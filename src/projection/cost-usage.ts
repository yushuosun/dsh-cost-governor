/**
 * `costUsage` projection unit: a pure, replay-safe fold of provider-reported
 * token usage into per-model raw buckets.
 *
 * The unit deliberately stores RAW token buckets only — never currency. Cost
 * is derived at view/query time by multiplying buckets against the active
 * price catalog, so a price-table update re-prices history without refolding
 * the durable log and the projection stays a plain-JSON fold that compaction
 * and cold reads cannot corrupt.
 *
 * @module dsh-cost-governor/projection
 */
import { z } from "zod";
import type { TokenUsage } from "@deepseek-ai/dsh-llm";
import type { SessionEvent } from "@deepseek-ai/dsh-session";
import type { ProjectionDefinition } from "@deepseek-ai/dsh-session-projection";

/** Disjoint billing buckets mirrored 1:1 from the harness `TokenUsage`. */
export interface TokenBuckets {
  /** Uncached input tokens. */
  input: number;
  /** Output (completion) tokens. */
  output: number;
  /** Cache-read tokens (billed separately by Anthropic-style providers). */
  cacheRead: number;
  /** Cache-write tokens. */
  cacheWrite: number;
  /** Reasoning tokens (a subdivision of output on reasoning models). */
  reasoning: number;
}

/** The projection's public view: raw buckets keyed by `provider/model`. */
export interface CostUsageView {
  byModel: Record<string, TokenBuckets>;
}

interface CostUsageState extends CostUsageView {
  /** `provider/model` of the in-flight step's request; null before the first. */
  currentModel: string | null;
}

/** Billed input = uncached input + cache reads + cache writes (buckets are disjoint). */
export function billedInputTokens(b: TokenBuckets): number {
  return b.input + b.cacheRead + b.cacheWrite;
}

export function totalOutputTokens(b: TokenBuckets): number {
  return b.output;
}

export function totalTokens(b: TokenBuckets): number {
  return billedInputTokens(b) + b.output;
}

export function emptyBuckets(): TokenBuckets {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 };
}

export function modelKey(provider: string, model: string): string {
  return `${provider}/${model}`;
}

/** Convert a provider `TokenUsage` sample into disjoint billing buckets. */
export function usageToBuckets(usage: TokenUsage): TokenBuckets {
  return {
    input: usage.inputTokens,
    output: usage.outputTokens,
    cacheRead: usage.cacheReadTokens ?? 0,
    cacheWrite: usage.cacheWriteTokens ?? 0,
    reasoning: usage.reasoningTokens ?? 0,
  };
}

function addUsage(prev: TokenBuckets, usage: TokenUsage): TokenBuckets {
  return {
    input: prev.input + usage.inputTokens,
    output: prev.output + usage.outputTokens,
    cacheRead: prev.cacheRead + (usage.cacheReadTokens ?? 0),
    cacheWrite: prev.cacheWrite + (usage.cacheWriteTokens ?? 0),
    reasoning: prev.reasoning + (usage.reasoningTokens ?? 0),
  };
}

const bucketsSchema = z
  .object({
    input: z.number().nonnegative(),
    output: z.number().nonnegative(),
    cacheRead: z.number().nonnegative(),
    cacheWrite: z.number().nonnegative(),
    reasoning: z.number().nonnegative(),
  })
  .strict();

const stateSchema = z
  .object({
    byModel: z.record(z.string(), bucketsSchema),
    currentModel: z.string().nullable(),
  })
  .strict();

/**
 * The registered projection unit.
 *
 * Model attribution: `request/context` carries `{ provider, model }` directly
 * (logged on route/capacity change) and `request/header` carries
 * `header.config.provider` / `header.config.model`. Both are logged before
 * dispatch, so by the time the matching `assistant/message` lands, the last
 * observed model is the one that produced the usage.
 *
 * Usage accounting: only the FINAL `assistant/message` sample is counted
 * (the harness docs state the step's usage travels with the assembled message;
 * the earlier `assistant/chunk` usage samples are stream-progress, so counting
 * both would double-charge). A cancelled/failed step therefore never lands a
 * sample here — its partial input spend is a documented limitation, not a
 * miscount.
 */
export const costUsageProjectionDefinition: ProjectionDefinition<
  "costUsage",
  CostUsageState
> = {
  key: "costUsage",
  schema: stateSchema,
  init: () => ({ byModel: {}, currentModel: null }),
  apply: (state, event: SessionEvent) => {
    switch (event.type) {
      case "request/context":
        return {
          ...state,
          currentModel: modelKey(event.data.provider, event.data.model),
        };
      case "request/header": {
        const cfg = event.data.header.config;
        return { ...state, currentModel: modelKey(cfg.provider, cfg.model) };
      }
      case "assistant/message": {
        const usage = event.data.usage;
        if (usage === undefined || state.currentModel === null) return state;
        const key = state.currentModel;
        const prev = state.byModel[key] ?? emptyBuckets();
        return {
          ...state,
          byModel: { ...state.byModel, [key]: addUsage(prev, usage) },
        };
      }
      default:
        return state;
    }
  },
  view: (state) => ({ byModel: state.byModel }),
  stateVersion: 1,
};

// Declaration merge: expose `costUsage` on the harness-wide projection table so
// the projection seam and client carriers type-check it end to end.
declare module "@deepseek-ai/dsh-session-projection/types" {
  interface SessionProjectionMap {
    costUsage: CostUsageView;
  }
}

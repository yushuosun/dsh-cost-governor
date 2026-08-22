/**
 * `costUsage` projection unit: a pure, replay-safe fold of provider-reported
 * token usage into per-model AND per-day raw buckets.
 *
 * The unit stores RAW token buckets only — never currency — so cost is derived
 * at view/query time against the active price catalog and a price-table edit
 * re-prices history without refolding the log. `byDay` (UTC `YYYY-MM-DD`) is
 * the durable input to the period budget; `byModel` is the per-session model
 * breakdown. Both survive compaction and cold reads because the fold is pure.
 *
 * @module dsh-cost-governor/projection
 */
import { z } from "zod";
import type { TokenUsage } from "@deepseek-ai/dsh-llm";
import type { SessionEvent } from "@deepseek-ai/dsh-session";
import type { ProjectionDefinition } from "@deepseek-ai/dsh-session-projection";

/** Disjoint billing buckets mirrored 1:1 from the harness `TokenUsage`. */
export interface TokenBuckets {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
}

/** Raw buckets keyed by `provider/model`. */
export type BucketMap = Record<string, TokenBuckets>;

/** Raw buckets keyed by day (`YYYY-MM-DD`) then by `provider/model`. */
export type DayBucketMap = Record<string, BucketMap>;

/** The projection's public view: raw buckets per model and per day. */
export interface CostUsageView {
  byModel: BucketMap;
  byDay: DayBucketMap;
}

interface CostUsageState extends CostUsageView {
  /** `provider/model` of the in-flight step's request; null before the first. */
  currentModel: string | null;
}

/** UTC `YYYY-MM-DD` (must match `dayKeyOf` in governor/budget.ts). */
export function dayKeyOf(timeMs: number): string {
  const d = new Date(timeMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

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

function addBuckets(a: TokenBuckets, b: TokenBuckets): TokenBuckets {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    reasoning: a.reasoning + b.reasoning,
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
    byDay: z.record(z.string(), z.record(z.string(), bucketsSchema)),
    currentModel: z.string().nullable(),
  })
  .strict();

function commit(
  state: CostUsageState,
  modelKey: string,
  buckets: TokenBuckets,
  dayKey: string,
): CostUsageState {
  const prevModel = state.byModel[modelKey] ?? emptyBuckets();
  const byModel = { ...state.byModel, [modelKey]: addBuckets(prevModel, buckets) };

  const dayMap = state.byDay[dayKey] ?? {};
  const prevDay = dayMap[modelKey] ?? emptyBuckets();
  const byDay = {
    ...state.byDay,
    [dayKey]: { ...dayMap, [modelKey]: addBuckets(prevDay, buckets) },
  };

  return { ...state, byModel, byDay };
}

/**
 * Model attribution: `request/context` (`{ provider, model }`) and
 * `request/header` (`header.config.provider/model`) are both logged before
 * dispatch, so by the time the matching `assistant/message` lands, the last
 * observed model is the one that produced the usage.
 *
 * Usage accounting: only the FINAL `assistant/message` sample is counted (the
 * step's usage travels with the assembled message). Failed/cancelled steps are
 * picked up by the `pending` early-sample path (see stateVersion 3), not here.
 */
export const costUsageProjectionDefinition: ProjectionDefinition<
  "costUsage",
  CostUsageState
> = {
  key: "costUsage",
  schema: stateSchema,
  init: () => ({ byModel: {}, byDay: {}, currentModel: null }),
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
        return commit(
          state,
          state.currentModel,
          usageToBuckets(usage),
          dayKeyOf(event.time),
        );
      }
      default:
        return state;
    }
  },
  view: (state) => ({ byModel: state.byModel, byDay: state.byDay }),
  stateVersion: 2,
};

// Declaration merge: expose `costUsage` on the harness-wide projection table so
// the projection seam and client carriers type-check it end to end.
declare module "@deepseek-ai/dsh-session-projection/types" {
  interface SessionProjectionMap {
    costUsage: CostUsageView;
  }
}

/**
 * In-memory cost ledger: the live hot path that accumulates raw token buckets
 * per session / per model / per day / per workspace, and derives USD cost on
 * demand from the active price catalog (so price edits re-price instantly).
 *
 * The ledger shares its fold logic with the `costUsage` projection (both call
 * the same pure `addUsage`), so live figures and the durable projection cannot
 * drift. The projection remains the replay/cold-read source of truth.
 *
 * @module dsh-cost-governor/governor
 */
import type { SessionId } from "@deepseek-ai/dsh-session";
import { emptyBuckets, type TokenBuckets } from "../projection/cost-usage";
import { computeViewCost, type PriceCatalog } from "../pricing/price";
import type { CostRollup, ModelAggregate } from "../types";

export interface BucketMap {
  [modelKey: string]: TokenBuckets;
}

function addBuckets(target: TokenBuckets, source: TokenBuckets): TokenBuckets {
  return {
    input: target.input + source.input,
    output: target.output + source.output,
    cacheRead: target.cacheRead + source.cacheRead,
    cacheWrite: target.cacheWrite + source.cacheWrite,
    reasoning: target.reasoning + source.reasoning,
  };
}

function addInto(map: BucketMap, key: string, buckets: TokenBuckets): void {
  const prev = map[key] ?? emptyBuckets();
  map[key] = addBuckets(prev, buckets);
}

/** Fold a bucket map into a rollup using the active catalog. */
export function rollup(
  map: BucketMap,
  catalog: PriceCatalog,
): CostRollup {
  const { total, perModel, unpriced } = computeViewCost(map, catalog);
  const aggregates: ModelAggregate[] = Object.entries(map)
    .map(([key, buckets]) => {
      const slash = key.indexOf("/");
      return {
        key,
        provider: slash < 0 ? "" : key.slice(0, slash),
        model: slash < 0 ? key : key.slice(slash + 1),
        buckets,
        costUsd: perModel[key] ?? 0,
        unpriced: perModel[key] === undefined ? [key] : [],
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd);

  let input = 0;
  let output = 0;
  let tokens = 0;
  for (const b of Object.values(map)) {
    input += b.input + b.cacheRead + b.cacheWrite;
    output += b.output;
    tokens += b.input + b.output + b.cacheRead + b.cacheWrite;
  }

  return {
    totalCostUsd: total,
    totalInputTokens: input,
    totalOutputTokens: output,
    totalTokens: tokens,
    byModel: aggregates,
    unpriced,
  };
}

export class CostLedger {
  private bySession = new Map<SessionId, BucketMap>();
  private byModel: BucketMap = {};
  private byDay = new Map<string, BucketMap>();
  private byWorkspace = new Map<string, BucketMap>();

  constructor(private readonly catalog: PriceCatalog) {}

  /** Record one final usage sample attributed to a model key. */
  record(
    sessionId: SessionId,
    modelKey: string,
    buckets: TokenBuckets,
    dayKey: string,
    workspaceKey: string,
  ): void {
    addInto((this.bySession.get(sessionId) ??= {}), modelKey, buckets);
    addInto(this.byModel, modelKey, buckets);
    addInto((this.byDay.get(dayKey) ??= {}), modelKey, buckets);
    addInto((this.byWorkspace.get(workspaceKey) ??= {}), modelKey, buckets);
  }

  sessionRollup(sessionId: SessionId): CostRollup {
    return rollup(this.bySession.get(sessionId) ?? {}, this.catalog);
  }

  globalRollup(): CostRollup {
    return rollup(this.byModel, this.catalog);
  }

  periodRollup(dayKey: string): CostRollup {
    return rollup(this.byDay.get(dayKey) ?? {}, this.catalog);
  }

  workspaceRollup(workspaceKey: string): CostRollup {
    return rollup(this.byWorkspace.get(workspaceKey) ?? {}, this.catalog);
  }

  /** Sum of cost over a set of period keys (e.g. every day in the current month). */
  spendAcross(dayKeys: string[]): number {
    let total = 0;
    for (const key of dayKeys) {
      total += computeViewCost(this.byDay.get(key) ?? {}, this.catalog).total;
    }
    return total;
  }

  /** All day keys, sorted ascending. */
  dayKeys(): string[] {
    return [...this.byDay.keys()].sort();
  }

  /** CSV export of the per-model global rollup. */
  exportCsv(): string {
    const r = this.globalRollup();
    const header = "provider,model,input_tokens,output_tokens,cache_read,cache_write,reasoning,cost_usd";
    const rows = r.byModel.map((m) =>
      [
        m.provider,
        m.model,
        m.buckets.input,
        m.buckets.output,
        m.buckets.cacheRead,
        m.buckets.cacheWrite,
        m.buckets.reasoning,
        m.costUsd.toFixed(4),
      ].join(","),
    );
    return [header, ...rows].join("\n");
  }
}

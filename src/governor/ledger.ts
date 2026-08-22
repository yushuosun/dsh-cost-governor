/**
 * Cost ledger — a DERIVED aggregate over the `costUsage` projection.
 *
 * The ledger holds one contribution per live session (its `byModel`/`byDay`
 * view + workspace key), set wholesale from the projection change feed and
 * seeded on cold start. Every rollup is computed on demand by summing those
 * contributions against the active price catalog, so there is exactly one
 * source of truth (the projection) and no parallel fold to drift.
 *
 * @module dsh-cost-governor/governor
 */
import type { SessionId } from "@deepseek-ai/dsh-session";
import {
  emptyBuckets,
  type BucketMap,
  type CostUsageView,
  type DayBucketMap,
} from "../projection/cost-usage.js";
import { computeViewCost, type PriceCatalog } from "../pricing/price.js";
import type { CostRollup, ModelAggregate } from "../types.js";

interface SessionContribution {
  workspaceKey: string;
  byModel: BucketMap;
  byDay: DayBucketMap;
}

function addInto(target: BucketMap, source: BucketMap): void {
  for (const [key, buckets] of Object.entries(source)) {
    const prev = target[key] ?? emptyBuckets();
    target[key] = {
      input: prev.input + buckets.input,
      output: prev.output + buckets.output,
      cacheRead: prev.cacheRead + buckets.cacheRead,
      cacheWrite: prev.cacheWrite + buckets.cacheWrite,
      reasoning: prev.reasoning + buckets.reasoning,
    };
  }
}

/** Fold a bucket map into a rollup using the active catalog. */
function rollup(map: BucketMap, catalog: PriceCatalog): CostRollup {
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
  private sessions = new Map<SessionId, SessionContribution>();

  constructor(private readonly catalog: PriceCatalog) {}

  /** Replace one session's whole contribution (projection view + workspace). */
  setSession(sessionId: SessionId, workspaceKey: string, view: CostUsageView): void {
    this.sessions.set(sessionId, {
      workspaceKey,
      byModel: view.byModel,
      byDay: view.byDay,
    });
  }

  /** Drop a session that left the store. */
  removeSession(sessionId: SessionId): void {
    this.sessions.delete(sessionId);
  }

  private byModelTotal(): BucketMap {
    const total: BucketMap = {};
    for (const s of this.sessions.values()) addInto(total, s.byModel);
    return total;
  }

  private byDayTotal(): DayBucketMap {
    const total: DayBucketMap = {};
    for (const s of this.sessions.values()) {
      for (const [day, map] of Object.entries(s.byDay)) {
        const t = (total[day] ??= {});
        addInto(t, map);
      }
    }
    return total;
  }

  sessionRollup(sessionId: SessionId): CostRollup {
    const s = this.sessions.get(sessionId);
    return rollup(s?.byModel ?? {}, this.catalog);
  }

  globalRollup(): CostRollup {
    return rollup(this.byModelTotal(), this.catalog);
  }

  /** Sum of cost over the given day keys (the current budget period). */
  spendAcross(dayKeys: string[]): number {
    const byDay = this.byDayTotal();
    let total = 0;
    for (const key of dayKeys) {
      total += computeViewCost(byDay[key] ?? {}, this.catalog).total;
    }
    return total;
  }

  workspaceRollup(workspaceKey: string): CostRollup {
    const map: BucketMap = {};
    for (const s of this.sessions.values()) {
      if (s.workspaceKey === workspaceKey) addInto(map, s.byModel);
    }
    return rollup(map, this.catalog);
  }

  /** All day keys across every session, sorted ascending. */
  dayKeys(): string[] {
    return Object.keys(this.byDayTotal()).sort();
  }

  /** CSV export of the global per-model rollup. */
  exportCsv(): string {
    const r = this.globalRollup();
    const header =
      "provider,model,input_tokens,output_tokens,cache_read,cache_write,reasoning,cost_usd";
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

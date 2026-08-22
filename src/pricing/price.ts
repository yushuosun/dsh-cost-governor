/**
 * Pure pricing math: raw token buckets × a per-model price → USD.
 * No side effects, no config reads — the single choke point every consumer
 * (host service, client dashboard, CSV export) shares so numbers always agree.
 *
 * @module dsh-cost-governor/pricing
 */
import type { TokenBuckets } from "../projection/cost-usage.js";
import { billedInputTokens } from "../projection/cost-usage.js";

/** Per-1M-token USD price for one provider/model route. */
export interface ModelPrice {
  /** USD per 1M uncached input tokens. */
  inputPerM: number;
  /** USD per 1M output tokens. */
  outputPerM: number;
  /** USD per 1M cache-read tokens. */
  cacheReadPerM: number;
  /** USD per 1M cache-write tokens. */
  cacheWritePerM: number;
  /** Optional USD per 1M reasoning tokens; falls back to `outputPerM`. */
  reasoningPerM?: number;
}

/** `provider/model` → price. */
export type PriceCatalog = Record<string, ModelPrice>;

const MILLION = 1_000_000;

/** Cost of one model's buckets under one price entry, in USD. */
export function computeCost(buckets: TokenBuckets, price: ModelPrice): number {
  const reasoningRate = price.reasoningPerM ?? price.outputPerM;
  return (
    (buckets.input / MILLION) * price.inputPerM +
    (buckets.output / MILLION) * price.outputPerM +
    (buckets.cacheRead / MILLION) * price.cacheReadPerM +
    (buckets.cacheWrite / MILLION) * price.cacheWritePerM +
    (buckets.reasoning / MILLION) * reasoningRate
  );
}

/** Cost of a whole per-model view under a catalog; unknown models price at zero (flagged by caller). */
export function computeViewCost(
  byModel: Record<string, TokenBuckets>,
  catalog: PriceCatalog,
): { total: number; perModel: Record<string, number>; unpriced: string[] } {
  let total = 0;
  const perModel: Record<string, number> = {};
  const unpriced: string[] = [];
  for (const [key, buckets] of Object.entries(byModel)) {
    const price = catalog[key];
    if (price === undefined) {
      unpriced.push(key);
      continue;
    }
    const cost = computeCost(buckets, price);
    perModel[key] = cost;
    total += cost;
  }
  return { total, perModel, unpriced };
}

/** Round to a display-safe cents value (2 decimals, no float dust). */
export function roundUsd(usd: number): number {
  return Math.round((usd + Number.EPSILON) * 100) / 100;
}

/** Total tokens across buckets — used for the "efficiency" stat line. */
export function totalTokens(buckets: TokenBuckets): number {
  return billedInputTokens(buckets) + buckets.output;
}

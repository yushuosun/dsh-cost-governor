/**
 * Public vocabulary of dsh-cost-governor: config, budget, and aggregate types.
 * Pure types only — no cordis context or runtime imports — so both host and
 * client faces import from one home without dragging host-side deps.
 *
 * @module dsh-cost-governor/types
 */

export type BudgetPeriod = "daily" | "weekly" | "monthly" | "unlimited";

export type HardAction =
  | "notify-only"
  | "block-new-requests"
  | "steer-to-cheaper-model";

export interface BudgetConfig {
  period: BudgetPeriod;
  budgetUsd: number;
  /** Soft-warn threshold as a ratio of `budgetUsd` (0.8 → warn at 80%). */
  warnRatio: number;
  /** Hard-ceiling ratio (1.0 → ceiling at 100%). */
  hardRatio: number;
  hardAction: HardAction;
}

/** One model's aggregate over a scope (a session, a day, a workspace, ...). */
export interface ModelAggregate {
  key: string;
  provider: string;
  model: string;
  buckets: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    reasoning: number;
  };
  costUsd: number;
  /** Keys in the aggregate whose price was missing at compute time. */
  unpriced: string[];
}

/** A whole-scope rollup. */
export interface CostRollup {
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  byModel: ModelAggregate[];
  unpriced: string[];
}

export interface BudgetStatus {
  period: BudgetPeriod;
  budgetUsd: number;
  spentUsd: number;
  remainingUsd: number;
  /** 0..∞ — spent / budget. */
  ratio: number;
  state: "ok" | "warn" | "over";
  hardAction: HardAction;
  blocked: boolean;
}

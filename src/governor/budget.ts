/**
 * Budget governance: pure status math + a threshold-crossing governor.
 *
 * The governor is deliberately side-effect-light and testable: it computes a
 * `BudgetStatus` from (spent, config) and emits cordis events when the state
 * crosses a warn/hard boundary. Enforcement (blocking new requests / steering
 * to a cheaper model) is exposed as a decision method for the LLM waterfall to
 * consult, so the policy logic stays in one place and the wiring point stays
 * swappable.
 *
 * @module dsh-cost-governor/governor
 */
import type { Context } from "@deepseek-ai/cordis";
import type { BudgetConfig, BudgetStatus, HardAction } from "../types.js";

/** Declared cordis events this plugin emits (consumed by UI and notifiers). */
declare module "@deepseek-ai/cordis" {
  interface Events {
    /** Emitted whenever the budget state for the active period changes. */
    "usage-cost/budget-status"(status: BudgetStatus): void;
    /** Emitted on the first crossing into `warn`. */
    "usage-cost/budget-warn"(status: BudgetStatus): void;
    /** Emitted on the first crossing into `over`. */
    "usage-cost/budget-over"(status: BudgetStatus): void;
  }
}

export function periodKeyOf(
  period: BudgetConfig["period"],
  timeMs: number,
): string {
  const d = new Date(timeMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  switch (period) {
    case "daily":
      return `${y}-${m}-${day}`;
    case "weekly": {
      // ISO week key: first Thursday of the year anchors week numbering.
      const t = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()));
      const dayOfWeek = (t.getUTCDay() + 6) % 7; // Mon=0
      t.setUTCDate(t.getUTCDate() - dayOfWeek + 3);
      const thursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
      const week =
        1 +
        Math.round(
          (t.getTime() - thursday.getTime()) / (7 * 24 * 3600 * 1000),
        );
      return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
    }
    case "monthly":
      return `${y}-${m}`;
    case "unlimited":
      return "all";
  }
}

export function computeBudgetStatus(
  spentUsd: number,
  budgetUsd: number,
  config: BudgetConfig,
): BudgetStatus {
  const budget = budgetUsd;
  const spent = spentUsd;
  const remaining = budget - spent;
  const ratio = budget <= 0 ? 0 : spent / budget;
  const hard = budget * config.hardRatio;
  const warn = budget * config.warnRatio;
  const state: BudgetStatus["state"] =
    spent >= hard ? "over" : spent >= warn ? "warn" : "ok";
  const blocked = config.hardAction !== "notify-only" && state === "over";
  return {
    period: config.period,
    budgetUsd: budget,
    spentUsd: spent,
    remainingUsd: remaining,
    ratio,
    state,
    hardAction: config.hardAction,
    blocked,
  };
}

export class BudgetGovernor {
  private lastState: BudgetStatus["state"] = "ok";

  constructor(
    private readonly ctx: Context,
    private readonly config: BudgetConfig,
  ) {}

  /** Recompute from a fresh spend figure; emits events only on transitions. */
  update(spentUsd: number): BudgetStatus {
    const status = computeBudgetStatus(spentUsd, this.config.budgetUsd, this.config);
    this.ctx.emit("usage-cost/budget-status", status);
    if (status.state === "warn" && this.lastState === "ok") {
      this.ctx.emit("usage-cost/budget-warn", status);
    }
    if (status.state === "over" && this.lastState !== "over") {
      this.ctx.emit("usage-cost/budget-over", status);
    }
    this.lastState = status.state;
    return status;
  }

  /** Enforcement decision for the request waterfall to consult. */
  gate(status: BudgetStatus): { allow: boolean; reason?: string } {
    if (!status.blocked) return { allow: true };
    switch (status.hardAction as HardAction) {
      case "block-new-requests":
        return {
          allow: false,
          reason: `budget exhausted: spent $${status.spentUsd.toFixed(
            2,
          )} of $${status.budgetUsd.toFixed(2)}`,
        };
      case "steer-to-cheaper-model":
        // Allow, but the waterfall should re-route to a cheaper equivalent.
        return { allow: true };
      default:
        return { allow: true };
    }
  }
}

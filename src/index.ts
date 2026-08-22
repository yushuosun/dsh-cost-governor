/**
 * dsh-cost-governor — cost governance & budget enforcement for DeepSeek Harness.
 *
 * Registers the `costUsage` projection (raw per-model + per-day token buckets)
 * and derives a cost ledger from it: the service seeds from every live session
 * on boot, then follows the projection change feed, so figures survive a
 * restart and never drift from the durable fold.
 *
 * @module dsh-cost-governor
 */
import { Service, type Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import type { SessionId } from "@deepseek-ai/dsh-session";
import {
  costUsageProjectionDefinition,
  type CostUsageView,
} from "./projection/cost-usage.js";
import { DEFAULT_PRICE_CATALOG } from "./pricing/catalog.js";
import type { ModelPrice } from "./pricing/price.js";
import { CostLedger } from "./governor/ledger.js";
import { BudgetGovernor, periodKeyOf } from "./governor/budget.js";
import { Notifier } from "./governor/notify.js";
import type { BudgetConfig, BudgetStatus } from "./types.js";

export const name = "cost-governor";

const priceSchema = z.object({
  inputPerM: z.number().min(0).required(),
  outputPerM: z.number().min(0).required(),
  cacheReadPerM: z.number().min(0).required(),
  cacheWritePerM: z.number().min(0).required(),
  reasoningPerM: z.number().min(0),
});

const budgetSchema = z.object({
  period: z
    .union([z.const("daily"), z.const("weekly"), z.const("monthly"), z.const("unlimited")])
    .default("monthly"),
  budgetUsd: z.number().min(0).default(20),
  warnRatio: z.number().min(0).max(2).default(0.8),
  hardRatio: z.number().min(0).max(2).default(1.0),
  hardAction: z
    .union([
      z.const("notify-only"),
      z.const("block-new-requests"),
      z.const("steer-to-cheaper-model"),
    ])
    .default("notify-only"),
});

/** Static cordis.yml config schema (schemastery). */
export const Config = z.object({
  currency: z.string().default("USD"),
  budget: budgetSchema.default({
    period: "monthly",
    budgetUsd: 20,
    warnRatio: 0.8,
    hardRatio: 1.0,
    hardAction: "notify-only",
  }),
  notifyWebhook: z.string(),
  priceCatalog: z.dict(priceSchema),
});

/** Validated config shape received by the service. */
export interface CostGovernorConfig {
  currency: string;
  budget: BudgetConfig;
  notifyWebhook?: string;
  priceCatalog?: Record<string, ModelPrice>;
}

export class CostGovernor extends Service {
  static inject = ["sessionProjections", "sessions"];
  static Config = Config;

  private readonly config: CostGovernorConfig;
  private readonly ledger: CostLedger;
  private readonly governor: BudgetGovernor;
  private readonly notifier: Notifier;
  private latestStatus: BudgetStatus | null = null;

  constructor(ctx: Context, config: CostGovernorConfig) {
    super(ctx, "usageCost");
    this.config = config;
    const catalog = { ...DEFAULT_PRICE_CATALOG, ...(config.priceCatalog ?? {}) };
    this.ledger = new CostLedger(catalog);
    this.governor = new BudgetGovernor(ctx, config.budget);
    this.notifier = new Notifier(config.notifyWebhook);
  }

  async [Service.init]() {
    // Durable projection (removed automatically on unload).
    this.ctx.sessionProjections.register(costUsageProjectionDefinition);

    // Cold-start seed: every live session's already-folded view.
    for (const session of this.ctx.sessions.list()) {
      const view = this.ctx.sessionProjections.snapshot(session).values
        .costUsage as CostUsageView | undefined;
      if (view) this.adopt(session.id, session.header.cwd ?? "default", view);
    }

    // Live feed: replace a session's contribution whenever its fold changes.
    this.ctx.sessionProjections.onChanged((session, key, value) => {
      if (key !== "costUsage") return;
      this.adopt(session.id, session.header.cwd ?? "default", value as CostUsageView);
    });

    // Notify on threshold crossings (fail-soft, fire-and-forget).
    this.ctx.on("usage-cost/budget-warn", (s) => void this.notifier.notify(s, "warn"));
    this.ctx.on("usage-cost/budget-over", (s) => void this.notifier.notify(s, "over"));
  }

  private adopt(sessionId: SessionId, workspaceKey: string, view: CostUsageView): void {
    this.ledger.setSession(sessionId, workspaceKey, view);
    this.latestStatus = this.governor.update(this.currentPeriodSpend());
  }

  /** Sum cost over every ledger day that falls in the current budget period. */
  private currentPeriodSpend(): number {
    const period = this.config.budget.period;
    const nowKey = periodKeyOf(period, Date.now());
    const days = this.ledger
      .dayKeys()
      .filter((d) => periodKeyOf(period, Date.parse(`${d}T00:00:00Z`)) === nowKey);
    return this.ledger.spendAcross(days);
  }

  // ── Public service surface (host consumers; a client Remote wraps these) ──
  budgetStatus(): BudgetStatus | null {
    return this.latestStatus;
  }

  globalRollup() {
    return this.ledger.globalRollup();
  }

  sessionRollup(sessionId: SessionId) {
    return this.ledger.sessionRollup(sessionId);
  }

  exportCsv(): string {
    return this.ledger.exportCsv();
  }
}

export default CostGovernor;

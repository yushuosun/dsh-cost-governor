/**
 * dsh-cost-governor — cost governance & budget enforcement for DeepSeek Harness.
 *
 * Registers the `costUsage` projection (raw per-model token buckets) and runs a
 * live ledger that prices those buckets against a multi-provider catalog,
 * enforces a period budget with soft/hard thresholds, and emits budget events.
 *
 * @module dsh-cost-governor
 */
import { Service, type Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import type { SessionEvent, SessionId } from "@deepseek-ai/dsh-session";
import {
  costUsageProjectionDefinition,
  modelKey,
  usageToBuckets,
} from "./projection/cost-usage";
import { DEFAULT_PRICE_CATALOG } from "./pricing/catalog";
import type { ModelPrice } from "./pricing/price";
import { CostLedger } from "./governor/ledger";
import { BudgetGovernor, dayKeyOf, periodKeyOf } from "./governor/budget";
import { Notifier } from "./governor/notify";
import type { BudgetConfig, BudgetStatus } from "./types";

export const name = "cost-governor";

/** Minimal structural view of a live session, avoiding a hard `Session` import. */
interface SessionShape {
  id: SessionId;
  header?: { cwd?: string };
}

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
  static inject = ["sessionProjections"];
  static Config = Config;

  private readonly config: CostGovernorConfig;
  private readonly ledger: CostLedger;
  private readonly governor: BudgetGovernor;
  private readonly notifier: Notifier;
  private readonly currentModelBySession = new Map<SessionId, string>();
  private latestStatus: BudgetStatus | null = null;

  constructor(ctx: Context, config: CostGovernorConfig) {
    super(ctx, "usageCost");
    this.config = config;
    // Merge user overrides over the built-in catalog (no schema default, so a
    // partial catalog only replaces the models the user names).
    const catalog = { ...DEFAULT_PRICE_CATALOG, ...(config.priceCatalog ?? {}) };
    this.ledger = new CostLedger(catalog);
    this.governor = new BudgetGovernor(ctx, config.budget);
    this.notifier = new Notifier(config.notifyWebhook);
  }

  async [Service.init]() {
    // Register the durable projection (removed automatically on unload).
    this.ctx.sessionProjections.register(costUsageProjectionDefinition);

    // Live hot path: fold the same events the projection folds.
    this.ctx.on("session/event", (session, event) =>
      this.onEvent(session as SessionShape, event),
    );

    // Notify on threshold crossings (fail-soft, fire-and-forget).
    this.ctx.on("usage-cost/budget-warn", (s) => void this.notifier.notify(s, "warn"));
    this.ctx.on("usage-cost/budget-over", (s) => void this.notifier.notify(s, "over"));

    this.ctx.effect(() => () => this.currentModelBySession.clear(), "cost-governor.cleanup");
  }

  private onEvent(session: SessionShape, event: SessionEvent): void {
    switch (event.type) {
      case "request/context":
        this.currentModelBySession.set(
          session.id,
          modelKey(event.data.provider, event.data.model),
        );
        break;
      case "request/header": {
        const cfg = event.data.header.config;
        this.currentModelBySession.set(session.id, modelKey(cfg.provider, cfg.model));
        break;
      }
      case "assistant/message": {
        const usage = event.data.usage;
        const mk = this.currentModelBySession.get(session.id);
        if (usage === undefined || mk === undefined) break;
        const workspaceKey = session.header?.cwd ?? "default";
        this.ledger.record(
          session.id,
          mk,
          usageToBuckets(usage),
          dayKeyOf(event.time),
          workspaceKey,
        );
        this.latestStatus = this.governor.update(this.currentPeriodSpend());
        break;
      }
      default:
        break;
    }
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

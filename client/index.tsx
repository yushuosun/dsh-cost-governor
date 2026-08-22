/**
 * Client entry — registers the "Usage & Cost" settings section and a budget HUD
 * slot, and wires live data from the `costUsage` projection stream + settings
 * scope into the presentational components.
 *
 * Slot registration follows the confirmed DSH contract:
 *   `ctx.slots.register({ name, id, order, locale, inject }, Component)`
 * returns an unregister function (disposal rides the caller's fiber).
 *
 * NOTE ON WIRING: the exact projection/settings read hooks a settings section
 * receives are injected through `inject` (cf. `PropsRuntime`/`PropsLocale` in
 * `@deepseek-ai/dsh-client-ui-slots`). The container below documents the shape;
 * the two hook names (`useProjection`, `useSettingsScope`) are the integration
 * points to confirm against the official client-plugin docs before first build.
 *
 * @module dsh-cost-governor/client
 */
import { useEffect, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { Hud } from "./components/Hud";
import { BudgetEditor } from "./components/BudgetEditor";
import { PriceEditor } from "./components/PriceEditor";
import type { BudgetConfig, BudgetStatus, CostRollup } from "../src/types";

export const name = "cost-governor-client";

// ── Minimal injected-runtime contracts (documented; verify against dsh docs) ──
interface ProjectionSource {
  /** Returns the live `costUsage` view for a session (or null). */
  useCostUsage: () => { byModel: Record<string, unknown> } | null;
}
interface SettingsSource {
  /** Returns budget config + price catalog from the settings namespace. */
  useGovernorSettings: () => {
    budget: BudgetConfig;
    priceCatalog: Record<string, unknown>;
    currency: string;
  };
}

export interface DashboardContainerProps {
  close: () => void;
  projection?: ProjectionSource;
  settings?: SettingsSource;
}

/** Demo data so the section renders meaningfully before live data is wired. */
function demoRollup(): CostRollup {
  return {
    totalCostUsd: 3.42,
    totalInputTokens: 482_000,
    totalOutputTokens: 96_400,
    totalTokens: 578_400,
    byModel: [
      { key: "deepseek/deepseek-chat", provider: "deepseek", model: "deepseek-chat", buckets: { input: 400_000, output: 80_000, cacheRead: 12_000, cacheWrite: 0, reasoning: 0 }, costUsd: 2.19, unpriced: [] },
      { key: "anthropic/claude-3-7-sonnet", provider: "anthropic", model: "claude-3-7-sonnet", buckets: { input: 60_000, output: 12_000, cacheRead: 10_000, cacheWrite: 0, reasoning: 4_400 }, costUsd: 1.23, unpriced: [] },
    ],
    unpriced: [],
  };
}

export function DashboardContainer(props: DashboardContainerProps) {
  const [rollup] = useState<CostRollup | null>(demoRollup());
  const [status, setStatus] = useState<BudgetStatus | null>({
    period: "monthly", budgetUsd: 20, spentUsd: 3.42, remainingUsd: 16.58,
    ratio: 0.171, state: "ok", hardAction: "notify-only", blocked: false,
  });
  const [view, setView] = useState<"dashboard" | "budget" | "prices">("dashboard");

  // Live wiring (integration point): replace demo state with projection + settings.
  useEffect(() => {
    const usage = props.projection?.useCostUsage?.();
    if (usage && Object.keys(usage.byModel).length > 0) {
      // Convert the raw projection view into a CostRollup here.
    }
    const s = props.settings?.useGovernorSettings?.();
    if (s) {
      // setStatus(compute from s.budget + current spend)
    }
  }, [props.projection, props.settings]);

  if (view === "budget") {
    return (
      <BudgetEditor
        value={status ? { period: status.period, budgetUsd: status.budgetUsd, warnRatio: 0.8, hardRatio: 1.0, hardAction: status.hardAction } : { period: "monthly", budgetUsd: 20, warnRatio: 0.8, hardRatio: 1.0, hardAction: "notify-only" }}
        onSave={(next) => { setStatus((s) => s && { ...s, budgetUsd: next.budgetUsd, period: next.period }); setView("dashboard"); }}
        onCancel={() => setView("dashboard")}
      />
    );
  }
  if (view === "prices") {
    return (
      <PriceEditor
        catalog={{}}
        onSave={() => setView("dashboard")}
        onCancel={() => setView("dashboard")}
      />
    );
  }

  return (
    <Dashboard
      status={status}
      rollup={rollup}
      daily={[
        { day: "2026-08-10", costUsd: 0.4 },
        { day: "2026-08-11", costUsd: 0.9 },
        { day: "2026-08-12", costUsd: 0.6 },
        { day: "2026-08-13", costUsd: 1.52 },
      ]}
      onOpenBudget={() => setView("budget")}
      onOpenPrices={() => setView("prices")}
      tip="deepseek-chat is 8.2× cheaper per token than claude-3-7-sonnet for this workload."
    />
  );
}

/** The settings-section registrant (confirm the exact `render`/locale wiring on first build). */
export const settingsSectionEntry = {
  name: "cost-governor.settings-section",
  inject: ["slots"],
  apply(ctx: any) {
    const unregister = ctx.slots.register(
      {
        name: "settings.section",
        id: "usage-cost",
        order: 100,
        locale: "costGovernor.section",
      },
      DashboardContainer,
    );
    ctx.effect(() => unregister, "cost-governor.settings-section.dispose");
  },
};

/** The HUD registrant — a rail/corner budget ring. */
export const hudEntry = {
  name: "cost-governor.hud",
  inject: ["slots"],
  apply(ctx: any) {
    const unregister = ctx.slots.register(
      { name: "settings.action", id: "usage-cost-hud", order: 0 },
      Hud,
    );
    ctx.effect(() => unregister, "cost-governor.hud.dispose");
  },
};

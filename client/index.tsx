/**
 * Client entry — registers the "Usage & Cost" settings section and a budget
 * HUD, and wires live data into the presentational components.
 *
 * Data sources (confirmed against the DSH client runtime):
 * - `useProjection('costUsage')` — the CURRENT session's folded raw buckets
 *   (session-scoped standard kit; `undefined` = capability absent). The
 *   per-session cost is derived client-side with the same `computeViewCost`
 *   the host uses, so host and client never disagree.
 * - The GLOBAL cross-session rollup and budget status live on the host
 *   `usageCost` service and must be exposed as a Typert Remote — the one
 *   remaining web-build integration (see PUBLISHING.md §4). Until then the
 *   dashboard shows the current session's spend; the budget ring needs the
 *   Remote.
 *
 * Slot registration follows the confirmed contract:
 *   `ctx.slots.register({ name, id, order, locale, inject }, Component)`.
 *
 * @module dsh-cost-governor/client
 */
import { useEffect } from "react";
import { Dashboard } from "./components/Dashboard";
import { Hud } from "./components/Hud";
import { BudgetEditor } from "./components/BudgetEditor";
import { PriceEditor } from "./components/PriceEditor";
import { computeViewCost } from "../src/pricing/price.js";
import type { CostUsageView } from "../src/projection/cost-usage.js";
import type { UseProjection } from "@deepseek-ai/dsh-client-runtime/client";
import type { BudgetStatus, CostRollup } from "../src/types.js";

export const name = "cost-governor-client";

/** A session-scoped slot's injected projection reader. */
export interface DashboardContainerProps {
  close: () => void;
  /** Current-session projection reader (session standard kit). */
  useProjection?: UseProjection;
  /** Global budget status — supplied by the host Remote once wired. */
  budgetStatus?: BudgetStatus | null;
  currency?: string;
}

/** Derive a per-session cost rollup from the folded `costUsage` view. */
function rollupFromView(view: CostUsageView | undefined): CostRollup | null {
  if (!view || Object.keys(view.byModel).length === 0) return null;
  const { total, perModel } = computeViewCost(view.byModel, {});
  // NOTE: the client has no price catalog; a real client passes the host's
  // catalog through the settings scope. With an empty catalog every model is
  // "unpriced", so this fallback shows tokens and a zero cost until wired.
  let input = 0;
  let output = 0;
  let tokens = 0;
  for (const b of Object.values(view.byModel)) {
    input += b.input + b.cacheRead + b.cacheWrite;
    output += b.output;
    tokens += b.input + b.output + b.cacheRead + b.cacheWrite;
  }
  return {
    totalCostUsd: total,
    totalInputTokens: input,
    totalOutputTokens: output,
    totalTokens: tokens,
    byModel: Object.entries(view.byModel).map(([key, buckets]) => {
      const slash = key.indexOf("/");
      return {
        key,
        provider: slash < 0 ? "" : key.slice(0, slash),
        model: slash < 0 ? key : key.slice(slash + 1),
        buckets,
        costUsd: perModel[key] ?? 0,
        unpriced: perModel[key] === undefined ? [key] : [],
      };
    }),
    unpriced: Object.keys(view.byModel),
  };
}

export function DashboardContainer(props: DashboardContainerProps) {
  const { useProjection, budgetStatus, currency = "USD", close } = props;
  const costUsage = useProjection?.("costUsage") as CostUsageView | undefined;
  const rollup = rollupFromView(costUsage);

  // Global budget/rollup arrive via the host Remote; fall back to null until then.
  return (
    <Dashboard
      status={budgetStatus ?? null}
      rollup={rollup}
      daily={[]}
      currency={currency}
      onOpenBudget={() => {}}
      onOpenPrices={() => {}}
      tip={rollup ? "Current-session spend. Global budget arrives once the host Remote is wired." : "Send a message in a session to start measuring its cost."}
    />
  );
}

/** Settings-section registrant (confirm the exact `render`/locale wiring on first build). */
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

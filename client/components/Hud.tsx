/**
 * Compact budget HUD — a corner/rail indicator showing the period budget ring
 * and the current session's spend. Sized to live in a 56px rail or a corner.
 *
 * @module dsh-cost-governor/client/components/Hud
 */
import { useEffect } from "react";
import { injectLedgerStyles } from "../theme";
import { formatUsd } from "../format";
import type { BudgetStatus } from "../../src/types";

export interface HudProps {
  status: BudgetStatus | null;
  sessionCostUsd?: number;
  currency?: string;
}

export function Hud({ status, sessionCostUsd = 0, currency = "USD" }: HudProps) {
  useEffect(() => injectLedgerStyles(), []);

  const ratio = Math.min(1, status?.ratio ?? 0);
  const r = 16;
  const c = 2 * Math.PI * r;
  const tone = status?.state === "over" ? "var(--cg-danger)" : status?.state === "warn" ? "var(--cg-amber)" : "var(--cg-accent)";

  return (
    <div className="cg-hud" title={`Budget: ${formatUsd(status?.spentUsd ?? 0, currency)} / ${formatUsd(status?.budgetUsd ?? 0, currency)}`}>
      <svg width="40" height="40" viewBox="0 0 40 40" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--cg-line-soft)" strokeWidth="4" />
        <circle
          cx="20" cy="20" r={r} fill="none"
          stroke={tone} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - ratio)}
          style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="cg-hud__meta">
        <span className="cg-hud__pct">{(ratio * 100).toFixed(0)}%</span>
        <span className="cg-hud__usd">{formatUsd(sessionCostUsd, currency)}</span>
      </div>
    </div>
  );
}

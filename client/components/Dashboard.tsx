/**
 * Presentational cost dashboard — the full "Usage & Cost" settings page.
 * Pure and props-driven: a container (client/index.ts) feeds it live data from
 * the `costUsage` projection stream and the settings scope.
 *
 * @module dsh-cost-governor/client/components/Dashboard
 */
import { useEffect, useState } from "react";
import { injectLedgerStyles } from "../theme";
import { formatPercent, formatTokens, formatUsd } from "../format";
import type { BudgetPeriod, BudgetStatus, CostRollup } from "../../src/types";

export interface DayPoint {
  day: string;
  costUsd: number;
}

export interface DashboardProps {
  status: BudgetStatus | null;
  rollup: CostRollup | null;
  daily: DayPoint[];
  currency?: string;
  tip?: string;
  onPeriodChange?: (period: BudgetPeriod) => void;
  onExportCsv?: () => void;
  onOpenBudget?: () => void;
  onOpenPrices?: () => void;
}

const PERIODS: BudgetPeriod[] = ["daily", "weekly", "monthly", "unlimited"];

function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function Kpi({
  label,
  value,
  sub,
  tone,
  delay,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warn" | "over";
  delay: number;
}) {
  return (
    <div className={`cg-kpi cg-rise${tone ? ` cg-kpi--${tone}` : ""}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="cg-kpi__label">{label}</div>
      <div className="cg-kpi__value">{value}</div>
      {sub && <div className="cg-kpi__delta">{sub}</div>}
    </div>
  );
}

export function Dashboard(props: DashboardProps) {
  const { status, rollup, daily, currency = "USD", tip, onPeriodChange, onExportCsv, onOpenBudget, onOpenPrices } = props;
  useEffect(() => injectLedgerStyles(), []);

  const spent = useCountUp(status?.spentUsd ?? 0);
  const budget = status?.budgetUsd ?? 0;
  const remaining = budget - (status?.spentUsd ?? 0);
  const ratio = status?.ratio ?? 0;
  const efficiency = rollup && rollup.totalTokens > 0 ? (rollup.totalCostUsd / rollup.totalTokens) * 1000 : 0;
  const maxDay = daily.length > 0 ? Math.max(...daily.map((d) => d.costUsd), 0.0001) : 1;

  const stateTone = status?.state === "over" ? "over" : status?.state === "warn" ? "warn" : undefined;

  return (
    <div className="cg-root">
      <div className="cg-header">
        <div>
          <p className="cg-eyebrow">Usage &amp; Cost</p>
          <h2 className="cg-title">Cost Governance</h2>
          <p className="cg-subtitle">Multi-provider spend, budget enforcement, and trends.</p>
        </div>
        <div className="cg-actions">
          <div className="cg-seg" role="tablist" aria-label="Budget period">
            {PERIODS.map((p) => (
              <button
                key={p}
                role="tab"
                data-on={status?.period === p}
                onClick={() => onPeriodChange?.(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="cg-btn" onClick={onOpenBudget}>Budget</button>
          <button className="cg-btn" onClick={onOpenPrices}>Prices</button>
          <button className="cg-btn cg-btn--primary" onClick={onExportCsv}>Export CSV</button>
        </div>
      </div>

      <div className="cg-kpis">
        <Kpi
          label="Spent this period"
          value={formatUsd(spent, currency)}
          sub={status ? `${formatTokens(rollup?.totalTokens ?? 0)} tokens` : "no data yet"}
          tone={stateTone}
          delay={0}
        />
        <Kpi
          label="Budget"
          value={formatUsd(budget, currency)}
          sub={status ? `${status.period} cap` : "configure in settings"}
          delay={60}
        />
        <Kpi
          label="Remaining"
          value={formatUsd(Math.max(0, remaining), currency)}
          sub={remaining >= 0 ? "on track" : "over budget"}
          tone={remaining < 0 ? "over" : undefined}
          delay={120}
        />
        <Kpi
          label="Cost / 1k tokens"
          value={formatUsd(efficiency, currency)}
          sub="blended efficiency"
          delay={180}
        />
      </div>

      {status && (
        <section className="cg-panel cg-rise" style={{ animationDelay: "240ms" }}>
          <div className="cg-panel__head">
            <span className="cg-panel__title">Budget progress</span>
            <span className={`cg-chip cg-chip--${status.state === "over" ? "over" : status.state === "warn" ? "warn" : "ok"}`}>
              {status.state}
              {status.blocked ? " · blocked" : ""}
            </span>
          </div>
          <div style={{ padding: "18px" }}>
            <div className={`cg-bar${stateTone ? ` cg-bar--${stateTone}` : ""}`}>
              <div className="cg-bar__fill" style={{ width: `${Math.min(100, ratio * 100)}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", fontSize: "11.5px", color: "var(--cg-muted)" }}>
              <span>{formatPercent(ratio)} of budget</span>
              <span>{formatUsd(remaining, currency)} left</span>
            </div>
          </div>
        </section>
      )}

      <div className="cg-grid">
        <section className="cg-panel cg-rise" style={{ animationDelay: "300ms" }}>
          <div className="cg-panel__head">
            <span className="cg-panel__title">Spend by model</span>
          </div>
          {rollup && rollup.byModel.length > 0 ? (
            <table className="cg-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th className="num">Tokens</th>
                  <th className="num">Cost</th>
                </tr>
              </thead>
              <tbody>
                {rollup.byModel.map((m) => (
                  <tr key={m.key}>
                    <td>
                      <span className="cg-model">
                        {m.model}
                        <small>{m.provider || "unknown provider"}</small>
                      </span>
                    </td>
                    <td className="num">
                      <span className="cg-minibar">
                        <span style={{ width: `${rollup.totalTokens ? Math.max(2, (m.buckets.input + m.buckets.output) / rollup.totalTokens * 100) : 0}%` }} />
                      </span>
                      {formatTokens(m.buckets.input + m.buckets.output)}
                    </td>
                    <td className="num">{formatUsd(m.costUsd, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="cg-empty">No spend recorded yet — send a message to start measuring.</div>
          )}
          {rollup && rollup.unpriced.length > 0 && (
            <div className="cg-note">
              Unpriced models (add prices in the Prices panel):{" "}
              {rollup.unpriced.join(", ")}
            </div>
          )}
        </section>

        <section className="cg-panel cg-rise" style={{ animationDelay: "360ms" }}>
          <div className="cg-panel__head">
            <span className="cg-panel__title">Daily spend</span>
          </div>
          {daily.length > 0 ? (
            <div className="cg-bars">
              {daily.map((d) => (
                <div className="cg-day" key={d.day} title={`${d.day}: ${formatUsd(d.costUsd, currency)}`}>
                  <div
                    className="cg-day__col"
                    style={{ height: `${Math.max(4, (d.costUsd / maxDay) * 84)}px` }}
                  />
                  <span className="cg-day__label">{d.day.slice(8)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="cg-empty">No daily activity yet.</div>
          )}
        </section>
      </div>

      {tip && (
        <section className="cg-panel cg-rise" style={{ animationDelay: "420ms" }}>
          <div className="cg-panel__head"><span className="cg-panel__title">Savings tip</span></div>
          <div className="cg-note" style={{ borderTop: "none" }}>{tip}</div>
        </section>
      )}
    </div>
  );
}

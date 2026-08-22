/**
 * Budget editor — edits the period budget and warn/hard thresholds.
 *
 * @module dsh-cost-governor/client/components/BudgetEditor
 */
import { useEffect, useState } from "react";
import { injectLedgerStyles } from "../theme";
import type { BudgetConfig } from "../../src/types";

export interface BudgetEditorProps {
  value: BudgetConfig;
  onSave: (next: BudgetConfig) => void;
  onCancel?: () => void;
}

export function BudgetEditor({ value, onSave, onCancel }: BudgetEditorProps) {
  useEffect(() => injectLedgerStyles(), []);
  const [draft, setDraft] = useState<BudgetConfig>(value);

  const set = <K extends keyof BudgetConfig>(k: K, v: BudgetConfig[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="cg-root">
      <div className="cg-header">
        <div>
          <p className="cg-eyebrow">Settings</p>
          <h2 className="cg-title">Budget</h2>
          <p className="cg-subtitle">Cap spend and choose what happens at the ceiling.</p>
        </div>
      </div>

      <div className="cg-panel">
        <div className="cg-form">
          <div className="cg-row">
            <div className="cg-field">
              <label>Period</label>
              <div className="cg-seg">
                {(["daily", "weekly", "monthly", "unlimited"] as const).map((p) => (
                  <button key={p} data-on={draft.period === p} onClick={() => set("period", p)}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="cg-field">
              <label>Budget (USD)</label>
              <input
                className="cg-input" type="number" min={0} step={1}
                value={draft.budgetUsd}
                onChange={(e) => set("budgetUsd", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="cg-row">
            <div className="cg-field">
              <label>Warn ratio</label>
              <input
                className="cg-input" type="number" min={0} max={2} step={0.05}
                value={draft.warnRatio}
                onChange={(e) => set("warnRatio", Number(e.target.value))}
              />
              <div className="cg-hint">Soft-warn at {Math.round(draft.warnRatio * 100)}% of budget.</div>
            </div>
            <div className="cg-field">
              <label>Hard ratio</label>
              <input
                className="cg-input" type="number" min={0} max={2} step={0.05}
                value={draft.hardRatio}
                onChange={(e) => set("hardRatio", Number(e.target.value))}
              />
              <div className="cg-hint">Ceiling at {Math.round(draft.hardRatio * 100)}% of budget.</div>
            </div>
          </div>

          <div className="cg-field">
            <label>Hard action</label>
            <div className="cg-seg">
              {(["notify-only", "block-new-requests", "steer-to-cheaper-model"] as const).map((a) => (
                <button key={a} data-on={draft.hardAction === a} onClick={() => set("hardAction", a)}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="cg-actions" style={{ marginTop: 8 }}>
            <button className="cg-btn cg-btn--primary" onClick={() => onSave(draft)}>Save</button>
            {onCancel && <button className="cg-btn cg-btn--ghost" onClick={onCancel}>Cancel</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Price editor — an editable per-model price table (USD per 1M tokens).
 *
 * @module dsh-cost-governor/client/components/PriceEditor
 */
import { useEffect, useState } from "react";
import { injectLedgerStyles } from "../theme";
import type { ModelPrice } from "../../src/pricing/price";

export interface PriceEditorProps {
  catalog: Record<string, ModelPrice>;
  onSave: (next: Record<string, ModelPrice>) => void;
  onCancel?: () => void;
}

const FIELDS: Array<{ key: keyof ModelPrice; label: string }> = [
  { key: "inputPerM", label: "Input" },
  { key: "outputPerM", label: "Output" },
  { key: "cacheReadPerM", label: "Cache read" },
  { key: "cacheWritePerM", label: "Cache write" },
  { key: "reasoningPerM", label: "Reasoning" },
];

export function PriceEditor({ catalog, onSave, onCancel }: PriceEditorProps) {
  useEffect(() => injectLedgerStyles(), []);
  const [draft, setDraft] = useState<Record<string, ModelPrice>>(catalog);

  const update = (key: string, field: keyof ModelPrice, v: number) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], [field]: v } }));

  return (
    <div className="cg-root">
      <div className="cg-header">
        <div>
          <p className="cg-eyebrow">Settings</p>
          <h2 className="cg-title">Price catalog</h2>
          <p className="cg-subtitle">USD per 1M tokens. Overrides the built-in defaults.</p>
        </div>
        <div className="cg-actions">
          {onCancel && <button className="cg-btn cg-btn--ghost" onClick={onCancel}>Cancel</button>}
          <button className="cg-btn cg-btn--primary" onClick={() => onSave(draft)}>Save</button>
        </div>
      </div>

      <div className="cg-panel">
        <table className="cg-table">
          <thead>
            <tr>
              <th>Model</th>
              {FIELDS.map((f) => (
                <th className="num" key={f.key}>{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(draft).map(([key, price]) => (
              <tr key={key}>
                <td><span className="cg-model">{key}</span></td>
                {FIELDS.map((f) => (
                  <td className="num" key={f.key}>
                    <input
                      className="cg-input"
                      style={{ width: 84, textAlign: "right", padding: "5px 8px" }}
                      type="number" min={0} step={0.01}
                      value={price[f.key] ?? ""}
                      onChange={(e) => update(key, f.key, Number(e.target.value))}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

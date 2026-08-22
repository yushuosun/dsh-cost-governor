/**
 * "Ledger Terminal" design system — a finance-grade, instrument-panel aesthetic
 * for the cost dashboard: deep ink surfaces, serif display numerals (Fraunces),
 * monospaced data (IBM Plex Mono), and a signal-green + amber budget palette.
 *
 * Everything is scoped under `.cg-*` classes so it never collides with DSH's own
 * theme. The stylesheet is injected once, idempotently.
 *
 * @module dsh-cost-governor/client/theme
 */

const FONTS =
  "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');";

const TOKENS = `
  .cg-root {
    --cg-ink: #0a0d12;
    --cg-panel: #10141c;
    --cg-panel-2: #141a24;
    --cg-line: #222b3a;
    --cg-line-soft: #1a2230;
    --cg-text: #e8ecf3;
    --cg-muted: #7e8a9d;
    --cg-faint: #56607888;
    --cg-accent: #2dd4a7;
    --cg-accent-ink: #07251c;
    --cg-accent-dim: rgba(45, 212, 167, 0.13);
    --cg-amber: #f5b840;
    --cg-amber-dim: rgba(245, 184, 64, 0.14);
    --cg-danger: #fb5d6d;
    --cg-danger-dim: rgba(251, 93, 109, 0.14);
    --cg-blue: #6aa5ff;

    --cg-font-display: 'Fraunces', 'Georgia', 'Times New Roman', serif;
    --cg-font-mono: 'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace;

    --cg-radius: 12px;
    --cg-shadow: 0 10px 30px -18px rgba(0, 0, 0, 0.8);
  }
`;

const BASE = `
  .cg-root {
    color: var(--cg-text);
    background:
      radial-gradient(1200px 500px at 85% -10%, rgba(45, 212, 167, 0.06), transparent 60%),
      radial-gradient(900px 420px at -10% 110%, rgba(106, 165, 255, 0.05), transparent 55%),
      var(--cg-ink);
    font-family: var(--cg-font-mono);
    line-height: 1.5;
    padding: 22px 24px 32px;
    min-height: 100%;
    box-sizing: border-box;
  }
  .cg-root *, .cg-root *::before, .cg-root *::after { box-sizing: border-box; }

  .cg-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 22px;
  }
  .cg-eyebrow {
    font-family: var(--cg-font-mono);
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--cg-accent);
    margin: 0 0 6px;
  }
  .cg-title {
    font-family: var(--cg-font-display);
    font-weight: 500;
    font-size: 30px;
    letter-spacing: -0.01em;
    margin: 0;
  }
  .cg-subtitle { color: var(--cg-muted); font-size: 13px; margin: 4px 0 0; }

  .cg-actions { display: flex; gap: 10px; }
  .cg-btn {
    font-family: var(--cg-font-mono);
    font-size: 12px;
    color: var(--cg-text);
    background: var(--cg-panel-2);
    border: 1px solid var(--cg-line);
    border-radius: 8px;
    padding: 8px 14px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, transform 0.1s;
  }
  .cg-btn:hover { border-color: var(--cg-accent); }
  .cg-btn:active { transform: translateY(1px); }
  .cg-btn--primary { background: var(--cg-accent); color: var(--cg-accent-ink); border-color: transparent; }
  .cg-btn--primary:hover { background: #3ce0b6; }
  .cg-btn--ghost { background: transparent; }

  .cg-seg { display: inline-flex; border: 1px solid var(--cg-line); border-radius: 8px; overflow: hidden; }
  .cg-seg button {
    font-family: var(--cg-font-mono); font-size: 11.5px;
    background: transparent; color: var(--cg-muted);
    border: none; padding: 7px 12px; cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .cg-seg button + button { border-left: 1px solid var(--cg-line); }
  .cg-seg button[data-on="true"] { background: var(--cg-panel-2); color: var(--cg-text); }
  .cg-seg button:hover { color: var(--cg-text); }

  .cg-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; margin-bottom: 22px; }
  .cg-kpi {
    background: linear-gradient(180deg, var(--cg-panel-2), var(--cg-panel));
    border: 1px solid var(--cg-line-soft);
    border-radius: var(--cg-radius);
    padding: 16px 18px;
    box-shadow: var(--cg-shadow);
    position: relative;
    overflow: hidden;
  }
  .cg-kpi::after {
    content: ""; position: absolute; inset: 0 0 auto 0; height: 2px;
    background: linear-gradient(90deg, transparent, var(--cg-accent), transparent);
    opacity: 0.5;
  }
  .cg-kpi__label { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--cg-muted); margin-bottom: 10px; }
  .cg-kpi__value {
    font-family: var(--cg-font-display); font-weight: 400; font-size: 34px;
    letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums;
  }
  .cg-kpi__value .cg-cur { font-size: 18px; color: var(--cg-muted); font-weight: 400; margin-right: 2px; }
  .cg-kpi__delta { margin-top: 8px; font-size: 11.5px; color: var(--cg-faint); }
  .cg-kpi--warn::after { background: linear-gradient(90deg, transparent, var(--cg-amber), transparent); }
  .cg-kpi--over::after { background: linear-gradient(90deg, transparent, var(--cg-danger), transparent); }

  .cg-bar { height: 8px; border-radius: 99px; background: var(--cg-line-soft); overflow: hidden; position: relative; }
  .cg-bar__fill { height: 100%; border-radius: 99px; background: var(--cg-accent); transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1); position: relative; }
  .cg-bar__fill::after {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
    animation: cg-shimmer 2.2s linear infinite; transform: translateX(-100%);
  }
  .cg-bar--warn .cg-bar__fill { background: var(--cg-amber); }
  .cg-bar--over .cg-bar__fill { background: var(--cg-danger); }
  @keyframes cg-shimmer { to { transform: translateX(100%); } }

  .cg-panel {
    background: var(--cg-panel); border: 1px solid var(--cg-line-soft);
    border-radius: var(--cg-radius); box-shadow: var(--cg-shadow); overflow: hidden;
    margin-bottom: 18px;
  }
  .cg-panel__head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; border-bottom: 1px solid var(--cg-line-soft);
  }
  .cg-panel__title { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--cg-muted); }

  .cg-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .cg-table th {
    text-align: left; font-weight: 500; color: var(--cg-faint); font-size: 10.5px;
    letter-spacing: 0.12em; text-transform: uppercase; padding: 11px 18px; border-bottom: 1px solid var(--cg-line-soft);
  }
  .cg-table td { padding: 11px 18px; border-bottom: 1px solid var(--cg-line-soft); font-variant-numeric: tabular-nums; }
  .cg-table tbody tr:last-child td { border-bottom: none; }
  .cg-table tbody tr { transition: background 0.12s; }
  .cg-table tbody tr:hover { background: var(--cg-panel-2); }
  .cg-table .num { text-align: right; }
  .cg-model { font-family: var(--cg-font-display); font-size: 14px; }
  .cg-model small { font-family: var(--cg-font-mono); color: var(--cg-faint); font-size: 10.5px; display: block; }

  .cg-chip { display: inline-block; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 7px; border-radius: 5px; }
  .cg-chip--warn { color: var(--cg-amber); background: var(--cg-amber-dim); }
  .cg-chip--over { color: var(--cg-danger); background: var(--cg-danger-dim); }
  .cg-chip--ok { color: var(--cg-accent); background: var(--cg-accent-dim); }
  .cg-chip--muted { color: var(--cg-muted); background: var(--cg-line-soft); }

  .cg-minibar { display: inline-block; width: 90px; height: 5px; border-radius: 99px; background: var(--cg-line-soft); vertical-align: middle; margin-right: 8px; }
  .cg-minibar span { display: block; height: 100%; border-radius: 99px; background: var(--cg-accent); }

  .cg-bars { display: flex; align-items: flex-end; gap: 4px; height: 120px; padding: 18px; }
  .cg-bars .cg-day { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
  .cg-bars .cg-day__col {
    width: 100%; max-width: 34px; border-radius: 4px 4px 2px 2px;
    background: linear-gradient(180deg, var(--cg-accent), rgba(45,212,167,0.25));
    transition: opacity 0.15s;
  }
  .cg-bars .cg-day:hover .cg-day__col { background: linear-gradient(180deg, #3ce0b6, rgba(45,212,167,0.4)); }
  .cg-bars .cg-day__label { font-size: 9px; color: var(--cg-faint); white-space: nowrap; }

  .cg-note { font-size: 11.5px; color: var(--cg-muted); padding: 12px 18px; border-top: 1px solid var(--cg-line-soft); }
  .cg-note a { color: var(--cg-blue); text-decoration: none; }
  .cg-empty { padding: 34px; text-align: center; color: var(--cg-faint); font-size: 13px; }

  .cg-rise { opacity: 0; transform: translateY(8px); animation: cg-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
  @keyframes cg-rise { to { opacity: 1; transform: none; } }

  .cg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  @media (max-width: 760px) { .cg-grid { grid-template-columns: 1fr; } }

  .cg-hud { display: flex; align-items: center; gap: 7px; padding: 4px 6px; }
  .cg-hud__meta { display: flex; flex-direction: column; line-height: 1.15; }
  .cg-hud__pct { font-family: var(--cg-font-display); font-size: 15px; font-variant-numeric: tabular-nums; }
  .cg-hud__usd { font-size: 9.5px; color: var(--cg-muted); letter-spacing: 0.02em; }
`;

const EDITOR = `
  .cg-form { padding: 18px; }
  .cg-field { margin-bottom: 16px; }
  .cg-field label { display: block; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--cg-muted); margin-bottom: 7px; }
  .cg-input {
    width: 100%; font-family: var(--cg-font-mono); font-size: 13px; color: var(--cg-text);
    background: var(--cg-panel-2); border: 1px solid var(--cg-line); border-radius: 8px; padding: 9px 12px;
  }
  .cg-input:focus { outline: none; border-color: var(--cg-accent); }
  .cg-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .cg-hint { font-size: 11px; color: var(--cg-faint); margin-top: 5px; }
`;

let injected = false;

/** Inject the Ledger Terminal stylesheet exactly once. */
export function injectLedgerStyles(): void {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const style = document.createElement("style");
  style.setAttribute("data-cg-styles", "true");
  style.textContent = `${FONTS}\n${TOKENS}\n${BASE}\n${EDITOR}`;
  document.head.appendChild(style);
}

export { TOKENS, BASE, EDITOR };

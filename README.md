# dsh-cost-governor

**Cost governance & budget enforcement for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).**

A finance-grade "cost governor" layered on top of DSH's built-in token metering: it turns the harness's already-disjoint token buckets (`input / output / cache-read / cache-write / reasoning`) into **money**, then enforces a budget — soft warn → hard ceiling → block or steer to a cheaper model — with a polished in-app dashboard.

> Not another "cost counter". The counter exists (`dsh-token-meter`). This plugin is the **budget keeper** that says *how much you're spending*, *what it will cost by month-end*, and *stops you when you told it to*.

---

## Why this one

| Capability | core `dsh-token-meter` | typical community cost plugins | **dsh-cost-governor** |
|---|---|---|---|
| Disjoint token buckets | ✅ | partial | ✅ (reuses core) |
| Compaction-safe accounting | ✅ | ⚠️ often drifts | ✅ (official projection seam) |
| Multi-provider precise pricing | — | mostly DeepSeek-only | ✅ catalog + cache/reasoning buckets |
| Budget **warn** | — | display only | ✅ threshold events + webhook |
| Budget **enforce** (block / steer) | — | ❌ | ✅ |
| Cross-session trends + CSV | — | ❌ | ✅ |
| Model cost comparison + savings tip | — | ❌ | ✅ |

## Features

- **Per-model cost accounting** on the official `sessionProjections` seam — stays correct through compaction and cold reads, and re-prices history instantly when you edit a price.
- **Multi-provider price catalog** (DeepSeek, OpenAI, Anthropic, Google, xAI, Qwen, GLM, Moonshot) with separate cache-read/write and reasoning rates. Fully overridable.
- **Budget governance**: `daily | weekly | monthly | unlimited` budget, `warnRatio` soft threshold, `hardRatio` ceiling, and a `hardAction` of `notify-only | block-new-requests | steer-to-cheaper-model`.
- **Webhook notifications** (Slack-style / Feishu / DingTalk) on threshold crossings — fail-soft.
- **Dashboard** (`Settings → Usage & Cost`): KPI cards, animated budget bar, per-model spend table, daily chart, savings tip, CSV export.
- **Compact HUD** budget ring for the sidebar rail.

## Install

```bash
# 1. install the plugin
npm i -g dsh-cost-governor          # or add it to your project

# 2. add to your DSH composition (cordis.yml)
```

```yaml
- name: dsh-cost-governor
  config:
    currency: USD
    budget:
      period: monthly
      budgetUsd: 20
      warnRatio: 0.8
      hardRatio: 1.0
      hardAction: notify-only      # notify-only | block-new-requests | steer-to-cheaper-model
    notifyWebhook: ""              # optional
```

```bash
# 3. restart dsh — the dashboard appears under Settings → Usage & Cost
```

## Configuration

| key | default | description |
|---|---|---|
| `currency` | `USD` | display currency |
| `budget.period` | `monthly` | `daily` \| `weekly` \| `monthly` \| `unlimited` |
| `budget.budgetUsd` | `20` | period cap |
| `budget.warnRatio` | `0.8` | soft-warn at 80% |
| `budget.hardRatio` | `1.0` | ceiling at 100% |
| `budget.hardAction` | `notify-only` | ceiling behavior |
| `notifyWebhook` | — | optional webhook URL |
| `priceCatalog` | built-in | per-model overrides (USD / 1M tokens) |

## Architecture

```
client dashboard / HUD
        ▲  session/projection frames + settings scope
host   UsageCost service ── BudgetGovernor · CostLedger · Notifier
        ▲  ctx.sessionProjections.register(costUsage)
costUsage projection   (pure fold: raw per-model token buckets)
        ▲  reuses core token buckets (request/context → model attribution)
dsh-token-meter · dsh-llm (TokenUsage)
```

The `costUsage` projection stores **raw token buckets only** — never currency — so it is replay-safe and a price-table edit re-prices history without refolding the log.

## Development

```bash
pnpm install
pnpm build          # tsc (see PUBLISHING.md for the full DSH toolchain notes)
```

Open `preview/dashboard.html` for a zero-build visual preview of the dashboard.

## Limitations

- Only **final `assistant/message` usage** is billed; input spend of a request that fails before assembling a message is not captured (a provider still charges it). This matches the harness's own usage-carrier semantics and is a documented edge, not a miscount.
- `block-new-requests` / `steer-to-cheaper-model` are exposed as a governance gate (`BudgetGovernor.gate`) and emitted events; wiring them into the LLM waterfall is the one integration point to verify against the official DSH plugin docs at first build.
- Prices in the built-in catalog are community placeholders — verify against each provider before trusting absolute dollar figures.

## License

MIT

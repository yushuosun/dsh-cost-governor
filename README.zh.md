# dsh-cost-governor

**为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 打造的成本治理与预算执行插件。**

在 DSH 内置 token 计量之上叠加一层"财务级"成本治理：把内核已经拆好的账单桶（`input / output / cache-read / cache-write / reasoning`）换算成**真金白银**，再执行预算——软告警 → 硬熔断 → 阻断新请求或自动换更便宜的模型，并配一个高质感的站内仪表盘。

> 不是"又一个成本计数器"。计数器内核已经有了（`dsh-token-meter`）。这个插件是那个**会拦你、会提醒你的预算管家**。

---

## 为什么选它

| 能力 | 内核 `dsh-token-meter` | 常见社区成本插件 | **dsh-cost-governor** |
|---|---|---|---|
| 分桶计量 | ✅ | 部分 | ✅（复用内核） |
| compaction 后不漂移 | ✅ | ⚠️ 多会漂移 | ✅（官方投影 seam） |
| 多厂商精确计价 | — | 多为 DeepSeek 单家 | ✅ 目录 + cache/reasoning 分桶 |
| 预算**告警** | — | 仅显示 | ✅ 阈值事件 + webhook |
| 预算**执行**（阻断/换模型） | — | ❌ | ✅ |
| 跨会话趋势 + CSV | — | ❌ | ✅ |
| 模型成本对比 + 省钱建议 | — | ❌ | ✅ |

## 特性

- **按模型成本核算**：跑在官方 `sessionProjections` seam 上——compaction、冷启动、重连都不丢数，改价格即时重算历史。
- **多厂商价格目录**（DeepSeek / OpenAI / Anthropic / Google / xAI / 通义 / GLM / Kimi），cache 读写与 reasoning 单独计价，全部可覆盖。
- **预算治理**：`daily | weekly | monthly | unlimited` 周期预算，`warnRatio` 软阈值、`hardRatio` 硬上限，`hardAction` 可选 `notify-only | block-new-requests | steer-to-cheaper-model`。
- **Webhook 通知**（Slack 风格 / 飞书 / 钉钉），fail-soft 不影响会话。
- **仪表盘**（设置 → 用量与成本）：KPI 卡片、动画预算条、按模型花费表、每日趋势图、省钱建议、CSV 导出。
- **侧栏 HUD** 预算圆环。

## 安装

```bash
npm i -g dsh-cost-governor
```

在 `cordis.yml` 组合中加入：

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
    notifyWebhook: ""              # 可选
```

重启 dsh 后，仪表盘出现在「设置 → 用量与成本」。

## 配置项

| 键 | 默认 | 说明 |
|---|---|---|
| `currency` | `USD` | 显示货币 |
| `budget.period` | `monthly` | `daily` \| `weekly` \| `monthly` \| `unlimited` |
| `budget.budgetUsd` | `20` | 周期预算上限 |
| `budget.warnRatio` | `0.8` | 80% 软告警 |
| `budget.hardRatio` | `1.0` | 100% 硬上限 |
| `budget.hardAction` | `notify-only` | 达到上限后的动作 |
| `notifyWebhook` | — | 可选 webhook 地址 |
| `priceCatalog` | 内置 | 按模型覆盖单价（USD / 1M token） |

## 架构

```
client 仪表盘 / HUD
        ▲  session/projection 帧 + settings scope
host   UsageCost 服务 ── BudgetGovernor · CostLedger · Notifier
        ▲  ctx.sessionProjections.register(costUsage)
costUsage 投影   （纯 fold：按模型的原始 token 桶）
        ▲  复用内核 token 桶（request/context → 模型归属）
dsh-token-meter · dsh-llm (TokenUsage)
```

`costUsage` 投影只存**原始 token 桶**、不存货币——因此可重放、可持久化，改价格无需重放日志即可重新计价。

## 开发

```bash
pnpm install
pnpm build
```

双击 `preview/dashboard.html` 可零构建预览仪表盘外观。

## 已知限制

- 只计 **最终 `assistant/message` 的 usage**；请求失败未产出消息时的输入开销暂未计入（厂商仍会收费）。这与内核 usage 载体语义一致，属文档化边界而非错计。
- `block-new-requests` / `steer-to-cheaper-model` 以治理闸门（`BudgetGovernor.gate`）+ 事件形式暴露，接入 LLM 瀑布是首次构建时需对照官方插件文档核实的唯一集成点。
- 内置价格为社区占位值，正式使用前请对照各厂商官方价目表。

## License

MIT

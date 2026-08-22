# dsh-cost-governor — 设计文档

> DeepSeek Harness（DSH）插件：**成本治理 + 预算执行 + 多厂商精确计价**
> 工作名 `dsh-cost-governor`（区别于社区已有的 "cost-meter" 命名，强调"治理/执行"而非"读数"）。

---

## 0. 结论速览（TL;DR）

- **内核已有地基**：`@deepseek-ai/dsh-token-meter` 已经提供 `tokenUsage` / `contextPressure` / `contextBreakdown` 三个投影单元 + `ctx.tokenMeter` 服务，`TokenUsage` 已经拆好账单桶：`inputTokens`（非缓存输入）、`outputTokens`、`cacheReadTokens`、`cacheWriteTokens`、`reasoningTokens`。
- **社区已有竞品**：`dsh-token-panel`（角落 HUD + 预算/余额）、`dsh-usage-chart`（实时图表 + DeepSeek 余额）、`dsh-cost-meter`（会话/当日费用 + 官方价格同步）、`dsh-daily-cost-meter`、`dsh-ui-usage-billing`、`dsh-usage-cost` 等 6~7 个。
- **真正空白 = 治理层**：现有竞品几乎都是「会话内读数 + 单一 DeepSeek 计价」，缺少：
  1. 正确复用官方投影 seam（在 compaction 后不重复计费、冷启动/重连后不丢失）——多数竞品从 UI 事件自推导，压测/压缩后会错。
  2. 多厂商精确计价（cache read/write、reasoning 分桶）。
  3. **预算执行**：按月/按 workspace 预算，软告警 / 硬熔断 / 通知。
  4. 跨会话、跨 workspace 的汇总、趋势、CSV 导出。
  5. 模型成本对比与「换更便宜模型」建议。

**一句话定位**：不是「又一个成本计数器」，而是「会算钱、会拦你、会提醒你的预算管家」。

---

## 1. 竞品与差异化

| 能力 | dsh-token-meter（内核） | 社区 cost 插件（多数） | **本插件** |
|---|---|---|---|
| token 分桶计量 | ✅ 完整（含 cache/reasoning） | 部分 | ✅ 直接复用 |
| 会话内读数/HUD | 无 UI | ✅ | ✅（轻量） |
| 多厂商精确计价 | ❌ 无价格概念 | ❌ 多为 DeepSeek 单家 | ✅ 目录 + 可编辑 |
| compaction 后准确 | ✅（投影 seam） | ⚠️ 多数会漂移 | ✅ 复用投影 seam |
| 预算告警 | ❌ | 部分（仅显示） | ✅ 软/硬两级 |
| 预算**执行**（熔断/换模型/停跑） | ❌ | ❌ | ✅ 核心卖点 |
| 跨 workspace 汇总 / 趋势 / 导出 | ❌ | ❌ | ✅ |
| 模型成本对比 + 省钱建议 | ❌ | ❌ | ✅ |

---

## 2. 分层架构

```
┌──────────────────────────────────────────────────────────┐
│  UI 层（client）                                          │
│  • settings.section  ——「用量与成本」仪表盘                │
│  • 侧栏 HUD 徽标   —— 本月预算进度 / 本会话花费             │
└──────────────┬───────────────────────────────────────────┘
               │ session/projection 帧 + settings scope
┌──────────────▼───────────────────────────────────────────┐
│  治理服务（host）                                          │
│  UsageCostService                                          │
│  • 读 costUsage 投影 → × 价格表 → 成本                    │
│  • BudgetGovernor：预算核算、软/硬阈值、事件告警、熔断      │
│  • Ledger：跨会话/workspace 汇总 + 趋势 + 导出             │
└──────────────┬───────────────────────────────────────────┘
               │ ctx.sessionProjections.register()
┌──────────────▼───────────────────────────────────────────┐
│  成本投影单元 costUsage（host，纯 fold，可重放）            │
│  • 按 (provider, model) 聚合原始 token 桶                 │
│  • 依赖 request/header 与 assistant/message 的 usage       │
│  • 存原始桶，不存价格（价格可在 view 层改）                │
└──────────────┬───────────────────────────────────────────┘
               │ 复用已有投影
┌──────────────▼───────────────────────────────────────────┐
│  dsh-token-meter（内核，不重复造轮子）                     │
│  tokenUsage / contextPressure / contextBreakdown          │
└───────────────────────────────────────────────────────────┘
```

**核心设计决策**：投影只存「原始 token 桶（按模型）」，**价格在 view/服务层乘**。这样价格表更新后无需重放整条日志即可重新计价，投影保持纯函数可重放、可持久化（`sessionProjectionCache`）。

---

## 3. 核心数据模型

### 3.1 价格目录（Price Catalog）

每模型一条，键为 `provider/model`（对齐 `LlmModelInfo.id` 与 `GenerateOptions.provider`）。价格单位：**每 1M token 的 USD**，缓存读写与推理单独计价。

```ts
interface ModelPrice {
  /** 每 1M input tokens（非缓存） */
  inputPerM: number;
  /** 每 1M output tokens */
  outputPerM: number;
  /** 每 1M cache-read tokens */
  cacheReadPerM: number;
  /** 每 1M cache-write tokens */
  cacheWritePerM: number;
  /** 可选：推理 token 单价（部分厂商单独计费） */
  reasoningPerM?: number;
}

type PriceCatalog = Record<string /* provider/model */, ModelPrice>;
```

内置默认目录（随版本发布、可被用户设置覆盖）示例：

| provider/model | input | output | cacheRead | cacheWrite |
|---|---|---|---|---|
| deepseek/deepseek-chat | 0.27 | 1.10 | 0.07 | 0.27 |
| deepseek/deepseek-reasoner | 0.55 | 2.19 | 0.14 | 0.55 |
| openai/gpt-4.1-mini | 0.40 | 1.60 | 0.10 | — |
| anthropic/claude-3-7-sonnet | 3.00 | 15.00 | 0.30 | 3.75 |

> 值仅占位示意，落地时以各厂商官方价目表为准；支持 OpenAI 兼容网关/自建模型按自定义单价。

### 3.2 成本投影单元 `costUsage`

```ts
interface CostUsageState {
  /** provider/model → 原始 token 桶累计 */
  byModel: Record<string, TokenBuckets>;
  /** 最近一次 request/header 的 (provider, model)，用于归属后续 usage */
  currentModel: string | null;
}
interface TokenBuckets {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
}
```

- `apply(state, event)` 关键分支：
  - `request/header`：记录 `currentModel = provider/model`。
  - `assistant/message`（带 `usage`）：把 `usage` 的桶累加到 `byModel[currentModel]`（与 token-meter 的「同 turn/step 用最终样本替换」策略对齐，避免 usage chunk 与最终 message 重复计）。
  - 其余事件透传。
- `view(state)` 返回纯桶（供客户端/服务端再计价），`stateVersion: 1`。
- `schema` 用 zod `z.object` + `z.record` 严格校验，满足投影「plain-JSON」契约。

### 3.3 预算治理（BudgetGovernor）

```ts
interface BudgetConfig {
  /** 预算周期，默认 monthly */
  period: 'daily' | 'weekly' | 'monthly' | 'unlimited';
  /** 预算上限（USD） */
  budgetUsd: number;
  /** 软告警阈值（比例，如 0.8 → 80% 触发提醒） */
  warnRatio: number;
  /** 硬熔断阈值（比例，如 1.0 → 超预算时阻断新请求） */
  hardRatio: number;
  /** 硬熔断动作 */
  hardAction: 'notify-only' | 'block-new-requests' | 'steer-to-cheaper-model';
  /** 可选 webhook（飞书/钉钉/Slack） */
  notifyWebhook?: string;
}
```

核算口径：**本周期内所有会话的 `costUsage` 投影 × 价格表之和**（按 workspace 分账，另设全局合计）。

---

## 4. 目录结构

```
dsh-cost-governor/
├── package.json                 # name/type:module/exports/peerDeps
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                 # 主插件入口（Service，静态 Config）
│   ├── pricing/
│   │   ├── catalog.ts           # 内置默认价格目录
│   │   ├── defaults.ts          # 厂商官方价（分文件维护）
│   │   └── price.ts             # buckets × price → cost 的纯函数
│   ├── projection/
│   │   └── cost-usage.ts        # costUsage 投影单元定义
│   ├── governor/
│   │   ├── budget.ts            # 预算核算 + 软/硬阈值判定
│   │   ├── ledger.ts            # 跨会话/workspace 汇总 + 趋势
│   │   └── notify.ts            # webhook 通知
│   ├── settings/
│   │   └── schema.ts            # settings namespace + schemastery 校验
│   └── events.ts                # 监听 session/event、projection 变更
├── client/                      # 浏览器侧 UI（独立 client 包或同包 dual-entry）
│   ├── index.ts                 # 注册 settings.section + HUD 槽位
│   ├── dashboard.tsx            # 仪表盘（按模型/按天/按 workspace 图表）
│   ├── hud.tsx                  # 侧栏预算进度徽标
│   └── settings-panel.tsx       # 价格目录/预算编辑页
└── cordis.yml                   # 组合配置示例
```

---

## 5. 关键实现要点

1. **主入口（host）**：`class UsageCost extends Service`，`static Config = z.object({...})`（schemastery），`static inject = ['sessionProjections','llm','settingsScope', ...]`，`super(ctx, 'usageCost')`，`async [Service.init]()` 内注册投影 + 挂监听。
2. **投影注册**：`ctx.sessionProjections.register(costUsageProjectionDefinition)`，走 `inject: ['sessionProjections']`，register 为 fiber 副作用（卸载自动移除 key）。
3. **事件监听**：`ctx.on('session/event', (session, event) => ...)` 驱动实时成本累加；硬熔断时在 `session/event` 的请求前拦截（具体挂点待按官方 dev docs 确认，候选为 llm 适配器路由前的 `ctx.llm` 中间层）。
4. **可编辑配置**：价格目录 + 预算用 `ctx.settingsScope.bind(spec)` 走 settings 域（用户可在 Web 设置页改），默认值来自 cordis.yml `config` 与内置目录。
5. **UI**：注册 `settings.section` 仪表盘；HUD 复用侧栏槽位（`dsh-client-ui-layout` 的 slot，具体 slot 名落地时查官方 client 插件合约）。
6. **多厂商计价**：`billedInput = input + cacheRead + cacheWrite`（与内核 `TokenUsage` 的「桶不相交」语义一致），`reasoning` 单独计价。
7. **硬熔断语义**（关键差异化）：`block-new-requests` 在超预算时拒绝新 `GenerateOptions`；`steer-to-cheaper-model` 把请求重路由到价目表里更便宜的等价模型（可配置映射）。

---

## 6. 分阶段实现计划

| 阶段 | 交付物 | 验证标准 |
|---|---|---|
| **P0 骨架** | package.json / tsconfig / 空 Service + cordis.yml | `dsh` 能加载插件，fiber 进入 active |
| **P1 计价内核** | 价格目录 + `costUsage` 投影 + 纯函数计价 | 单会话 token 桶 → 成本正确；compaction 后不重复计 |
| **P2 预算治理** | BudgetGovernor 软/硬阈值 + webhook 通知 + 熔断 | 超预算触发告警/阻断，日志可回放验证 |
| **P3 汇总/趋势** | Ledger 跨会话汇总 + CSV 导出 + 趋势数据 | 多会话/多 workspace 数字一致 |
| **P4 UI** | settings.section 仪表盘 + HUD + 价格/预算编辑页 | 浏览器可看/可改，重启持久化 |
| **P5 打磨发布** | README / 中文文档 / 内置多厂商价格 / 提交 marketplace | 通过 PR 进入 awesome-dsh-plugin 列表 |

---

## 7. 落地前需核实的未知点（依据官方 dev docs / 源码）

1. `request/header` 事件的确切载荷（是否含 provider+model，字段名）——直接影响投影归属逻辑。候选来源：`dsh-session` / `dsh-session-log` 的 `SessionEvent` 联合类型（本机 checkout 中该类型在 `dsh-host-apiproxy/lib/types/api/events.d.ts` 的 `SessionEvent` 引用处）。
2. 硬熔断的正确挂点：是拦截 `ctx.llm` 生成请求，还是监听 `session/event` 里的请求阶段事件；需查 `@deepseek-ai/dsh-llm` 的流式入口与官方「第一个插件」文档。
3. client 侧 HUD/仪表盘的精确槽位名与注册方式（`settings.section` 已确认，侧栏槽位名待查 `dsh-client-ui-layout` contract）。
4. settings scope 在 host 插件中的绑定方式与「用户覆盖 vs cordis.yml 默认」的优先级。
5. 社区 cost 插件的确切实现路径（是否用投影 seam），用于 README 里的「为何我们更准」对比举证。

---

## 8. 命名与发布

- npm 名（候选）：`dsh-cost-governor` / `@dsh-cost/governor`。
- 仓库 README 用中英双语，配「一分钟接入」片段与截图，对齐 awesome-dsh-plugin 的收录格式。
- License：MIT（与 DSH 内核一致）。

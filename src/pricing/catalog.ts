/**
 * Built-in default price catalog (USD per 1M tokens).
 *
 * ⚠️  These figures are community-maintained placeholders recorded at authoring
 * time and DO drift. Treat them as sane defaults to be verified against each
 * provider's official price page; every entry is user-overridable via cordis.yml
 * `config.priceCatalog` (merged over this table) or the in-app settings panel.
 *
 * Cache pricing is recorded only where the provider bills it (Anthropic,
 * DeepSeek, OpenAI-compatible gateways). Zero means "not billed separately".
 *
 * @module dsh-cost-governor/pricing
 */
import type { PriceCatalog } from "./price.js";

export const DEFAULT_PRICE_CATALOG: PriceCatalog = {
  // ── DeepSeek ────────────────────────────────────────────────
  "deepseek/deepseek-chat": {
    inputPerM: 0.27,
    outputPerM: 1.1,
    cacheReadPerM: 0.07,
    cacheWritePerM: 0.27,
  },
  "deepseek/deepseek-reasoner": {
    inputPerM: 0.55,
    outputPerM: 2.19,
    cacheReadPerM: 0.14,
    cacheWritePerM: 0.55,
  },

  // ── OpenAI ──────────────────────────────────────────────────
  "openai/gpt-4.1": {
    inputPerM: 2.0,
    outputPerM: 8.0,
    cacheReadPerM: 0.5,
    cacheWritePerM: 0,
  },
  "openai/gpt-4.1-mini": {
    inputPerM: 0.4,
    outputPerM: 1.6,
    cacheReadPerM: 0.1,
    cacheWritePerM: 0,
  },
  "openai/gpt-4o": {
    inputPerM: 2.5,
    outputPerM: 10.0,
    cacheReadPerM: 1.25,
    cacheWritePerM: 0,
  },

  // ── Anthropic ───────────────────────────────────────────────
  "anthropic/claude-3-7-sonnet": {
    inputPerM: 3.0,
    outputPerM: 15.0,
    cacheReadPerM: 0.3,
    cacheWritePerM: 3.75,
  },
  "anthropic/claude-3-5-haiku": {
    inputPerM: 0.8,
    outputPerM: 4.0,
    cacheReadPerM: 0.08,
    cacheWritePerM: 1.0,
  },

  // ── Google ──────────────────────────────────────────────────
  "google/gemini-2.5-flash": {
    inputPerM: 0.15,
    outputPerM: 0.6,
    cacheReadPerM: 0,
    cacheWritePerM: 0,
  },
  "google/gemini-2.5-pro": {
    inputPerM: 1.25,
    outputPerM: 10.0,
    cacheReadPerM: 0,
    cacheWritePerM: 0,
  },

  // ── xAI ─────────────────────────────────────────────────────
  "xai/grok-3-mini": {
    inputPerM: 0.3,
    outputPerM: 0.5,
    cacheReadPerM: 0,
    cacheWritePerM: 0,
  },

  // ── Alibaba Qwen ────────────────────────────────────────────
  "qwen/qwen-max": {
    inputPerM: 1.6,
    outputPerM: 6.4,
    cacheReadPerM: 0,
    cacheWritePerM: 0,
  },
  "qwen/qwen-plus": {
    inputPerM: 0.4,
    outputPerM: 1.2,
    cacheReadPerM: 0,
    cacheWritePerM: 0,
  },

  // ── Zhipu GLM ───────────────────────────────────────────────
  "glm/glm-4-plus": {
    inputPerM: 0.8,
    outputPerM: 1.6,
    cacheReadPerM: 0,
    cacheWritePerM: 0,
  },

  // ── Moonshot ────────────────────────────────────────────────
  "moonshot/kimi-k2": {
    inputPerM: 0.6,
    outputPerM: 2.5,
    cacheReadPerM: 0,
    cacheWritePerM: 0,
  },
};

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBudgetStatus, periodKeyOf } from "../lib/governor/budget.js";

const config = { period: "monthly", budgetUsd: 20, warnRatio: 0.8, hardRatio: 1.0, hardAction: "notify-only" };

test("computeBudgetStatus thresholds", () => {
  assert.equal(computeBudgetStatus(10, 20, config).state, "ok");
  assert.equal(computeBudgetStatus(16, 20, config).state, "warn");
  assert.equal(computeBudgetStatus(20, 20, config).state, "over");
  assert.equal(computeBudgetStatus(20, 20, config).blocked, false); // notify-only
  const blockCfg = { ...config, hardAction: "block-new-requests" };
  assert.equal(computeBudgetStatus(20, 20, blockCfg).blocked, true);
});

test("periodKeyOf buckets", () => {
  assert.equal(periodKeyOf("monthly", Date.UTC(2026, 7, 15)), "2026-08");
  assert.equal(periodKeyOf("daily", Date.UTC(2026, 7, 15)), "2026-08-15");
  assert.equal(periodKeyOf("unlimited", Date.now()), "all");
});

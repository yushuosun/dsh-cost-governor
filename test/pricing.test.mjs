import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCost, computeViewCost, roundUsd } from "../lib/pricing/price.js";

test("computeCost bills disjoint buckets at per-1M rates", () => {
  const price = { inputPerM: 1, outputPerM: 10, cacheReadPerM: 0.5, cacheWritePerM: 2 };
  const buckets = { input: 1_000_000, output: 1_000_000, cacheRead: 1_000_000, cacheWrite: 1_000_000, reasoning: 0 };
  assert.equal(computeCost(buckets, price), 13.5);
});

test("computeCost falls back reasoning to the output rate", () => {
  const price = { inputPerM: 0, outputPerM: 5, cacheReadPerM: 0, cacheWritePerM: 0 };
  const buckets = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 1_000_000 };
  assert.equal(computeCost(buckets, price), 5);
});

test("computeViewCost flags unpriced models and sums", () => {
  const view = { "deepseek/deepseek-chat": { input: 1e6, output: 1e6, cacheRead: 0, cacheWrite: 0, reasoning: 0 } };
  const price = { "deepseek/deepseek-chat": { inputPerM: 0.27, outputPerM: 1.1, cacheReadPerM: 0, cacheWritePerM: 0 } };
  const { total, unpriced } = computeViewCost(view, price);
  assert.equal(total, 1.37);
  assert.deepEqual(unpriced, []);
  assert.deepEqual(computeViewCost(view, {}).unpriced, ["deepseek/deepseek-chat"]);
});

test("roundUsd avoids float dust", () => {
  assert.equal(roundUsd(1.005), 1.01);
  assert.equal(roundUsd(1.234), 1.23);
  assert.equal(roundUsd(3.42), 3.42);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  costUsageProjectionDefinition,
  usageToBuckets,
} from "../lib/projection/cost-usage.js";

/** Minimal SessionEvent envelope (seq is unused by the fold). */
function ev(type, data, time = 0) {
  return { type, seq: 0, time, data };
}
function fold(events) {
  let s = costUsageProjectionDefinition.init();
  for (const e of events) s = costUsageProjectionDefinition.apply(s, e);
  return costUsageProjectionDefinition.view(s);
}

const header = () =>
  ev("request/header", {
    header: { config: { provider: "deepseek", model: "deepseek-chat" } },
    reason: "initial",
  });
const usage = {
  inputTokens: 100,
  outputTokens: 50,
  cacheReadTokens: 10,
  cacheWriteTokens: 5,
  reasoningTokens: 20,
};
const key = "deepseek/deepseek-chat";

test("model attribution via request/header", () => {
  const view = fold([header(), ev("assistant/message", { turn: 0, step: 0, message: {}, usage })]);
  assert.deepEqual(view.byModel[key], usageToBuckets(usage));
});

test("model attribution via request/context", () => {
  const view = fold([
    ev("request/context", { provider: "deepseek", model: "deepseek-chat" }),
    ev("assistant/message", { turn: 0, step: 0, message: {}, usage }),
  ]);
  assert.deepEqual(view.byModel[key], usageToBuckets(usage));
});

test("byDay bucketing by event time", () => {
  const view = fold([
    ev("request/context", { provider: "deepseek", model: "deepseek-chat" }),
    ev("assistant/message", { turn: 0, step: 0, message: {}, usage }, Date.UTC(2026, 7, 1)),
    ev("assistant/message", { turn: 0, step: 1, message: {}, usage }, Date.UTC(2026, 7, 2)),
  ]);
  assert.ok(view.byDay["2026-08-01"]);
  assert.ok(view.byDay["2026-08-02"]);
  // byModel accumulates across both days
  assert.equal(view.byModel[key].input, usage.inputTokens * 2);
});

test("failed request bills its early sample at step/end", () => {
  const view = fold([
    header(),
    ev("assistant/chunk", { turn: 0, step: 0, chunk: { type: "usage", usage } }),
    ev("step/end", { turn: 0, step: 0 }),
  ]);
  assert.deepEqual(view.byModel[key], usageToBuckets(usage));
});

test("final message replaces the chunk sample (no double count)", () => {
  const view = fold([
    header(),
    ev("assistant/chunk", { turn: 0, step: 0, chunk: { type: "usage", usage } }),
    ev("assistant/message", { turn: 0, step: 0, message: {}, usage }),
  ]);
  assert.deepEqual(view.byModel[key], usageToBuckets(usage));
});

test("interrupted message without usage bills the early sample", () => {
  const view = fold([
    header(),
    ev("assistant/chunk", { turn: 0, step: 0, chunk: { type: "usage", usage } }),
    ev("assistant/message", { turn: 0, step: 0, message: {}, interrupted: true }),
  ]);
  assert.deepEqual(view.byModel[key], usageToBuckets(usage));
});

test("no usage sample and no message bills nothing", () => {
  const view = fold([header(), ev("step/end", { turn: 0, step: 0 })]);
  assert.deepEqual(view.byModel, {});
});

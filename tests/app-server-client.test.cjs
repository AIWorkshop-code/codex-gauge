const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeRateLimits } = require("../electron/app-server-client.cjs");

test("normalizes official App Server rate limits", () => {
  const snapshot = normalizeRateLimits({
    rateLimitsByLimitId: {
      codex: {
        limitId: "codex",
        primary: { usedPercent: 45, windowDurationMins: 300, resetsAt: 2000000000 },
        secondary: { usedPercent: 7, windowDurationMins: 10080, resetsAt: 2000600000 },
      },
    },
  }, Date.parse("2026-07-11T03:20:00.000Z"));

  assert.equal(snapshot.source, "app-server");
  assert.equal(snapshot.primaryRemaining, 55);
  assert.equal(snapshot.secondaryRemaining, 93);
  assert.equal(snapshot.primaryWindowMinutes, 300);
  assert.equal(snapshot.secondaryWindowMinutes, 10080);
  assert.equal(snapshot.stale, false);
});

test("normalizes the weekly-only App Server rate limit", () => {
  const snapshot = normalizeRateLimits({
    rateLimits: {
      limitId: "codex",
      primary: { usedPercent: 4, windowDurationMins: 10080, resetsAt: 2000600000 },
      secondary: null,
    },
  }, Date.parse("2026-07-13T10:00:00.000Z"));

  assert.equal(snapshot.primaryRemaining, null);
  assert.equal(snapshot.secondaryRemaining, 96);
  assert.equal(snapshot.primaryWindowMinutes, null);
  assert.equal(snapshot.secondaryWindowMinutes, 10080);
  assert.equal(snapshot.secondaryResetsAt, 2000600000);
});

test("rejects model-specific rate limits", () => {
  assert.equal(normalizeRateLimits({
    rateLimits: {
      limitId: "codex_bengalfox",
      primary: { usedPercent: 0 },
      secondary: { usedPercent: 0 },
    },
  }), null);
});

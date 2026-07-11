const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { clampPercent, parseRateLimitLine, latestRateLimits } = require("../electron/quota-reader.cjs");

test("clampPercent constrains percentages", () => {
  assert.equal(clampPercent(-4), 0);
  assert.equal(clampPercent(42.5), 42.5);
  assert.equal(clampPercent(140), 100);
  assert.equal(clampPercent("bad"), null);
});

test("parseRateLimitLine returns remaining percentages", () => {
  const line = JSON.stringify({
    timestamp: "2026-07-11T01:00:00.000Z",
    payload: {
      rate_limits: {
        limit_id: "codex",
        primary: { used_percent: 32, window_minutes: 300, resets_at: 2000000000 },
        secondary: { used_percent: 58, window_minutes: 10080, resets_at: 2000600000 },
      },
    },
  });

  const snapshot = parseRateLimitLine(line, "sample.jsonl");
  assert.equal(snapshot.primaryRemaining, 68);
  assert.equal(snapshot.secondaryRemaining, 42);
  assert.equal(snapshot.limitId, "codex");
  assert.equal(snapshot.primaryWindowMinutes, 300);
  assert.equal(snapshot.secondaryWindowMinutes, 10080);
});

test("parseRateLimitLine ignores unrelated events", () => {
  assert.equal(parseRateLimitLine('{"payload":{}}', "sample.jsonl"), null);
});

test("latestRateLimits ignores newer model-specific limits", (context) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "codex-quota-test-"));
  context.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const sessions = path.join(home, "sessions", "2026", "07", "11");
  fs.mkdirSync(sessions, { recursive: true });

  const generic = JSON.stringify({
    timestamp: "2026-07-11T02:29:42.000Z",
    payload: {
      rate_limits: {
        limit_id: "codex",
        primary: { used_percent: 32, window_minutes: 300, resets_at: 2000000000 },
        secondary: { used_percent: 5, window_minutes: 10080, resets_at: 2000600000 },
      },
    },
  });
  const spark = JSON.stringify({
    timestamp: "2026-07-11T03:02:22.000Z",
    payload: {
      rate_limits: {
        limit_id: "codex_bengalfox",
        limit_name: "GPT-5.3-Codex-Spark",
        primary: { used_percent: 0, window_minutes: 300, resets_at: 2000000100 },
        secondary: { used_percent: 0, window_minutes: 10080, resets_at: 2000600100 },
      },
    },
  });
  fs.writeFileSync(path.join(sessions, "generic.jsonl"), `${generic}\n`);
  fs.writeFileSync(path.join(sessions, "spark.jsonl"), `${spark}\n`);

  const snapshot = latestRateLimits(home);
  assert.equal(snapshot.available, true);
  assert.equal(snapshot.limitId, "codex");
  assert.equal(snapshot.primaryRemaining, 68);
  assert.equal(snapshot.secondaryRemaining, 95);
});

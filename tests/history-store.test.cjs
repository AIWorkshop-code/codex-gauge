const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { HistoryStore, MAX_AGE_MS, MIN_SAMPLE_INTERVAL_MS } = require("../electron/history-store.cjs");

test("records valid snapshots and throttles dense samples", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-gauge-history-"));
  const store = new HistoryStore(path.join(directory, "history.json"));
  const snapshot = { available: true, primaryRemaining: 80, secondaryRemaining: 60, source: "app-server" };
  assert.equal(store.record(snapshot, 100_000), true);
  assert.equal(store.record(snapshot, 100_000 + MIN_SAMPLE_INTERVAL_MS - 1), false);
  assert.equal(store.read().length, 1);
});

test("prunes samples older than thirty days", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-gauge-history-"));
  const store = new HistoryStore(path.join(directory, "history.json"));
  const snapshot = { available: true, primaryRemaining: 80, secondaryRemaining: 60 };
  store.record(snapshot, 100_000);
  store.record(snapshot, 100_000 + MAX_AGE_MS + MIN_SAMPLE_INTERVAL_MS);
  assert.equal(store.read().length, 1);
});

test("records weekly-only snapshots without inventing a primary value", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-gauge-history-"));
  const store = new HistoryStore(path.join(directory, "history.json"));
  const snapshot = { available: true, primaryRemaining: null, secondaryRemaining: 96, source: "app-server" };
  assert.equal(store.record(snapshot, 100_000), true);
  assert.deepEqual(store.read()[0], {
    timestamp: 100_000,
    secondaryRemaining: 96,
    source: "app-server",
  });
});

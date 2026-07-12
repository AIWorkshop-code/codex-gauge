const test = require("node:test");
const assert = require("node:assert/strict");
const { compareVersions, normalizeVersion, releaseSummary } = require("../electron/github-release.cjs");

test("normalizes GitHub release tags", () => {
  assert.equal(normalizeVersion("v0.5.2"), "0.5.2");
});

test("compares release versions numerically", () => {
  assert.equal(compareVersions("0.5.2", "0.5.1"), 1);
  assert.equal(compareVersions("0.5.2", "0.5.2"), 0);
  assert.equal(compareVersions("0.5.2", "0.6.0"), -1);
});

test("extracts update details from a GitHub release", () => {
  assert.deepEqual(releaseSummary({
    tag_name: "v0.5.2",
    html_url: "https://github.com/AIWorkshop-code/codex-gauge/releases/tag/v0.5.2",
    body: "新增紧凑模式",
  }), {
    version: "0.5.2",
    releaseUrl: "https://github.com/AIWorkshop-code/codex-gauge/releases/tag/v0.5.2",
    notes: "新增紧凑模式",
  });
});

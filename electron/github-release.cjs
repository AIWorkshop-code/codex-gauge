const LATEST_RELEASE_API = "https://api.github.com/repos/AIWorkshop-code/codex-gauge/releases/latest";

function normalizeVersion(value) {
  return String(value || "").trim().replace(/^v/i, "").split("-")[0];
}

function compareVersions(left, right) {
  const a = normalizeVersion(left).split(".").map((part) => Number(part) || 0);
  const b = normalizeVersion(right).split(".").map((part) => Number(part) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function releaseSummary(release) {
  const version = normalizeVersion(release?.tag_name || release?.name);
  const releaseUrl = release?.html_url;
  if (!version || !releaseUrl) throw new Error("GitHub Release 返回的数据不完整");
  const notes = String(release.body || "本次更新未提供详细说明。").trim();
  return {
    version,
    releaseUrl,
    notes: notes.length > 1400 ? `${notes.slice(0, 1400)}\n…` : notes,
  };
}

module.exports = { LATEST_RELEASE_API, compareVersions, normalizeVersion, releaseSummary };

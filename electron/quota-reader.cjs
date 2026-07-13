const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const TAIL_BYTES = 512 * 1024;
const MAX_CANDIDATES = 160;

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(100, Math.max(0, number));
}

function codexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function collectJsonlFiles(root, output = []) {
  if (!fs.existsSync(root)) return output;

  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return output;
  }

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      collectJsonlFiles(fullPath, output);
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      try {
        const stat = fs.statSync(fullPath);
        output.push({ path: fullPath, mtimeMs: stat.mtimeMs, size: stat.size });
      } catch {
        // A live session can rotate while scanning. Ignore it and continue.
      }
    }
  }

  return output;
}

function readTail(filePath, size) {
  const bytes = Math.min(size, TAIL_BYTES);
  if (bytes <= 0) return "";
  const descriptor = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(bytes);
    fs.readSync(descriptor, buffer, 0, bytes, size - bytes);
    return buffer.toString("utf8");
  } finally {
    fs.closeSync(descriptor);
  }
}

function parseRateLimitLine(line, sourcePath) {
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    return null;
  }

  const rateLimits = event?.payload?.rate_limits;
  const primary = rateLimits?.primary;
  const secondary = rateLimits?.secondary;
  const primaryWindowMinutes = Number(primary?.window_minutes) || null;
  const weekly = secondary || (primaryWindowMinutes >= 10080 ? primary : null);
  const shortWindow = weekly === primary ? null : primary;
  if (!weekly) return null;

  const primaryUsed = clampPercent(shortWindow?.used_percent);
  const weeklyUsed = clampPercent(weekly.used_percent);
  if (weeklyUsed === null) return null;

  return {
    limitId: rateLimits.limit_id || null,
    primaryRemaining: primaryUsed === null ? null : Math.round((100 - primaryUsed) * 10) / 10,
    secondaryRemaining: Math.round((100 - weeklyUsed) * 10) / 10,
    primaryWindowMinutes: shortWindow ? (Number(shortWindow.window_minutes) || 300) : null,
    secondaryWindowMinutes: Number(weekly.window_minutes) || 10080,
    primaryResetsAt: shortWindow ? (Number(shortWindow.resets_at) || null) : null,
    secondaryResetsAt: Number(weekly.resets_at) || null,
    collectedAt: event.timestamp || new Date().toISOString(),
    sourcePath,
    limitName: rateLimits.limit_name || null,
  };
}

function latestRateLimits(home = codexHome()) {
  const files = collectJsonlFiles(path.join(home, "sessions"))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, MAX_CANDIDATES);

  let best = null;
  for (const file of files) {
    let tail;
    try {
      tail = readTail(file.path, file.size);
    } catch {
      continue;
    }

    const lines = tail.split(/\r?\n/);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index];
      if (!line.includes('"rate_limits"')) continue;
      const snapshot = parseRateLimitLine(line, file.path);
      if (!snapshot) continue;
      // Codex can emit newer, model-specific rate limits (for example Spark)
      // alongside the shared account quota. The widget represents the shared
      // Codex quota shown in Usage, so named model limits must not win merely
      // because their event is newer.
      if (snapshot.limitId !== "codex") continue;
      const timestamp = Date.parse(snapshot.collectedAt) || file.mtimeMs;
      if (!best || timestamp > best.timestamp) best = { timestamp, snapshot };
      break;
    }
  }

  if (!best) {
    return {
      available: false,
      error: "NO_RATE_LIMIT_DATA",
      checkedAt: new Date().toISOString(),
    };
  }

  const ageMs = Date.now() - best.timestamp;
  return {
    available: true,
    ...best.snapshot,
    source: "session-log",
    stale: ageMs > 2 * 60 * 1000,
    ageMs,
    checkedAt: new Date().toISOString(),
  };
}

module.exports = {
  clampPercent,
  collectJsonlFiles,
  parseRateLimitLine,
  latestRateLimits,
};

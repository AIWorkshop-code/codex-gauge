const fs = require("node:fs");

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_SAMPLE_INTERVAL_MS = 60 * 1000;

class HistoryStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.entries = this.#load();
  }

  #load() {
    try {
      const entries = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      return Array.isArray(entries) ? entries : [];
    } catch {
      return [];
    }
  }

  record(snapshot, now = Date.now()) {
    if (!snapshot?.available) return false;
    const latest = this.entries.at(-1);
    if (latest && now - latest.timestamp < MIN_SAMPLE_INTERVAL_MS) return false;
    const entry = {
      timestamp: now,
      secondaryRemaining: Number(snapshot.secondaryRemaining),
      source: snapshot.source || "unknown",
    };
    if (snapshot.primaryRemaining !== null && snapshot.primaryRemaining !== undefined) {
      entry.primaryRemaining = Number(snapshot.primaryRemaining);
    }
    this.entries.push(entry);
    this.entries = this.entries.filter((entry) => now - entry.timestamp <= MAX_AGE_MS);
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.entries));
    } catch {
      return false;
    }
    return true;
  }

  read() {
    return [...this.entries];
  }

  clear() {
    this.entries = [];
    try {
      fs.writeFileSync(this.filePath, "[]");
    } catch {
      // Clearing in memory still succeeds for this session.
    }
  }
}

module.exports = { HistoryStore, MAX_AGE_MS, MIN_SAMPLE_INTERVAL_MS };

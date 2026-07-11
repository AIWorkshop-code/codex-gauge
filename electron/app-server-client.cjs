const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { EventEmitter } = require("node:events");
const { spawn } = require("node:child_process");

const REQUEST_TIMEOUT_MS = 12_000;

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(100, Math.max(0, number));
}

function normalizeRateLimits(payload, now = Date.now()) {
  const container = payload?.rateLimitsByLimitId?.codex
    || payload?.rateLimits
    || payload;
  if (!container || container.limitId !== "codex") return null;

  const primaryUsed = clampPercent(container.primary?.usedPercent);
  const secondaryUsed = clampPercent(container.secondary?.usedPercent);
  if (primaryUsed === null || secondaryUsed === null) return null;

  return {
    available: true,
    source: "app-server",
    limitId: "codex",
    primaryRemaining: Math.round((100 - primaryUsed) * 10) / 10,
    secondaryRemaining: Math.round((100 - secondaryUsed) * 10) / 10,
    primaryWindowMinutes: Number(container.primary?.windowDurationMins) || 300,
    secondaryWindowMinutes: Number(container.secondary?.windowDurationMins) || 10080,
    primaryResetsAt: Number(container.primary?.resetsAt) || null,
    secondaryResetsAt: Number(container.secondary?.resetsAt) || null,
    collectedAt: new Date(now).toISOString(),
    checkedAt: new Date(now).toISOString(),
    stale: false,
  };
}

function developmentBinary(projectRoot) {
  return path.join(
    projectRoot,
    "node_modules",
    "@openai",
    "codex-win32-x64",
    "vendor",
    "x86_64-pc-windows-msvc",
    "bin",
    "codex.exe",
  );
}

function packagedBinary(resourcesPath) {
  return path.join(resourcesPath, "codex-sidecar", "bin", "codex.exe");
}

class AppServerClient extends EventEmitter {
  constructor({ binaryPath }) {
    super();
    this.binaryPath = binaryPath;
    this.process = null;
    this.reader = null;
    this.pending = new Map();
    this.nextId = 1;
    this.initialized = null;
    this.stopping = false;
  }

  async start() {
    if (this.initialized) return this.initialized;
    this.stopping = false;
    this.initialized = this.#startProcess();
    try {
      await this.initialized;
    } catch (error) {
      this.initialized = null;
      throw error;
    }
  }

  async #startProcess() {
    if (!this.binaryPath || !fs.existsSync(this.binaryPath)) {
      const error = new Error("Codex App Server binary was not found");
      error.code = "APP_SERVER_BINARY_MISSING";
      throw error;
    }

    const child = spawn(this.binaryPath, ["app-server"], {
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
      env: process.env,
    });
    this.process = child;
    this.reader = readline.createInterface({ input: child.stdout });
    this.reader.on("line", (line) => this.#handleLine(line));
    child.on("error", (error) => this.#handleExit(error));
    child.on("exit", (code, signal) => {
      if (this.stopping) return;
      const error = new Error(`Codex App Server exited (${code ?? signal ?? "unknown"})`);
      error.code = "APP_SERVER_EXITED";
      this.#handleExit(error);
    });

    await this.#request("initialize", {
      clientInfo: {
        name: "codex_quota_widget",
        title: "Codex Gauge",
        version: "0.2.0",
      },
    }, 0);
    this.#send({ method: "initialized", params: {} });
  }

  #send(message) {
    if (!this.process?.stdin?.writable) {
      const error = new Error("Codex App Server is not writable");
      error.code = "APP_SERVER_NOT_RUNNING";
      throw error;
    }
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  #request(method, params, forcedId) {
    const id = forcedId ?? this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        const error = new Error(`${method} timed out`);
        error.code = "APP_SERVER_TIMEOUT";
        reject(error);
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timeout });
      try {
        const message = { method, id };
        if (params !== undefined) message.params = params;
        this.#send(message);
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  #handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    if (message.id !== undefined && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if (message.error) {
        const error = new Error(message.error.message || "App Server request failed");
        error.code = message.error.code || "APP_SERVER_REQUEST_FAILED";
        pending.reject(error);
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.method === "account/rateLimits/updated") {
      const snapshot = normalizeRateLimits(message.params);
      if (snapshot) this.emit("updated", snapshot);
    }
  }

  #handleExit(error) {
    for (const { reject, timeout } of this.pending.values()) {
      clearTimeout(timeout);
      reject(error);
    }
    this.pending.clear();
    this.reader?.close();
    this.reader = null;
    this.process = null;
    this.initialized = null;
    this.emit("unavailable", error);
  }

  async readRateLimits() {
    await this.start();
    const result = await this.#request("account/rateLimits/read");
    const snapshot = normalizeRateLimits(result);
    if (!snapshot) {
      const error = new Error("App Server returned no shared Codex rate limit");
      error.code = "APP_SERVER_NO_CODEX_LIMIT";
      throw error;
    }
    return snapshot;
  }

  stop() {
    this.stopping = true;
    this.reader?.close();
    this.reader = null;
    if (this.process && !this.process.killed) this.process.kill();
    this.process = null;
    this.initialized = null;
  }
}

module.exports = {
  AppServerClient,
  normalizeRateLimits,
  developmentBinary,
  packagedBinary,
};

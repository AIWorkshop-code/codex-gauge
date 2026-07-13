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

  const primaryWindowMinutes = Number(container.primary?.windowDurationMins) || null;
  const weeklyWindow = container.secondary
    || (primaryWindowMinutes >= 10080 ? container.primary : null);
  const shortWindow = weeklyWindow === container.primary ? null : container.primary;
  const weeklyUsed = clampPercent(weeklyWindow?.usedPercent);
  const shortUsed = clampPercent(shortWindow?.usedPercent);
  if (weeklyUsed === null) return null;

  return {
    available: true,
    source: "app-server",
    limitId: "codex",
    primaryRemaining: shortUsed === null ? null : Math.round((100 - shortUsed) * 10) / 10,
    secondaryRemaining: Math.round((100 - weeklyUsed) * 10) / 10,
    primaryWindowMinutes: shortWindow ? (Number(shortWindow.windowDurationMins) || 300) : null,
    secondaryWindowMinutes: Number(weeklyWindow.windowDurationMins) || 10080,
    primaryResetsAt: shortWindow ? (Number(shortWindow.resetsAt) || null) : null,
    secondaryResetsAt: Number(weeklyWindow.resetsAt) || null,
    collectedAt: new Date(now).toISOString(),
    checkedAt: new Date(now).toISOString(),
    stale: false,
  };
}

function platformPackage() {
  if (process.platform === "win32" && process.arch === "x64") {
    return { packageName: "codex-win32-x64", target: "x86_64-pc-windows-msvc", executable: "codex.exe" };
  }
  if (process.platform === "darwin" && process.arch === "arm64") {
    return { packageName: "codex-darwin-arm64", target: "aarch64-apple-darwin", executable: "codex" };
  }
  if (process.platform === "darwin" && process.arch === "x64") {
    return { packageName: "codex-darwin-x64", target: "x86_64-apple-darwin", executable: "codex" };
  }
  return null;
}

function developmentBinary(projectRoot) {
  const platform = platformPackage();
  if (!platform) return null;
  let packageRoot;
  try {
    const codexPackage = require.resolve("@openai/codex/package.json", { paths: [projectRoot] });
    const codexPackageRoot = path.dirname(fs.realpathSync(codexPackage));
    packageRoot = path.join(path.dirname(codexPackageRoot), platform.packageName);
  } catch {
    return null;
  }
  return path.join(
    packageRoot,
    "vendor",
    platform.target,
    "bin",
    platform.executable,
  );
}

function packagedBinary(resourcesPath) {
  const platform = platformPackage();
  if (!platform) return null;
  return path.join(resourcesPath, "codex-sidecar", "bin", platform.executable);
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

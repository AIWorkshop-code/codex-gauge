const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow, ipcMain, Menu, powerMonitor, screen } = require("electron");
const { latestRateLimits } = require("./quota-reader.cjs");
const {
  AppServerClient,
  developmentBinary,
  packagedBinary,
} = require("./app-server-client.cjs");

let mainWindow;
let appServerClient;
let saveBoundsTimer;

const BASE_WIDTH = 440;
const BASE_HEIGHT = 194;
const ASPECT_RATIO = BASE_WIDTH / BASE_HEIGHT;

const legacyUserDataPath = path.join(app.getPath("appData"), "codex-quota-widget");
const gaugeUserDataPath = path.join(app.getPath("appData"), "Codex Gauge");
try {
  fs.mkdirSync(gaugeUserDataPath, { recursive: true });
  const legacyState = path.join(legacyUserDataPath, "window-state.json");
  const gaugeState = path.join(gaugeUserDataPath, "window-state.json");
  if (!fs.existsSync(gaugeState) && fs.existsSync(legacyState)) {
    fs.copyFileSync(legacyState, gaugeState);
  }
  app.setPath("userData", gaugeUserDataPath);
} catch {
  // Fall back to Electron's default userData path if migration is unavailable.
}

function windowStatePath() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function loadWindowState() {
  try {
    const state = JSON.parse(fs.readFileSync(windowStatePath(), "utf8"));
    const width = Number(state.width);
    const height = Number(state.height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    const normalizedWidth = Math.min(660, Math.max(176, Math.round(width)));
    return {
      width: normalizedWidth,
      height: Math.round(normalizedWidth / ASPECT_RATIO),
      x: Number.isFinite(Number(state.x)) ? Math.round(Number(state.x)) : undefined,
      y: Number.isFinite(Number(state.y)) ? Math.round(Number(state.y)) : undefined,
    };
  } catch {
    return null;
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  try {
    fs.writeFileSync(windowStatePath(), JSON.stringify(bounds));
  } catch {
    // Window state persistence is optional; the widget continues normally.
  }
}

function scheduleSaveWindowState() {
  if (process.argv.includes("--screenshot")) return;
  clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(saveWindowState, 250);
}

function setPresetSize(width) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  const height = Math.round(width / ASPECT_RATIO);
  mainWindow.setBounds({ ...bounds, width, height }, true);
  scheduleSaveWindowState();
}

function testWindowSize() {
  if (!process.argv.includes("--screenshot")) return null;
  const match = /^(\d+)x(\d+)$/.exec(process.env.CODEX_WIDGET_TEST_SIZE || "");
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

function appServerBinary() {
  if (process.env.CODEX_SIDECAR_PATH) return process.env.CODEX_SIDECAR_PATH;
  if (app.isPackaged) return packagedBinary(process.resourcesPath);
  return developmentBinary(path.join(__dirname, ".."));
}

async function readQuota() {
  if (process.argv.includes("--reference-state")) {
    return {
      available: true,
      source: "reference",
      primaryRemaining: 68,
      secondaryRemaining: 42,
      primaryResetsAt: Math.floor(Date.now() / 1000) + 2 * 3600 + 18 * 60,
      stale: false,
    };
  }

  try {
    return await appServerClient.readRateLimits();
  } catch (appServerError) {
    const fallback = latestRateLimits();
    if (!fallback.available || fallback.stale) {
      return {
        available: false,
        source: "unavailable",
        error: fallback.stale ? "STALE_LOG_DATA" : fallback.error,
        appServerError: appServerError.code || "APP_SERVER_FAILED",
        checkedAt: new Date().toISOString(),
      };
    }
    return {
      ...fallback,
      appServerError: appServerError.code || "APP_SERVER_FAILED",
    };
  }
}

function positionWindow(window) {
  const display = screen.getPrimaryDisplay();
  const { x, y, width } = display.workArea;
  const [windowWidth] = window.getSize();
  window.setPosition(x + width - windowWidth - 28, y + 28, false);
}

function createWindow() {
  const savedState = loadWindowState();
  const testSize = testWindowSize();
  mainWindow = new BrowserWindow({
    width: testSize?.width || savedState?.width || 220,
    height: testSize?.height || savedState?.height || 97,
    x: savedState?.x,
    y: savedState?.y,
    frame: false,
    transparent: false,
    backgroundColor: "#f2f6f7",
    backgroundMaterial: "none",
    roundedCorners: true,
    thickFrame: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setAlwaysOnTop(true, "floating");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  mainWindow.setAspectRatio(ASPECT_RATIO);
  if (!savedState || savedState.x === undefined || savedState.y === undefined) {
    positionWindow(mainWindow);
  }
  mainWindow.on("resize", scheduleSaveWindowState);
  mainWindow.on("move", scheduleSaveWindowState);

  if (process.argv.includes("--screenshot")) {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (!app.isPackaged) {
    mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", async () => {
    mainWindow.show();
    scheduleSaveWindowState();
    if (process.argv.includes("--screenshot")) {
      await new Promise((resolve) => setTimeout(resolve, 3500));
      const image = await mainWindow.webContents.capturePage();
      const target = process.env.CODEX_WIDGET_SCREENSHOT_PATH
        || path.join(app.getPath("userData"), "widget-implementation.png");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, image.toPNG());
      console.log(target);
      app.quit();
    }
  });
}

function openContextMenu() {
  if (!mainWindow) return;
  const menu = Menu.buildFromTemplate([
    {
      label: "置于顶层",
      type: "checkbox",
      checked: mainWindow.isAlwaysOnTop(),
      click: (item) => mainWindow.setAlwaysOnTop(item.checked, "floating"),
    },
    {
      label: "大小",
      submenu: [
        { label: "小（50%）", click: () => setPresetSize(220) },
        { label: "中（75%）", click: () => setPresetSize(330) },
        { label: "大（100%）", click: () => setPresetSize(440) },
      ],
    },
    {
      label: "重置位置",
      click: () => positionWindow(mainWindow),
    },
    { type: "separator" },
    { label: "退出", role: "quit" },
  ]);
  menu.popup({ window: mainWindow });
}

app.whenReady().then(() => {
  app.setLoginItemSettings({ openAtLogin: app.isPackaged && !process.argv.includes("--screenshot") });
  appServerClient = new AppServerClient({ binaryPath: appServerBinary() });
  appServerClient.on("updated", (snapshot) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("quota:updated", snapshot);
    }
  });
  const refreshAfterSystemWake = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("quota:refresh");
    }
  };
  powerMonitor.on("resume", refreshAfterSystemWake);
  powerMonitor.on("unlock-screen", refreshAfterSystemWake);
  ipcMain.handle("quota:read", () => readQuota());
  ipcMain.handle("widget:menu", () => openContextMenu());
  createWindow();
});

app.on("window-all-closed", () => app.quit());

app.on("before-quit", () => {
  clearTimeout(saveBoundsTimer);
  if (!process.argv.includes("--screenshot")) saveWindowState();
  appServerClient?.stop();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

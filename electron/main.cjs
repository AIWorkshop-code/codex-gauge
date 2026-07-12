const path = require("node:path");
const fs = require("node:fs");
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  net,
  Notification,
  powerMonitor,
  screen,
  shell,
  Tray,
} = require("electron");
const {
  LATEST_RELEASE_API,
  compareVersions,
  releaseSummary,
} = require("./github-release.cjs");
const { latestRateLimits } = require("./quota-reader.cjs");
const { HistoryStore } = require("./history-store.cjs");
const {
  AppServerClient,
  developmentBinary,
  packagedBinary,
} = require("./app-server-client.cjs");

let mainWindow;
let historyWindow;
let announcementWindow;
let appServerClient;
let historyStore;
let tray;
let saveBoundsTimer;
let preferences;
let currentSnapshot = { available: false };
let lastNotificationWindows = {};
let macUpdateCheckPromise;
let announcementRestoreBounds;

const MEMBERSHIP_OFFER_URL = "https://pay.ldxp.cn/shop/EZ1G95SK";
const ANNOUNCEMENT_WIDTH = 350;
const ANNOUNCEMENT_HEIGHT = 118;

const BASE_WIDTH = 440;
const BASE_HEIGHT = 194;
const ASPECT_RATIO = BASE_WIDTH / BASE_HEIGHT;
const DEFAULT_PREFERENCES = {
  themeSource: "system",
  countdownWindow: "primary",
  notificationsEnabled: true,
  primaryNotificationThreshold: 15,
  secondaryNotificationThreshold: 10,
  launchAtLogin: false,
  trayEnabled: true,
  displayMode: "full",
};

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

function preferencesPath() {
  return path.join(app.getPath("userData"), "preferences.json");
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadPreferences() {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(preferencesPath(), "utf8"));
  } catch {
    // Defaults are used for first launch.
  }
  if (process.argv.includes("--screenshot") && ["system", "light", "dark"].includes(process.env.CODEX_WIDGET_THEME)) {
    saved.themeSource = process.env.CODEX_WIDGET_THEME;
  }
  if (process.argv.includes("--screenshot") && ["full", "primary"].includes(process.env.CODEX_WIDGET_DISPLAY_MODE)) {
    saved.displayMode = process.env.CODEX_WIDGET_DISPLAY_MODE;
  }
  return { ...DEFAULT_PREFERENCES, ...saved };
}

function savePreferences() {
  try {
    fs.writeFileSync(preferencesPath(), JSON.stringify(preferences));
  } catch {
    // Preference persistence is optional.
  }
}

function updatePreference(key, value) {
  preferences[key] = value;
  savePreferences();
  if (key === "themeSource") nativeTheme.themeSource = value;
  if (key === "launchAtLogin" && app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: value });
  }
  if (key === "trayEnabled") updateTray();
  if (key === "displayMode") applyDisplayMode(value);
  mainWindow?.webContents.send("preferences:updated", preferences);
}

function windowBackgroundColor() {
  return nativeTheme.shouldUseDarkColors ? "#171b1d" : "#f2f6f7";
}

function loadWindowState() {
  try {
    const state = JSON.parse(fs.readFileSync(windowStatePath(), "utf8"));
    const width = Number(state.width);
    const height = Number(state.height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    if (preferences?.displayMode === "primary") {
      const side = Math.min(291, Math.max(78, Math.round(width)));
      return {
        width: side,
        height: side,
        x: Number.isFinite(Number(state.x)) ? Math.round(Number(state.x)) : undefined,
        y: Number.isFinite(Number(state.y)) ? Math.round(Number(state.y)) : undefined,
      };
    }
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
  if (preferences.displayMode === "primary") {
    const side = Math.round(width / ASPECT_RATIO);
    mainWindow.setBounds({ ...bounds, width: side, height: side }, true);
  } else {
    const height = Math.round(width / ASPECT_RATIO);
    mainWindow.setBounds({ ...bounds, width, height }, true);
  }
  scheduleSaveWindowState();
}

function applyDisplayMode(mode) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  if (mode === "primary") {
    const side = Math.min(291, Math.max(78, bounds.height));
    mainWindow.setAspectRatio(1);
    mainWindow.setBounds({ ...bounds, width: side, height: side }, true);
  } else {
    const height = Math.min(291, Math.max(78, bounds.height));
    mainWindow.setAspectRatio(ASPECT_RATIO);
    mainWindow.setBounds({ ...bounds, width: Math.round(height * ASPECT_RATIO), height }, true);
  }
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
    const snapshot = {
      available: true,
      source: "reference",
      primaryRemaining: 68,
      secondaryRemaining: 42,
      primaryResetsAt: Math.floor(Date.now() / 1000) + 2 * 3600 + 18 * 60,
      stale: false,
    };
    acceptSnapshot(snapshot);
    return snapshot;
  }

  try {
    const snapshot = await appServerClient.readRateLimits();
    acceptSnapshot(snapshot);
    return snapshot;
  } catch (appServerError) {
    const fallback = latestRateLimits();
    if (!fallback.available || fallback.stale) {
      const snapshot = {
        available: false,
        source: "unavailable",
        error: fallback.stale ? "STALE_LOG_DATA" : fallback.error,
        appServerError: appServerError.code || "APP_SERVER_FAILED",
        checkedAt: new Date().toISOString(),
      };
      acceptSnapshot(snapshot);
      return snapshot;
    }
    const snapshot = {
      ...fallback,
      appServerError: appServerError.code || "APP_SERVER_FAILED",
    };
    acceptSnapshot(snapshot);
    return snapshot;
  }
}

function quotaWindowKey(snapshot) {
  return `${snapshot.primaryResetsAt || "none"}:${snapshot.secondaryResetsAt || "none"}`;
}

function showQuotaNotification(title, body) {
  if (!preferences.notificationsEnabled || !Notification.isSupported()) return;
  new Notification({ title, body, silent: false }).show();
}

function evaluateNotifications(snapshot, previousSnapshot) {
  if (!snapshot.available) return;
  const windowKey = quotaWindowKey(snapshot);
  if (lastNotificationWindows.primary !== windowKey
    && snapshot.primaryRemaining <= preferences.primaryNotificationThreshold) {
    lastNotificationWindows.primary = windowKey;
    showQuotaNotification("Codex 5H 额度不足", `剩余 ${snapshot.primaryRemaining}%，将在当前额度窗口内继续监控。`);
  }
  if (lastNotificationWindows.secondary !== windowKey
    && snapshot.secondaryRemaining <= preferences.secondaryNotificationThreshold) {
    lastNotificationWindows.secondary = windowKey;
    showQuotaNotification("Codex 7D 额度不足", `剩余 ${snapshot.secondaryRemaining}%，请留意本周用量。`);
  }
  if (previousSnapshot?.available
    && previousSnapshot.primaryResetsAt !== snapshot.primaryResetsAt
    && snapshot.primaryRemaining > previousSnapshot.primaryRemaining + 20) {
    showQuotaNotification("Codex 5H 额度已恢复", `当前剩余 ${snapshot.primaryRemaining}%。`);
  }
}

function acceptSnapshot(snapshot) {
  const previousSnapshot = currentSnapshot;
  currentSnapshot = snapshot;
  const recorded = historyStore?.record(snapshot);
  if (recorded) historyWindow?.webContents.send("history:updated", historyStore.read());
  evaluateNotifications(snapshot, previousSnapshot);
  updateTray();
}

function formatCheckedAt(snapshot) {
  const value = snapshot?.checkedAt || snapshot?.collectedAt;
  return value ? new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--";
}

function positionWindow(window) {
  const display = screen.getPrimaryDisplay();
  const { x, y, width } = display.workArea;
  const [windowWidth] = window.getSize();
  window.setPosition(x + width - windowWidth - 28, y + 28, false);
}

function positionAnnouncement() {
  if (!mainWindow || mainWindow.isDestroyed() || !announcementWindow || announcementWindow.isDestroyed()) return;
  let bounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const workArea = display.workArea;
  const requiredTop = ANNOUNCEMENT_HEIGHT + 8;
  if (bounds.y - requiredTop < workArea.y + 8 && !announcementRestoreBounds) {
    announcementRestoreBounds = bounds;
    bounds = { ...bounds, y: workArea.y + requiredTop + 8 };
    mainWindow.setBounds(bounds, false);
  }
  const x = Math.round(bounds.x + (bounds.width - ANNOUNCEMENT_WIDTH) / 2);
  const clampedX = Math.min(
    workArea.x + workArea.width - ANNOUNCEMENT_WIDTH - 8,
    Math.max(workArea.x + 8, x),
  );
  announcementWindow.setBounds({
    x: clampedX,
    y: bounds.y - requiredTop,
    width: ANNOUNCEMENT_WIDTH,
    height: ANNOUNCEMENT_HEIGHT,
  }, false);
}

function closeAnnouncement() {
  if (announcementWindow && !announcementWindow.isDestroyed()) announcementWindow.close();
}

function createAnnouncementWindow(manual = false) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (announcementWindow && !announcementWindow.isDestroyed()) {
    positionAnnouncement();
    announcementWindow.show();
    return;
  }
  const forceShow = manual || process.env.CODEX_WIDGET_ANNOUNCEMENT === "1";
  const today = localDateKey();
  if (!forceShow && preferences.lastAnnouncementDate === today) return;
  preferences.lastAnnouncementDate = today;
  savePreferences();

  announcementWindow = new BrowserWindow({
    width: ANNOUNCEMENT_WIDTH,
    height: ANNOUNCEMENT_HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    roundedCorners: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    parent: mainWindow,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  announcementWindow.setAlwaysOnTop(true, "floating");
  announcementWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  if (process.env.VITE_DEV_SERVER_URL) {
    announcementWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}/?view=announcement`);
  } else if (!app.isPackaged && !process.argv.includes("--screenshot")) {
    announcementWindow.loadURL("http://127.0.0.1:5173/?view=announcement");
  } else {
    announcementWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"), { query: { view: "announcement" } });
  }
  positionAnnouncement();
  announcementWindow.once("ready-to-show", async () => {
    positionAnnouncement();
    announcementWindow.show();
    if (process.argv.includes("--screenshot") && process.env.CODEX_WIDGET_ANNOUNCEMENT_SCREENSHOT_PATH) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      const image = await announcementWindow.webContents.capturePage();
      const target = process.env.CODEX_WIDGET_ANNOUNCEMENT_SCREENSHOT_PATH;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, image.toPNG());
    }
  });
  announcementWindow.on("closed", () => {
    announcementWindow = null;
    if (announcementRestoreBounds && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBounds(announcementRestoreBounds, false);
    }
    announcementRestoreBounds = null;
  });
}

function createWindow() {
  const savedState = loadWindowState();
  const testSize = testWindowSize();
  const primaryOnly = preferences.displayMode === "primary";
  mainWindow = new BrowserWindow({
    width: testSize?.width || savedState?.width || (primaryOnly ? 97 : 220),
    height: testSize?.height || savedState?.height || 97,
    x: savedState?.x,
    y: savedState?.y,
    frame: false,
    transparent: false,
    backgroundColor: windowBackgroundColor(),
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
  mainWindow.setAspectRatio(preferences.displayMode === "primary" ? 1 : ASPECT_RATIO);
  if (!savedState || savedState.x === undefined || savedState.y === undefined) {
    positionWindow(mainWindow);
  }
  mainWindow.on("resize", scheduleSaveWindowState);
  mainWindow.on("move", scheduleSaveWindowState);
  mainWindow.on("resize", positionAnnouncement);
  mainWindow.on("move", positionAnnouncement);

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
    if (!process.argv.includes("--screenshot") || process.env.CODEX_WIDGET_ANNOUNCEMENT === "1") {
      setTimeout(createAnnouncementWindow, process.argv.includes("--screenshot") ? 100 : 900);
    }
    if (process.argv.includes("--screenshot")) {
      const screenshotDelay = Number(process.env.CODEX_WIDGET_SCREENSHOT_DELAY_MS) || 3500;
      await new Promise((resolve) => setTimeout(resolve, screenshotDelay));
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

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  mainWindow.show();
  mainWindow.focus();
}

function createTrayImage() {
  if (process.platform === "darwin") {
    const image = nativeImage.createFromNamedImage("NSStatusAvailable");
    image.setTemplateImage(true);
    return image;
  }
  return nativeImage.createFromPath(process.execPath);
}

function updateTray() {
  if (!preferences?.trayEnabled) {
    tray?.destroy();
    tray = null;
    return;
  }
  if (!tray) {
    tray = new Tray(createTrayImage());
    tray.on("click", showMainWindow);
  }
  const primary = currentSnapshot.available ? `${currentSnapshot.primaryRemaining}%` : "--";
  if (process.platform === "darwin") tray.setTitle(` ${primary}`);
  tray.setToolTip(`Codex Gauge · 5H ${primary}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `5H 剩余 ${primary}`, enabled: false },
    { label: currentSnapshot.available ? `7D 剩余 ${currentSnapshot.secondaryRemaining}%` : "7D 剩余 --", enabled: false },
    { type: "separator" },
    { label: "显示组件", click: showMainWindow },
    { label: "查看用量历史", click: openHistoryWindow },
    { type: "separator" },
    { label: "退出", role: "quit" },
  ]));
}

function openHistoryWindow() {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.show();
    historyWindow.focus();
    return;
  }
  historyWindow = new BrowserWindow({
    width: 720,
    height: 500,
    minWidth: 620,
    minHeight: 420,
    title: "Codex Gauge · 用量历史",
    backgroundColor: windowBackgroundColor(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (!app.isPackaged) historyWindow.loadURL("http://127.0.0.1:5173/?view=history");
  else historyWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"), { query: { view: "history" } });
  historyWindow.on("closed", () => { historyWindow = null; });
}

async function checkMacRelease(manual = false) {
  if (macUpdateCheckPromise) return macUpdateCheckPromise;
  macUpdateCheckPromise = (async () => {
    const response = await net.fetch(LATEST_RELEASE_API, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `Codex-Gauge/${app.getVersion()}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) throw new Error(`GitHub Release 请求失败（HTTP ${response.status}）`);
    const release = releaseSummary(await response.json());
    if (compareVersions(release.version, app.getVersion()) <= 0) {
      if (manual) {
        await dialog.showMessageBox(mainWindow, {
          type: "info",
          title: "检查更新",
          message: "当前已是最新版本",
          detail: `Codex Gauge ${app.getVersion()}`,
        });
      }
      return;
    }

    const result = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "发现新版本",
      message: `Codex Gauge ${release.version} 可以下载`,
      detail: `${release.notes}\n\n下载后请退出 Codex Gauge，将新版本拖入“应用程序”并选择覆盖。`,
      buttons: ["下载更新", "稍后"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (result.response === 0) {
      await shell.openExternal(release.releaseUrl);
      await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "安装更新",
        message: "GitHub Release 已打开",
        detail: "下载 macOS DMG，退出当前版本，然后将新的 Codex Gauge 拖入“应用程序”文件夹并选择覆盖。",
        buttons: ["知道了"],
      });
    }
  })().catch(async (error) => {
    if (manual) {
      await dialog.showMessageBox(mainWindow, {
        type: "error",
        title: "检查更新失败",
        message: "暂时无法连接 GitHub Release",
        detail: error.message,
      });
    }
  }).finally(() => {
    macUpdateCheckPromise = null;
  });
  return macUpdateCheckPromise;
}

async function checkForUpdates() {
  if (!app.isPackaged) {
    await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "检查更新",
      message: "开发版不执行自动更新",
      detail: "正式打包安装后会自动检查 GitHub Releases。",
    });
    return;
  }
  if (process.platform === "darwin") {
    await checkMacRelease(true);
    return;
  }
  try {
    const { autoUpdater } = require("electron-updater");
    await autoUpdater.checkForUpdates();
  } catch (error) {
    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "检查更新失败",
      message: "暂时无法检查更新",
      detail: error.message,
    });
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;
  if (process.platform === "darwin") {
    setTimeout(() => checkMacRelease(false), 10_000);
    return;
  }
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("update-downloaded", async (info) => {
      const result = await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Codex Gauge 更新就绪",
        message: `新版本 ${info.version} 已下载`,
        detail: "现在重启即可完成更新。",
        buttons: ["立即重启", "稍后"],
        defaultId: 0,
        cancelId: 1,
      });
      if (result.response === 0) autoUpdater.quitAndInstall();
    });
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 10_000);
  } catch {
    // Update support is optional in development installs.
  }
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
      label: "显示内容",
      submenu: [
        {
          label: "完整模式",
          type: "radio",
          checked: preferences.displayMode === "full",
          click: () => updatePreference("displayMode", "full"),
        },
        {
          label: "仅显示 5H",
          type: "radio",
          checked: preferences.displayMode === "primary",
          click: () => updatePreference("displayMode", "primary"),
        },
      ],
    },
    {
      label: "外观",
      submenu: [
        {
          label: "自动",
          type: "radio",
          checked: nativeTheme.themeSource === "system",
          click: () => updatePreference("themeSource", "system"),
        },
        {
          label: "浅色",
          type: "radio",
          checked: nativeTheme.themeSource === "light",
          click: () => updatePreference("themeSource", "light"),
        },
        {
          label: "深色",
          type: "radio",
          checked: nativeTheme.themeSource === "dark",
          click: () => updatePreference("themeSource", "dark"),
        },
      ],
    },
    {
      label: "倒计时",
      submenu: [
        {
          label: "5H 重置",
          type: "radio",
          checked: preferences.countdownWindow === "primary",
          click: () => updatePreference("countdownWindow", "primary"),
        },
        {
          label: "7D 重置",
          type: "radio",
          checked: preferences.countdownWindow === "secondary",
          click: () => updatePreference("countdownWindow", "secondary"),
        },
      ],
    },
    {
      label: "额度通知",
      type: "checkbox",
      checked: preferences.notificationsEnabled,
      click: (item) => updatePreference("notificationsEnabled", item.checked),
    },
    {
      label: "登录时启动",
      type: "checkbox",
      checked: preferences.launchAtLogin,
      click: (item) => updatePreference("launchAtLogin", item.checked),
    },
    {
      label: "托盘 / 菜单栏",
      type: "checkbox",
      checked: preferences.trayEnabled,
      click: (item) => updatePreference("trayEnabled", item.checked),
    },
    { label: "查看用量历史", click: openHistoryWindow },
    { label: "会员服务公告", click: () => createAnnouncementWindow(true) },
    {
      label: "数据状态",
      submenu: [
        { label: `来源：${currentSnapshot.source || "不可用"}`, enabled: false },
        { label: `最后更新：${formatCheckedAt(currentSnapshot)}`, enabled: false },
        {
          label: !currentSnapshot.available
            ? "状态：不可用"
            : (currentSnapshot.stale ? "状态：数据已过期" : "状态：正常"),
          enabled: false,
        },
        {
          label: "复制诊断信息",
          click: () => require("electron").clipboard.writeText(JSON.stringify({
            version: app.getVersion(),
            platform: `${process.platform}-${process.arch}`,
            snapshot: currentSnapshot,
          }, null, 2)),
        },
      ],
    },
    { label: "检查更新", click: checkForUpdates },
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
  preferences = loadPreferences();
  nativeTheme.themeSource = preferences.themeSource;
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: preferences.launchAtLogin });
  historyStore = new HistoryStore(path.join(app.getPath("userData"), "quota-history.json"));
  if (process.platform === "win32") {
    app.setLoginItemSettings({ openAtLogin: app.isPackaged && !process.argv.includes("--screenshot") });
  }
  appServerClient = new AppServerClient({ binaryPath: appServerBinary() });
  appServerClient.on("updated", (snapshot) => {
    acceptSnapshot(snapshot);
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
  ipcMain.handle("preferences:read", () => preferences);
  ipcMain.handle("history:read", () => historyStore.read());
  ipcMain.handle("history:clear", () => {
    historyStore.clear();
    historyWindow?.webContents.send("history:updated", []);
  });
  ipcMain.handle("widget:menu", () => openContextMenu());
  ipcMain.handle("announcement:open-offer", async () => {
    await shell.openExternal(MEMBERSHIP_OFFER_URL);
    closeAnnouncement();
  });
  ipcMain.handle("announcement:close", () => closeAnnouncement());
  createWindow();
  updateTray();
  setupAutoUpdater();
  nativeTheme.on("updated", () => {
    mainWindow?.setBackgroundColor(windowBackgroundColor());
    historyWindow?.setBackgroundColor(windowBackgroundColor());
  });
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

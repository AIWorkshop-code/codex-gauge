# Codex Gauge 开发交接

更新时间：2026-07-11

当前版本：0.4.1

仓库：<https://github.com/AIWorkshop-code/codex-gauge>

## 1. 产品目标

Codex Gauge 是一个常驻 Windows 桌面的 Codex 额度小组件。界面保持极简，只显示：

- 5 小时额度：圆形仪表盘。
- 7 天额度：水平进度条。
- 5 小时额度重置倒计时。

默认窗口约为 220 × 97，设计基准为 440 × 194。窗口无标题栏、始终置顶、支持原生拖动和等比例缩放，并保存位置与尺寸。

## 2. 当前实现

技术栈：

- Electron 37
- React 19 + Vite 6
- Canvas 2D UI
- Codex App Server JSON-RPC
- electron-builder + NSIS

可视界面不是普通 DOM/SVG 仪表盘，而是绘制到一张 1320 × 582 的高分辨率 Canvas，再由 GPU 随窗口缩放。Canvas 只在额度或倒计时变化时重绘，窗口缩放不会触发 React 布局重排。

## 3. 数据读取

主通道：应用内置官方 Codex CLI sidecar，启动 `codex app-server`，通过 stdio JSON-RPC 调用：

- `initialize`
- `account/rateLimits/read`
- `account/rateLimits/updated`

刷新策略：

- 启动时立即读取。
- App Server 通知时立即更新。
- 每 30 秒主动校准。
- Windows 恢复或解锁时立即读取。

降级通道：当 App Server 不可用时，读取 `%USERPROFILE%\.codex\sessions` 中 Codex 已写入的 `limit_id: codex` 限额状态。超过 2 分钟的日志快照视为过期，模型专属限额不会覆盖通用额度。

应用不会发起模型任务，因此日常查看额度不会消耗 Codex 额度。

## 4. Windows 窗口关键决策

当前稳定方案：

- `frame: false`
- `transparent: false`
- 浅色稳定背景 + Windows 系统圆角
- `resizable: true`
- `setAspectRatio(440 / 194)`
- 不设置 BrowserWindow 原生 `minWidth` / `minHeight` / `maxWidth` / `maxHeight`
- 窗口内部使用 CSS `-webkit-app-region: drag`

不要轻易恢复以下实现：

- 透明窗口：Electron 透明窗口无法可靠使用 Windows 原生缩放。
- React 鼠标坐标拖动：会与无边框窗口边缘缩放命中冲突。
- `will-resize + preventDefault + setBounds`：快速缩放会闪屏。
- 停止拖动后延时校正比例：有明显延迟和跳动。
- BrowserWindow 原生最小/最大尺寸配合厚边框：单击边缘可能触发系统补偿放大。
- 固定 DOM/SVG 画布再通过 React 更新 `transform: scale()`：快速拖动会露出空白区域。

## 5. 运行与测试

新电脑需要 Node.js 22.12 或更高版本，并确保 Codex 已登录。

```powershell
git clone https://github.com/AIWorkshop-code/codex-gauge.git
cd codex-gauge
npm install
npm run dev:desktop
```

测试与构建：

```powershell
npm test
npm run build
npm run build:desktop
```

NSIS 安装包输出到 `release/`。安装包和构建产物不提交到 Git。

## 6. 打包注意事项

- electron-builder 固定为 26.0.12。
- 26.15.3 在当前 Node 环境中会因 `@noble/hashes` ESM/CommonJS 冲突而失败。
- `win.signAndEditExecutable` 当前为 `false`，用于绕过 Windows 无符号链接权限导致的 winCodeSign 解压失败。
- 当前没有代码签名证书和自定义应用图标，安装时可能显示“未知发布者”，并使用 Electron 默认图标。
- 安装包约 190 MB，主要因为包含 Windows Codex CLI sidecar。

## 7. 配置与迁移

窗口状态保存在：

```text
%APPDATA%\Codex Gauge\window-state.json
```

程序会在首次启动时尝试从旧目录迁移：

```text
%APPDATA%\codex-quota-widget\window-state.json
```

## 8. 关键文件

- `electron/main.cjs`：窗口、菜单、状态保存、App Server 生命周期。
- `electron/app-server-client.cjs`：Codex App Server JSON-RPC 客户端。
- `electron/quota-reader.cjs`：本地会话日志降级读取。
- `electron/preload.cjs`：安全 IPC 暴露。
- `src/App.jsx`：额度状态、倒计时和 Canvas 绘制。
- `src/styles.css`：Canvas 与原生拖动区域。
- `tests/`：App Server 数据标准化和日志降级测试。
- `package.json`：开发命令、NSIS 配置和 Codex sidecar 打包配置。

## 9. 后续建议

优先级建议：

1. 在另一台 Windows 电脑验证拖动、四边缩放、四角缩放、DPI 125%/150% 和多显示器。
2. 验证右键菜单在 Canvas 原生拖动区域上的行为。
3. 设计并加入正式应用图标。
4. 配置代码签名证书，恢复安装包签名。
5. 增加 Windows 登录启动的显式开关和托盘提醒设置。
6. 建立 GitHub Actions，自动运行测试并构建未签名安装包。

## 10. 最近验证状态

- `npm test`：6 项通过。
- Vite 生产构建：通过。
- NSIS 0.4.1 安装包：生成成功。
- `win-unpacked/Codex Gauge.exe`：生产模式启动截图验证通过。
- 首次源码提交：`1f90ecc`。

本文档只保留开发所需结论，没有包含 GitHub 登录信息、设备码、令牌或本机凭据。

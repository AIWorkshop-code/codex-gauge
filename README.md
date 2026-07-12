# Codex Gauge

一个通过官方 Codex App Server 实时读取额度的 Windows / macOS 桌面小组件，并在服务不可用时安全降级到本机会话数据。

## 功能

- 显示 5 小时额度剩余百分比。
- 显示 7 天额度剩余百分比。
- 显示 5 小时窗口重置倒计时。
- 启动时通过官方 App Server 立即读取。
- 监听 `account/rateLimits/updated` 实时变化通知。
- 每 30 秒主动校准一次。
- 无边框、始终置顶、可拖动、开机启动。
- 可以从窗口边缘自由缩放，自动保持设计比例。
- 自动记住窗口尺寸和桌面位置。
- 右键小组件可以切换置顶、选择小/中/大尺寸、重置位置或退出。
- 额度更新完全自动；电脑唤醒或解锁时立即重新读取。
- 额度不足时发送一次性系统通知，可在右键菜单关闭。
- 动态无障碍描述会朗读两档额度和当前倒计时。
- 右键菜单显示数据来源、最后更新时间和诊断信息。
- 可以在 5H 与 7D 重置倒计时之间切换。
- 可以控制登录时启动和托盘 / macOS 菜单栏模式。
- 在独立详情窗口查看最近 30 天的本地用量趋势。
- 正式安装包会通过 GitHub Releases 自动检查、下载并提示安装更新。
- 支持自动、浅色和深色外观，并跟随系统主题实时切换。

## 隐私

应用优先通过内置的官方 Codex CLI 启动 App Server，并调用 `account/rateLimits/read`。身份验证由 Codex 自身处理，桌面助手不读取浏览器 Cookie、ChatGPT 密码或认证令牌，也不会启动模型任务。

只有 App Server 不可用时，应用才读取 `%USERPROFILE%\.codex\sessions` 中 Codex 已写入的通用 `limit_id: codex` 限额状态；模型专属限额不会覆盖通用额度。日志快照超过 2 分钟会被视为过期，不再展示为实时额度。

如果找不到有效状态，界面会显示 `--`，不会生成估算额度。

## 安装

### Windows

前往 GitHub Releases 下载最新的 `Codex-Gauge-Setup-*.exe`，运行安装程序即可完成安装。

### macOS

macOS 用户请勿直接使用 Windows 安装包，需要将项目拉取到本地，并按照以下环境要求自行编译安装：

- Apple Silicon Mac（M 系列芯片）。
- Node.js 22.12 或更高版本。
- npm。

```bash
git clone https://github.com/AIWorkshop-code/codex-gauge.git
cd codex-gauge
npm install
npm run build:mac
```

编译完成后，安装文件会生成在 `release/` 目录中。打开其中的 DMG 文件并完成安装。当前 macOS 版本未签名，首次打开时可能需要前往“系统设置 → 隐私与安全性”确认允许打开。

## 开发

需要 Node.js 22.12 或更高版本。

```powershell
npm install
npm run dev:desktop
npm test
npm run build:desktop
```

Windows 安装包输出到 `release/`。

在 Apple Silicon Mac 上构建 DMG：

```bash
npm install
npm run build:mac
```

macOS 安装包同样输出到 `release/`。当前 macOS 打包目标为 Apple Silicon（arm64），生成的应用未签名；首次打开时可能需要在“系统设置 → 隐私与安全性”中确认。

## 自动更新

自动更新使用 `AIWorkshop-code/codex-gauge` 的 GitHub Releases。Windows 构建会生成 NSIS 更新包；macOS 构建会同时生成 DMG、ZIP 和更新元数据。正式发布前仍应配置 Windows 代码签名和 macOS Developer ID 签名、公证，否则操作系统可能阻止自动安装。

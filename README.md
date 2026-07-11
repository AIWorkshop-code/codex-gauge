# Codex Gauge

一个通过官方 Codex App Server 实时读取额度的 Windows 桌面小组件，并在服务不可用时安全降级到本机会话数据。

换电脑继续开发时，请先阅读 [开发交接文档](docs/DEVELOPMENT_HANDOFF.md)。

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

## 隐私

应用优先通过内置的官方 Codex CLI 启动 App Server，并调用 `account/rateLimits/read`。身份验证由 Codex 自身处理，桌面助手不读取浏览器 Cookie、ChatGPT 密码或认证令牌，也不会启动模型任务。

只有 App Server 不可用时，应用才读取 `%USERPROFILE%\.codex\sessions` 中 Codex 已写入的通用 `limit_id: codex` 限额状态；模型专属限额不会覆盖通用额度。日志快照超过 2 分钟会被视为过期，不再展示为实时额度。

如果找不到有效状态，界面会显示 `--`，不会生成估算额度。

## 开发

需要 Node.js 22.12 或更高版本。

```powershell
npm install
npm run dev:desktop
npm test
npm run build:desktop
```

安装包输出到 `release/`。

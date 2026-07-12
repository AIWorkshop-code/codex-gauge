# Verification

## Completed checks

- `npm test`: 8/8 App Server, fallback parser, and history-store tests passed.
- `npm run build`: Vite production build passed.
- Electron development capture passed.
- Packaged Electron capture passed with reference data.
- Packaged Electron capture passed with live local Codex data.
- NSIS Windows installer build passed.
- Design comparison passed in `design-qa.md`.

## Release artifacts — 0.5.0

- Windows NSIS: `release/Codex-Gauge-Setup-0.5.0.exe`
  - Size: 195,401,387 bytes
  - SHA-256: `9227666230CF4CEFA8EEB18D0DE49AA248CC14A1C65652167E2DCE887E8B6776`
- macOS Apple Silicon DMG: `release/Codex-Gauge-0.5.0-macOS-arm64.dmg`
  - Size: 232,537,922 bytes
  - SHA-256: `7EE4C5A162D963BF687DD3457C66D284417825E51F1A7F9AB2275BF3B6DB1710`
- macOS Apple Silicon ZIP: `release/Codex-Gauge-0.5.0-macOS-arm64.zip`
  - Size: 224,851,623 bytes
  - SHA-256: `2410A1FBE773CF7950A3AAC8F3CF295B5DEBBFC3E8E6F075AA51EE07F5392639`

## Runtime behavior verified

- Starts the bundled official Codex 0.144.1 App Server over stdio.
- Completes the official `initialize` / `initialized` handshake.
- Reads live account state using `account/rateLimits/read`.
- Listens for `account/rateLimits/updated` notifications.
- Rechecks the service every 30 seconds in addition to notifications.
- Falls back to local Codex JSONL sessions only when App Server fails.
- Selects the shared `limit_id: codex` quota and ignores model-specific limits such as `codex_bengalfox`.
- Rejects fallback log snapshots older than two minutes.
- Converts used percentages to remaining percentages.
- Displays the primary five-hour quota.
- Displays the secondary seven-day quota.
- Counts down to the selected primary or secondary reset timestamp with explicit day/hour/minute/second units.
- Does not call an OpenAI API or start a Codex task.
- Displays `--` when neither live App Server data nor a fresh fallback snapshot is available.

## 0.2.0 App Server verification

- Direct development-sidecar probe returned current live shared quota successfully.
- Electron development build captured live App Server values successfully.
- Packaged Electron build started its bundled sidecar and captured live values successfully.
- Packaged evidence: `artifacts/widget-app-server-packaged-0.2.0.png`.
- Forced missing-sidecar test rejected the stale log and displayed `--` rather than old values.

## 0.2.1 size reduction

- Reduced the logical desktop window from 440 x 194 to 220 x 97 pixels.
- Scaled the complete 440 x 194 design canvas to 50%, preserving the original proportions.
- Disabled window resizing so the layout cannot be accidentally clipped.
- Packaged evidence: `artifacts/widget-half-size-packaged-0.2.1.png`.

## 0.2.2 user resizing

- Window edges are resizable from 176 x 78 through 660 x 291 logical pixels.
- Native aspect-ratio locking preserves the 440:194 design proportions.
- The React surface scales the complete base canvas to the current window size.
- Window size and desktop position persist to `window-state.json` under Electron user data.
- Context menu provides 50%, 75%, and 100% size presets plus position reset.
- Verified both 220 x 97 and 440 x 194 rendering without clipping.
- Packaged small-size evidence: `artifacts/widget-resizable-packaged-0.2.2.png`.

## 0.2.3 fully automatic refresh

- Removed the manual refresh action from the context menu.
- Retained App Server `account/rateLimits/updated` push notifications.
- Retained 30-second background reconciliation.
- Added immediate automatic refresh on Windows resume and unlock events.

## 0.1.1 regression fix

Version 0.1.0 selected the newest rate-limit event without checking its identity. A newer GPT-5.3-Codex-Spark-specific event therefore displayed 100% even while the shared Codex quota was 68% / 95%. Version 0.1.1 filters for the shared Codex limit and the packaged live capture confirms 68% / 95% on the same machine.

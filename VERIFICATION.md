# Verification

## Completed checks

- `npm test`: 14/14 App Server, weekly-only schema, fallback parser, GitHub Release, and history-store tests passed.
- `npm run build`: Vite production build passed.
- Electron development capture passed.
- Packaged Electron capture passed with reference data.
- Packaged Electron capture passed with live local Codex data.
- NSIS Windows installer build passed.
- Design comparison passed in `design-qa.md`.

## Release artifacts — 0.5.4

- Windows x64 NSIS: `release/Codex-Gauge-Setup-0.5.4.exe`
  - Size: 199,080,782 bytes
  - SHA-256: `5877650AAC00EC4FE9D2BA1B7B9D76FDDAE85FB5CC7C16FE22DEA4F143BC49AF`
- macOS Apple Silicon DMG: `release/Codex-Gauge-0.5.4-macOS-arm64.dmg`
  - Size: 238,275,893 bytes
  - SHA-256: `64E2365B8237E2047C05FADC257F21EC85978517DFE4FE72D7E7DD9F7DE5174D`
- macOS Apple Silicon ZIP: `release/Codex-Gauge-0.5.4-macOS-arm64.zip`
  - Size: 229,796,674 bytes
  - SHA-256: `CD38693D6229898298850776888C5FD9C5487795A656A55C2F87B1ADEC2A9F29`
- Packaged macOS app contains an arm64 Codex sidecar and displayed the live weekly quota successfully.
- Windows application and bundled Codex sidecar both report x86-64 architecture.
- Packaged live evidence: `artifacts/widget-7d-live-packaged-0.5.4.png`.

## Release artifacts — 0.5.3

- Windows NSIS: `release-0.5.3/Codex-Gauge-Setup-0.5.3.exe`
  - Size: 195,541,484 bytes
  - SHA-256: `E9BCE4035CA4CA5C08B0AF581CF3B990D19B12B5A24E74E02E00ABE00B4F5107`
- macOS Apple Silicon DMG: `release-0.5.3/Codex-Gauge-0.5.3-macOS-arm64.dmg`
  - Size: 233,483,425 bytes
  - SHA-256: `E5029B903F7262057AEDFF41DC9BD76C0EFF525C7857ECEBABFE19DC20A75167`
- macOS Apple Silicon ZIP: `release-0.5.3/Codex-Gauge-0.5.3-macOS-arm64.zip`
  - Size: 225,197,360 bytes
  - SHA-256: `2A045E3F6E2CA296903E58C288A50AE0E28944686780F6EFFC253A185544C56B`

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
- Displays only the seven-day quota in user-facing surfaces; the primary window remains parser input only for source compatibility.
- Counts down to the seven-day reset timestamp with explicit day/hour/minute/second units.
- Does not call an OpenAI API or start a Codex task.
- Displays `--` when neither live App Server data nor a fresh fallback snapshot is available.

## Weekly-only interface verification — 2026-07-13

- `node --check electron/main.cjs` passed.
- `npm test` passed all 14 tests.
- `npm run build` completed successfully with Vite 6.4.2.
- Light and dark Electron captures passed at the default 200 × 80 logical-pixel footprint.
- Browser checks passed at both 400 × 160 and 200 × 80 viewports with no console warnings or errors.
- The widget accessibility tree contains only the 7-day remaining percentage and 7-day reset countdown.
- The history view contains one 7D summary and one 7D trend series; no 5H label or series remains.
- Live local verification read the official weekly-only shape (`primary.windowDurationMins: 10080`, `secondary: null`) and displayed the real remaining value instead of `--`.
- Evidence: `artifacts/widget-7d-200x80.png` and `artifacts/widget-7d-dark-200x80.png`.

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

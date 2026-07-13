# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Selected widget direction

- Build a small, always-on-desktop Windows widget rather than a taskbar popover.
- Match the selected light acrylic horizontal card, now simplified around one 7D progress bar, one weekly remaining percentage, and the 7D reset countdown.
- Do not display the 5H quota in the widget, tray/menu-bar status, notifications, context menu, accessibility copy, or history view. The reader may keep ingesting the primary window only for data-source compatibility.
- Identify the weekly quota by its 10080-minute duration, not by assuming it is always the App Server `secondary` field. The current weekly-only schema places it in `primary` and returns `secondary: null`.
- Keep visible widget copy to `7D`, `本周剩余`, the percentage, and the reset countdown. No title, credits, settings button, source label, or trend chart.
- The widget must remain draggable, frameless, unobtrusive, and readable over the desktop.
- Final desktop footprint is 50% of the 400 x 160 weekly-only design: use a 200 x 80 logical-pixel window and scale the complete visual system proportionally.
- Users move the widget through the native Windows draggable region and resize through native Windows window edges. Do not calculate movement or resizing from renderer pointer events. Persist the chosen size and desktop position across restarts, and expose 50%, 75%, and 100% presets in the context menu.
- Use a non-transparent frameless Windows window with a stable light background and system rounded corners, because Electron transparent windows do not support native resizing and Acrylic exposes unpainted gray areas during live resizing.
- Use Electron's native `setAspectRatio(400 / 160)` only with the non-transparent, unconstrained native window so Windows maintains the ratio continuously without renderer mouse calculations, per-frame `setBounds()`, or delayed correction.
- Render the visible widget into one high-resolution fixed-bitmap Canvas and let the compositor scale that surface during native resizing. Redraw only when quota/countdown data changes, not on resize; this avoids live DOM, SVG, font, shadow, and grid reflow.
- Quota refresh is fully automatic. Do not expose a manual refresh action; refresh from App Server notifications, the 30-second reconciliation timer, and Windows resume/unlock events.
- Motion should feel premium and clearly visible without becoming distracting: animate quota changes with a 1.3-second eased transition and progress growth. While idle, run a brief endpoint pulse about every 6.5 seconds, stop rendering between pulses, and respect reduced-motion preferences.
- Support light, dark, and automatic system-following appearance. Keep automatic as the default, persist manual overrides, and preserve the same hierarchy and green quota accent in both themes.
- The usage-history detail view follows the selected editorial analytics direction: a compact title/privacy header, one continuous inline quota summary band, and a chart-dominant lower region with meaningful percentage and date axes. Avoid returning to three equal floating metric cards.
- Countdown copy must use the 7D reset timestamp and expose its time units instead of ambiguous colon-only digits: show days plus hours, hours plus minutes, minutes plus seconds, or seconds alone depending on the remaining duration.
- The selected app icon direction is minimal and fresh: a pale mint squircle, one emerald quota ring, one sky-blue endpoint, and a quiet cool-gray center. Avoid dark inset panels, atom motifs, heavy shadows, or complex orbital detail.

## Promotional visual direction

- Promotional posters should feel editorial and premium rather than like generic SaaS feature grids: use one strong narrative headline, a large product-in-context hero, asymmetric spacing, and only a few supporting annotations.
- Prefer restrained cool-to-warm atmospheric light (soft blue/violet with coral or peach) behind white space and translucent product surfaces. Avoid covering the whole poster with identical white cards or repeating green outline icons.
- Show the real Codex Gauge widget faithfully in a believable desktop context. Let typography, product scale, depth, and lighting carry the composition; keep secondary copy concise.
- Installation posters should center a believable Codex prompt interaction and a visually connected three-step path, not a dense form-like checklist.
- On unsigned macOS builds, check the latest GitHub Release directly, show the new version and release notes immediately, and open the Release download page with clear drag-to-Applications replacement instructions. Keep `electron-updater` for Windows.
- Show a lightweight membership-service announcement above the widget at most once per local calendar day. It must be dismissible, follow the widget, support both themes, and open the configured external offer in the system browser only after the user clicks the CTA. Keep a context-menu entry that lets users reopen the announcement manually without changing the daily automatic-display limit.

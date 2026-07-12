# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Selected widget direction

- Build a small, always-on-desktop Windows widget rather than a taskbar popover.
- Match the selected light acrylic horizontal card: circular 5H gauge on the left, 7D progress and reset countdown on the right.
- Keep visible copy to `5H`, the two percentages, `7D`, and the countdown. No title, credits, settings button, source label, or trend chart.
- The widget must remain draggable, frameless, unobtrusive, and readable over the desktop.
- Final desktop footprint is 50% of the original 440 x 194 design: use a 220 x 97 logical-pixel window and scale the complete visual system proportionally.
- Users move the widget through the native Windows draggable region and resize through native Windows window edges. Do not calculate movement or resizing from renderer pointer events. Persist the chosen size and desktop position across restarts, and expose 50%, 75%, and 100% presets in the context menu.
- Use a non-transparent frameless Windows window with a stable light background and system rounded corners, because Electron transparent windows do not support native resizing and Acrylic exposes unpainted gray areas during live resizing.
- Use Electron's native `setAspectRatio(440 / 194)` only with the non-transparent, unconstrained native window so Windows maintains the ratio continuously without renderer mouse calculations, per-frame `setBounds()`, or delayed correction.
- Render the visible widget into one high-resolution fixed-bitmap Canvas and let the compositor scale that surface during native resizing. Redraw only when quota/countdown data changes, not on resize; this avoids live DOM, SVG, font, shadow, and grid reflow.
- Quota refresh is fully automatic. Do not expose a manual refresh action; refresh from App Server notifications, the 30-second reconciliation timer, and Windows resume/unlock events.
- Motion should feel premium and clearly visible without becoming distracting: animate quota changes with a 1.3-second eased transition and synchronized ring/bar growth. While idle, run a brief ring sweep and endpoint pulse about every 6.5 seconds, stop rendering between pulses, and respect reduced-motion preferences.
- Support light, dark, and automatic system-following appearance. Keep automatic as the default, persist manual overrides, and preserve the same hierarchy and green quota accent in both themes.
- The usage-history detail view follows the selected editorial analytics direction: a compact title/privacy header, one continuous inline quota summary band, and a chart-dominant lower region with meaningful percentage and date axes. Avoid returning to three equal floating metric cards.
- Countdown copy must expose its time units instead of ambiguous colon-only digits: show days plus hours, hours plus minutes, minutes plus seconds, or seconds alone depending on the remaining duration.
- The selected app icon direction is minimal and fresh: a pale mint squircle, one emerald quota ring, one sky-blue endpoint, and a quiet cool-gray center. Avoid dark inset panels, atom motifs, heavy shadows, or complex orbital detail.
- Offer a persistent compact display mode that turns the widget into a square and renders only the 5H circular gauge. Keep the full 5H/7D/countdown layout available from the context menu.

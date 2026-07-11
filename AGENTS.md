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

# Design QA

- Source visual truth: `/Users/mac/.codex/generated_images/019f54e0-0a17-7ac3-8b0c-4404b1c0da62/exec-29973aac-179c-42b0-8bd6-50a91aa406e2.png`
- Implementation screenshot: `/Users/mac/Documents/codex桌面插件/codex-gauge/artifacts/history-redesign-pass2.png`
- Combined comparison: `/Users/mac/Documents/codex桌面插件/codex-gauge/artifacts/history-redesign-comparison-pass2.png`
- Viewport: 1440 × 1024
- State: light theme, populated preview history, clear action idle

## Full-view comparison evidence

The implementation matches the selected editorial analytics direction: compact header, privacy line with lock icon, low-emphasis destructive action, three-part inline summary band, and chart-dominant lower region. Major region proportions, whitespace, chart frame, axis hierarchy, green/blue series, and current-point treatment align with the source.

## Required fidelity surfaces

- Fonts and typography: system UI font closely matches the source's neutral desktop typography. Title, quota numerals, labels, and metadata preserve the intended hierarchy and optical weight.
- Spacing and layout rhythm: header divider, summary columns, vertical separators, chart inset, and outer margins match the source structure. Responsive fallback is included below 850 px.
- Colors and visual tokens: off-white page, white chart surface, graphite text, Codex green, muted blue, light grid, and destructive red map cleanly to the source. Dark-mode equivalents remain supported.
- Image quality and asset fidelity: the source contains no raster imagery. Lock and trash controls use the existing Phosphor icon library; the chart remains crisp code-native data visualization.
- Copy and content: all product-specific Chinese labels are preserved. Dates intentionally use current real/preview data rather than copying the mock's stale April/May labels.

Focused region comparison was not required because both 1440 × 1024 frames and all typography, controls, chart labels, separators, and endpoints were legible in the full-resolution combined comparison.

## Interaction and browser checks

- Clear-record action opens a confirmation state.
- Cancel returns to the idle state without deleting history.
- Browser console warnings/errors: none.
- Dynamic chart and accessibility label render successfully.

## Comparison history

### Pass 1

- [P2] Repeated x-axis dates made the 30-day chart read like a one-day snapshot.
- Fix: changed preview history to cover a full 30-day domain and regenerated seven distinct date ticks.
- Evidence: `artifacts/history-redesign-pass1.png` compared with `artifacts/history-redesign-pass2.png`.

### Pass 2

- No actionable P0, P1, or P2 differences remain.
- Remaining data-value differences are expected because the implementation uses live/local history rather than hard-coded mock values.

## Follow-up polish

- [P3] The source title is marginally heavier; the implementation keeps a slightly softer native system weight for better cross-platform rendering.

## Membership announcement — 2026-07-12

- Source visual truth: `/Users/mac/.codex/generated_images/019f54e0-0a17-7ac3-8b0c-4404b1c0da62/exec-e70de66a-ae92-4d32-9d0d-c192c05dacdd.png`
- Implementation screenshot: `/Users/mac/Documents/codex桌面插件/codex-gauge/artifacts/announcement-implementation-pass2.png`
- Combined comparison: `/Users/mac/Documents/codex桌面插件/codex-gauge/artifacts/announcement-qa-comparison.png`
- Viewport: 350 × 118 logical pixels at 2× display scale
- State: light theme, announcement visible above full widget

### Full-view comparison evidence

The implementation preserves the source hierarchy: quiet mint-white floating surface, membership title, one supporting sentence, once-daily disclosure, emerald CTA, dismiss control, and a centered visual pointer toward the quota widget. The production component is intentionally denser than the enlarged concept render so it remains usable beside the 220 × 97 desktop widget.

### Required fidelity surfaces

- Fonts and typography: native system typography matches the widget; title, body, disclosure, and CTA use distinct weights and remain legible at native scale.
- Spacing and layout rhythm: text and CTA occupy separate grid columns, the close control has its own top-right zone, and the pointer is centered over the widget.
- Colors and visual tokens: cool-white/mint surface, graphite copy, muted metadata, and emerald action match the existing light theme; dark equivalents are included.
- Image quality and asset fidelity: the design contains no raster imagery. Bell, close, and pointer use the existing Phosphor icon library and render crisply at native resolution.
- Copy and content: membership-service copy, CTA, and once-daily disclosure match the approved concept and the requested destination behavior.

Focused region evidence is the native-resolution implementation capture, where all text, icon strokes, CTA bounds, close target, border, shadow, and pointer are readable.

### Interaction checks

- Close invokes the isolated announcement close channel.
- CTA invokes a hard-coded external URL through the system browser and then closes the announcement.
- The shown date is persisted as a local calendar date, limiting normal startup display to once per day.
- The announcement follows widget move/resize events and temporarily makes room when the widget is too close to the top edge.

### Comparison history

#### Pass 1

- [P1] Supporting copy was clipped behind the CTA and the close control visually collided with the action.
- Fix: increased the announcement height, allowed a controlled two-line wrap, bottom-aligned the CTA, and separated the close focus zone.
- Evidence: `artifacts/announcement-implementation.png`.

#### Pass 2

- No actionable P0, P1, or P2 differences remain. The two-line production copy is an intentional small-widget adaptation.
- Evidence: `artifacts/announcement-implementation-pass2.png` and `artifacts/announcement-qa-comparison.png`.

### Follow-up polish

- [P3] The generated concept uses a wider one-line body; retaining that exact line length would make the announcement disproportionately wide next to the real widget.

final result: passed

## Weekly-only widget — 2026-07-13

- Light implementation: `/Users/mac/Documents/codex桌面插件/codex-gauge/artifacts/widget-7d-200x80.png`
- Dark implementation: `/Users/mac/Documents/codex桌面插件/codex-gauge/artifacts/widget-7d-dark-200x80.png`
- Viewport: 200 × 80 logical pixels at 2× display scale
- State: reference 7D quota at 42%, four-day reset countdown

The revised widget keeps the existing soft acrylic visual language while reducing the hierarchy to one weekly quota. The 7D badge, large remaining percentage, full-width progress track, and unit-bearing reset countdown remain legible at the default half-size footprint. Light and dark captures have consistent padding, corner radius, baseline alignment, progress geometry, and contrast. Browser checks at both the 400 × 160 base canvas and 200 × 80 default footprint reported no warnings or errors.

The history view was also checked at 1440 × 1024. Its summary band and chart now expose only one green 7D series, with the sample count retained as secondary metadata. No 5H label remains in the widget, accessibility tree, tray/menu code, notifications, context menu, or history DOM.

final result: passed

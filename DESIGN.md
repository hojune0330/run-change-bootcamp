# RUN CHANGE Design System

## 0. Research Log

- Embedded references: the supplied design state shortlisted TrainOracle, minimalist
  editorial UI, and Linear-style operational UI. This foundation uses
  `minimalist-skill.md` + `linear.app.md`: the former supplies warm restraint and the
  latter supplies compact hierarchy, active-state clarity, and shell mechanics.
- Product state: `.omo/frontend-design/state.md` supplies the owner-selected off-white,
  charcoal, and deep-teal direction plus participant, coach, and program-owner personas.
- Lazyweb and Imagen: not rerun in this foundation slice because the owner-selected
  design state is the visual brief. Comparison with private TrainOracle assets remains
  explicitly accepted design debt rather than an invented fidelity claim.

## 1. Atmosphere & Identity

RUN CHANGE feels like a coach's field journal made operational: warm, calm, and exact.
Information is compact enough for a coach to scan, but each participant screen presents
one clear next action. The signature is a deep-teal route marker running through an
off-white paper-like shell; borders and tonal shifts create structure without decoration.

## 2. Color

The code source of truth is `src/design/tokens.css`.

| Role | Token | Value | Usage |
|---|---|---:|---|
| Canvas | `--color-canvas` | `#F3F0E8` | App background |
| Surface | `--color-surface` | `#FBFAF6` | Primary panels |
| Surface muted | `--color-surface-muted` | `#EAE6DC` | Selected and grouped regions |
| Surface pressed | `--color-surface-pressed` | `#DED9CD` | Active neutral controls |
| Text primary | `--color-text` | `#18201E` | Headings and body |
| Text secondary | `--color-text-muted` | `#59615E` | Supporting copy |
| Text subtle | `--color-text-subtle` | `#747C78` | Metadata |
| Border | `--color-border` | `#CBC7BC` | Cards and controls |
| Border strong | `--color-border-strong` | `#979D99` | Emphasis and disabled controls |
| Accent | `--color-accent` | `#0B5B52` | Primary actions and active routes |
| Accent hover | `--color-accent-hover` | `#084940` | Hovered primary action |
| Accent soft | `--color-accent-soft` | `#DCE9E4` | Active navigation background |
| On accent | `--color-on-accent` | `#FFFFFF` | Text on accent |
| Success | `--color-success` | `#2F6D52` | Completed state |
| Success soft | `--color-success-soft` | `#DFEBE4` | Completed badge |
| Warning | `--color-warning` | `#80551B` | Needs attention |
| Warning soft | `--color-warning-soft` | `#F1E6D2` | Attention badge |
| Critical | `--color-critical` | `#9A3E34` | Error or pain/risk marker |
| Critical soft | `--color-critical-soft` | `#F3DFDC` | Error badge |

Rules:

- Accent is reserved for actions, focus, and current location.
- Sensitive-health or risk semantics use text plus an icon or label, never color alone.
- No raw color values appear outside `src/design/tokens.css` and this documentation.
- No gradients are used.

## 3. Typography

| Level | Token | Size | Weight | Line height | Use |
|---|---|---:|---:|---:|---|
| Display | `--font-size-display` | `2rem` | 650 | 1.15 | Compact page title |
| Heading 1 | `--font-size-h1` | `1.5rem` | 650 | 1.25 | Screen heading |
| Heading 2 | `--font-size-h2` | `1.125rem` | 620 | 1.35 | Card heading |
| Body | `--font-size-body` | `1rem` | 430 | 1.6 | Primary reading |
| Body small | `--font-size-small` | `0.875rem` | 450 | 1.5 | Supporting copy |
| Label | `--font-size-label` | `0.75rem` | 620 | 1.4 | Status and metadata |
| Metric | `--font-size-metric` | `1.25rem` | 560 | 1.2 | Numeric values |

Fonts:

- UI: Pretendard Variable, then Apple SD Gothic Neo, Noto Sans KR, Malgun Gothic,
  system UI, and sans-serif.
- Metrics: JetBrains Mono Variable, then SFMono-Regular, Consolas, and monospace.
- Both web fonts are bundled into the production build with `font-display: swap`.
  Offline and first-paint fallbacks remain metrically sensible for Korean and numbers.

Long Korean headings use balanced wrapping when supported and never force a fixed height.

## 4. Spacing & Layout

All layout intent derives from a 4px unit.

| Token | Value | Use |
|---|---:|---|
| `--space-1` | `0.25rem` | Icon/label micro gap |
| `--space-2` | `0.5rem` | Compact controls |
| `--space-3` | `0.75rem` | Field padding |
| `--space-4` | `1rem` | Standard inset |
| `--space-5` | `1.25rem` | Card inset on mobile |
| `--space-6` | `1.5rem` | Card inset on wide screens |
| `--space-8` | `2rem` | Section separation |
| `--space-10` | `2.5rem` | Page rhythm |
| `--space-12` | `3rem` | Major separation |

Layout contract:

- Shell height is bounded by `100dvb`; the main region is the only vertical scroll owner.
- 375px: single content column, bottom navigation, 16px page inset.
- 768px: fixed 224px side navigation, 24px page inset.
- 1280px: the side navigation remains fixed and content caps at 1120px.
- Intrinsic grids use `minmax(min(16rem, 100%), 1fr)` to avoid narrow overflow.
- Long or unbroken content uses `min-inline-size: 0` and `overflow-wrap: anywhere`.

## 5. Components

### Button

- **Structure**: native `button` with optional leading icon and stable text.
- **Variants**: primary, secondary, quiet.
- **Spacing**: `--space-2` to `--space-4`; minimum block size 44px.
- **States**: default, hover, active, focus-visible, disabled, busy.
- **Accessibility**: native keyboard behavior; busy state uses `aria-busy`; disabled uses
  the native attribute; icon-only use requires an accessible name.
- **Motion**: transform and color only, `--motion-fast`.

### Badge

- **Structure**: short inline status label.
- **Variants**: neutral, success, warning, critical.
- **Spacing**: `--space-1` and `--space-2`.
- **States**: static; no decorative hover.
- **Accessibility**: status meaning is present in text and never color-only.
- **Motion**: none.

### Card

- **Structure**: labelled `section` with optional eyebrow and action slot.
- **Variants**: default and muted.
- **Spacing**: `--space-5` mobile, `--space-6` wide.
- **States**: default; no hover unless the card itself becomes an action.
- **Accessibility**: generated heading id labels the section.
- **Motion**: none.

### App shell and navigation

- **Structure**: skip link, header, one route navigation, and labelled main region.
- **Layout**: `scroll-body-shell`; header and navigation remain fixed, main scrolls.
- **States**: route default, hover, active, focus-visible, current.
- **Accessibility**: landmarks have Korean labels, current route uses
  `aria-current="page"`, all targets are at least 44px, tab order follows reading order.
- **Motion**: transform-only press feedback; reduced-motion removes it.

## 6. Motion & Interaction

| Type | Token | Duration | Easing | Use |
|---|---|---:|---|---|
| Fast | `--motion-fast` | `160ms` | ease-out | Press and focus response |
| Standard | `--motion-standard` | `240ms` | ease-in-out | Meaningful panel/state change |

Only `transform` and `opacity` animate. There is no decorative entrance motion in the
foundation shell. Under `prefers-reduced-motion: reduce`, transitions and animations use
near-zero duration and smooth scrolling is disabled.

## 7. Depth & Surface

Strategy: borders plus tonal shift.

- Cards and controls use a one-pixel `--color-border` outline.
- Current navigation uses `--color-accent-soft` rather than elevation.
- There are no decorative shadows, inset shadows, glows, or glass effects.
- Radius tokens are compact: 4px for micro UI, 6px for controls, 8px for panels.

## 8. Accessibility Constraints & Accepted Debt

Constraints:

- WCAG 2.2 AA; text contrast target 4.5:1 and large text/UI target 3:1.
- Visible `:focus-visible` state on every interactive element.
- Full keyboard reachability, 44px touch targets, semantic landmarks, 200% zoom
  resilience, reduced-motion support, and natural Korean line breaking.
- One concise action or decision per section for the participant persona.
- Private health information does not appear in the foundation shell or demo labels.

Accepted debt:

| Item | Location | Why accepted | Owner / Exit |
|---|---|---|---|
| Private TrainOracle asset comparison | Whole surface | Assets were not provided and corporate/private fidelity cannot be inferred | Product owner review before production |
| Corporate logo | Header mark | Usage rights are not confirmed | Replace the text mark only after approval |
| Feature-specific empty/error/loading states | Future routes | Feature screens are explicitly outside T1 | Owning feature task documents and tests them |

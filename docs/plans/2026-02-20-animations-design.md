# Animation Design — baytas.net replica
_2026-02-20_

## Source analysis
Reverse-engineered from baytas.net via React fiber tree inspection and CSS extraction. Library: Framer Motion (Next.js). Replicated here with pure CSS + vanilla JS (no new dependencies).

## Files changed
- `src/styles/global.css` — keyframes, easing
- `src/components/WorkList.astro` — stagger, hover dimming, arrow reveal
- `src/components/SiteHeader.astro` — text scramble

---

## 1. CSS keyframes (`global.css`)

Two named keyframes:

```css
@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(2px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Easing: `cubic-bezier(0, 0, 0.58, 1)` (CSS `ease-out`). Matches Framer Motion's `"easeOut"` default.

---

## 2. WorkList stagger

**Direction:** reverse — top item delays longest, bottom item shortest.

**Formula:** `delay = 1.0 - (i / items.length)` seconds

With 5 items: `1.000, 0.800, 0.600, 0.400, 0.200`

**Per-item:** `animation: fade-up 0.4s ease-out both`

---

## 3. Hover dimming

| State | opacity | transition-duration |
|-------|---------|---------------------|
| Sibling (any item hovered) | 0.4 | 1000ms |
| Hovered item | 1.0 | 0ms (instant) |

Selector: `.work-list:has(.work-row:hover) .work-item:not(:hover)`

---

## 4. Arrow reveal (asymmetric)

Rest: `opacity: 0; width: 0; margin-left: 0; filter: blur(2px)`
Hover: `opacity: 1; width: 10px; margin-left: 6px; filter: blur(0)`

Transitions:
- **Enter** (via CSS `:hover` override): all `150ms ease-out`
- **Exit** (base inline style): `opacity 250ms, width 1s, margin-left 1s`

---

## 5. Header text scramble

Vanilla JS `<script>` in `SiteHeader.astro`.

- Character pool: `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·`
- Tick interval: `40ms`
- Each tick: characters resolve left-to-right; unresolved show random pool char
- Fires on `DOMContentLoaded`
- Total duration ≈ `text.length × 40ms` ≈ 800ms
- Respects `prefers-reduced-motion` (skip scramble, show final text immediately)

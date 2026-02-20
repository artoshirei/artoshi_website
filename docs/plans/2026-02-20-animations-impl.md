# Animations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replicate baytas.net's load animations, reverse stagger, asymmetric arrow hover, and header text scramble in the Astro project using zero new dependencies.

**Architecture:** Pure CSS keyframes for load animations; CSS custom properties for asymmetric hover transitions; vanilla JS `<script>` in SiteHeader.astro for the scramble effect. Three files touched total.

**Tech Stack:** Astro 5, Tailwind CSS v4, vanilla JS (no new packages)

**Design doc:** `docs/plans/2026-02-20-animations-design.md`

---

### Task 1: Update CSS keyframes and easing in `global.css`

**Files:**
- Modify: `src/styles/global.css`

**Context:**
Current `fade-up` uses `translateY(8px)` and Tailwind's ease `cubic-bezier(0.4, 0, 0.2, 1)`.
baytas.net uses `translateY(2px)` and Framer Motion's `"easeOut"` = `cubic-bezier(0, 0, 0.58, 1)`.
We also need a separate `fade-in` keyframe (opacity only, no Y) for the header.

**Step 1: Replace the keyframes and easing**

In `src/styles/global.css`, replace the entire `/* ─── Entrance animation ────────── */` block with:

```css
/* ─── Entrance animations ──────────────────────────────── */

/* Header / bio: opacity only */
@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* List items: opacity + 2px lift (matches baytas.net exactly) */
@keyframes fade-up {
  from { opacity: 0; transform: translateY(2px); }
  to   { opacity: 1; transform: translateY(0); }
}

.animate-in {
  animation-name: fade-up;
  animation-duration: 0.4s;
  animation-timing-function: cubic-bezier(0, 0, 0.58, 1);
  animation-fill-mode: both;
}

.animate-in-fade {
  animation-name: fade-in;
  animation-duration: 0.5s;
  animation-timing-function: cubic-bezier(0, 0, 0.58, 1);
  animation-fill-mode: both;
}

@media (prefers-reduced-motion: reduce) {
  .animate-in,
  .animate-in-fade {
    animation: none;
  }
}
```

**Step 2: Verify visually**

Run `npm run dev`, open `http://localhost:4321`. Items should float up only 2px (barely perceptible lift) with a quick ease-out snap. Previously items slid up 8px.

**Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "fix: animations (2px Y, easeOut, add fade-in variant)"
```

---

### Task 2: Reverse stagger + updated duration in `WorkList.astro`

**Files:**
- Modify: `src/components/WorkList.astro`

**Context:**
Current stagger goes forward: first item 0.1s, last item 0.7s (top-in-first).
baytas.net goes reverse: first item (top) has the highest delay, last item (bottom) has the lowest.
Formula: `delay = 1.0 - (i / items.length)` — bottom items appear first (~0.2s), top items appear last (~1.0s).
Duration changes from 0.5s → 0.4s (already done in Task 1 via `.animate-in`).

**Step 1: Update the delay function**

In `src/components/WorkList.astro`, replace the `delay` function:

```ts
// BEFORE
const delay = (i: number) => {
  const min = 0.1, max = 0.7;
  return (min + (max - min) * (i / Math.max(sorted.length - 1, 1))).toFixed(2);
};

// AFTER
const delay = (i: number) =>
  (1.0 - i / sorted.length).toFixed(3);
```

**Step 2: Verify visually**

Reload dev server. The list should cascade upward: bottom item appears first (~200ms), top item last (~1000ms). With 5 items the step is 200ms — clearly visible stagger in reverse order.

**Step 3: Commit**

```bash
git add src/components/WorkList.astro
git commit -m "fix: reverse stagger — bottom items appear first (baytas.net pattern)"
```

---

### Task 3: Hover dimming — slow fade out, instant in

**Files:**
- Modify: `src/components/WorkList.astro`

**Context:**
baytas.net: when any item is hovered, siblings dim to `opacity: 0.4` over `1000ms`. The hovered item snaps back to full opacity instantly (`transition-duration: 0ms`).
Current code uses `transition: opacity 0.2s ease` on `.work-item` (both directions same speed).

**Step 1: Update hover CSS in WorkList.astro `<style>` block**

Replace the existing `.work-item` and `.work-list:has(.work-item:hover)` rules:

```css
/* ─── Hover: dim siblings, keep hovered item bright ─── */
.work-item {
  border-top: 1px solid var(--color-border);
  /* slow fade OUT (siblings dimming) */
  transition: opacity 1000ms cubic-bezier(0.4, 0, 0.2, 1),
              background-color 1000ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* When ANY sibling row is hovered, dim non-hovered items */
.work-list:has(.work-row:hover) .work-item:not(:has(.work-row:hover)) {
  opacity: 0.4;
}

/* Hovered item: instant snap to full + subtle bg */
.work-item:has(.work-row:hover) {
  opacity: 1 !important;
  background-color: rgb(23 23 23); /* neutral-900 */
  transition-duration: 0ms;
}
```

**Step 2: Verify visually**

Hover over any work item. The others should slowly fade to 40% opacity (1s). Moving to the next item: new item snaps bright instantly, old item slowly dims. Moving away entirely: all items restore slowly (1s).

**Step 3: Commit**

```bash
git add src/components/WorkList.astro
git commit -m "fix: hover dimming — 1000ms fade out, instant in (baytas.net pattern)"
```

---

### Task 4: Asymmetric arrow reveal with blur

**Files:**
- Modify: `src/components/WorkList.astro`

**Context:**
baytas.net arrow (→ indicator) has an asymmetric transition:
- **Enter:** all properties 150ms (snappy)
- **Exit:** `opacity 250ms, width 1s, margin-left 1s` (slow withdrawal)
- Rest state: `opacity: 0; width: 0; margin-left: 0; filter: blur(2px)`
- Hover state: `opacity: 1; width: 10px; margin-left: 6px; filter: blur(0)`

The trick: set the slow exit durations as the base `transition` on the element. Override with a fast transition on the hovered parent using CSS `:has()`.

**Step 1: Update `.work-arrow` and `.work-row` hover in WorkList.astro `<style>`**

Remove the old `.work-arrow` and `.work-item:hover .work-arrow` rules. Replace with:

```css
/* Arrow: hidden by default, blurred */
.work-arrow {
  font-size: 0.75rem;
  color: var(--color-secondary);
  flex-shrink: 0;
  /* rest state */
  opacity: 0;
  width: 0;
  margin-left: 0;
  overflow: hidden;
  filter: blur(2px);
  /* EXIT transition (slow) */
  transition: opacity 250ms cubic-bezier(0, 0, 0.58, 1),
              width 1s cubic-bezier(0, 0, 0.58, 1),
              margin-left 1s cubic-bezier(0, 0, 0.58, 1),
              filter 250ms cubic-bezier(0, 0, 0.58, 1);
}

/* ENTER transition: override to fast when parent is hovered */
.work-row:hover .work-arrow {
  opacity: 1;
  width: 10px;
  margin-left: 6px;
  filter: blur(0);
  /* 150ms enter override */
  transition-duration: 150ms;
}
```

**Step 2: Verify visually**

Hover an external-link row. Arrow should snap in at 150ms (fast). Mouse out: arrow slowly fades and collapses over ~1s. The blur-in effect (blurry → sharp on enter) should be visible.

**Step 3: Commit**

```bash
git add src/components/WorkList.astro
git commit -m "fix: arrow reveal — asymmetric transition, blur effect (baytas.net pattern)"
```

---

### Task 5: Header text scramble

**Files:**
- Modify: `src/components/SiteHeader.astro`

**Context:**
On page load, the header title starts as random characters and resolves left-to-right to the real text. Runs entirely in vanilla JS — no Framer Motion, no library. Respects `prefers-reduced-motion`.

**Step 1: Rewrite `SiteHeader.astro`**

Replace the entire file with:

```astro
---
// src/components/SiteHeader.astro
---

<header class="animate-in-fade" style="animation-delay: 0s">
  <div style="max-width: var(--container-max)" class="mx-auto px-6 py-16">
    <p style="font-size: 0.875rem">
      <span
        id="header-scramble"
        style="color: var(--color-primary); font-weight: 500; font-family: var(--font-mono)"
        data-final="artoshi"
      >artoshi</span><span style="color: var(--color-secondary)"> · design + engineering</span>
    </p>
  </div>
</header>

<script>
  const POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·_-';
  const TICK_MS = 40;

  function scramble(el: HTMLElement) {
    const final = el.dataset.final ?? el.textContent ?? '';
    let resolved = 0;

    const interval = setInterval(() => {
      const chars = final.split('').map((ch, i) => {
        if (i < resolved) return ch;
        return POOL[Math.floor(Math.random() * POOL.length)];
      });
      el.textContent = chars.join('');

      resolved++;
      if (resolved > final.length) {
        el.textContent = final;
        clearInterval(interval);
      }
    }, TICK_MS);
  }

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!prefersReduced) {
    const el = document.getElementById('header-scramble') as HTMLElement | null;
    if (el) scramble(el);
  }
</script>
```

**Step 2: Verify visually**

Reload the page. The header title should display random mono characters that resolve left-to-right to "artoshi" over ~280ms (7 chars × 40ms). Should complete before the list items finish animating in (~1s total).

**Step 3: Verify reduced-motion**

In DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce". Reload. The header should show "artoshi" immediately with no scramble.

**Step 4: Commit**

```bash
git add src/components/SiteHeader.astro
git commit -m "feat: header text scramble (baytas.net pattern)"
```

---

### Task 6: Final review pass

**Step 1: Full visual check**

Run `npm run dev`. Verify:
- [ ] Header: scramble resolves before ~300ms, then header fade-in completes by ~500ms
- [ ] Bio/work list: bottom items appear first (shortest delay ~200ms), top items last (~1000ms)
- [ ] Hover: siblings dim slowly (1s), hovered item snaps bright immediately + subtle bg
- [ ] Arrow: enters fast (150ms, blurry→sharp), exits slowly (1s, width/margin collapse)
- [ ] Reduced-motion: no animations at all

**Step 2: Commit final**

```bash
git add -A
git commit -m "feat: baytas.net animation system complete"
```

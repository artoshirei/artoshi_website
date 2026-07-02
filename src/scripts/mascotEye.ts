// src/scripts/mascotEye.ts
// The mascot brain. One rAF loop drives the eyes (gaze, blink, surprise,
// happy, sleep) and the body (hop physics, dance groove, breathing, lean,
// spin) as independently spring-blended scalars, so every state melts into
// the next — no CSS keyframes, no hard cuts. The header initialises it; the
// index work list opts rows in via watchRows() so hovering a project makes
// the mascot hop with excitement.

const MAX_CURSOR_PULL = 42;
const SPRING_SPEED = 0.24;          // eye gaze lerp per 60fps frame
const EYE_RETURN_DELAY_MS = 1300;
const BLINK_MIN = 2600, BLINK_MAX = 5400, BLINK_CLOSE = 78, BLINK_OPEN = 120;

// Body spring (posY in % of the mascot's own height; negative = up)
const BODY_K = 140;                 // stiffness — snappy with a hint of overshoot
const BODY_C = 11;                  // damping
const HOP_GREET = 110;              // hello on page load
const HOP_WAKE = 95;                // startled wake-up
const HOP_BOOP = 150;               // click
const HOP_SPIN = 190;               // triple-click celebration
const MASCOT_ZONE_PX = 48;          // clicks this close to the brand link's left edge are mascot clicks

const SLEEP_AFTER_MS = 30_000;
const HAPPY_HOLD_MS = 2600;         // happy arcs relax back to normal eyes even mid-hover
const SPIN_DURATION_S = 0.75;
const SPIN_CLICKS = 3, SPIN_WINDOW_MS = 1400;

const EYE_GEOMETRY = [
  { cx: 38.92463, cy: 131.08272 },
  { cx: 127.4235, cy: 131.08273 },
];
const EYE_WIDTH = 46;
const EYE_HEIGHT = 198;
const EYE_GROUP_CENTER = {
  x: (EYE_GEOMETRY[0].cx + EYE_GEOMETRY[1].cx) / 2,
  y: (EYE_GEOMETRY[0].cy + EYE_GEOMETRY[1].cy) / 2,
};
const EYES_ANCHOR = { x: 235, y: 124 };
const EYE_CENTER_VIEWBOX = {
  x: EYES_ANCHOR.x + EYE_GROUP_CENTER.x,
  y: EYES_ANCHOR.y + EYE_GROUP_CENTER.y,
};
const EYE_OFFSETS = EYE_GEOMETRY.map((e) => ({ x: e.cx - EYE_GROUP_CENTER.x, y: e.cy - EYE_GROUP_CENTER.y }));

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}
function clampVector(px: number, py: number, max: number) {
  const mag = Math.hypot(px, py);
  if (mag === 0 || mag <= max) return { x: px, y: py };
  const s = max / mag;
  return { x: px * s, y: py * s };
}
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let svg: SVGSVGElement | null = null;
let travel: SVGGElement | null = null;
let eyeL: SVGRectElement | null = null;
let eyeR: SVGRectElement | null = null;
let arcL: SVGPathElement | null = null;
let arcR: SVGPathElement | null = null;
let started = false;

// ─── eye state ──────────────────────────────────────────
const cursorTarget = { x: 0, y: 0 };
let gazeTarget: { x: number; y: number } | null = null;
const offset = { x: 0, y: 0 };
let idleTimeout: number | null = null;
let blinkValue = 0;
let blinkPhase: "idle" | "closing" | "opening" = "idle";
let glanceY = 0;                    // scroll flick, decays to 0

// ─── mood scalars (each springs toward its target) ──────
let surprise = 0, surpriseTarget = 0;
let surpriseTimeout: number | null = null;
let happy = 0, happyTarget = 0;
let happyTimeout: number | null = null;
let giggle = 0, giggleUntil = -1, nextGiggleAt = 0;
let dance = 0, danceTarget = 0;
let sleep = 0;

// ─── body physics ───────────────────────────────────────
let posY = 0, velY = 0;
let spinStart = -1;                 // seconds; -1 = not spinning
let lastActivity = 0;
let waking = false;
const clickTimes: number[] = [];

// ─── drag & clumsy hop-home ─────────────────────────────
// While held, `drag` chases the pointer on a stiff spring. On release the
// mascot hops home in small random arcs. `drag` is continuous state shared
// by both modes, so grabbing it mid-return just works.
type MascotMode = "idle" | "dragging" | "returning";
let mode: MascotMode = "idle";
const drag = { x: 0, y: 0 };
const dragTarget = { x: 0, y: 0 };
const dragVel = { x: 0, y: 0 };
let rotDrag = 0;                    // dangly lean while carried
let grabPointer = { x: 0, y: 0 };
let grabStart = { x: 0, y: 0 };
let dragBounds = { minX: -1e4, maxX: 1e4, minY: -1e4, maxY: 1e4 };
let suppressClick = false;          // a real drag must not fire the boop/link
// each hop is a little performance: crouch (anticipation) → flight
// (stretch at launch/fall, floaty apex) → land (squash + follow-through wobble)
let hopPhase: "none" | "crouch" | "flight" = "none";
let hopFrom = { x: 0, y: 0 };
let hopTo = { x: 0, y: 0 };
let hopStartT = 0, hopDur = 0, hopArc = 0, hopDirX = 0;
let crouchStartT = 0, crouchDur = 0;
let hopSquash = 0;                  // anticipation crouch, feeds scaleY
let hopStretch = 0;                 // in-flight elongation, feeds scaleY
let landT = -10, landAmp = 0;       // follow-through rotation wobble
let hopsDone = 0;
let nextHopAt = 0;
let lastTime = 0;
let lastScrollY = typeof window !== "undefined" ? window.scrollY : 0;

function pointerToSvg(clientX: number, clientY: number) {
  if (!svg) return null;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const t = pt.matrixTransform(ctm.inverse());
  return { x: t.x, y: t.y };
}

function activity() {
  lastActivity = performance.now();
  if (sleep > 0.4 && !waking) {
    waking = true;
    hop(HOP_WAKE);
    // blink once the lids have actually re-opened — blinking while the eyes
    // are still closed is invisible
    window.setTimeout(() => {
      if (blinkPhase === "idle") { blinkPhase = "closing"; animateBlink("closing", performance.now()); }
    }, 1100);
  }
}

function onPointerMove(e: PointerEvent) {
  activity();
  const pt = pointerToSvg(e.clientX, e.clientY);
  if (!pt) return;
  const c = clampVector(pt.x - EYE_CENTER_VIEWBOX.x, pt.y - EYE_CENTER_VIEWBOX.y, MAX_CURSOR_PULL);
  cursorTarget.x = c.x;
  cursorTarget.y = c.y;
  if (idleTimeout) window.clearTimeout(idleTimeout);
  idleTimeout = window.setTimeout(() => { cursorTarget.x = 0; cursorTarget.y = 0; }, EYE_RETURN_DELAY_MS);
}

/** Make the eyes gaze toward a point in screen coordinates (wins over cursor). */
export function setGaze(screenX: number, screenY: number) {
  if (prefersReduced || !svg) return;
  const pt = pointerToSvg(screenX, screenY);
  if (!pt) return;
  const c = clampVector(pt.x - EYE_CENTER_VIEWBOX.x, pt.y - EYE_CENTER_VIEWBOX.y, MAX_CURSOR_PULL);
  gazeTarget = { x: c.x, y: c.y };
}

/** Release the gaze override; eyes return to cursor-follow then rest. */
export function clearGaze() {
  gazeTarget = null;
}

/** Give the body an upward impulse; the spring brings it home with overshoot. */
function hop(impulse: number) {
  velY -= impulse;
}

/** A tiny attention hop, e.g. when the speech bubble appears. */
export function chirp() {
  if (started) hop(70);
}

// ─── mood particles ─────────────────────────────────────
// Tiny anime-style glyphs that drift up from the head: "z" while sleeping,
// hearts on giggles, "!" on boops, "♪" while dancing, "✦" on the spin.
// Spawned as children of the mascot svg so they need no markup changes.
const SVG_NS = "http://www.w3.org/2000/svg";
const HEART_PATH = "M0 -4 C -5 -11, -14 -3, 0 8 C 14 -3, 5 -11, 0 -4";
const MAX_PARTICLES = 6;

interface Particle {
  el: SVGElement;
  age: number;
  life: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  sway: number;
  phase: number;
  scale: number;
}
const particles: Particle[] = [];
let fxLayer: SVGSVGElement | null = null;
let nextZAt = 0;
let nextNoteAt = 0;

function spawnParticle(kind: "z" | "heart" | "bang" | "note" | "spark", x: number, y: number, opts: Partial<Particle> = {}) {
  if (!svg || particles.length >= MAX_PARTICLES) return;
  if (!fxLayer) {
    // a sibling overlay svg with the same viewBox, NOT a child of the mascot:
    // particles must stay serenely upright while the body hops, dances, spins
    fxLayer = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
    fxLayer.setAttribute("viewBox", "0 0 649 512");
    fxLayer.setAttribute("class", "mascot-fx-layer");
    fxLayer.setAttribute("aria-hidden", "true");
    (svg.parentElement ?? document.body).appendChild(fxLayer);
  }
  let el: SVGElement;
  if (kind === "heart") {
    el = document.createElementNS(SVG_NS, "path");
    el.setAttribute("d", HEART_PATH);
    el.setAttribute("fill", "#dfa1ae");
  } else {
    el = document.createElementNS(SVG_NS, "text");
    el.textContent = kind === "z" ? "z" : kind === "bang" ? "!" : kind === "note" ? "♪" : "✦";
    el.setAttribute("font-family", "Spline Sans Mono, ui-monospace, monospace");
    // sized in viewBox units: the 649-unit-wide mascot renders at ~30-40px,
    // so ~190 units ≈ 12px on screen — smaller than this is invisible
    el.setAttribute("font-size", "190");
    el.setAttribute("fill", kind === "z" ? "var(--ink-faint)" : kind === "note" ? "var(--ink-mute)" : "var(--accent)");
  }
  el.setAttribute("opacity", "0");
  fxLayer.appendChild(el);
  particles.push({ el, age: 0, life: 2.4, x, y, vx: 40, vy: -140, sway: 26, phase: Math.random() * 6.28, scale: 1, ...opts });
}

function stepParticles(dt: number, t: number) {
  // emitters tied to mood levels — only while the mascot is actually home,
  // since the fx layer is pinned to its resting spot
  if (mode !== "idle") { nextZAt = t; nextNoteAt = t; }
  if (mode === "idle" && sleep > 0.85 && t >= nextZAt) {
    nextZAt = t + 1.9;
    spawnParticle("z", 430, -20, { vx: 50, vy: -110, life: 3, scale: 0.75 + 0.4 * Math.random() });
  }
  if (mode === "idle" && dance > 0.6 && t >= nextNoteAt) {
    nextNoteAt = t + 1.15;
    spawnParticle("note", Math.random() < 0.5 ? 110 : 500, -10, { vx: 0, vy: -150, life: 1.6, sway: 34 });
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      p.el.remove();
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const k = p.age / p.life;
    const fade = Math.min(k / 0.12, 1) * (1 - Math.max((k - 0.55) / 0.45, 0));
    const sway = Math.sin(p.age * 3 + p.phase) * p.sway;
    p.el.setAttribute("transform", `translate(${p.x + sway}, ${p.y}) scale(${p.scale * (0.85 + 0.3 * k)})`);
    p.el.setAttribute("opacity", String(fade * 0.9));
  }
}

function flashSurprise(holdMs: number) {
  surpriseTarget = 1;
  if (surpriseTimeout) window.clearTimeout(surpriseTimeout);
  surpriseTimeout = window.setTimeout(() => { surpriseTarget = 0; }, holdMs);
}

function onBoop(e: Event) {
  e.preventDefault();
  e.stopPropagation();
  activity();
  const now = performance.now();
  clickTimes.push(now);
  while (clickTimes.length && now - clickTimes[0] > SPIN_WINDOW_MS) clickTimes.shift();
  if (clickTimes.length >= SPIN_CLICKS && spinStart < 0) {
    clickTimes.length = 0;
    spinStart = now / 1000;
    hop(HOP_SPIN);
    flashSurprise(700);
    for (let s = 0; s < 3; s++) {
      spawnParticle("spark", 150 + s * 175, -30, { vx: (s - 1) * 60, vy: -170 - s * 25, life: 1.1, phase: s * 2, scale: 0.8 });
    }
  } else {
    hop(HOP_BOOP);
    flashSurprise(480);
    spawnParticle("bang", 460, -50, { vx: 25, vy: -200, life: 0.85, sway: 5, scale: 1.1 });
  }
}

/** Opt hover targets in: the mascot's eyes go happy while one is hovered.
 *  Pure spring scalar — spam-hovering across rows just retargets smoothly. */
export function watchRows(rows: Iterable<Element>) {
  if (prefersReduced || !svg) return;
  for (const row of rows) {
    row.addEventListener("pointerenter", () => {
      happyTarget = 1;
      if (happyTimeout) window.clearTimeout(happyTimeout);
      happyTimeout = window.setTimeout(() => { happyTarget = 0; }, HAPPY_HOLD_MS);
    });
    row.addEventListener("pointerleave", () => { happyTarget = 0; });
  }
}

function animateBlink(phase: "closing" | "opening", start: number) {
  const duration = phase === "closing" ? BLINK_CLOSE : BLINK_OPEN;
  const tick = (time: number) => {
    const progress = clamp((time - start) / duration, 0, 1);
    const eased = phase === "closing" ? easeOutCubic(progress) : easeInOutCubic(progress);
    blinkValue = phase === "closing" ? eased : 1 - eased;
    if (progress < 1) { requestAnimationFrame(tick); return; }
    if (phase === "closing") { blinkPhase = "opening"; requestAnimationFrame((t) => animateBlink("opening", t)); return; }
    blinkPhase = "idle";
    scheduleBlink();
  };
  requestAnimationFrame(tick);
}
function scheduleBlink() {
  window.setTimeout(() => {
    // hold blinks while another eye state owns the shape — a blink squashing
    // happy arcs, closed sleeping lids, or wide surprised eyes reads as flicker
    if (happy > 0.2 || sleep > 0.2 || surprise > 0.2) { scheduleBlink(); return; }
    if (blinkPhase === "idle") { blinkPhase = "closing"; animateBlink("closing", performance.now()); }
  }, BLINK_MIN + Math.random() * (BLINK_MAX - BLINK_MIN));
}

function step(time: number) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  const t = time / 1000;
  // frame-rate independent lerp factor equivalent to 0.24/frame at 60fps
  const spring = 1 - Math.pow(1 - SPRING_SPEED, dt * 60);
  const slowSpring = 1 - Math.pow(1 - 0.1, dt * 60);

  // ── moods drift toward their targets ──
  surprise += (surpriseTarget - surprise) * spring;
  // happy eyes wait until it's back home; if the row is still hovered on
  // arrival, they engage then
  happy += ((happyTarget === 1 && mode === "idle" ? 1 : 0) - happy) * spring;
  // no dancing while being carried or hopping home
  dance += ((danceTarget === 1 && mode === "idle" ? 1 : 0) - dance) * slowSpring;
  // never doze off mid-dance, mid-carry, or mid-return
  const sleepTarget = danceTarget === 0 && mode === "idle" && time - lastActivity > SLEEP_AFTER_MS ? 1 : 0;
  sleep += (sleepTarget - sleep) * slowSpring * 0.35;
  if (waking && sleep < 0.1) waking = false;

  // ── drag & clumsy return ──
  let rotJump = 0;
  if (mode === "dragging") {
    const stiff = 1 - Math.pow(1 - 0.38, dt * 60); // chases the hand with a rubbery lag
    const nx = drag.x + (dragTarget.x - drag.x) * stiff;
    const ny = drag.y + (dragTarget.y - drag.y) * stiff;
    dragVel.x = (nx - drag.x) / Math.max(dt, 1e-4);
    dragVel.y = (ny - drag.y) / Math.max(dt, 1e-4);
    drag.x = nx;
    drag.y = ny;
    // dangles: leans away from the direction it's being swung
    rotDrag += (clamp(-dragVel.x * 0.02, -13, 13) - rotDrag) * slowSpring;
  } else if (mode === "returning") {
    const dist = Math.hypot(drag.x, drag.y);
    if (hopPhase === "none" && t >= nextHopAt) {
      if (dist < 10) {
        drag.x = 0;
        drag.y = 0;
        mode = "idle";
        hopsDone = 0;
        velY += 70; // settle squash
        landT = t;
        landAmp = (Math.random() - 0.5) * 5; // a last little wiggle as it settles
        if (blinkPhase === "idle") { blinkPhase = "closing"; animateBlink("closing", performance.now()); }
      } else {
        // plan the next clumsy hop: covers a random fraction of the way,
        // veering slightly off-line so the path never looks computed.
        // Within reach of home the hop lands EXACTLY on it, no minimum
        // length and no jitter — a 36px minimum step from 20px away would
        // overshoot back and forth around home forever
        const finalHop = dist <= 52;
        const frac = 0.38 + Math.random() * 0.2;
        const len = finalHop ? dist : clamp(dist * frac, 36, 130);
        const ux = -drag.x / dist;
        const uy = -drag.y / dist;
        const jitter = finalHop ? 0 : (Math.random() - 0.5) * Math.min(18, dist * 0.15);
        hopFrom = { x: drag.x, y: drag.y };
        hopTo = finalHop
          ? { x: 0, y: 0 }
          : { x: drag.x + ux * len - uy * jitter, y: drag.y + uy * len + ux * jitter };
        if (Math.hypot(hopTo.x, hopTo.y) < 14) { hopTo.x = 0; hopTo.y = 0; }
        hopDur = 0.3 + len / 320 + Math.random() * 0.08;
        hopArc = 16 + len * 0.22 + Math.random() * 10;
        hopDirX = Math.sign(ux || 1);
        // anticipation: winds up with a crouch, deeper for bigger jumps
        crouchDur = 0.08 + hopArc * 0.0022;
        crouchStartT = t;
        hopPhase = "crouch";
      }
    }
    if (hopPhase === "crouch") {
      const cp = Math.min((t - crouchStartT) / crouchDur, 1);
      hopSquash = Math.sin(cp * Math.PI) * (0.1 + hopArc * 0.0012);
      rotJump = -hopDirX * 4 * Math.sin(cp * Math.PI); // leans back, gathering itself
      if (cp >= 1) {
        hopPhase = "flight";
        hopStartT = t;
        hopSquash = 0;
      }
    } else if (hopPhase === "flight") {
      const p = Math.min((t - hopStartT) / hopDur, 1);
      const pe = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      // flattened sine: launches and falls briskly, floats at the apex
      const hang = Math.pow(Math.sin(p * Math.PI), 0.75);
      drag.x = hopFrom.x + (hopTo.x - hopFrom.x) * pe;
      drag.y = hopFrom.y + (hopTo.y - hopFrom.y) * pe - hopArc * hang;
      // stretches along the fast parts of the arc, relaxes at the top
      hopStretch = (0.05 + hopArc * 0.0011) * Math.abs(1 - 2 * p);
      rotJump = hopDirX * 9 * Math.sin(p * Math.PI); // leans into the jump
      if (p >= 1) {
        hopPhase = "none";
        hopStretch = 0;
        drag.x = hopTo.x;
        drag.y = hopTo.y;
        velY += 55 + hopArc * 0.9; // landing squash, bigger arc = bigger thud
        landT = t;
        landAmp = hopDirX * (3 + hopArc * 0.06); // follow-through wobble
        if (hopTo.x === 0 && hopTo.y === 0) {
          // touched down on home: this landing IS the arrival. Flipping to
          // idle right here — routing through the settle branch would fire a
          // second squash+wiggle moments later while standing still
          mode = "idle";
          hopsDone = 0;
          if (blinkPhase === "idle") { blinkPhase = "closing"; animateBlink("closing", performance.now()); }
        } else {
          hopsDone += 1;
          // after a few hops it sometimes needs a breather (and a blink)
          const breather = hopsDone >= 2 && Math.random() < 0.3;
          nextHopAt = t + (breather ? 0.45 + Math.random() * 0.5 : 0.07 + Math.random() * 0.14);
          if (breather && blinkPhase === "idle") { blinkPhase = "closing"; animateBlink("closing", performance.now()); }
        }
      }
    }
    rotDrag += (0 - rotDrag) * slowSpring;
    dragVel.x = 0;
    dragVel.y = 0;
  } else {
    rotDrag += (0 - rotDrag) * slowSpring;
  }
  // follow-through: a damped rotational wobble rings out after every landing
  const sinceLand = t - landT;
  const rotWobble = sinceLand < 0.6 ? landAmp * Math.exp(-sinceLand * 7) * Math.sin(sinceLand * 26) : 0;

  // ── eyes ──
  const awake = 1 - 0.9 * sleep;
  glanceY += (0 - glanceY) * slowSpring;
  let targetX = (gazeTarget ? gazeTarget.x : cursorTarget.x) * awake;
  let targetY = ((gazeTarget ? gazeTarget.y : cursorTarget.y) + glanceY) * awake;
  if (mode === "returning") {
    // eyes on home while hopping back
    const g = clampVector(-drag.x * 0.35, -drag.y * 0.35, MAX_CURSOR_PULL);
    targetX = g.x;
    targetY = g.y;
  }
  offset.x += (targetX - offset.x) * spring;
  offset.y += (targetY - offset.y) * spring;

  const magnitude = Math.min(Math.hypot(offset.x, offset.y) / MAX_CURSOR_PULL, 1);
  const tv = { x: offset.x * 1.2, y: offset.y * 0.8 };
  const nh = clamp(offset.x / MAX_CURSOR_PULL, -1, 1);
  const spacing = 1 - Math.min(Math.abs(nh) * 0.22, 0.26) + 0.1 * surprise;
  const blinkComp = 1 - 0.92 * blinkValue;
  // happy = eyes morph into upward arcs (^ ^): the rects shrink and fade out
  // while the arc paths scale and fade in, both riding the same spring, so the
  // crossfade reads as one continuous shape change.
  const happyBlend = happy * happy * (3 - 2 * happy); // smoothstep
  const dh = Math.max(
    EYE_HEIGHT * (1 - 0.12 * magnitude + 0.16 * surprise) * (1 - 0.6 * happyBlend) * blinkComp * (1 - 0.8 * sleep),
    8,
  );
  const dw = EYE_WIDTH * (1 + 0.08 * magnitude + 0.22 * surprise + 0.14 * happyBlend);

  travel!.setAttribute("transform", `translate(${tv.x}, ${tv.y})`);
  const eyes = [eyeL!, eyeR!];
  const arcs = [arcL, arcR];
  for (let i = 0; i < 2; i++) {
    const hb = offset.x * 0.06 * (i === 0 ? 1 : -1);
    const vb = offset.y * 0.06 + 14 * sleep - 22 * happyBlend;
    const cx = EYE_GROUP_CENTER.x + EYE_OFFSETS[i].x * spacing;
    const cy = EYE_GROUP_CENTER.y + EYE_OFFSETS[i].y;
    eyes[i].setAttribute("x", String(cx - dw / 2 + hb));
    eyes[i].setAttribute("y", String(cy - dh / 2 + vb));
    eyes[i].setAttribute("width", String(dw));
    eyes[i].setAttribute("height", String(dh));
    eyes[i].setAttribute("rx", String(dw / 2));
    const arc = arcs[i];
    if (arc) {
      eyes[i].setAttribute("opacity", String(1 - happyBlend));
      // no blink coupling — the arcs are already a "closed" happy shape,
      // letting blinks squash them reads as flicker
      const arcScale = 0.7 + 0.3 * happyBlend;
      arc.setAttribute("transform", `translate(${cx + hb}, ${cy + vb}) scale(${arcScale})`);
      arc.setAttribute("opacity", String(happyBlend));
    }
  }

  // ── body physics: hop spring ──
  velY += (-BODY_K * posY - BODY_C * velY) * dt;
  posY += velY * dt;

  // ── dance groove: bouncy |sin| with contact squash and alternating sway ──
  const dphase = t * ((2 * Math.PI) / 0.55);
  const bob = -10 * dance * Math.abs(Math.sin(dphase));
  const ground = 1 - Math.abs(Math.sin(dphase));
  const danceSquash = dance * 0.09 * ground * ground;
  const rotDance = dance * 6 * Math.sin(dphase / 2);

  // ── giggle: random little laugh wobbles while the eyes are happy ──
  if (happy > 0.5 && t >= nextGiggleAt) {
    giggleUntil = t + 0.4 + Math.random() * 0.35;
    nextGiggleAt = giggleUntil + 0.5 + Math.random() * 1.1;
    if (mode === "idle") spawnParticle("heart", 280 + Math.random() * 120, -30, { vx: 20, vy: -160, life: 1.4, sway: 20, scale: 8 });
  }
  giggle += ((t < giggleUntil ? 1 : 0) - giggle) * spring;
  const gw = giggle * happy;
  const laughPhase = t * 2 * Math.PI * 4.2;
  const rotGiggle = gw * 1.6 * Math.sin(laughPhase);
  const bobGiggle = -gw * 1.1 * Math.abs(Math.sin(laughPhase));

  // ── spin (triple-click celebration) ──
  let rotSpin = 0;
  if (spinStart >= 0) {
    const p = (t - spinStart) / SPIN_DURATION_S;
    if (p >= 1) spinStart = -1;
    else rotSpin = 360 * easeInOutCubic(p);
  }

  // ── breathing: faint always, deeper asleep ──
  const breathe = 0.015 * (0.35 + 0.65 * sleep) * Math.sin((2 * Math.PI * t) / 4);

  // squash & stretch from vertical velocity, plus dance/sleep/breath shaping,
  // plus a slight elongation while being swung around
  const dragStretch = clamp(Math.hypot(dragVel.x, dragVel.y) * 0.00012, 0, 0.08);
  const sy = clamp(1 - velY * 0.0035 + breathe - danceSquash - 0.05 * sleep + dragStretch - hopSquash + hopStretch, 0.8, 1.22);
  const sx = 1 - (sy - 1) * 0.65;
  const y = posY + bob + bobGiggle + 2.5 * sleep;
  const lean = offset.x * 0.06; // leans toward whatever it's looking at
  svg!.style.transform = `translate(${drag.x}px, ${drag.y}px) translateY(${y}%) rotate(${lean + rotDance + rotGiggle + rotSpin + rotDrag + rotJump + rotWobble}deg) scale(${sx}, ${sy})`;

  stepParticles(dt, t);
  requestAnimationFrame(step);
}

/** Initialise the mascot on the given SVG (call once, from the header). */
export function init(svgEl: SVGSVGElement | null) {
  if (prefersReduced || started || !svgEl) return;
  travel = svgEl.querySelector(".mascot-eyes-travel");
  eyeL = svgEl.querySelector(".mascot-eye-left");
  eyeR = svgEl.querySelector(".mascot-eye-right");
  arcL = svgEl.querySelector(".mascot-eye-arc-left");
  arcR = svgEl.querySelector(".mascot-eye-arc-right");
  if (!travel || !eyeL || !eyeR) return;
  svg = svgEl;
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerleave", () => { cursorTarget.x = 0; cursorTarget.y = 0; });
  window.addEventListener("blur", () => { cursorTarget.x = 0; cursorTarget.y = 0; });
  window.addEventListener("pointerdown", activity);
  window.addEventListener("keydown", activity);
  window.addEventListener(
    "scroll",
    () => {
      activity();
      const dy = window.scrollY - lastScrollY;
      lastScrollY = window.scrollY;
      glanceY = clamp(glanceY + dy * 0.35, -16, 16);
    },
    { passive: true },
  );
  // The mascot is a toy: clicking it boops instead of following the home link
  // (the wordmark next to it still navigates). The handler lives on the parent
  // link and tests the click's x-position against the link's stable layout box,
  // NOT the svg — mid-hop/spin the svg's transformed bounds move out from
  // under the cursor, and a click would fall through to the link and navigate.
  const brandLink = svgEl.closest("a");
  if (brandLink) {
    brandLink.addEventListener("click", (e) => {
      // after a real drag, the trailing click must neither boop nor navigate.
      // mode/drag checks cover the sneaky case: grabbing the mascot mid-return
      // and releasing without moving the pointer sets no suppress flag (the
      // mascot moved, not the hand), yet the click lands outside the home
      // zone and would otherwise follow the link
      if (suppressClick || mode !== "idle" || Math.abs(drag.x) + Math.abs(drag.y) > 1) {
        e.preventDefault();
        suppressClick = false;
        return;
      }
      const rect = brandLink.getBoundingClientRect();
      if (e.clientX <= rect.left + MASCOT_ZONE_PX) onBoop(e);
    });
    brandLink.addEventListener("dragstart", (e) => e.preventDefault());
  } else {
    svgEl.addEventListener("click", (e) => {
      if (suppressClick || mode !== "idle" || Math.abs(drag.x) + Math.abs(drag.y) > 1) {
        suppressClick = false;
        return;
      }
      onBoop(e);
    });
  }

  // ── drag & drop: pick it up anywhere, including mid-return ──
  svgEl.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault(); // no text selection / native link drag
    activity();
    mode = "dragging";
    hopPhase = "none";
    hopSquash = 0;
    hopStretch = 0;
    suppressClick = false;
    grabPointer = { x: e.clientX, y: e.clientY };
    grabStart = { x: drag.x, y: drag.y };
    dragTarget.x = drag.x;
    dragTarget.y = drag.y;
    dragVel.x = 0;
    dragVel.y = 0;
    // keep the whole body on screen while carried
    const r = svgEl.getBoundingClientRect();
    const rest = { left: r.left - drag.x, right: r.right - drag.x, top: r.top - drag.y, bottom: r.bottom - drag.y };
    dragBounds = {
      minX: -rest.left + 4,
      maxX: window.innerWidth - rest.right - 4,
      minY: -rest.top + 4,
      maxY: window.innerHeight - rest.bottom - 4,
    };
    svgEl.classList.add("mascot-held");
    try {
      svgEl.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic or already-released pointer: window listeners still track */
    }
    flashSurprise(260); // !? who picked me up
  });
  // move/up live on window so a fast fling can't outrun the tiny svg,
  // even if pointer capture was refused
  window.addEventListener("pointermove", (e) => {
    if (mode !== "dragging") return;
    const dx = e.clientX - grabPointer.x;
    const dy = e.clientY - grabPointer.y;
    if (Math.hypot(dx, dy) > 6) suppressClick = true;
    dragTarget.x = clamp(grabStart.x + dx, dragBounds.minX, dragBounds.maxX);
    dragTarget.y = clamp(grabStart.y + dy, dragBounds.minY, dragBounds.maxY);
  });
  const release = () => {
    if (mode !== "dragging") return;
    svgEl.classList.remove("mascot-held");
    mode = "returning";
    hopPhase = "none";
    hopsDone = 0;
    velY += 90; // drop thud
    // a beat to collect itself before the first hop
    nextHopAt = performance.now() / 1000 + 0.28 + Math.random() * 0.22;
  };
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  svgEl.addEventListener("pointerenter", () => { activity(); danceTarget = 1; });
  svgEl.addEventListener("pointerleave", () => { danceTarget = 0; });
  svgEl.classList.add("mascot-live");
  scheduleBlink();
  started = true;
  lastActivity = performance.now();
  lastTime = performance.now();
  // a small hello once the entrance settles
  window.setTimeout(() => hop(HOP_GREET), 900);
  requestAnimationFrame(step);
}

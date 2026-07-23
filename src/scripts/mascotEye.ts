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
let wakeT = -10;                    // seconds; when the current wake-up began
let wakeHopped = false;             // the soft push-off at the stretch peak fired
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
// the drop: on release it carries the throw momentum and free-falls a short
// way to an imaginary floor — weight is what makes letting go feel real
let falling = false;
const fallVel = { x: 0, y: 0 };
let fallFloorY = 0;
// pendulum dangle while carried: lateral acceleration swings it, and it
// keeps swinging for a moment after release
let rotVel = 0;
const prevDragVel = { x: 0, y: 0 };
// shaken too hard → dizzy: pointer direction reversals pump shakeEnergy,
// enough of it and the poor thing needs a moment
let shakeEnergy = 0;
let dizzy = 0;
let heldSm = 0;                     // smoothed "is being held" for damping the weave
let wasDizzy = false;
let lastMoveDirX = 0, lastMoveDirY = 0;
let lastSegX = 0, lastSegY = 0;
let lastSegT = 0;
let starEls: SVGTextElement[] = [];
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
    // no startled jump — waking is a slow cat-stretch (see step); the only
    // jolt a sleeper gets is an actual boop
    waking = true;
    wakeT = performance.now() / 1000;
    wakeHopped = false;
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

/** True when the mascot is sitting at its resting spot (a static,
 *  reduced-motion mascot is always home). */
export function isHome() {
  if (!started) return true;
  return mode === "idle" && Math.abs(drag.x) + Math.abs(drag.y) < 1;
}

// ─── mood particles ─────────────────────────────────────
// Tiny anime-style glyphs that drift up from the head: "z" while sleeping,
// hearts on giggles, "!" on boops, "♪" while dancing, "✦" on the spin.
// Spawned as children of the mascot svg so they need no markup changes.
const SVG_NS = "http://www.w3.org/2000/svg";
const HEART_PATH = "M0 -4 C -5 -11, -14 -3, 0 8 C 14 -3, 5 -11, 0 -4";
// classic anime sweat bead: pointed crown easing into a round belly
const SWEAT_PATH = "M0 -9 C 3.2 -3.6, 6.4 0.8, 6.4 4.2 A 6.4 6.4 0 1 1 -6.4 4.2 C -6.4 0.8 -3.2 -3.6 0 -9";
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
  gravity?: number;                 // px/s² downward pull (sweat falls, it doesn't float)
  wobble?: number;                  // squishy jiggle amount while falling
}
const particles: Particle[] = [];
let fxLayer: SVGSVGElement | null = null;
let nextZAt = 0;
let nextNoteAt = 0;
// mid-return breather: a couple of sweat beads roll off, staggered
let sweatBurst = 0;
let nextSweatAt = 0;
let sweatSide = 1;

function ensureFxLayer(): SVGSVGElement | null {
  if (!svg) return null;
  if (!fxLayer) {
    // a sibling overlay svg with the same viewBox, NOT a child of the mascot:
    // particles must stay serenely upright while the body hops, dances, spins.
    // It follows the mascot's drag position (translate only) so effects stay
    // over its head wherever it's carried
    fxLayer = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
    fxLayer.setAttribute("viewBox", "0 0 649 512");
    fxLayer.setAttribute("class", "mascot-fx-layer");
    fxLayer.setAttribute("aria-hidden", "true");
    (svg.parentElement ?? document.body).appendChild(fxLayer);
  }
  return fxLayer;
}

function spawnParticle(kind: "z" | "heart" | "bang" | "note" | "spark" | "sweat", x: number, y: number, opts: Partial<Particle> = {}) {
  if (!svg || particles.length >= MAX_PARTICLES) return;
  const layer = ensureFxLayer();
  if (!layer) return;
  let el: SVGElement;
  if (kind === "heart") {
    el = document.createElementNS(SVG_NS, "path");
    el.setAttribute("d", HEART_PATH);
    el.setAttribute("fill", "#dfa1ae");
  } else if (kind === "sweat") {
    // a bead with a tiny specular glint so it reads as liquid, not confetti
    el = document.createElementNS(SVG_NS, "g");
    const bead = document.createElementNS(SVG_NS, "path");
    bead.setAttribute("d", SWEAT_PATH);
    bead.setAttribute("fill", "#a3c4d8");
    const glint = document.createElementNS(SVG_NS, "circle");
    glint.setAttribute("cx", "-2.2");
    glint.setAttribute("cy", "3.4");
    glint.setAttribute("r", "1.7");
    glint.setAttribute("fill", "#e6f1f7");
    el.appendChild(bead);
    el.appendChild(glint);
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
  layer.appendChild(el);
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
  // breather sweat: beads roll off the brow while it catches its breath
  // mid-return. Alternating temples, staggered so they read as drip… drip.
  // The fx layer is pinned to home, so the current drag offset is folded into
  // the spawn point (same trick as the dizzy stars)
  if (mode !== "returning") sweatBurst = 0;
  else if (sweatBurst > 0 && t >= nextSweatAt && hopPhase === "none" && !falling) {
    sweatBurst -= 1;
    nextSweatAt = t + 0.26 + Math.random() * 0.1;
    sweatSide = -sweatSide;
    const layerW = fxLayer ? fxLayer.getBoundingClientRect().width || 1 : 1;
    const u = 649 / layerW;
    spawnParticle("sweat", 324.5 + drag.x * u + sweatSide * (150 + Math.random() * 40), drag.y * u + 40 + Math.random() * 30, {
      vx: sweatSide * (30 + Math.random() * 22),
      vy: 50,
      gravity: 620,
      life: 0.85 + Math.random() * 0.15,
      sway: 0,
      wobble: 0.09,
      scale: 9 + Math.random() * 3,
      phase: Math.random() * 6.28,
    });
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      p.el.remove();
      particles.splice(i, 1);
      continue;
    }
    if (p.gravity) p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const k = p.age / p.life;
    const fade = Math.min(k / 0.12, 1) * (1 - Math.max((k - 0.55) / 0.45, 0));
    const sway = Math.sin(p.age * 3 + p.phase) * p.sway;
    // falling beads jiggle like jello — squash x against stretch y
    const jx = p.wobble ? 1 + p.wobble * Math.sin(p.age * 17 + p.phase) : 1;
    const jy = p.wobble ? 1 - p.wobble * Math.sin(p.age * 17 + p.phase) : 1;
    const grow = p.gravity ? 1 : 0.85 + 0.3 * k;
    p.el.setAttribute("transform", `translate(${p.x + sway}, ${p.y}) scale(${p.scale * grow * jx}, ${p.scale * grow * jy})`);
    p.el.setAttribute("opacity", String(fade * 0.9));
  }
}

// Three little stars orbiting overhead while dizzy — the classic cartoon
// "just got clobbered" halo. The fx layer itself never moves (moving it
// would yank every other particle along); instead the mascot's current drag
// position is folded into the stars' own orbit coordinates.
function updateDizzyStars(t: number) {
  if (dizzy > 0.5 && starEls.length === 0) {
    const layer = ensureFxLayer();
    if (!layer) return;
    for (let i = 0; i < 3; i++) {
      const s = document.createElementNS(SVG_NS, "text") as SVGTextElement;
      s.textContent = "✦";
      s.setAttribute("font-family", "Spline Sans Mono, ui-monospace, monospace");
      s.setAttribute("font-size", i === 1 ? "150" : "115");
      s.setAttribute("fill", "var(--accent)");
      s.setAttribute("opacity", "0");
      layer.appendChild(s);
      starEls.push(s);
    }
  }
  if (!starEls.length) return;
  if (dizzy < 0.15) {
    for (const s of starEls) s.remove();
    starEls = [];
    return;
  }
  // convert the drag offset (px) into viewBox units so the halo hovers over
  // the mascot's head wherever it currently is
  const layerW = fxLayer ? fxLayer.getBoundingClientRect().width || 1 : 1;
  const u = 649 / layerW;
  for (let i = 0; i < starEls.length; i++) {
    const a = t * 4.6 + (i * Math.PI * 2) / 3;
    const x = 324.5 + drag.x * u + Math.cos(a) * 155;
    const y = -60 + drag.y * u + Math.sin(a) * 42;
    const depth = 0.75 + 0.25 * Math.sin(a); // smaller + dimmer at the back of the orbit
    starEls[i].setAttribute("transform", `translate(${x}, ${y}) scale(${depth})`);
    starEls[i].setAttribute("opacity", String(clamp((dizzy - 0.15) / 0.5, 0, 1) * 0.85 * depth));
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
    // too groggy for wide-eyed shock: sleep-slit eyes snapping to surprise-
    // wide is exactly the abrupt wake this avoids (same below)
    if (sleep < 0.35) flashSurprise(700);
    for (let s = 0; s < 3; s++) {
      spawnParticle("spark", 150 + s * 175, -30, { vx: (s - 1) * 60, vy: -170 - s * 25, life: 1.1, phase: s * 2, scale: 0.8 });
    }
  } else {
    hop(HOP_BOOP);
    if (sleep < 0.35) flashSurprise(480);
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
  // drifting off is slow; waking is a touch quicker but still an unhurried
  // lid-drift (~1.5s) — the whole point is that it never snaps open
  sleep += (sleepTarget - sleep) * slowSpring * (waking ? 0.55 : 0.35);
  if (waking && sleep < 0.1) waking = false;

  // ── waking: a slow cat-stretch instead of a startle ──
  // the body arches up over ~1.2s with a soft push-off at the peak. Runs on
  // its own clock from wakeT (NOT the `waking` flag, which clears as the
  // lids finish opening — that used to truncate the stretch at its apex);
  // the sine returns to zero on its own
  const wp = clamp((t - wakeT) / 1.2, 0, 1);
  const wakeStretch = 0.07 * Math.sin(wp * Math.PI);
  if (wp >= 0.55 && wp < 1 && !wakeHopped) {
    wakeHopped = true;
    hop(38);
  }

  // ── drag & clumsy return ──
  let rotJump = 0;
  if (mode === "dragging") {
    const stiff = 1 - Math.pow(1 - 0.3, dt * 60); // chases the hand with a rubbery lag
    const nx = drag.x + (dragTarget.x - drag.x) * stiff;
    const ny = drag.y + (dragTarget.y - drag.y) * stiff;
    prevDragVel.x = dragVel.x;
    prevDragVel.y = dragVel.y;
    dragVel.x = (nx - drag.x) / Math.max(dt, 1e-4);
    dragVel.y = (ny - drag.y) / Math.max(dt, 1e-4);
    drag.x = nx;
    drag.y = ny;
  } else if (mode === "returning") {
    if (hopPhase === "none" && dizzy > 0.35) nextHopAt = Math.max(nextHopAt, t + 0.16); // too woozy to jump
    if (hopPhase === "none" && sweatBurst > 0) nextHopAt = Math.max(nextHopAt, t + 0.5); // still wiping its brow
    if (falling) {
      // gravity + carried throw momentum, with a little air drag sideways
      fallVel.y = Math.min(fallVel.y + 2400 * dt, 1600);
      fallVel.x *= Math.exp(-1.8 * dt);
      drag.x = clamp(drag.x + fallVel.x * dt, dragBounds.minX, dragBounds.maxX);
      drag.y += fallVel.y * dt;
      if (fallVel.y > 0 && drag.y >= fallFloorY) {
        drag.y = fallFloorY;
        const impact = Math.abs(fallVel.y);
        if (impact > 720) {
          // came in hot: one springy little bounce before settling
          fallVel.y = -impact * 0.27;
          fallVel.x *= 0.6;
          velY += 60;
          landT = t;
          landAmp = Math.sign(fallVel.x || 1) * 4;
        } else {
          falling = false;
          velY += clamp(impact * 0.12, 45, 150); // landing thud scaled by fall speed
          landT = t;
          landAmp = Math.sign(fallVel.x || 1) * (3 + impact * 0.004);
          nextHopAt = t + 0.32 + Math.random() * 0.25; // collects itself, then hops
        }
      }
    }
    const dist = Math.hypot(drag.x, drag.y);
    if (!falling && hopPhase === "none" && t >= nextHopAt) {
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
          // after a few hops it sometimes needs a breather (and a blink) —
          // the longer the trek, the more likely it is winded
          const breather = hopsDone >= 2 && Math.random() < 0.25 + (hopsDone - 2) * 0.18;
          nextHopAt = t + (breather ? 0.6 + Math.random() * 0.5 : 0.07 + Math.random() * 0.14);
          if (breather) {
            // phew — a couple of sweat beads while it catches its breath
            sweatBurst = 2;
            nextSweatAt = t + 0.16;
            if (blinkPhase === "idle") { blinkPhase = "closing"; animateBlink("closing", performance.now()); }
          }
        }
      }
    }
    prevDragVel.x = dragVel.x;
    prevDragVel.y = dragVel.y;
    dragVel.x = 0;
    dragVel.y = 0;
  } else {
    prevDragVel.x = dragVel.x;
    prevDragVel.y = dragVel.y;
    dragVel.x = 0;
    dragVel.y = 0;
  }

  // pendulum dangle: lateral acceleration swings it while carried, and the
  // swing rings out naturally for a moment after release
  const accelX = mode === "dragging" ? (dragVel.x - prevDragVel.x) / Math.max(dt, 1e-4) : 0;
  rotVel = clamp(rotVel + (-120 * rotDrag - 8 * rotVel - accelX * 0.0065) * dt, -320, 320);
  rotDrag = clamp(rotDrag + rotVel * dt, -26, 26);

  // ── dizzy from being shaken ──
  // Dizziness builds up WHILE being shaken (spiral eyes, green, stars ramp in
  // mid-drag) and simply carries across the release — no state starts or
  // stops at the drop, so the transition into the stagger is seamless
  // cap + drain tuned so even a maximal shake resolves in ~3-4s of theater
  shakeEnergy = Math.max(0, Math.min(shakeEnergy, 7) - dt * 2.2);
  const dizzyOn = shakeEnergy >= 4 || (dizzy > 0.55 && shakeEnergy > 0.8);
  dizzy += ((dizzyOn ? 1 : 0) - dizzy) * (dizzyOn ? spring : slowSpring * 0.5);
  // the hand steadies it: weaving is damped while held, blooming to full
  // stagger after release — smoothed so the release itself is invisible
  heldSm += ((mode === "dragging" ? 1 : 0) - heldSm) * slowSpring;
  if (dizzy > 0.6 && !wasDizzy) {
    wasDizzy = true;
    svg!.classList.add("mascot-queasy"); // goes a little green
  }
  if (wasDizzy && dizzy < 0.35) {
    wasDizzy = false;
    svg!.classList.remove("mascot-queasy");
    landT = t;
    landAmp = 7; // sobers up with a quick head-waggle
  }
  const rotDizzy = dizzy * 6.5 * (1 - 0.45 * heldSm) * Math.sin(t * 5.2); // woozy weaving

  // follow-through: a damped rotational wobble rings out after every landing
  const sinceLand = t - landT;
  const rotWobble = sinceLand < 0.6 ? landAmp * Math.exp(-sinceLand * 7) * Math.sin(sinceLand * 26) : 0;

  // ── eyes ──
  // smoothstepped so the gaze engages late in the wake: lids first, then
  // tracking — a sleeper snapping straight onto the cursor reads as abrupt
  const aw = clamp((1 - sleep - 0.22) / 0.78, 0, 1);
  const awake = aw * aw * (3 - 2 * aw);
  glanceY += (0 - glanceY) * slowSpring;
  let targetX = (gazeTarget ? gazeTarget.x : cursorTarget.x) * awake;
  let targetY = ((gazeTarget ? gazeTarget.y : cursorTarget.y) + glanceY) * awake;
  if (mode === "returning") {
    if (falling) {
      // eyes follow the fall — braced for the landing
      const g = clampVector(fallVel.x * 0.03, fallVel.y * 0.03, MAX_CURSOR_PULL);
      targetX = g.x;
      targetY = g.y;
    } else {
      // eyes on home while hopping back
      const g = clampVector(-drag.x * 0.35, -drag.y * 0.35, MAX_CURSOR_PULL);
      targetX = g.x;
      targetY = g.y;
    }
  }
  if (dizzy > 0.12) {
    // cartoon-dizzy: the eyes roll in little circles, overriding everything
    const r = MAX_CURSOR_PULL * 0.75 * dizzy;
    targetX = Math.cos(t * 6.8) * r;
    targetY = Math.sin(t * 6.8) * r * 0.7;
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
    EYE_HEIGHT * (1 - 0.12 * magnitude + 0.16 * surprise) * (1 - 0.6 * happyBlend) * blinkComp * (1 - 0.8 * sleep) * (1 - 0.2 * dizzy),
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

  // squash & stretch from vertical velocity, plus dance/sleep/breath shaping.
  // While carried: speed elongates it and vertical motion adds jello — being
  // yanked down stretches it, being whipped up compresses it. While falling,
  // the same shaping runs on the fall velocity, so it lengthens as it drops
  const speedRef = mode === "dragging" ? dragVel : falling ? fallVel : null;
  const dragStretch = speedRef
    ? clamp(Math.hypot(speedRef.x, speedRef.y) * 0.00008 + speedRef.y * 0.00005, -0.05, 0.12)
    : 0;
  const sy = clamp(1 - velY * 0.0035 + breathe - danceSquash - 0.05 * sleep + dragStretch - hopSquash + hopStretch + wakeStretch, 0.8, 1.22);
  const sx = 1 - (sy - 1) * 0.65;
  const y = posY + bob + bobGiggle + 2.5 * sleep;
  const lean = offset.x * 0.06; // leans toward whatever it's looking at
  svg!.style.transform = `translate(${drag.x}px, ${drag.y}px) translateY(${y}%) rotate(${lean + rotDance + rotGiggle + rotSpin + rotDrag + rotJump + rotWobble + rotDizzy}deg) scale(${sx}, ${sy})`;

  stepParticles(dt, t);
  updateDizzyStars(t);
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
      // the tail-end click of a real drag must neither boop nor navigate,
      // wherever it lands (release() clears the flag right after this click
      // has had its chance to fire)
      if (suppressClick) {
        e.preventDefault();
        return;
      }
      const rect = brandLink.getBoundingClientRect();
      if (e.clientX <= rect.left + MASCOT_ZONE_PX) {
        // clicks on the mascot's spot are toy clicks: boop when it's home,
        // swallowed while it's away (grabbing it mid-return and releasing
        // without moving lands here with mode !== idle — the mascot moved,
        // not the hand, so no suppress flag was set)
        if (mode !== "idle" || Math.abs(drag.x) + Math.abs(drag.y) > 1) {
          e.preventDefault();
          return;
        }
        onBoop(e);
        return;
      }
      // wordmark clicks always navigate home — even while the mascot is
      // out on the page hopping back; that's the whole point of the link
    });
    brandLink.addEventListener("dragstart", (e) => e.preventDefault());
  } else {
    svgEl.addEventListener("click", (e) => {
      if (suppressClick || mode !== "idle" || Math.abs(drag.x) + Math.abs(drag.y) > 1) return;
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
    falling = false;
    hopSquash = 0;
    hopStretch = 0;
    suppressClick = false;
    grabPointer = { x: e.clientX, y: e.clientY };
    grabStart = { x: drag.x, y: drag.y };
    dragTarget.x = drag.x;
    dragTarget.y = drag.y;
    dragVel.x = 0;
    dragVel.y = 0;
    lastSegX = e.clientX;
    lastSegY = e.clientY;
    lastMoveDirX = 0;
    lastMoveDirY = 0;
    lastSegT = performance.now();
    // keep the whole body on screen while carried
    const r = svgEl.getBoundingClientRect();
    const rest = { left: r.left - drag.x, right: r.right - drag.x, top: r.top - drag.y, bottom: r.bottom - drag.y };
    dragBounds = {
      minX: -rest.left + 4,
      maxX: window.innerWidth - rest.right - 4,
      minY: -rest.top + 4,
      maxY: window.innerHeight - rest.bottom - 4,
    };
    velY += 55; // a little squeeze as it's picked up
    // let listeners (e.g. the speech bubble) know it just left its spot
    svgEl.dispatchEvent(new CustomEvent("mascot-grab", { bubbles: true }));
    svgEl.classList.add("mascot-held");
    try {
      svgEl.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic or already-released pointer: window listeners still track */
    }
    if (sleep < 0.35) flashSurprise(260); // !? who picked me up (unless too groggy)
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
    // shake detection: each ~18px leg of hand travel that reverses direction
    // quickly pumps shakeEnergy; slow deliberate back-and-forth doesn't count
    const now = performance.now();
    if (Math.abs(e.clientX - lastSegX) > 18) {
      const dir = Math.sign(e.clientX - lastSegX);
      if (lastMoveDirX !== 0 && dir !== lastMoveDirX && now - lastSegT < 300) shakeEnergy += 1;
      lastMoveDirX = dir;
      lastSegX = e.clientX;
      lastSegT = now;
    }
    if (Math.abs(e.clientY - lastSegY) > 18) {
      const dir = Math.sign(e.clientY - lastSegY);
      if (lastMoveDirY !== 0 && dir !== lastMoveDirY && now - lastSegT < 300) shakeEnergy += 1;
      lastMoveDirY = dir;
      lastSegY = e.clientY;
      lastSegT = now;
    }
  });
  const release = () => {
    if (mode !== "dragging") return;
    svgEl.classList.remove("mascot-held");
    // a grab that never went anywhere is a click, not a throw: the hand
    // didn't move (no suppressClick) and it's still on its perch — stay
    // put and let the trailing click event fire the boop instead of
    // face-planting off the header
    if (!suppressClick && Math.abs(drag.x) + Math.abs(drag.y) < 2) {
      mode = "idle";
      return;
    }
    mode = "returning";
    hopPhase = "none";
    hopsDone = 0;
    // let it DROP: throw momentum carries over and gravity takes it to a
    // floor a short way below the release point (clamped to the viewport)
    falling = true;
    fallVel.x = clamp(dragVel.x * 0.85, -900, 900);
    fallVel.y = clamp(dragVel.y * 0.85, -700, 900);
    const r = svgEl.getBoundingClientRect();
    const restBottom = r.bottom - drag.y;
    // floor sits a short way below the release point, clamped to the viewport
    // but never ABOVE the release point (dropping at the bottom edge must not
    // snap it upward — it just lands where it is)
    fallFloorY = Math.max(Math.min(drag.y + 60 + Math.random() * 35, window.innerHeight - restBottom - 4), drag.y);
    nextHopAt = Infinity; // hops are scheduled once it has landed
    // the drag's own trailing click fires synchronously after pointerup —
    // clear the suppress flag right after it, so it can't leak onto a later
    // legitimate wordmark click (e.g. when the drag ended off the link and
    // no trailing click ever consumed it)
    window.setTimeout(() => { suppressClick = false; }, 0);
  };
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  svgEl.addEventListener("pointerenter", () => { activity(); danceTarget = 1; });
  svgEl.addEventListener("pointerleave", () => { danceTarget = 0; });
  svgEl.classList.add("mascot-live");
  if (import.meta.env?.DEV) {
    // dev-only hook: trigger the breather sweat on demand so the visuals can
    // be inspected without fishing for a random mid-return breather
    (window as unknown as Record<string, unknown>).__mascotSweat = () => {
      mode = "returning";
      falling = false;
      hopPhase = "none";
      sweatBurst = 2;
      nextSweatAt = 0;
    };
    // dev-only hook: force deep sleep so the wake transition can be
    // inspected without waiting out SLEEP_AFTER_MS
    (window as unknown as Record<string, unknown>).__mascotSleep = () => {
      sleep = 1;
      waking = false;
      lastActivity = performance.now() - SLEEP_AFTER_MS - 1;
    };
  }
  scheduleBlink();
  started = true;
  lastActivity = performance.now();
  lastTime = performance.now();
  // a small hello once the entrance settles
  window.setTimeout(() => hop(HOP_GREET), 900);
  requestAnimationFrame(step);
}

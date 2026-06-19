// src/scripts/mascotEye.ts
// Shared, singleton eye-tracking spring for the ARTOSHI mascot. The header
// initialises it on the mascot SVG; the work list feeds it a gaze target so the
// eyes look at the active row. One rAF loop, one 0.24 spring — fully
// interruptible/reversible: every frame just lerps toward the CURRENT target,
// which any caller can reassign at any instant.

const MAX_CURSOR_PULL = 42;
const SPRING_SPEED = 0.24;
const EYE_RETURN_DELAY_MS = 1300;
const BLINK_MIN = 2600, BLINK_MAX = 5400, BLINK_CLOSE = 78, BLINK_OPEN = 120;

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
let started = false;

const cursorTarget = { x: 0, y: 0 };
let gazeTarget: { x: number; y: number } | null = null;
const offset = { x: 0, y: 0 };
let idleTimeout: number | null = null;
let blinkValue = 0;
let blinkPhase: "idle" | "closing" | "opening" = "idle";
let lastTime = 0;

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

function onPointerMove(e: PointerEvent) {
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

function animateBlink(phase: "closing" | "opening", start: number) {
  const duration = phase === "closing" ? BLINK_CLOSE : BLINK_OPEN;
  const tick = (time: number) => {
    const progress = Math.min(Math.max((time - start) / duration, 0), 1);
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
    if (blinkPhase === "idle") { blinkPhase = "closing"; animateBlink("closing", performance.now()); }
  }, BLINK_MIN + Math.random() * (BLINK_MAX - BLINK_MIN));
}

function step(time: number) {
  const delta = Math.min((time - lastTime) / 16.67, 1.8);
  lastTime = time;
  const targetX = gazeTarget ? gazeTarget.x : cursorTarget.x;
  const targetY = gazeTarget ? gazeTarget.y : cursorTarget.y;
  const spring = SPRING_SPEED * delta;
  offset.x += (targetX - offset.x) * spring;
  offset.y += (targetY - offset.y) * spring;

  const magnitude = Math.min(Math.hypot(offset.x, offset.y) / MAX_CURSOR_PULL, 1);
  const tv = { x: offset.x * 1.2, y: offset.y * 0.8 };
  const nh = Math.max(Math.min(offset.x / MAX_CURSOR_PULL, 1), -1);
  const spacing = 1 - Math.min(Math.abs(nh) * 0.22, 0.26);
  const blinkComp = 1 - 0.92 * blinkValue;
  const dh = EYE_HEIGHT * (1 - 0.12 * magnitude) * blinkComp;
  const dw = EYE_WIDTH * (1 + 0.08 * magnitude);

  travel!.setAttribute("transform", `translate(${tv.x}, ${tv.y})`);
  const eyes = [eyeL!, eyeR!];
  for (let i = 0; i < 2; i++) {
    const hb = offset.x * 0.06 * (i === 0 ? 1 : -1);
    const vb = offset.y * 0.06;
    const cx = EYE_GROUP_CENTER.x + EYE_OFFSETS[i].x * spacing;
    const cy = EYE_GROUP_CENTER.y + EYE_OFFSETS[i].y;
    eyes[i].setAttribute("x", String(cx - dw / 2 + hb));
    eyes[i].setAttribute("y", String(cy - dh / 2 + vb));
    eyes[i].setAttribute("width", String(dw));
    eyes[i].setAttribute("height", String(dh));
    eyes[i].setAttribute("rx", String(dw / 2));
  }
  requestAnimationFrame(step);
}

/** Initialise eye-tracking on the given mascot SVG (call once, from the header). */
export function init(svgEl: SVGSVGElement | null) {
  if (prefersReduced || started || !svgEl) return;
  travel = svgEl.querySelector(".mascot-eyes-travel");
  eyeL = svgEl.querySelector(".mascot-eye-left");
  eyeR = svgEl.querySelector(".mascot-eye-right");
  if (!travel || !eyeL || !eyeR) return;
  svg = svgEl;
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerleave", () => { cursorTarget.x = 0; cursorTarget.y = 0; });
  window.addEventListener("blur", () => { cursorTarget.x = 0; cursorTarget.y = 0; });
  scheduleBlink();
  started = true;
  lastTime = performance.now();
  requestAnimationFrame(step);
}

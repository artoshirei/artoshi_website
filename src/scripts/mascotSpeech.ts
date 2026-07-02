// src/scripts/mascotSpeech.ts
// Small speech bubbles from the header mascot, reacting to the page the
// visitor opened. Lines come from /mascot/say (a Cloudflare Pages Function
// proxying OpenRouter) with hand-written fallbacks when it's unreachable.
//
// Guardrails, in order:
//  - one bubble per page per browser session (sessionStorage)
//  - 45s cooldown and 15 calls/day across pages (localStorage) before the
//    API is even attempted — beyond that, fallbacks only
//  - recently shown lines are remembered per page and sent as an avoid-list
//    so the model doesn't repeat itself between visits

import { chirp } from "./mascotEye";
import { voices, type PageVoice } from "../data/mascotVoice";

const CALL_COOLDOWN_MS = 45_000;
const DAILY_CALL_CAP = 15;
const SHOW_DELAY_MS = 1400;
const SHOW_FOR_MS = 8000;
const REMEMBER_LINES = 12;

const K_RECENT = (page: string) => `mascot-recent:${page}`;
const K_LAST_CALL = "mascot-last-call";
const K_DAILY = () => `mascot-calls:${new Date().toISOString().slice(0, 10)}`;

function recentLines(page: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(K_RECENT(page)) ?? "[]");
  } catch {
    return [];
  }
}

function remember(page: string, line: string) {
  try {
    const lines = [line, ...recentLines(page).filter((l) => l !== line)].slice(0, REMEMBER_LINES);
    localStorage.setItem(K_RECENT(page), JSON.stringify(lines));
  } catch {
    /* storage unavailable — repeats are survivable */
  }
}

function apiAllowed(): boolean {
  try {
    const last = Number(localStorage.getItem(K_LAST_CALL) ?? 0);
    const today = Number(localStorage.getItem(K_DAILY()) ?? 0);
    return Date.now() - last > CALL_COOLDOWN_MS && today < DAILY_CALL_CAP;
  } catch {
    return false;
  }
}

function noteApiCall() {
  try {
    localStorage.setItem(K_LAST_CALL, String(Date.now()));
    localStorage.setItem(K_DAILY(), String(Number(localStorage.getItem(K_DAILY()) ?? 0) + 1));
  } catch {
    /* ignore */
  }
}

function pickFallback(page: string, voice: PageVoice): string {
  const recent = recentLines(page);
  const fresh = voice.fallbacks.filter((l) => !recent.includes(l));
  const pool = fresh.length ? fresh : voice.fallbacks;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function fetchLine(page: string, voice: PageVoice): Promise<string | null> {
  if (!voice.api || !apiAllowed()) return null;
  noteApiCall(); // count the attempt, not the success — failures cost upstream too
  try {
    const res = await fetch("/mascot/say", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ page, facts: voice.facts, avoid: recentLines(page) }),
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const line = typeof data?.line === "string" ? data.line.trim() : "";
    return line || null;
  } catch {
    return null;
  }
}

function showBubble(anchor: HTMLElement, line: string) {
  const bubble = document.createElement("div");
  bubble.className = "mascot-bubble";
  bubble.setAttribute("role", "status");
  bubble.textContent = line;
  anchor.appendChild(bubble);
  requestAnimationFrame(() => {
    bubble.classList.add("show");
    chirp();
  });
  const dismiss = () => {
    bubble.classList.remove("show");
    window.setTimeout(() => bubble.remove(), 350);
  };
  bubble.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dismiss();
  });
  window.setTimeout(dismiss, SHOW_FOR_MS);
}

/** Maybe say one quiet line about the current page. Call once per page. */
export async function initSpeech(anchor: HTMLElement | null) {
  if (!anchor) return;
  const page = location.pathname.replace(/\/+$/, "") || "/";
  const voice = voices[page];
  if (!voice) return;
  try {
    if (sessionStorage.getItem(`mascot-said:${page}`)) return;
    sessionStorage.setItem(`mascot-said:${page}`, "1");
  } catch {
    /* no sessionStorage: still speak, worst case repeats per view */
  }
  const line = (await fetchLine(page, voice)) ?? pickFallback(page, voice);
  remember(page, line);
  window.setTimeout(() => showBubble(anchor, line), SHOW_DELAY_MS);
}

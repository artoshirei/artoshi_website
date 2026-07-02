// src/data/work.ts — one flat index. Category is metadata (a quiet tag),
// not page structure.

export type WorkKind = "app" | "website" | "experiment";

export interface WorkItem {
  title: string;
  description: string;
  kind: WorkKind;
  year: number;
  url: string;
  external?: boolean; // true -> target=_blank + arrow glyph
  now?: boolean; // building right now -> pulse dot, "now" instead of year
}

export const work: WorkItem[] = [
  {
    title: "FowlVoice",
    description: "On-device speech-to-text for macOS",
    kind: "app",
    year: 2026,
    url: "https://fowlvoice.com",
    external: true,
    now: true,
  },
  {
    title: "DailyNote",
    description: "Daily productivity app",
    kind: "app",
    year: 2025,
    url: "https://dailynote.me",
    external: true,
    now: true,
  },
  {
    title: "Steepfu",
    description: "Calm tea timer for macOS",
    kind: "app",
    year: 2026,
    url: "/steepfu",
  },
  {
    title: "Tonica",
    description: "Circle of Fifths for macOS",
    kind: "app",
    year: 2026,
    url: "/tonica",
  },
  {
    title: "fowlvoice.com",
    description: "Website for my private Mac dictation app",
    kind: "website",
    year: 2026,
    url: "https://fowlvoice.com",
    external: true,
  },
  {
    title: "Pretext Drift",
    description: "WebGPU type wrapped to a soft field",
    kind: "experiment",
    year: 2026,
    url: "/experiments/pretext-drift",
  },
];

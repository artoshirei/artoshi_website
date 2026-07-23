// src/data/work.ts — one flat index. Category is metadata (a quiet tag),
// not page structure.

export type WorkKind = "app" | "website" | "experiment";

export interface WorkItem {
  title: string;
  description: string;
  kind: WorkKind;
  year: number;
  url?: string;
  external?: boolean; // true -> target=_blank + arrow glyph
  now?: boolean; // building right now -> pulse dot, "now" instead of year
  icon?: string; // apps only: 256px macOS icon in /public; absent -> coming-soon tile
}

export const work: WorkItem[] = [
  {
    title: "FowlCode",
    description: "Focused coding workspace for macOS",
    kind: "app",
    year: 2026,
    now: true,
  },
  {
    title: "FowlNote",
    description: "Notes app for everyday capture",
    kind: "app",
    year: 2026,
    now: true,
  },
  {
    title: "FowyDo",
    description: "Tasks and project flow for macOS",
    kind: "app",
    year: 2026,
    now: true,
    icon: "/fowydo-icon.png",
  },
  {
    title: "FowlVoice",
    description: "On-device speech-to-text for macOS",
    kind: "app",
    year: 2026,
    url: "https://fowlvoice.com",
    external: true,
    now: true,
    icon: "/fowlvoice-icon.png",
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
    icon: "/steepfu-icon.png",
  },
  {
    title: "Tonica",
    description: "Circle of Fifths for macOS",
    kind: "app",
    year: 2026,
    url: "/tonica",
    icon: "/tonica-icon.png",
  },
  {
    title: "namethatui.com",
    description: "Describe a UI element badly, get its real name",
    kind: "website",
    year: 2026,
    url: "https://namethatui.com",
    external: true,
    now: true,
  },
  {
    title: "golyzh.com",
    description: "Vegan recipes website",
    kind: "website",
    year: 2026,
    url: "https://golyzh.com",
    external: true,
  },
  {
    title: "48hicons.com",
    description: "Fast custom app icon design",
    kind: "website",
    year: 2026,
    url: "https://48hicons.com",
    external: true,
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

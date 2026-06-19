// src/data/work.ts — categorized ledger, multi-facet via `facets`.

export type WorkGroup = "apps" | "websites" | "experiments";
export type FacetKind = "case" | "download" | "app" | "site" | "lab";

export interface WorkFacet {
  kind: FacetKind; // case/lab = internal quiet tag; site/download/app = action chip
  label: string; // chip text, e.g. "Case", "Download", "Site", "Lab"
  url: string;
  external?: boolean; // true -> target=_blank + arrow glyph
  ariaLabel?: string; // e.g. "FowlVoice website"
}

export interface WorkItem {
  year: number;
  title: string;
  description: string;
  group: WorkGroup; // one listing position for this card
  facets: WorkFacet[]; // 1 = whole row is the link; 2+ = distinct destinations only
  current?: boolean; // renders the ember BUILDING pill
}

export const GROUP_ORDER: { key: WorkGroup; label: string }[] = [
  { key: "apps", label: "Apps" },
  { key: "websites", label: "Websites" },
  { key: "experiments", label: "Experiments" },
];

export const work: WorkItem[] = [
  {
    year: 2026,
    title: "Steepfu",
    description: "Calm tea timer for macOS",
    group: "apps",
    facets: [{ kind: "case", label: "Case", url: "/steepfu" }],
  },
  {
    year: 2026,
    title: "Tonica",
    description: "Circle of Fifths for macOS",
    group: "apps",
    facets: [{ kind: "case", label: "Case", url: "/tonica" }],
  },
  {
    year: 2026,
    title: "FowlVoice",
    description: "On-device speech-to-text for macOS",
    group: "apps",
    current: true,
    facets: [{ kind: "site", label: "Site", url: "https://fowlvoice.com", external: true, ariaLabel: "FowlVoice website" }],
  },
  {
    year: 2025,
    title: "DailyNote",
    description: "Daily productivity app",
    group: "apps",
    current: true,
    facets: [{ kind: "site", label: "Site", url: "https://dailynote.me", external: true, ariaLabel: "DailyNote website" }],
  },
  {
    year: 2026,
    title: "fowlvoice.com",
    description: "Website for my private Mac dictation app",
    group: "websites",
    facets: [{ kind: "site", label: "Site", url: "https://fowlvoice.com", external: true, ariaLabel: "FowlVoice website" }],
  },
  {
    year: 2026,
    title: "Pretext Drift",
    description: "WebGPU type wrapped to a soft field",
    group: "experiments",
    facets: [{ kind: "lab", label: "Lab", url: "/experiments/pretext-drift" }],
  },
];

// homepage helper: grouped, in fixed order, rows newest-first, empty groups dropped
export const grouped = GROUP_ORDER.map((g) => ({
  ...g,
  items: work.filter((w) => w.group === g.key).sort((a, b) => b.year - a.year),
})).filter((g) => g.items.length > 0);

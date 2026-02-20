// src/data/work.ts

export type WorkCategory = "App" | "Website" | "Lab" | "Article" | "Podcast" | "Research" | "Freelance" | "Company";

export interface WorkItem {
  year: number;
  title: string;
  description: string;
  url?: string;
  categories: WorkCategory[];
  current?: boolean;
}

export const work: WorkItem[] = [
  {
    year: 2026,
    title: "FowlVoice",
    description: "macOS native on-device speech-to-text",
    url: "https://fowlvoice.com",
    categories: ["App"],
    current: true,
  },
  {
    year: 2025,
    title: "DailyNote",
    description: "daily productivity — todos, notes, supplements, countdowns",
    url: "https://dailynote.me",
    categories: ["App"],
  },
];

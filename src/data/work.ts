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
    description: "On-Device Speech-to-Text for macOS",
    url: "https://fowlvoice.com",
    categories: ["App"],
    current: true,
  },
  {
    year: 2025,
    title: "DailyNote",
    description: "Daily Productivity App",
    url: "https://dailynote.me",
    categories: ["App"],
    current: true,
  },
];

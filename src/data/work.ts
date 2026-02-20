// src/data/work.ts

export type WorkCategory = "design" | "engineering" | "research" | "writing";

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
    year: 2025,
    title: "Portfolio Site",
    description: "This site. Minimal dark portfolio built with Astro and pure CSS animations.",
    categories: ["design", "engineering"],
    current: true,
  },
  {
    year: 2024,
    title: "Design System",
    description: "Component library and design tokens for a SaaS product. Figma + React.",
    url: "https://example.com",
    categories: ["design", "engineering"],
  },
  {
    year: 2023,
    title: "Brand Identity",
    description: "Full brand identity for a fintech startup — logo, type, color, motion.",
    categories: ["design"],
  },
  {
    year: 2022,
    title: "Mobile App",
    description: "iOS and Android app for personal finance tracking. React Native.",
    url: "https://example.com",
    categories: ["engineering"],
  },
  {
    year: 2021,
    title: "Web Platform",
    description: "B2B dashboard with complex data visualization and real-time updates.",
    categories: ["design", "engineering"],
  },
];

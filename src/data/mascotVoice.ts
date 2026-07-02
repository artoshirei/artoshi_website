// src/data/mascotVoice.ts
// What the mascot knows and can say, per page. `facts` are the ONLY things
// the LLM is allowed to state about a page (it's instructed to never invent),
// so add real anecdotes here as apps get pages. `fallbacks` are hand-written
// lines used when the say endpoint is unreachable (dev, offline, over budget).
// `api: false` keeps a page purely on fallbacks — no OpenRouter call.

export interface PageVoice {
  api: boolean;
  facts: string;
  fallbacks: string[];
}

export const voices: Record<string, PageVoice> = {
  "/": {
    api: false, // the busiest page stays free
    facts: "",
    fallbacks: [
      "hi. argo makes things, i mostly watch",
      "psst, the ones with the amber dot are being built right now",
      "welcome in. hover around, i get excited easily",
    ],
  },
  "/tonica": {
    api: true,
    facts:
      "Tonica is a Circle of Fifths app for macOS, for exploring keys and chords. argo originally built it for a friend.",
    fallbacks: [
      "tonica is a fun one. argo built it for a friend first",
      "the circle of fifths, minus the homework feeling",
      "argo's music-theory helper. made for a friend, kept for everyone",
    ],
  },
  "/steepfu": {
    api: true,
    facts:
      "Steepfu is a calm tea timer for macOS. It exists so tea never over-steeps while you're deep in work.",
    fallbacks: [
      "steepfu guards your tea while you forget about it",
      "a timer so calm your tea relaxes too",
      "argo kept over-steeping his tea. so, steepfu",
    ],
  },
};

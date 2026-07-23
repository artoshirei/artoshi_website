# artoshi.work

Astro 5 portfolio site (quiet single-column index) with Tailwind CSS v4, React islands, and three.js/R3F experiments. **bun only** — never npm/yarn/pnpm.

## Commands & dev server

- `bun install` · `bun run dev` · `bun run build` (→ `dist/`) · `bun run preview`.
- Dev port **3010** (`astro.config.mjs`, `PORT` env override). The nested `sprint.artoshi.work/` repo owns **3011** — it's a separate git repo living inside this directory; never treat it as part of this one.
- Keep `host: true` in the Astro config — the Claude Code preview panel connects via `127.0.0.1`. Don't restart the dev server unnecessarily; the preview panel takes time to reconnect.

## Layout

- `src/pages/`: `index.astro` (portfolio index, items from `src/data/work.ts`), `tonica/{index,download}.astro`, `steepfu/index.astro`, `experiments/pretext-drift.astro`. No content collections.
- `src/components/` (`PretextDriftApp.tsx`, `CircularMenu.astro`, `experiment-controls/`), `src/layouts/` (`BaseLayout`, `GridFrame`, `ExperimentLayout`), `src/scripts/` (mascot eye/speech + `atom/` + `three/` WebGL).
- Cloudflare Pages Functions: `functions/mascot/say.js`, `functions/steepfu/download.js`; routed via `public/_routes.json`.
- The site uses `<ClientRouter />` (view transitions): the header mascot (`src/components/MascotBrand.astro`, `transition:persist`) survives navigation, and page `<script>` modules run ONCE per session — any per-page DOM setup must run inside `document.addEventListener("astro:page-load", ...)` (fires on first load and every navigation), with `astro:before-swap` cleanup for document-level listeners/timers (see steepfu).

## Deploy

Git-connected Cloudflare Pages (repo `artoshirei/artoshi_website`) — push to deploy. The README is unmodified Astro boilerplate; ignore it.

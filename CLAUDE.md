# NYC Interagency MOU Visualizer

React + D3 + Vite app visualizing NYC agency data-sharing agreements under Local Law 40 of 2011. Deployed to GitHub Pages.

## Commands

```bash
npm run dev      # dev server (usually binds to :5173 or :5174 if port taken)
npm run build    # production build → dist/
npm run lint     # eslint
npm run preview  # preview the dist/ build locally
```

## Deployment

Pushes to `main` auto-deploy via GitHub Actions (`.github/workflows/deploy.yml`). No manual step needed. The Vite base is `/data-sharing/` — this must stay set in `vite.config.js` or GitHub Pages routing breaks.

## Data

`src/data/agreements.json` is the authoritative data file. Two entry types:
- `"data_source": "confirmed"` — manually curated with a verified published PDF link
- `"data_source": "scraped"` — extracted directly from agency MOU pages; `pdfUrl` links to the actual published document

**NEVER invent agreement data.** Any new entry must have a real `pdfUrl` pointing to a published NYC government PDF. Do not add entries without a primary source.

### Re-scraping

The full pipeline:

```bash
# 1. Scrape PDF links from all agency MOU pages
node scraper/scrape.cjs --output /tmp/scraped.json --verbose

# 2. Download each PDF and extract text/metadata
python3 scraper/enrich.py --input /tmp/processed.json --output /tmp/enriched.json

# 3. Manual review before merging into agreements.json
```

Note: nyc.gov returns 403 on some pages for automated requests. The scraper logs warnings and skips those. Output needs review before merging — particularly check category assignments and party detection, which are heuristic.

## Architecture

All filter/view state lives in `App.jsx`. Components are stateless except NetworkGraph (D3 sim + domain filter + tooltip state).

- `NetworkGraph` — D3 force simulation. Uses a transparent wide hit-line layer (`stroke-width: 20`) on top of visible edges for fat touch targets. Visible lines have `pointer-events: none`.
- `AgreementTable` — sortable table view
- `DataTypesView` — bubble chart by data domain
- `AgreementDetail` — side panel (full-screen overlay on mobile)
- `FilterBar` — controlled by App.jsx state

## Mobile

Breakpoint: `640px` in `App.css`. Key mobile behaviors:
- Detail panel becomes `position: fixed; inset: 0` (full-screen overlay)
- Domain filter panel collapses to a single tappable header row
- Legend hidden (`network-legend--desktop`)
- All interactive controls meet 44px touch target minimum

## UX Reviews

After batches of UI changes, spin up a background UX review agent:
1. Take screenshots: `npx playwright screenshot --browser chromium --viewport-size "1440,900" <url> /tmp/desktop.png` and `390,844` for mobile
2. Pass screenshots + relevant source files to the agent
3. Ask for top issues prioritized by impact with fix suggestions

This caught 8 real issues (touch targets, contrast, mobile layout, missing affordances) in a single pass.

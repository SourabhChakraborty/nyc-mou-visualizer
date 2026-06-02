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

Pushes to `main` auto-deploy via GitHub Actions (`.github/workflows/deploy.yml`). No manual step needed. The Vite base is `/nyc-mou-visualizer/` — this must stay set in `vite.config.js` or GitHub Pages routing breaks.

## Data

`src/data/agreements.json` is the authoritative data file — hand-edited and scraped. Two entry types:
- `"data_source": "confirmed"` — links to a published PDF
- `"data_source": "seeded"` — manually curated, not yet verified against a PDF

To re-scrape: `node scraper/scrape.js --output src/data/scraped.json`. Note: nyc.gov returns 403 on many pages for automated requests even with browser headers; the scraper logs warnings and skips those. Output needs manual review before merging into `agreements.json`.

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

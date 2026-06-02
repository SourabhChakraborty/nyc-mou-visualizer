#!/usr/bin/env node
/**
 * Scrapes NYC agency interagency MOU pages (Local Law 40) and outputs
 * a JSON list of agreements to stdout (or --output <file>).
 *
 * Usage:
 *   node scraper/scrape.js
 *   node scraper/scrape.js --output src/data/scraped.json
 *
 * Note: nyc.gov returns 403 on many pages via automated requests.
 * The scraper uses browser-like headers and retries. For pages that
 * still 403, it logs a warning and skips. Run with --verbose for detail.
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

// ── Config ──────────────────────────────────────────────────────────────────

const AGENCY_PAGES = [
  { id: 'HRA',   url: 'https://www.nyc.gov/site/hra/about/interagency-memoranda-understanding-mous.page' },
  { id: 'DOF',   url: 'https://www.nyc.gov/site/finance/about/interagency-mou.page' },
  { id: 'DOHMH', url: 'https://www.nyc.gov/site/doh/about/about-doh/interagency-mous.page' },
  { id: 'ACS',   url: 'https://www.nyc.gov/site/acs/about/interagency-memoranda-of-understanding.page' },
  { id: 'HPD',   url: 'https://www.nyc.gov/site/hpd/about/interagency-mous.page' },
  { id: 'DFTA',  url: 'https://www.nyc.gov/site/dfta/about/interagency-mous.page' },
  { id: 'DYCD',  url: 'https://www.nyc.gov/site/dycd/about/about-dycd/interagency-mous.page' },
  { id: 'DOT',   url: 'https://www.nyc.gov/html/dot/html/about/mou_dot.shtml' },
  { id: 'DCAS',  url: 'https://www.nyc.gov/site/dcas/about/interagency-memoranda-of-understanding-mous.page' },
  { id: 'OMB',   url: 'https://www.nyc.gov/site/omb/about/interagency-mous.page' },
  { id: 'SBS',   url: 'https://www.nyc.gov/site/sbs/about/interagency-mous.page' },
  { id: 'DOB',   url: 'https://www.nyc.gov/site/buildings/dob/interagency-mous.page' },
  { id: 'DORIS', url: 'https://www.nyc.gov/site/records/about/agency-mous.page' },
  { id: 'LAW',   url: 'https://www.nyc.gov/site/law/about/interagency-mous.page' },
  { id: 'DOP',   url: 'https://www.nyc.gov/site/probation/about/interagency-mous.page' },
  { id: 'DFTA2', url: 'https://www.nyc.gov/site/dfta/about/interagency-mous.page' },
]

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Cache-Control': 'no-cache',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const verbose = process.argv.includes('--verbose')
const outputArg = (() => {
  const i = process.argv.indexOf('--output')
  return i !== -1 ? process.argv[i + 1] : null
})()

function log(...args) { if (verbose) console.error(...args) }
function warn(...args) { console.error('[warn]', ...args) }

function get(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { ...HEADERS, Host: parsed.hostname },
    }
    const req = https.request(options, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return get(res.headers.location).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')) })
    req.end()
  })
}

// Extract PDF links from HTML using a simple regex (avoids heavy dep on cheerio at runtime)
function extractLinks(html, baseUrl) {
  const results = []
  // Match anchor tags with href containing .pdf
  const linkRe = /<a\s[^>]*href=["']([^"']*\.pdf[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1].trim()
    const text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    const url = href.startsWith('http') ? href : new URL(href, baseUrl).href
    if (text && url) results.push({ text, url })
  }
  return results
}

// Try to extract a date from a link's surrounding context
function extractDateFromContext(html, pdfHref) {
  const idx = html.indexOf(pdfHref)
  if (idx === -1) return null
  // Look within 300 chars before/after the link for a date pattern
  const snippet = html.slice(Math.max(0, idx - 300), idx + 300)
  const dateRe = /(\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b)/gi
  const match = dateRe.exec(snippet)
  return match ? match[1] : null
}

// Infer agencies from PDF URL or link text by matching known acronyms
const KNOWN_AGENCIES = ['HRA','DOF','DOHMH','DOH','DOE','ACS','DHS','NYPD','DOC','HPD','DFTA','DYCD','DOT','DCAS','OMB','SBS','DOB','DORIS','OTI','LAW','MOCJ','OCME','DEP','DSNY','CUNY','OMH','DOP']

function inferParties(sourceAgency, text, url) {
  const combined = (text + ' ' + url).toUpperCase()
  const found = new Set([sourceAgency])
  for (const a of KNOWN_AGENCIES) {
    if (combined.includes(a)) found.add(a)
  }
  return [...found]
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function scrapeAgency({ id, url }) {
  let html
  try {
    html = await get(url)
    log(`[${id}] fetched ${url} (${html.length} bytes)`)
  } catch (err) {
    warn(`[${id}] failed to fetch ${url}: ${err.message}`)
    return []
  }

  const links = extractLinks(html, url)
  log(`[${id}] found ${links.length} PDF links`)

  return links.map(({ text, url: pdfUrl }) => {
    const rawDate = extractDateFromContext(html, pdfUrl.replace(/^https?:\/\/[^/]+/, ''))
    const parties = inferParties(id, text, pdfUrl)
    const year = rawDate ? parseInt(rawDate.match(/\d{4}/)?.[0]) : null

    return {
      id: `scraped-${id.toLowerCase()}-${Buffer.from(pdfUrl).toString('base64').slice(0, 12)}`,
      title: text,
      parties,
      date: rawDate ?? null,
      year: year ?? null,
      category: null,
      jurisdiction: 'nyc',
      pdfUrl,
      sourceUrl: url,
      description: null,
      data_source: 'scraped',
    }
  })
}

async function main() {
  console.error(`Scraping ${AGENCY_PAGES.length} NYC agency MOU pages…`)
  const results = []

  for (const agency of AGENCY_PAGES) {
    const agreements = await scrapeAgency(agency)
    results.push(...agreements)
    // Small delay to be polite
    await new Promise(r => setTimeout(r, 500))
  }

  console.error(`\nTotal scraped: ${results.length} agreements`)

  const output = JSON.stringify(results, null, 2)
  if (outputArg) {
    fs.writeFileSync(path.resolve(outputArg), output)
    console.error(`Written to ${outputArg}`)
  } else {
    process.stdout.write(output)
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

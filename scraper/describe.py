#!/usr/bin/env python3
"""
Downloads each PDF, renders the first 2 pages as images, and uses the
Claude vision API to generate a concise 1-2 sentence description.

Usage:
    python3 scraper/describe.py \
        --data src/data/agreements.json \
        [--limit N]      # process only first N missing entries
        [--verbose]

Requires: ANTHROPIC_API_KEY env var, PyMuPDF, anthropic SDK
    pip install PyMuPDF anthropic --break-system-packages
"""

import argparse, base64, json, os, sys, time, urllib.request
import fitz  # PyMuPDF
import anthropic

parser = argparse.ArgumentParser()
parser.add_argument("--data",    default="src/data/agreements.json")
parser.add_argument("--limit",   type=int, default=None)
parser.add_argument("--verbose", action="store_true")
args = parser.parse_args()

def log(*a):
    if args.verbose: print(*a, file=sys.stderr)
def info(*a):
    print(*a, file=sys.stderr)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/pdf,*/*",
}

def fetch_pdf(url: str) -> bytes | None:
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.read()
    except Exception as e:
        info(f"  fetch error: {e}")
        return None

def pdf_to_page_images(data: bytes, max_pages: int = 2) -> list[str]:
    """Render first N pages of a PDF to base64 PNG strings."""
    try:
        doc = fitz.open(stream=data, filetype="pdf")
        images = []
        for i in range(min(max_pages, len(doc))):
            page = doc[i]
            # 150 DPI is enough for OCR-quality text; keeps image sizes small
            mat = fitz.Matrix(150 / 72, 150 / 72)
            pix = page.get_pixmap(matrix=mat)
            images.append(base64.b64encode(pix.tobytes("png")).decode())
        doc.close()
        return images
    except Exception as e:
        info(f"  render error: {e}")
        return []

SYSTEM = (
    "You are a data analyst summarizing NYC interagency data sharing agreements "
    "published under Local Law 40 of 2011. Write concise, factual summaries only. "
    "No preamble, no meta-commentary."
)

PROMPT = """These are the first page(s) of a NYC interagency Memorandum of Understanding.
Return a JSON object with exactly these fields:

{
  "description": "1-2 sentences: which agencies, what data/services shared, for what purpose. Be specific. Do not start with 'This MOU' or 'This agreement'.",
  "parties": ["list of agency abbreviations that are actual parties, e.g. HRA, DOE, DOHMH, ACS, DHS, NYPD, HPD, DYCD, DFTA, DOT, DOF, DOB, DCAS, SBS, LAW, DOP, CUNY, OMH, OTI, DOC, MOCJ, HHC, Parks, NYCHA, MOPT, OTDA"],
  "dataTypes": ["list of data types actually shared, chosen from: Health Records, Mental Health Records, Public Health Data, Benefits Eligibility, Financial Records, Case Records, Student Records, Enrollment Data, Identity Documents, Contact Information, Housing Records, Building Records, Arrest Records, Detention Records, Court Records, Program Participation, Death Records, Employment Data, Traffic Data, Infrastructure Data"]
}

Only include parties that are named in the document. Only include dataTypes that are actually mentioned or clearly implied. Return valid JSON only, no other text."""

client = anthropic.Anthropic()

def analyze(title: str, images: list[str]) -> dict:
    content = []
    for img_b64 in images:
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/png", "data": img_b64},
        })
    content.append({"type": "text", "text": PROMPT})

    resp = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=400,
        system=SYSTEM,
        messages=[{"role": "user", "content": content}],
    )
    text = resp.content[0].text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)

# ── Main ──────────────────────────────────────────────────────────────────────
data = json.load(open(args.data))
agreements = data["agreements"]

# Re-process all scraped entries — update description, parties, and dataTypes
needs_desc = [
    a for a in agreements
    if a.get("pdfUrl") and a.get("data_source") in ("scraped", "confirmed")
]

if args.limit:
    needs_desc = needs_desc[:args.limit]

info(f"Entries needing descriptions: {len(needs_desc)}")
info(f"Model: claude-haiku-4-5\n")

updated = 0
errors  = 0

for i, entry in enumerate(needs_desc):
    info(f"[{i+1}/{len(needs_desc)}] {entry['title'][:65]}")

    pdf_bytes = fetch_pdf(entry["pdfUrl"])
    if not pdf_bytes:
        errors += 1
        continue

    images = pdf_to_page_images(pdf_bytes)
    if not images:
        info("  no renderable pages — skipping")
        errors += 1
        continue

    log(f"  rendered {len(images)} page(s)")

    try:
        result = analyze(entry["title"], images)
        log(f"  → {result.get('description','')[:100]}")
        log(f"     parties={result.get('parties')}  types={result.get('dataTypes')}")
    except Exception as e:
        info(f"  API/parse error: {e}")
        errors += 1
        time.sleep(2)
        continue

    # Update in-place
    for a in agreements:
        if a["id"] == entry["id"]:
            if result.get("description"):
                a["description"] = result["description"]
            if result.get("parties"):
                a["parties"] = sorted(set(result["parties"]))
            if result.get("dataTypes"):
                a["dataTypes"] = result["dataTypes"][:6]
            break

    updated += 1
    time.sleep(0.4)  # stay well under rate limits

info(f"\nDone: {updated} updated, {errors} errors")

data["agreements"] = agreements
json.dump(data, open(args.data, "w"), indent=2)
info(f"Written to {args.data}")

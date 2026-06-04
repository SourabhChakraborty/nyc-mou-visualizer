#!/usr/bin/env python3
"""
Downloads each PDF from the scraped MOU list, extracts text via PyMuPDF,
and enriches each entry with: description, dataTypes, parties, date, year.

Usage:
    python3 scraper/enrich.py \
        --input /tmp/processed.json \
        --output /tmp/enriched.json \
        [--limit N]   # process only first N entries (for testing)
        [--verbose]
"""

import json, re, sys, os, time, argparse, urllib.request, urllib.error, io
from collections import defaultdict
import fitz  # PyMuPDF

# ── CLI ───────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument('--input',   required=True)
parser.add_argument('--output',  required=True)
parser.add_argument('--limit',   type=int, default=None)
parser.add_argument('--verbose', action='store_true')
args = parser.parse_args()

def log(*a):
    if args.verbose: print(*a, file=sys.stderr)
def info(*a):
    print(*a, file=sys.stderr)

# ── PDF fetch + text extraction ────────────────────────────────────────────────
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) '
                  'Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/pdf,*/*',
}

def fetch_pdf_text(url, timeout=20):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
    except Exception as e:
        return None, str(e)

    try:
        doc = fitz.open(stream=data, filetype='pdf')
        pages = []
        for page in doc:
            pages.append(page.get_text())
        text = '\n'.join(pages)
        doc.close()
        return text, None
    except Exception as e:
        return None, f'pdf parse: {e}'

# ── Known agency patterns ──────────────────────────────────────────────────────
AGENCY_PATTERNS = {
    'HRA':   [r'\bHRA\b', r'\bDSS\b', r'Human Resources Administration', r'Dept\.? of Social Services'],
    'DOF':   [r'\bDOF\b', r'Department of Finance', r'Finance Department'],
    'DOHMH': [r'\bDOHMH\b', r'\bDOH\b', r'Health and Mental Hygiene', r'Dept\.? of Health'],
    'DOE':   [r'\bDOE\b', r'Department of Education', r'Board of Education'],
    'ACS':   [r'\bACS\b', r"Administration for Children'?s Services"],
    'DHS':   [r'\bDHS\b', r'Department of Homeless Services'],
    'NYPD':  [r'\bNYPD\b', r'Police Department', r'New York City Police'],
    'DOC':   [r'\bDOC\b', r'Department of Correction'],
    'HPD':   [r'\bHPD\b', r'Housing Preservation'],
    'DFTA':  [r'\bDFTA\b', r'Department for the Aging', r'NYC Aging'],
    'DYCD':  [r'\bDYCD\b', r'Youth and Community Development'],
    'DOT':   [r'\bDOT\b', r'Department of Transportation'],
    'DCAS':  [r'\bDCAS\b', r'Citywide Administrative Services'],
    'OMB':   [r'\bOMB\b', r'Office of Management and Budget'],
    'SBS':   [r'\bSBS\b', r'Small Business Services'],
    'DOB':   [r'\bDOB\b', r'Department of Buildings'],
    'DORIS': [r'\bDORIS\b', r'Dept\.? of Records'],
    'OTI':   [r'\bOTI\b', r'Office of Technology and Innovation'],
    'LAW':   [r'\bLAW\b', r'Law Department', r'Corporation Counsel'],
    'MOCJ':  [r'\bMOCJ\b', r"Mayor'?s Office of Criminal Justice"],
    'OCME':  [r'\bOCME\b', r'Chief Medical Examiner'],
    'DEP':   [r'\bDEP\b', r'Environmental Protection'],
    'DSNY':  [r'\bDSNY\b', r'Department of Sanitation'],
    'CUNY':  [r'\bCUNY\b', r'City University of New York'],
    'OMH':   [r'\bOMH\b', r'Office of Mental Health'],
    'DOP':   [r'\bDOP\b', r'Department of Probation'],
    'Parks': [r'\bParks\b', r'NYC Parks', r'Dept\.? of Parks'],
    'HHC':   [r'\bHHC\b', r'Health \+ Hospitals', r'NYC Health and Hospitals'],
    'MOPT':  [r'\bMOPT\b'],
}

def extract_parties(text):
    found = set()
    for agency, pats in AGENCY_PATTERNS.items():
        for pat in pats:
            if re.search(pat, text, re.I):
                found.add(agency)
                break
    return sorted(found)

# ── Date extraction from PDF text ──────────────────────────────────────────────
MONTH_PAT = r'(?:January|February|March|April|May|June|July|August|September|October|November|December)'
DATE_PATS = [
    rf'(?:dated?|effective|executed|entered into)[\s:]+({MONTH_PAT}\s+\d{{1,2}},?\s+\d{{4}})',
    rf'(?:dated?|effective|executed|entered into)[\s:]+(\d{{1,2}}/\d{{1,2}}/\d{{2,4}})',
    rf'\bas\s+of\s+({MONTH_PAT}\s+\d{{1,2}},?\s+\d{{4}})',
    rf'({MONTH_PAT}\s+\d{{1,2}},?\s+\d{{4}})',
]

def extract_date_from_text(text):
    for pat in DATE_PATS:
        m = re.search(pat, text, re.I)
        if m:
            return m.group(1)
    return None

# ── Data types ──────────────────────────────────────────────────────────────────
DATA_TYPE_RULES = [
    ('Health Records',        r'\b(health records?|medical records?|clinical data|patient data|EHR|EMR)\b'),
    ('Mental Health Records', r'\b(mental health|behavioral health|psychiatric|substance use)\b'),
    ('Public Health Data',    r'\b(public health|epidemiolog|disease|immuniz|vaccination|surveillance)\b'),
    ('Benefits Eligibility',  r'\b(benefits? eligib|SNAP|TANF|cash assistance|food stamps?|Medicaid|SSI|SSD)\b'),
    ('Financial Records',     r'\b(financial records?|tax records?|property records?|fiscal data|income)\b'),
    ('Case Records',          r'\b(case records?|case management|case file|case data|case workers?)\b'),
    ('Student Records',       r'\b(student records?|student data|academic records?|grades?|attendance)\b'),
    ('Enrollment Data',       r'\b(enrollment data|enrollment records?|program enrollment|registered)\b'),
    ('Identity Documents',    r'\b(identity|IDNYC|identification|ID documents?|birth certificate|passport)\b'),
    ('Contact Information',   r'\b(contact information|address|phone number|email|locate)\b'),
    ('Housing Records',       r'\b(housing records?|rental data|eviction|housing placement|shelter data)\b'),
    ('Building Records',      r'\b(building records?|permit|violation|inspection|property condition)\b'),
    ('Arrest Records',        r'\b(arrest records?|booking|criminal history|rap sheet)\b'),
    ('Detention Records',     r'\b(detention records?|incarceration|jail records?|inmate)\b'),
    ('Court Records',         r'\b(court records?|case disposition|arraignment|summons)\b'),
    ('Program Participation', r'\b(program participation|program data|service utilization|service records?)\b'),
    ('Death Records',         r'\b(death records?|death certificate|mortality)\b'),
    ('Employment Data',       r'\b(employment data|job placement|workforce|payroll|hiring)\b'),
    ('Traffic Data',          r'\b(traffic data|crash data|accident data|vision zero)\b'),
    ('Infrastructure Data',   r'\b(infrastructure|capital project|street|utility)\b'),
]

def extract_data_types(text):
    found = []
    for dtype, pat in DATA_TYPE_RULES:
        if re.search(pat, text, re.I):
            found.append(dtype)
    return found[:6]  # cap at 6

# ── Description extraction ──────────────────────────────────────────────────────
def extract_description(text):
    # Look for "purpose" or "whereas" clauses — common in MOUs
    patterns = [
        r'(?:purpose|background|recitals?)[\s:\n]+([^\n]{80,400})',
        r'WHEREAS[,\s]+([^\n]{80,400})',
        r'(?:The parties|The Parties|This Agreement|This MOU)[^\n]{0,30}\n([^\n]{80,400})',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.I)
        if m:
            snippet = m.group(1).strip()
            snippet = re.sub(r'\s+', ' ', snippet)
            # truncate at sentence boundary around 300 chars
            if len(snippet) > 300:
                end = snippet.rfind('.', 0, 300)
                snippet = snippet[:end+1] if end > 100 else snippet[:300] + '…'
            return snippet
    # Fallback: first substantial paragraph
    paras = [p.strip() for p in text.split('\n') if len(p.strip()) > 80]
    if paras:
        p = re.sub(r'\s+', ' ', paras[0])
        if len(p) > 300:
            end = p.rfind('.', 0, 300)
            p = p[:end+1] if end > 100 else p[:300] + '…'
        return p
    return ''

# ── Category assignment ──────────────────────────────────────────────────────────
CATEGORY_RULES = [
    ('Criminal Justice',    r'\b(NYPD|DOC|DOP|MOCJ|police|correction|arrest|jail|reentry|probation|court|criminal|summons|pretrial|detention)\b'),
    ('Health Data',         r'\b(DOHMH|DOH|health|medical|hospital|clinic|HIV|AIDS|mental health|nursing|behavioral|immuniz|disease|COVID|public health|vital stat|medicaid)\b'),
    ('Youth & Families',    r'\b(ACS|child|youth|foster|juvenile|DYCD|family|families|runaway|homeless youth|preventive|HASA|after.?school)\b'),
    ('Housing',             r'\b(HPD|DHS|housing|shelter|homeless|rent|eviction|landlord|lead paint|LINC|FHEPS|voucher)\b'),
    ('Education',           r'\b(DOE|education|school|student|teacher|enrollment|academic|HSE|GED|literacy)\b'),
    ('Identity & Benefits', r'\b(SNAP|TANF|benefits|eligib|IDNYC|identity|cash assistance|food stamps?|welfare|WIC)\b'),
    ('Financial/Benefits',  r'\b(DOF|finance|tax|fiscal|budget|financial|property|lien|assessment|revenue|HHS)\b'),
    ('Transportation',      r'\b(DOT|DSNY|DEP|traffic|transit|bus|street|parking|vehicle|bike|Vision Zero|infrastructure|sweeping)\b'),
    ('Administrative',      r'\b(DCAS|SBS|OMB|LAW|DORIS|workforce|procurement|personnel|administrative|civil service|records)\b'),
    ('Emergency Response',  r'\b(emergency|hurricane|disaster|pandemic|storm)\b'),
]

def assign_category(title, parties, text=''):
    combined = title + ' ' + ' '.join(parties) + ' ' + text[:500]
    for cat, pattern in CATEGORY_RULES:
        if re.search(pattern, combined, re.I):
            return cat
    return 'Administrative'

# ── Main ──────────────────────────────────────────────────────────────────────
entries = json.load(open(args.input))
if args.limit:
    entries = entries[:args.limit]

info(f'Enriching {len(entries)} entries…')

results = []
errors = 0

for i, entry in enumerate(entries):
    pdf_url = entry.get('pdfUrl')
    info(f'[{i+1}/{len(entries)}] {entry["title"][:60]}')

    enriched = dict(entry)

    if pdf_url:
        text, err = fetch_pdf_text(pdf_url)
        if err:
            info(f'  ERR: {err}')
            errors += 1
        else:
            chars = len(text.strip())
            log(f'  got {chars} chars')

            if chars > 100:
                # Parties from PDF text (more reliable than title alone)
                pdf_parties = extract_parties(text)
                if len(pdf_parties) >= len(entry.get('parties', [])):
                    enriched['parties'] = pdf_parties

                # Date
                pdf_date = extract_date_from_text(text)
                if pdf_date and not entry.get('date'):
                    enriched['date'] = pdf_date
                    m = re.search(r'\d{4}', pdf_date)
                    enriched['year'] = int(m.group()) if m else entry.get('year')

                # Data types
                enriched['dataTypes'] = extract_data_types(text)

                # Description
                enriched['description'] = extract_description(text)

                # Category (re-derive with full text)
                enriched['category'] = assign_category(
                    entry['title'], enriched['parties'], text
                )

        time.sleep(0.3)  # polite delay

    results.append(enriched)

info(f'\nDone. {errors} fetch errors out of {len(entries)}.')
json.dump(results, open(args.output, 'w'), indent=2)
info(f'Written to {args.output}')

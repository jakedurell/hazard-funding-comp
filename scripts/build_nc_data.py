#!/usr/bin/env python3
# ==========================================================
# North Carolina Oceanfront HMA Comparison — Data Builder
#
# Fetches FEMA Hazard Mitigation Assistance records, FEMA disaster
# declarations, and Census place boundaries; matches HMA's free-text
# `subrecipient` field to NC oceanfront municipalities; flags whether
# each award's county was inside its own declaration's declared area;
# and emits a single compact JSON payload for docs/nc/index.html.
#
# Stdlib only — no pandas/geopandas required.
#
# Usage:
#   python3 scripts/build_nc_data.py            # use cache if present
#   python3 scripts/build_nc_data.py --refresh  # re-download sources
#
# Outputs:
#   docs/nc/data/nc_hma.json        map + sidebar payload
#   docs/nc/data/unmatched.csv      audit trail: NC coastal-county
#                                   subrecipients that did NOT match
# ==========================================================

import csv
import datetime
import json
import os
import re
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "data", "raw", "NC")
OUT = os.path.join(ROOT, "docs", "nc", "data")

HMA_CSV = "https://www.fema.gov/api/open/v4/HazardMitigationAssistanceProjects.csv"
# One row per designated area per declaration. Gives us, for each disaster
# number, the counties FEMA actually declared — which is what lets us ask
# whether an award went to a town inside or outside the impact area.
DECLARATIONS = "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries"
TIGERWEB = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/"
    "Places_CouSub_ConCity_SubMCD/MapServer/4/query"
)
# Counties are the unit FEMA designates, so the impact-area overlay needs
# their polygons — places alone would draw a scatter of dots, not an area.
TIGERWEB_COUNTIES = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/"
    "State_County/MapServer/1/query"
)

# Statewide: every NC incorporated place is included. Geometry is generalized
# server-side (maxAllowableOffset) — full resolution is 28 MB, too heavy for a
# web payload; 0.0005 deg holds shape well at 1.8 MB.
GEOM_OFFSET = "0.0005"
# Counties are only ever a background wash, so they can be coarser than places.
COUNTY_GEOM_OFFSET = "0.002"

# NFIP dependency by program. This drives the "could this town even have
# applied?" question, which matters wherever CBRS restricts flood insurance.
#
#   required  — the property itself must carry an NFIP policy to be eligible.
#               FMA is funded from the National Flood Insurance Fund and
#               targets NFIP-insured structures; SRL and RFC were separate
#               programs on the same basis, folded into FMA after BW-12 (2012).
#   community — no property-level insurance requirement, but the community must
#               be participating in the NFIP and in good standing for projects
#               in a Special Flood Hazard Area.
#
# Verify against the current fiscal year's HMA guidance / NOFO before relying
# on this in an argument — eligibility rules are revised year to year.
PROGRAM_NFIP = {
    "FMA":  "required",
    "SRL":  "required",
    "RFC":  "required",
    "HMGP": "community",
    "PDM":  "community",
    "BRIC": "community",
    "LPDM": "community",
}

# NC Atlantic-facing barrier island municipalities — the original comparison
# frame, now retained as a flag so the UI can filter statewide data down to it.
# Grouped by island system so the UI can offer "same island" comps.
OCEANFRONT = {
    "Duck": "Currituck Banks",
    "Southern Shores": "Currituck Banks",
    "Kitty Hawk": "Bodie Island",
    "Kill Devil Hills": "Bodie Island",
    "Nags Head": "Bodie Island",
    "Atlantic Beach": "Bogue Banks",
    "Pine Knoll Shores": "Bogue Banks",
    "Indian Beach": "Bogue Banks",
    "Emerald Isle": "Bogue Banks",
    "North Topsail Beach": "Topsail Island",
    "Surf City": "Topsail Island",
    "Topsail Beach": "Topsail Island",
    "Wrightsville Beach": "New Hanover",
    "Carolina Beach": "New Hanover",
    "Kure Beach": "New Hanover",
    "Bald Head Island": "Brunswick",
    "Caswell Beach": "Brunswick",
    "Oak Island": "Brunswick",
    "Holden Beach": "Brunswick",
    "Ocean Isle Beach": "Brunswick",
    "Sunset Beach": "Brunswick",
}

# Non-municipal subrecipients carried as context rows. Counties are not Census
# places so they never match the place index, but Onslow County is the body that
# would serve North Topsail Beach residents if the town itself did not.
REFERENCE_SUBRECIPIENTS = {
    "Onslow (County)": "Onslow County",
    "ONSLOW COUNTY": "Onslow County",
    "Onslow County*": "Onslow County",
}

# FEMA activity codes → category. The 200/202/207 families are the ones
# that mitigate privately owned homes; everything else is municipal asset,
# planning, or administrative work.
HOMEOWNER_PREFIXES = ("200", "202", "203", "207")


def category(project_type):
    code = (project_type or "").split(":")[0].strip()
    if code.startswith(("200", "203")):
        return "Acquisition"
    if code.startswith("202"):
        return "Elevation"
    if code.startswith("207"):
        return "Reconstruction"
    if code.startswith(("90", "91", "92")):
        return "Planning"
    if code.startswith(("4", "5", "6")):
        return "Infrastructure"
    return "Other"


def is_homeowner_directed(project_type):
    return (project_type or "").split(":")[0].strip().startswith(HOMEOWNER_PREFIXES)


def declaration_index(path):
    """disasterNumber -> {counties, title, type, date} from the declarations feed.

    `designatedArea` arrives as "Buncombe (County)" plus the occasional tribal
    area; strip the suffix so it compares to HMA's bare `county` field.
    """
    with open(path, encoding="utf-8") as fh:
        rows = json.load(fh)["DisasterDeclarationsSummaries"]
    idx = {}
    for r in rows:
        d = idx.setdefault(str(r["disasterNumber"]), {
            "counties": set(),
            "title": r.get("declarationTitle"),
            "type": r.get("declarationType"),
            "date": (r.get("declarationDate") or "")[:10] or None,
        })
        area = (r.get("designatedArea") or "").replace(" (County)", "").strip()
        if area:
            d["counties"].add(area)
    return idx


def designated(disaster, county, idx):
    """Was this award's county inside the declared area of its own declaration?

    True / False / None, where None means the question does not apply — the
    competitive programs (FMA, PDM, BRIC, LPDM, RFC, SRL) are not tied to a
    declaration at all, so they carry no disaster number.

    False is NOT a statement of ineligibility. HMGP funds are allocated to the
    state off a declaration and the state may award them anywhere in it; that
    is precisely why an award can land outside the declared counties.
    """
    if not disaster or disaster not in idx or not county:
        return None
    return county.strip() in idx[disaster]["counties"]


def fetch(url, dest, params=None, label=""):
    """Download to dest unless cached. Returns dest path."""
    if os.path.exists(dest) and "--refresh" not in sys.argv:
        print(f"  cached  {label or os.path.basename(dest)}")
        return dest
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    print(f"  fetching {label or url} ...", flush=True)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "hazard-funding-comp/1.0"})
    with urllib.request.urlopen(req, timeout=300) as r, open(dest, "wb") as f:
        f.write(r.read())
    print(f"  saved    {dest} ({os.path.getsize(dest)/1e6:.1f} MB)")
    return dest


def normalize(name):
    """Collapse HMA's free-text subrecipient spellings to a comparable key."""
    s = (name or "").upper()
    s = re.sub(r"\(.*?\)", " ", s)                       # drop parentheticals
    s = re.sub(r"[^A-Z0-9 ]", " ", s)                    # punctuation
    s = re.sub(r"\b(TOWN|CITY|VILLAGE|OF|THE)\b", " ", s)
    s = re.sub(r"\b(TOWNSHIP|TWP)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def num(x):
    try:
        return float(x or 0)
    except ValueError:
        return 0.0


def main():
    os.makedirs(OUT, exist_ok=True)
    print("Sources:")
    hma_path = fetch(HMA_CSV, os.path.join(CACHE, "hma_projects.csv"), label="FEMA HMA projects")
    places_path = fetch(
        TIGERWEB,
        os.path.join(CACHE, "nc_places.geojson"),
        params={
            "where": "STATE='37'",
            "outFields": "GEOID,NAME,BASENAME",
            "returnGeometry": "true",
            "outSR": "4326",
            "maxAllowableOffset": GEOM_OFFSET,
            "f": "geojson",
        },
        label="Census TIGERweb NC incorporated places (generalized)",
    )
    decl_path = fetch(
        DECLARATIONS,
        os.path.join(CACHE, "nc_declarations.json"),
        params={
            "$filter": "state eq 'NC'",
            "$select": "disasterNumber,designatedArea,declarationTitle,"
                       "declarationType,declarationDate",
            "$top": "10000",
            "$format": "json",
        },
        label="FEMA declared areas for NC (all declarations)",
    )
    counties_path = fetch(
        TIGERWEB_COUNTIES,
        os.path.join(CACHE, "nc_counties.geojson"),
        params={
            "where": "STATE='37'",
            "outFields": "GEOID,NAME,BASENAME",
            "returnGeometry": "true",
            "outSR": "4326",
            "maxAllowableOffset": COUNTY_GEOM_OFFSET,
            "f": "geojson",
        },
        label="Census TIGERweb NC counties (generalized)",
    )
    decl = declaration_index(decl_path)

    # ---- Places: every NC incorporated place is a candidate ----------
    with open(places_path, encoding="utf-8") as fh:
        places = json.load(fh)

    # Census suffixes the legal type onto NAME ("Emerald Isle town"); BASENAME
    # is the bare name. Index both so free-text subrecipients match either way.
    by_name = {}
    for f in places["features"]:
        pr = f["properties"]
        for variant in (pr.get("BASENAME"), pr.get("NAME")):
            if variant:
                by_name.setdefault(normalize(variant), f)

    # ---- HMA records -------------------------------------------------
    print("\nMatching HMA subrecipients statewide:")
    with open(hma_path, newline="", encoding="utf-8") as fh:
        nc = [r for r in csv.DictReader(fh) if r["state"] == "North Carolina"]

    projects, unmatched = [], {}
    nonmunicipal = {"n": 0, "fed": 0.0}
    for r in nc:
        sub = r.get("subrecipient") or ""
        hit = by_name.get(normalize(sub))
        if not hit:
            if sub:
                unmatched.setdefault(sub, {"county": r.get("county") or "", "n": 0})
                unmatched[sub]["n"] += 1
                nonmunicipal["n"] += 1
                nonmunicipal["fed"] += num(r.get("federalShareObligated"))
            continue
        town = hit["properties"]["BASENAME"] or hit["properties"]["NAME"]
        total = num(r.get("projectAmount"))
        fed = num(r.get("federalShareObligated"))
        program = r.get("programArea")
        projects.append({
            "town": town,
            "geoid": hit["properties"]["GEOID"],
            "id": r.get("projectIdentifier"),
            "fy": int(r["programFy"]) if (r.get("programFy") or "").isdigit() else None,
            "program": program,
            "nfip": PROGRAM_NFIP.get(program, "community"),
            "disaster": r.get("disasterNumber") or None,
            "type": r.get("projectType"),
            "cat": category(r.get("projectType")),
            "homeowner": is_homeowner_directed(r.get("projectType")),
            "status": r.get("status"),
            "total": round(total, 2),
            "fed": round(fed, 2),
            "nonfed": round(max(total - fed, 0), 2),
            "share": num(r.get("costSharePercentage")) or None,
            "props": int(num(r.get("numberOfProperties"))),
            "final": int(num(r.get("numberOfFinalProperties"))),
            # grant lifecycle dates — NOT deed dates. A buyout's title transfer
            # falls between obligation and closeout; that is the window to
            # search at the county Register of Deeds.
            "obligated": (r.get("initialObligationDate") or "")[:10] or None,
            "closed": (r.get("dateClosed") or "")[:10] or None,
            "sponsor": r.get("subrecipient"),
            "county": r.get("county"),
            "designated": designated(r.get("disasterNumber"), r.get("county"), decl),
        })

    # reference rows — same record shape, kept out of the municipal comparison
    reference = []
    for r in nc:
        label = REFERENCE_SUBRECIPIENTS.get((r.get("subrecipient") or "").strip())
        if not label:
            continue
        total = num(r.get("projectAmount")); fed = num(r.get("federalShareObligated"))
        program = r.get("programArea")
        reference.append({
            "town": label, "geoid": None, "id": r.get("projectIdentifier"),
            "fy": int(r["programFy"]) if (r.get("programFy") or "").isdigit() else None,
            "program": program, "nfip": PROGRAM_NFIP.get(program, "community"),
            "disaster": r.get("disasterNumber") or None, "type": r.get("projectType"),
            "cat": category(r.get("projectType")),
            "homeowner": is_homeowner_directed(r.get("projectType")),
            "status": r.get("status"), "total": round(total, 2), "fed": round(fed, 2),
            "nonfed": round(max(total - fed, 0), 2),
            "share": num(r.get("costSharePercentage")) or None,
            "props": int(num(r.get("numberOfProperties"))),
            "final": int(num(r.get("numberOfFinalProperties"))),
            "obligated": (r.get("initialObligationDate") or "")[:10] or None,
            "closed": (r.get("dateClosed") or "")[:10] or None,
            "sponsor": r.get("subrecipient"), "county": r.get("county"),
            "designated": designated(r.get("disasterNumber"), r.get("county"), decl),
        })

    funded = {p["geoid"] for p in projects}
    print(f"  {len(projects)} of {len(nc)} NC records matched to an incorporated place")
    print(f"  {len(funded)} of {len(places['features'])} places have at least one award")
    print(f"  {nonmunicipal['n']} records went to counties/agencies/other "
          f"(${nonmunicipal['fed']:,.0f} federal) — see unmatched.csv")

    # ---- Counties: geometry for the impact-area overlay ---------------
    with open(counties_path, encoding="utf-8") as fh:
        county_geo = json.load(fh)
    county_feats = [{
        "type": "Feature",
        "geometry": f["geometry"],
        "properties": {"name": f["properties"]["BASENAME"], "geoid": f["properties"]["GEOID"]},
    } for f in county_geo["features"]]
    county_names = {f["properties"]["name"] for f in county_feats}

    # Carry the declarations the data actually references, so the payload can
    # name a disaster and shade its declared area without a second lookup.
    # `unmapped` holds designated areas with no county polygon — tribal areas
    # such as the Eastern Band of Cherokee Indians — so the overlay can say it
    # is not drawing them rather than silently dropping them.
    disasters_meta = {}
    for d in sorted({p["disaster"] for p in projects + reference if p["disaster"]}):
        if d not in decl:
            continue
        areas = decl[d]["counties"]
        disasters_meta[d] = {
            "title": decl[d]["title"], "type": decl[d]["type"], "date": decl[d]["date"],
            "areas": len(areas),
            "counties": sorted(areas & county_names),
            "unmapped": sorted(areas - county_names),
        }
    inside = sum(1 for p in projects if p["designated"] is True)
    outside = sum(1 for p in projects if p["designated"] is False)
    n_a = sum(1 for p in projects if p["designated"] is None)
    print(f"  declared-area match: {inside} inside, {outside} outside, "
          f"{n_a} n/a (no declaration) across {len(disasters_meta)} declarations")

    print("\n  Oceanfront comparison set:")
    for t in sorted(OCEANFRONT):
        n = sum(1 for p in projects if normalize(p["town"]) == normalize(t))
        print(f"    {t:22} {n:3d} projects{'' if n else '   <-- NO HMA RECORDS'}")

    # ---- Boundaries: all places, flagged by role ---------------------
    ocean_norm = {normalize(t): isl for t, isl in OCEANFRONT.items()}
    feats = []
    for f in places["features"]:
        pr = f["properties"]
        name = pr.get("BASENAME") or pr.get("NAME")
        feats.append({
            "type": "Feature",
            "geometry": f["geometry"],
            "properties": {
                "town": name,
                "geoid": pr["GEOID"],
                "island": ocean_norm.get(normalize(name)),   # null unless oceanfront
            },
        })

    missing_geo = [t for t in OCEANFRONT if normalize(t) not in by_name]
    if missing_geo:
        print("\n  WARNING no boundary matched:", ", ".join(missing_geo))

    payload = {
        "meta": {
            "source": "FEMA OpenFEMA HMA Projects v4; FEMA OpenFEMA Disaster "
                      "Declarations Summaries v2; Census TIGERweb Incorporated Places",
            "note": "Dollars are nominal (not inflation-adjusted). "
                    "federalShareObligated reflects obligated federal funds; "
                    "non-federal share is derived (projectAmount - federalShareObligated) "
                    "and the dataset does NOT identify who paid it.",
            "nfip_note": "FMA/SRL/RFC require the property to carry NFIP flood "
                         "insurance. HMGP/PDM/BRIC do not, though the community must "
                         "participate in the NFIP for projects in an SFHA. Verify "
                         "against the current fiscal year's HMA guidance.",
            "designation_note": "'Declared impact area' means the award's county was a "
                                "designated area of the same declaration that funded it, "
                                "per FEMA OpenFEMA DisasterDeclarationsSummaries v2. "
                                "Outside does NOT mean ineligible: HMGP is allocated to "
                                "the state off a declaration and may be awarded anywhere "
                                "in it, which is why awards land outside the declared "
                                "counties. Designation is an administrative determination, "
                                "not a damage map. The competitive programs (FMA, PDM, "
                                "BRIC, LPDM, RFC, SRL) carry no disaster number and are "
                                "recorded as not applicable.",
            "disasters": disasters_meta,
            "program_nfip": PROGRAM_NFIP,
            "oceanfront": OCEANFRONT,
            "nonmunicipal": {"records": nonmunicipal["n"], "fed": round(nonmunicipal["fed"], 2)},
            "reference_note": "Context rows: bodies other than an oceanfront municipality "
                              "that serve the same residents.",
            "built": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"),
            "fetched": datetime.datetime.fromtimestamp(
                os.path.getmtime(hma_path), datetime.timezone.utc).strftime("%Y-%m-%d"),
            "declarations_fetched": datetime.datetime.fromtimestamp(
                os.path.getmtime(decl_path), datetime.timezone.utc).strftime("%Y-%m-%d"),
            "fy_range": [
                min((p["fy"] for p in projects if p["fy"]), default=1989),
                max((p["fy"] for p in projects if p["fy"]), default=2025),
            ],
        },
        "projects": projects,
        "reference": reference,
        "boundaries": {"type": "FeatureCollection", "features": feats},
        "counties": {"type": "FeatureCollection", "features": county_feats},
    }

    out_json = os.path.join(OUT, "nc_hma.json")
    with open(out_json, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, separators=(",", ":"))

    out_audit = os.path.join(OUT, "unmatched.csv")
    with open(out_audit, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["subrecipient", "county", "records"])
        for name, info in sorted(unmatched.items(), key=lambda x: -x[1]["n"]):
            w.writerow([name, info["county"], info["n"]])

    print(f"\nWrote {out_json} ({os.path.getsize(out_json)/1e6:.1f} MB)")
    print(f"  {len(projects)} projects · {len(funded)} funded places · {len(feats)} boundaries")
    print(f"Wrote {out_audit} — {len(unmatched)} unmatched coastal-county subrecipients to review")


if __name__ == "__main__":
    main()

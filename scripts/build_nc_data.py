#!/usr/bin/env python3
# ==========================================================
# North Carolina Oceanfront HMA Comparison — Data Builder
#
# Fetches FEMA Hazard Mitigation Assistance records and Census
# place boundaries, matches HMA's free-text `subrecipient` field
# to NC oceanfront municipalities, and emits a single compact
# JSON payload for docs/nc/index.html.
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
TIGERWEB = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/"
    "Places_CouSub_ConCity_SubMCD/MapServer/4/query"
)

# Statewide: every NC incorporated place is included. Geometry is generalized
# server-side (maxAllowableOffset) — full resolution is 28 MB, too heavy for a
# web payload; 0.0005 deg holds shape well at 1.8 MB.
GEOM_OFFSET = "0.0005"

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
        })

    funded = {p["geoid"] for p in projects}
    print(f"  {len(projects)} of {len(nc)} NC records matched to an incorporated place")
    print(f"  {len(funded)} of {len(places['features'])} places have at least one award")
    print(f"  {nonmunicipal['n']} records went to counties/agencies/other "
          f"(${nonmunicipal['fed']:,.0f} federal) — see unmatched.csv")

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
            "source": "FEMA OpenFEMA HMA Projects v4; Census TIGERweb Incorporated Places",
            "note": "Dollars are nominal (not inflation-adjusted). "
                    "federalShareObligated reflects obligated federal funds; "
                    "non-federal share is derived (projectAmount - federalShareObligated) "
                    "and the dataset does NOT identify who paid it.",
            "nfip_note": "FMA/SRL/RFC require the property to carry NFIP flood "
                         "insurance. HMGP/PDM/BRIC do not, though the community must "
                         "participate in the NFIP for projects in an SFHA. Verify "
                         "against the current fiscal year's HMA guidance.",
            "program_nfip": PROGRAM_NFIP,
            "oceanfront": OCEANFRONT,
            "nonmunicipal": {"records": nonmunicipal["n"], "fed": round(nonmunicipal["fed"], 2)},
            "fy_range": [
                min((p["fy"] for p in projects if p["fy"]), default=1989),
                max((p["fy"] for p in projects if p["fy"]), default=2025),
            ],
        },
        "projects": projects,
        "boundaries": {"type": "FeatureCollection", "features": feats},
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

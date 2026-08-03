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

# NC Atlantic-facing barrier island municipalities — the comparison frame.
# Grouped by island system so the UI can offer "same island" comps.
TOWNS = {
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

# Coastal counties, used only to scope the unmatched-subrecipient audit.
COASTAL_COUNTIES = {
    "Currituck", "Dare", "Hyde", "Carteret", "Onslow",
    "Pender", "New Hanover", "Brunswick",
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
            "f": "geojson",
        },
        label="Census TIGERweb NC incorporated places",
    )

    lookup = {normalize(t): t for t in TOWNS}

    # ---- HMA records -------------------------------------------------
    print("\nMatching HMA subrecipients:")
    with open(hma_path, newline="", encoding="utf-8") as fh:
        nc = [r for r in csv.DictReader(fh) if r["state"] == "North Carolina"]

    projects, unmatched = [], {}
    for r in nc:
        key = normalize(r.get("subrecipient"))
        town = lookup.get(key)
        if not town:
            if r.get("county") in COASTAL_COUNTIES and r.get("subrecipient"):
                unmatched.setdefault(r["subrecipient"], {"county": r["county"], "n": 0})
                unmatched[r["subrecipient"]]["n"] += 1
            continue
        total = num(r.get("projectAmount"))
        fed = num(r.get("federalShareObligated"))
        projects.append({
            "town": town,
            "id": r.get("projectIdentifier"),
            "fy": int(r["programFy"]) if (r.get("programFy") or "").isdigit() else None,
            "program": r.get("programArea"),
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
            "final_props": int(num(r.get("numberOfFinalProperties"))),
            "county": r.get("county"),
        })

    matched_towns = {p["town"] for p in projects}
    for t in sorted(TOWNS):
        n = sum(1 for p in projects if p["town"] == t)
        flag = "" if n else "   <-- NO HMA RECORDS"
        print(f"  {t:22} {n:3d} projects{flag}")

    # ---- Boundaries --------------------------------------------------
    with open(places_path, encoding="utf-8") as fh:
        places = json.load(fh)

    # index by normalized name once — the loop below rewrites properties,
    # so scanning the raw feature list per town would lose the NAME field
    by_name = {normalize(f["properties"]["NAME"]): f for f in places["features"]}

    feats, missing_geo = [], []
    for town in TOWNS:
        hit = by_name.get(normalize(town))
        if not hit:
            missing_geo.append(town)
            continue
        feats.append({
            "type": "Feature",
            "geometry": hit["geometry"],
            "properties": {
                "town": town,
                "geoid": hit["properties"]["GEOID"],
                "island": TOWNS[town],
            },
        })

    if missing_geo:
        print("\n  WARNING no boundary matched:", ", ".join(missing_geo))

    payload = {
        "meta": {
            "source": "FEMA OpenFEMA HMA Projects v4; Census TIGERweb Incorporated Places",
            "note": "Dollars are nominal (not inflation-adjusted). "
                    "federalShareObligated reflects obligated federal funds; "
                    "non-federal share is derived (projectAmount - federalShareObligated) "
                    "and the dataset does NOT identify who paid it.",
            "towns": TOWNS,
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
    print(f"  {len(projects)} projects across {len(matched_towns)} towns, {len(feats)} boundaries")
    print(f"Wrote {out_audit} — {len(unmatched)} unmatched coastal-county subrecipients to review")


if __name__ == "__main__":
    main()

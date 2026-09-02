#!/usr/bin/env python3
# ==========================================================
# Brief figures — North Topsail Beach HMA comparison
#
# Renders the two SVG figures used by briefs/ from the same
# payload the dashboard reads (docs/nc/data/nc_hma.json), so
# the fact sheet can never drift from the map.
#
# Stdlib only. Colors are the dataviz reference palette already
# used by docs/nc/index.html.
#
# Usage:  python3 scripts/build_brief_figures.py
# Outputs: briefs/figures/delivery.svg, briefs/figures/coast_map.svg
# ==========================================================
import json, math, os
os.makedirs('briefs/figures', exist_ok=True)
D = json.load(open('docs/nc/data/nc_hma.json'))
P = D['projects']
OCEAN = ["Duck","Southern Shores","Kitty Hawk","Kill Devil Hills","Nags Head","Atlantic Beach",
 "Pine Knoll Shores","Indian Beach","Emerald Isle","North Topsail Beach","Surf City","Topsail Beach",
 "Wrightsville Beach","Carolina Beach","Kure Beach","Bald Head Island","Caswell Beach","Oak Island",
 "Holden Beach","Ocean Isle Beach","Sunset Beach"]
SUBJ = "North Topsail Beach"
BLUE="#2a78d6"; ORANGE="#eb6834"; INK="#0b0b0b"; INK2="#52514e"; INK3="#7a7873"
LINE="#dedbd4"; SURF="#fcfcfb"; ZERO="#e2e0da"; WASH="#eceae5"; WASH2="#e2e0da"
SEQ=["#cde2fb","#9ec5f4","#6da7ec","#2a78d6","#1c5cab","#0d366b"]

stat = {}
for t in OCEAN:
    ho = [x for x in P if x['town'] == t and x['homeowner']]
    stat[t] = {'filings': len(ho), 'props': sum(x['final'] for x in ho)}

def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

# ---------------- Figure 1: delivery bar chart ----------------
rows = [(t, stat[t]['props'], stat[t]['filings']) for t in OCEAN if stat[t]['filings'] > 0]
rows.sort(key=lambda r: (-r[1], r[0]))
W = 760
padL, padR, padT = 178, 58, 78
rowh, gap = 22, 7
H = padT + len(rows) * (rowh + gap) + 74
maxv = max(r[1] for r in rows)
plotw = W - padL - padR
s = []
s.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="ui-sans-serif,-apple-system,Segoe UI,Helvetica,Arial,sans-serif">')
s.append(f'<rect width="{W}" height="{H}" fill="{SURF}"/>')
s.append(f'<text x="20" y="26" font-size="14.5" font-weight="700" fill="{INK}">Homes actually mitigated with FEMA hazard-mitigation grants</text>')
s.append(f'<text x="20" y="44" font-size="11.5" fill="{INK2}">NC Atlantic barrier-island towns that filed at least one homeowner-directed application. All years on record, 1989–2026.</text>')
for gv in range(0, maxv + 1, 10):
    gx = padL + plotw * gv / maxv
    s.append(f'<line x1="{gx:.1f}" y1="{padT-8}" x2="{gx:.1f}" y2="{padT+len(rows)*(rowh+gap)-gap+4}" stroke="{LINE}" stroke-width="1"/>')
    s.append(f'<text x="{gx:.1f}" y="{padT-14}" font-size="10" fill="{INK3}" text-anchor="middle">{gv}</text>')
y = padT
for t, v, fl in rows:
    subj = t == SUBJ
    col = ORANGE if subj else BLUE
    fw = "700" if subj else "400"
    s.append(f'<text x="{padL-10}" y="{y+rowh*0.68:.1f}" font-size="11.5" font-weight="{fw}" fill="{INK if subj else INK2}" text-anchor="end">{esc(t)}</text>')
    bw = plotw * v / maxv
    if v == 0:
        s.append(f'<rect x="{padL}" y="{y}" width="3" height="{rowh}" fill="{ZERO}"/>')
        plural = "s" if fl > 1 else ""
        s.append(f'<text x="{padL+10}" y="{y+rowh*0.68:.1f}" font-size="11" font-weight="{fw}" fill="{ORANGE if subj else INK3}">0 — {fl} application{plural} filed, none completed</text>')
    else:
        s.append(f'<rect x="{padL}" y="{y}" width="{bw:.1f}" height="{rowh}" rx="4" fill="{col}"/>')
        s.append(f'<text x="{padL+bw+8:.1f}" y="{y+rowh*0.68:.1f}" font-size="11" font-weight="{fw}" fill="{INK2}">{v}</text>')
    y += rowh + gap
ly = H - 42
s.append(f'<rect x="20" y="{ly}" width="11" height="11" rx="3" fill="{BLUE}"/>')
s.append(f'<text x="37" y="{ly+9.5}" font-size="11" fill="{INK2}">Peer barrier-island town</text>')
s.append(f'<rect x="190" y="{ly}" width="11" height="11" rx="3" fill="{ORANGE}"/>')
s.append(f'<text x="207" y="{ly+9.5}" font-size="11" fill="{INK2}">North Topsail Beach</text>')
s.append(f'<text x="20" y="{H-14}" font-size="9.5" fill="{INK3}">Source: FEMA OpenFEMA Hazard Mitigation Assistance Projects v4. Homes mitigated = numberOfFinalProperties on activity codes 200/202/203/207.</text>')
s.append('</svg>')
open('briefs/figures/delivery.svg', 'w').write('\n'.join(s))
print('wrote delivery.svg:', len(rows), 'rows, max', maxv)


# ---------------- Figure 2: coastal map ----------------
COASTAL = {"Currituck","Dare","Hyde","Carteret","Onslow","Pender","New Hanover","Brunswick"}
TIER2 = {"Camden","Pasquotank","Perquimans","Chowan","Washington","Tyrrell","Beaufort","Pamlico",
         "Craven","Jones","Duplin","Sampson","Bladen","Columbus","Robeson","Lenoir","Carteret"}
counties = D['counties']['features']
bfeat = {f['properties']['town']: f for f in D['boundaries']['features']
         if f['properties'].get('town') in OCEAN}

def rings(geom):
    if geom['type'] == 'Polygon':
        return geom['coordinates']
    out = []
    for poly in geom['coordinates']:
        out.extend(poly)
    return out

def centroid(geom):
    ax = ay = a = 0.0
    for r in rings(geom):
        for i in range(len(r) - 1):
            x0, y0 = r[i][0], r[i][1]; x1, y1 = r[i+1][0], r[i+1][1]
            cr = x0*y1 - x1*y0
            a += cr; ax += (x0+x1)*cr; ay += (y0+y1)*cr
    if abs(a) < 1e-12:
        pts = [p for r in rings(geom) for p in r]
        return sum(p[0] for p in pts)/len(pts), sum(p[1] for p in pts)/len(pts)
    return ax/(3*a), ay/(3*a)

cents = {t: centroid(f['geometry']) for t, f in bfeat.items()}

MW, MH = 780, 600
TOP = 74            # below title block
BOT = 30
GUT_L, GUT_R = 196, 168   # label gutters
mx0, mx1 = GUT_L, MW - GUT_R

# bounds from coastal counties only (keeps the coast large)
pts = [p for f in counties if f['properties']['name'] in COASTAL
       for r in rings(f['geometry']) for p in r]
minx = min(p[0] for p in pts) - 0.15; maxx = max(p[0] for p in pts) + 0.15
miny = min(p[1] for p in pts) - 0.15; maxy = max(p[1] for p in pts) + 0.15
lat0 = math.radians((miny + maxy) / 2)
def proj(lon, lat): return (lon - minx) * math.cos(lat0), (maxy - lat)
w0, _ = proj(maxx, miny); _, h0 = proj(minx, miny)
sc = min((mx1 - mx0) / w0, (MH - TOP - BOT) / h0)
offx = mx0 + ((mx1 - mx0) - w0 * sc) / 2
offy = TOP + ((MH - TOP - BOT) - h0 * sc) / 2
def pt(lon, lat):
    x, y = proj(lon, lat)
    return offx + x * sc, offy + y * sc

def path(geom):
    out = []
    for r in rings(geom):
        if len(r) < 3: continue
        d = []
        for i, p in enumerate(r):
            X, Y = pt(p[0], p[1])
            d.append(f'{"M" if i==0 else "L"}{X:.1f} {Y:.1f}')
        out.append(' '.join(d) + 'Z')
    return ' '.join(out)

m = []
m.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {MW} {MH}" width="{MW}" height="{MH}" font-family="ui-sans-serif,-apple-system,Segoe UI,Helvetica,Arial,sans-serif">')
m.append(f'<rect width="{MW}" height="{MH}" fill="{SURF}"/>')
m.append(f'<clipPath id="c"><rect x="0" y="{TOP-6}" width="{MW}" height="{MH-TOP-BOT+12}"/></clipPath>')
m.append(f'<text x="20" y="26" font-size="14.5" font-weight="700" fill="{INK}">Where FEMA hazard-mitigation money reached homeowners on the NC coast</text>')
m.append(f'<text x="20" y="44" font-size="11.5" fill="{INK2}">Every NC Atlantic barrier-island municipality. Circle area = homes mitigated, all years on record.</text>')
# inline legend row
lx = 20
m.append(f'<circle cx="{lx+6}" cy="60" r="6" fill="{BLUE}" fill-opacity="0.85" stroke="{SURF}" stroke-width="1.5"/>')
m.append(f'<text x="{lx+18}" y="63.6" font-size="10.5" fill="{INK2}">homes mitigated</text>')
m.append(f'<circle cx="{lx+140}" cy="60" r="6" fill="none" stroke="{ORANGE}" stroke-width="2.2"/>')
m.append(f'<text x="{lx+152}" y="63.6" font-size="10.5" fill="{INK2}">applied, none completed</text>')
m.append(f'<circle cx="{lx+312}" cy="60" r="2.8" fill="{ZERO}" stroke="#c6c2b8" stroke-width="0.8"/>')
m.append(f'<text x="{lx+322}" y="63.6" font-size="10.5" fill="{INK2}">never applied for homeowner funds</text>')

m.append('<g clip-path="url(#c)">')
for f in counties:
    nm = f['properties']['name']
    if nm not in COASTAL and nm not in TIER2:
        continue
    m.append(f'<path d="{path(f["geometry"])}" fill="{WASH2 if nm in COASTAL else WASH}" stroke="#d5d2ca" stroke-width="0.7"/>')
m.append('</g>')

mxv = max(stat[t]['props'] for t in OCEAN)
def rad(v): return 5.0 + 21 * math.sqrt(v / mxv)

marks = []
for t in OCEAN:
    if t not in cents: continue
    X, Y = pt(*cents[t])
    v = stat[t]['props']; fl = stat[t]['filings']
    marks.append({'t': t, 'X': X, 'Y': Y, 'v': v, 'fl': fl, 'subj': t == SUBJ})

for k in sorted(marks, key=lambda z: -z['v']):
    X, Y, v, fl, subj = k['X'], k['Y'], k['v'], k['fl'], k['subj']
    if v > 0:
        m.append(f'<circle cx="{X:.1f}" cy="{Y:.1f}" r="{rad(v):.1f}" fill="{BLUE}" fill-opacity="0.85" stroke="{SURF}" stroke-width="2"/>')
    elif fl > 0:
        col = ORANGE if subj else INK3
        m.append(f'<circle cx="{X:.1f}" cy="{Y:.1f}" r="{7.5 if subj else 5.5}" fill="none" stroke="{col}" stroke-width="{2.6 if subj else 1.7}"/>')
    else:
        m.append(f'<circle cx="{X:.1f}" cy="{Y:.1f}" r="2.8" fill="{ZERO}" stroke="#c6c2b8" stroke-width="0.8"/>')

# ---- labels: only towns that filed homeowner-directed applications ----
lab = [k for k in marks if k['fl'] > 0]
midx = (mx0 + mx1) / 2
left = sorted([k for k in lab if k['X'] <= midx], key=lambda z: z['Y'])
right = sorted([k for k in lab if k['X'] > midx], key=lambda z: z['Y'])

def place(group, gx, anchor):
    SPACING = 16.5
    ys = [k['Y'] for k in group]
    # greedy push-down then correct upward so the block stays centered
    out = []
    prev = -1e9
    for y in ys:
        ny = max(y, prev + SPACING); out.append(ny); prev = ny
    over = out[-1] - (MH - BOT - 6) if out and out[-1] > (MH - BOT - 6) else 0
    if over > 0:
        out = [y - over for y in out]
        prev = 1e9
        for i in range(len(out) - 1, -1, -1):
            out[i] = min(out[i], prev - SPACING) if prev - SPACING < out[i] else out[i]
            prev = out[i]
    for k, ly in zip(group, out):
        r = rad(k['v']) if k['v'] > 0 else (7.5 if k['subj'] else 5.5)
        subj = k['subj']
        txt = f"{k['t']} — {k['v']}" if k['v'] > 0 else f"{k['t']} — 0 of {k['fl']}"
        fill = ORANGE if subj else INK2
        fw = "700" if subj else "400"
        fs = 11.5 if subj else 10.5
        if anchor == 'end':
            tx = gx; ex = k['X'] - r - 3; bx = tx + 4
        else:
            tx = gx; ex = k['X'] + r + 3; bx = tx - 4
        m.append(f'<path d="M{bx:.1f} {ly:.1f} L{(bx+ex)/2:.1f} {ly:.1f} L{ex:.1f} {k["Y"]:.1f}" fill="none" stroke="{ORANGE if subj else LINE}" stroke-width="{1.3 if subj else 0.9}"/>')
        m.append(f'<text x="{tx:.1f}" y="{ly+3.6:.1f}" font-size="{fs}" font-weight="{fw}" fill="{fill}" text-anchor="{anchor}">{esc(txt)}</text>')

place(left, GUT_L - 26, 'end')
place(right, MW - GUT_R + 26, 'start')

m.append(f'<text x="20" y="{MH-10}" font-size="9.5" fill="{INK3}">Source: FEMA OpenFEMA HMA Projects v4; Census TIGERweb boundaries. Circles at municipal centroids. Homeowner-directed = FEMA activity codes 200/202/203/207.</text>')
m.append('</svg>')
open('briefs/figures/coast_map.svg', 'w').write('\n'.join(m))
print('wrote coast_map.svg | left labels', len(left), 'right labels', len(right))

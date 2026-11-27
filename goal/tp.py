"""Thinking processes: Evaporating Cloud and trees. Mirror of app/tp.js (same JSON and DSL)."""
import re
from xml.sax.saxutils import escape

KINDS = ["ude", "cause", "root", "injection", "de", "obstacle", "io", "action", "need", "effect"]
TREES = {"crt": "Current Reality Tree", "frt": "Future Reality Tree", "prt": "Prerequisite Tree", "tt": "Transition Tree"}
CLR = [("clarity", "Clarity"), ("entity", "Entity existence"), ("causality", "Causality existence"),
       ("insufficiency", "Cause insufficiency"), ("additional", "Additional cause"), ("reversal", "Cause-effect reversal"),
       ("predicted", "Predicted effect existence"), ("tautology", "Tautology")]
COLORS = {"ude": "#fbe0dc", "root": "#f3d0f0", "cause": "#eef1f5", "injection": "#dce7fb", "de": "#e3f4e8",
          "obstacle": "#fbe0dc", "io": "#dce7fb", "action": "#fff4cc", "need": "#eef1f5", "effect": "#e3f4e8"}

EXAMPLES = {
    "crt": ("Bearington plant: current reality", """
m1: Performance measured by local efficiency [root]
p2: Material released to keep workers busy [root]
p1: Managers push work to keep every worker busy [cause]
c1: Non-bottlenecks make more than the bottleneck can process [cause]
c2: Bottleneck time lost to idle, setups, bad parts [cause]
u1: Inventory piles up before bottlenecks [ude]
u2: Orders ship late [ude]
u3: Constant expediting and overtime [ude]
u4: Plant loses money [ude]
m1 -> p1
p1 + p2 -> c1
c1 -> u1
u1 + c2 -> u2
u2 -> u3
u1 + u3 -> u4
"""),
    "frt": ("Bearington plant: future reality", """
i1: Release material at the bottleneck's pace [injection]
i2: Measure system throughput, not local efficiency [injection]
i3: Inspect before the bottleneck; run it through breaks [injection]
e1: Inventory falls [de]
e2: Bottleneck time not wasted [de]
e3: Orders ship on time [de]
e4: Plant makes money [de]
i1 + i2 -> e1
i3 -> e2
e1 + e2 -> e3
e3 -> e4
"""),
    "prt": ("Bearington plant: prerequisites", """
g: Ship on time with low inventory [de]
o1: Supervisors resist idle workers [obstacle]
io1: Supervisors measured on throughput [io]
o2: No release schedule [obstacle]
io2: Release schedule set from bottleneck queue [io]
o3: Bottleneck load unknown [obstacle]
io3: Bottlenecks found from queue data [io]
o1 -> io1
o2 -> io2
o3 -> io3
io3 -> io2
io1 + io2 -> g
"""),
    "tt": ("Bearington plant: transition", """
n1: Bottleneck parts wait behind other work [need]
a1: Tag bottleneck parts red [action]
e1: Workers process red-tag parts first [effect]
a2: Release material by bottleneck schedule [action]
e2: Queue before NCX-10 stays at buffer size [effect]
g: Orders ship on time [de]
n1 + a1 -> e1
e1 + a2 -> e2
e2 -> g
"""),
}

CLOUD = {
    "type": "cloud", "title": "Bearington plant: release conflict",
    "a": "Run a profitable plant", "b": "Keep everyone busy", "c": "Reduce inventory",
    "d": "Release more material", "dp": "Release only at the constraint's pace",
    "assumptions": {"ab": "Idle workers waste money", "ac": "Inventory costs cash and hides delays",
                    "bd": "Workers need material to stay busy", "cdp": "Material past constraint pace piles up",
                    "ddp": "One release policy at a time"},
    "injections": ["Idle time at a non-bottleneck costs nothing", "Measure throughput, not efficiency"],
}

_NODE = re.compile(r"^([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*(?:\[(\w+)\])?\s*$")
_LINK = re.compile(r"^(.+?)\s*->\s*([A-Za-z0-9_-]+)\s*$")


def parse_dsl(text):
    nodes, links = [], []
    for raw in str(text).splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = _NODE.match(line)
        if m and "->" not in line.split(":", 1)[0]:
            nodes.append({"id": m.group(1), "text": m.group(2), "kind": (m.group(3) or "cause").lower()})
            continue
        m = _LINK.match(line)
        if m:
            links.append({"from": [s.strip() for s in m.group(1).split("+") if s.strip()], "to": m.group(2)})
    return {"nodes": nodes, "links": links}


def to_dsl(doc):
    out = ["%s: %s [%s]" % (n["id"], n["text"], n.get("kind", "cause")) for n in doc.get("nodes", [])]
    out += ["%s -> %s" % (" + ".join(l["from"]), l["to"]) for l in doc.get("links", [])]
    return "\n".join(out) + "\n"


def new_doc(kind):
    if kind == "cloud":
        import copy
        return copy.deepcopy(CLOUD)
    if kind not in TREES:
        raise ValueError("kind must be cloud|" + "|".join(TREES))
    title, dsl = EXAMPLES[kind]
    d = {"type": kind, "title": title}
    d.update(parse_dsl(dsl))
    d["clr"] = {k: False for k, _ in CLR}
    return d


def validate(doc):
    out = []
    t = doc.get("type")
    if t == "cloud":
        for k in ("a", "b", "c", "d", "dp"):
            if not str(doc.get(k, "")).strip():
                out.append({"level": "error", "msg": "empty box: " + ("D'" if k == "dp" else k.upper())})
        return out
    if t not in TREES:
        return [{"level": "error", "msg": "unknown type: %s" % t}]
    ids, seen = set(), set()
    for n in doc.get("nodes", []):
        if n["id"] in ids:
            out.append({"level": "error", "msg": "duplicate id: " + n["id"]})
        ids.add(n["id"])
        if n.get("kind") not in KINDS:
            out.append({"level": "warn", "msg": "unknown kind: %s (%s)" % (n.get("kind"), n["id"])})
    adj = {i: [] for i in ids}
    for l in doc.get("links", []):
        for x in l["from"] + [l["to"]]:
            if x not in ids:
                out.append({"level": "error", "msg": "unknown id: " + x})
            seen.add(x)
        for f in l["from"]:
            if f in adj and l["to"] in ids:
                adj[f].append(l["to"])
    state = {}

    def dfs(u):
        state[u] = 1
        for v in adj[u]:
            if state.get(v) == 1 or (not state.get(v) and dfs(v)):
                return True
        state[u] = 2
        return False

    for i in sorted(ids):
        if not state.get(i) and dfs(i):
            out.append({"level": "error", "msg": "cycle"})
            break
    for n in doc.get("nodes", []):
        if n["id"] not in seen and len(ids) > 1:
            out.append({"level": "warn", "msg": "orphan: " + n["id"]})
    if t == "crt" and not any(n.get("kind") == "ude" for n in doc.get("nodes", [])):
        out.append({"level": "error", "msg": "no UDE"})
    return out


def render_md(doc):
    t = doc.get("type")
    md = ["# " + doc.get("title", t), ""]
    if t == "cloud":
        a = doc.get("assumptions", {})
        md += ["| Box | Entity | Assumption |", "|---|---|---|", "| A objective | %s | |" % doc["a"],
               "| B need | %s | %s |" % (doc["b"], a.get("ab", "")), "| C need | %s | %s |" % (doc["c"], a.get("ac", "")),
               "| D prerequisite | %s | %s |" % (doc["d"], a.get("bd", "")),
               "| D' prerequisite | %s | %s |" % (doc["dp"], a.get("cdp", "")), "| D vs D' | conflict | %s |" % a.get("ddp", ""),
               "", "## Injections", ""] + ["- " + x for x in doc.get("injections", [])]
        return "\n".join(md) + "\n"
    md += ["Type: " + TREES.get(t, t), "", "## Entities", ""]
    md += ["- **%s** `%s` %s" % (n["id"], n.get("kind", ""), n["text"]) for n in doc.get("nodes", [])]
    md += ["", "## Links", ""] + ["- %s -> %s" % (" + ".join(l["from"]), l["to"]) for l in doc.get("links", [])]
    clr = doc.get("clr", {})
    md += ["", "## CLR", ""] + ["- [%s] %s" % ("x" if clr.get(k) else " ", lab) for k, lab in CLR]
    return "\n".join(md) + "\n"


def _wrap(text, w=24):
    lines, cur = [], ""
    for word in str(text).split():
        if cur and len(cur) + 1 + len(word) > w:
            lines.append(cur)
            cur = word
        else:
            cur = (cur + " " + word).strip()
    return lines + ([cur] if cur else [])


def layout(doc):
    """Levels by longest path from sources (0 = bottom). Same algorithm as app/tp.js."""
    nodes = doc.get("nodes", [])
    ids = [n["id"] for n in nodes]
    preds = {i: [] for i in ids}
    for l in doc.get("links", []):
        if l["to"] in preds:
            preds[l["to"]] += [f for f in l["from"] if f in preds]
    lvl = {}
    for _ in range(len(ids) + 1):
        changed = False
        for i in ids:
            v = 1 + max([lvl.get(p, 0) for p in preds[i]], default=-1)
            v = min(v, len(ids))
            if lvl.get(i) != v:
                lvl[i], changed = v, True
        if not changed:
            break
    rows = {}
    for i in ids:
        rows.setdefault(lvl[i], []).append(i)
    pos = {}
    for k in sorted(rows):
        r = rows[k]
        if k > 0:
            def bc(i):
                ps = [pos[p][0] for p in preds[i] if p in pos]
                return sum(ps) / len(ps) if ps else 0
            r.sort(key=lambda i: (bc(i), ids.index(i)))
        for j, i in enumerate(r):
            pos[i] = (j, k)
    return pos, max(rows) + 1 if rows else 0, max((len(r) for r in rows.values()), default=0)


def render_svg(doc):
    if doc.get("type") == "cloud":
        return _cloud_svg(doc)
    BW, BH, GX, GY = 170, 56, 30, 60
    pos, nl, nw = layout(doc)
    W, H = max(1, nw) * (BW + GX) + GX, nl * (BH + GY) + GY
    byid = {n["id"]: n for n in doc.get("nodes", [])}
    rows = {}
    for i, (x, y) in pos.items():
        rows[y] = max(rows.get(y, 0), x + 1)

    def xy(i):
        x, y = pos[i]
        off = (W - rows[y] * (BW + GX) + GX) / 2
        return off + x * (BW + GX), H - GY / 2 - (y + 1) * (BH + GY) + GY

    out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" font-family="sans-serif" font-size="11">' % (W, H),
           '<defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="#555"/></marker></defs>']
    for l in doc.get("links", []):
        if l["to"] not in pos:
            continue
        tx, ty = xy(l["to"])
        tx += BW / 2
        ty += BH
        src = [f for f in l["from"] if f in pos]
        if len(src) > 1:
            jx, jy = tx, ty + GY * 0.45
            for f in src:
                fx, fy = xy(f)
                out.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#555"/>' % (fx + BW / 2, fy, jx, jy))
            out.append('<ellipse cx="%.1f" cy="%.1f" rx="16" ry="7" fill="#fff" stroke="#555"/>' % (jx, jy))
            out.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#555" marker-end="url(#ar)"/>' % (jx, jy - 7, tx, ty))
        elif src:
            fx, fy = xy(src[0])
            out.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#555" marker-end="url(#ar)"/>' % (fx + BW / 2, fy, tx, ty))
    for i in pos:
        n = byid[i]
        x, y = xy(i)
        out.append('<rect x="%.1f" y="%.1f" width="%d" height="%d" rx="5" fill="%s" stroke="#999"/>' % (x, y, BW, BH, COLORS.get(n.get("kind"), "#fff")))
        out.append('<text x="%.1f" y="%.1f" fill="#666" font-size="9">%s %s</text>' % (x + 5, y + 11, escape(i), escape(n.get("kind", ""))))
        for k, line in enumerate(_wrap(n["text"])[:3]):
            out.append('<text x="%.1f" y="%.1f">%s</text>' % (x + 5, y + 25 + k * 12, escape(line)))
    out.append("</svg>")
    return "\n".join(out) + "\n"


def _cloud_svg(doc):
    a = doc.get("assumptions", {})
    box = {"a": (10, 130), "b": (270, 30), "c": (270, 230), "d": (580, 30), "dp": (580, 230)}
    BW, BH = 170, 60
    out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 300" font-family="sans-serif" font-size="11">',
           '<defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="#555"/></marker></defs>']

    def note(x, y, txt, col="#666", anchor="middle"):
        for j, line in enumerate(_wrap(txt or "", 26)[:2]):
            out.append('<text x="%d" y="%d" fill="%s" font-size="9.5" text-anchor="%s">%s</text>' % (x, y + j * 11, col, anchor, escape(line)))

    for f, t, k in (("b", "a", "ab"), ("c", "a", "ac"), ("d", "b", "bd"), ("dp", "c", "cdp")):
        (fx, fy), (tx, ty) = box[f], box[t]
        x1, y1, x2, y2 = fx, fy + BH / 2, tx + BW, ty + BH / 2
        out.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#555" marker-end="url(#ar)"/>' % (x1, y1, x2, y2))
        if t == "a":
            note((x1 + x2) / 2 - 8, (y1 + y2) / 2 + (-6 if f == "b" else 14), a.get(k, ""), anchor="end")
        else:
            note((x1 + x2) / 2, (y1 + y2) / 2 + 14, a.get(k, ""))
    out.append('<path d="M665 92 L655 140 L675 180 L665 228" fill="none" stroke="#d33b2c" stroke-width="2"/>')
    note(645, 158, a.get("ddp", ""), "#d33b2c", "end")
    labels = {"a": "A", "b": "B", "c": "C", "d": "D", "dp": "D'"}
    for k, (x, y) in box.items():
        out.append('<rect x="%d" y="%d" width="%d" height="%d" rx="5" fill="%s" stroke="#999"/>' % (x, y, BW, BH, "#dce7fb" if k == "a" else "#fff"))
        out.append('<text x="%d" y="%d" font-weight="700">%s</text>' % (x + 6, y + 14, labels[k]))
        for j, line in enumerate(_wrap(doc.get(k, ""), 27)[:3]):
            out.append('<text x="%d" y="%d">%s</text>' % (x + 6, y + 28 + j * 12, escape(line)))
    out.append("</svg>")
    return "\n".join(out) + "\n"

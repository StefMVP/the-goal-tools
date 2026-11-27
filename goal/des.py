"""Discrete-event flow simulation. Python only (no app mirror).

Model (JSON, times in days, t=0 is Monday 00:00 unless start_weekday is set):
  seed, reps, horizon (optional; open items are cut at the horizon)
  calendars: {name: {"days": [0..6], "hours": [from, to]}}
  resources: {name: {"cap": n, "calendar": name}}
  stocks: {name: {"initial": n, "supply": [[t, n], ...]}}  (consumed by a step with "take": name)
  arrivals: {"times": [t, ...]} | {"every": d, "count": n} | {"gap": dist, "count": n}
  steps: [{name, after: [names], take: stock, gate: {period, at: [t]}, limit: {max, until},
           wait: dist, resource: name, work: dist, fail: {p, extra: dist}}]
Step order: after -> limit -> take -> gate -> wait (elapsed) -> queue -> work (resource, calendar) -> fail?
dist: number | {"fixed": x} | {"exp": mean} | {"uniform": [a, b]} | {"tri": [a, mode, b]}
      | {"lognorm": [median, p90]} | {"emp": [x, ...]} (resample)
"""
import heapq
import math

from goal.core import mulberry32, median, rnd

PARTS = ("hold", "wait", "queue", "work")


def sample(d, r):
    if d is None:
        return 0.0
    if isinstance(d, (int, float)):
        return float(d)
    k, v = next(iter(d.items()))
    if k == "fixed":
        return float(v)
    if k == "exp":
        return -v * math.log(1 - r())
    if k == "uniform":
        return v[0] + (v[1] - v[0]) * r()
    if k == "tri":
        a, m, b = v
        u = r()
        c = (m - a) / (b - a) if b > a else 0
        return a + math.sqrt(u * (b - a) * (m - a)) if u < c else b - math.sqrt((1 - u) * (b - a) * (b - m))
    if k == "lognorm":
        med, p90 = v
        s = math.log(p90 / med) / 1.2815515655446004 if p90 > med else 0
        u1, u2 = max(r(), 1e-12), r()
        z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
        return med * math.exp(s * z)
    if k == "emp":
        return float(v[math.floor(r() * len(v))])
    raise ValueError("unknown dist: " + k)


class Calendar:
    """Open windows each week. None = always open."""

    def __init__(self, spec, start_weekday=0):
        self.win = []
        h0, h1 = spec.get("hours", [0, 24])
        for d in spec.get("days", range(7)):
            off = ((d - start_weekday) % 7)
            self.win.append((off + h0 / 24, off + h1 / 24))
        self.win.sort()

    def _windows(self, t):
        w0 = math.floor(t / 7) * 7
        for k in (0, 7):
            for a, b in self.win:
                yield w0 + k + a, w0 + k + b

    def advance(self, t, work):
        """End time of `work` open days started at t."""
        left = work
        while True:
            for a, b in self._windows(t):
                if b <= t:
                    continue
                s = max(a, t)
                if s + left <= b + 1e-12:
                    return s + left
                left -= b - s
                t = b
            if left <= 1e-12:
                return t

    def open_days(self, t0, t1):
        tot = 0.0
        w = math.floor(t0 / 7) * 7
        while w < t1:
            for a, b in self.win:
                tot += max(0.0, min(w + b, t1) - max(w + a, t0))
            w += 7
        return tot


def _arrivals(spec, r):
    if "times" in spec:
        return sorted(float(x) for x in spec["times"])
    n = int(spec.get("count", 1))
    if "every" in spec:
        return [i * float(spec["every"]) for i in range(n)]
    out, t = [], 0.0
    for _ in range(n):
        out.append(t)
        t += sample(spec.get("gap"), r)
    return out


def run_once(m, seed):
    r = mulberry32(seed)
    sw = m.get("start_weekday", 0)
    cals = {k: Calendar(v, sw) for k, v in (m.get("calendars") or {}).items()}
    res = {}
    for k, v in (m.get("resources") or {}).items():
        res[k] = {"cap": int(v.get("cap", 1)), "busy": 0, "q": [], "cal": cals.get(v.get("calendar")), "used": 0.0}
    steps = m["steps"]
    names = [s["name"] for s in steps]
    idx = {n: i for i, n in enumerate(names)}
    after = [[idx[a] for a in s.get("after", [names[i - 1]] if i else [])] for i, s in enumerate(steps)]
    horizon = m.get("horizon")
    ev, seq = [], [0]
    items = []
    inside = {}  # step index -> set of items between that step start and `until` end
    held = {i: [] for i, s in enumerate(steps) if s.get("limit")}
    stock = {k: {"n": int(v.get("initial", 0)), "q": []} for k, v in (m.get("stocks") or {}).items()}

    def at(t, fn, *a):
        seq[0] += 1
        heapq.heappush(ev, (t, seq[0], fn, a))

    def ready(it, i, t):
        st = it["steps"][i]
        st["ready"] = t
        lim = steps[i].get("limit")
        if lim and len(inside.setdefault(i, set())) >= lim["max"]:
            held[i].append(it)
            return
        admit(it, i, t)

    def admit(it, i, t):
        if steps[i].get("limit"):
            inside.setdefault(i, set()).add(it["id"])
        sk = steps[i].get("take")
        if sk:
            if stock[sk]["n"] > 0 and not stock[sk]["q"]:
                stock[sk]["n"] -= 1
            else:
                stock[sk]["q"].append((it, i))
                return
        gated(it, i, t)

    def supply(t, sk, n):
        stock[sk]["n"] += n
        while stock[sk]["n"] > 0 and stock[sk]["q"]:
            stock[sk]["n"] -= 1
            gated(*stock[sk]["q"].pop(0), t)

    def gated(it, i, t):
        g = steps[i].get("gate")
        if g:
            p = float(g["period"])
            base = math.floor(t / p) * p
            cand = [base + k * p + a for k in (0, 1) for a in g["at"]]
            t = min(c for c in cand if c >= t - 1e-12)
        it["steps"][i]["admit"] = t
        at(t + sample(steps[i].get("wait"), r), queue, it, i)

    def queue(t, it, i):
        it["steps"][i]["queued"] = t
        rn = steps[i].get("resource")
        if not rn:
            at(t + sample(steps[i].get("work"), r), done, it, i, None)
            return
        rs = res[rn]
        rs["q"].append((it, i))
        serve(t, rn)

    def serve(t, rn):
        rs = res[rn]
        while rs["busy"] < rs["cap"] and rs["q"]:
            it, i = rs["q"].pop(0)
            rs["busy"] += 1
            w = sample(steps[i].get("work"), r)
            s = rs["cal"].advance(t, 0) if rs["cal"] else t
            end = rs["cal"].advance(s, w) if rs["cal"] else s + w
            rs["used"] += w
            it["steps"][i]["start"] = s
            at(end, done, it, i, rn)

    def done(t, it, i, rn):
        if rn:
            res[rn]["busy"] -= 1
            serve(t, rn)
        f = steps[i].get("fail")
        st = it["steps"][i]
        if f and r() < f["p"]:
            st["fails"] = st.get("fails", 0) + 1
            at(t + sample(f.get("extra"), r), queue, it, i)
            return
        st["end"] = t
        for j, s in enumerate(steps):
            lim = s.get("limit")
            if lim and names[i] == lim["until"] and it["id"] in inside.get(j, ()):
                inside[j].discard(it["id"])
                if held[j]:
                    admit(held[j].pop(0), j, t)
        nxt = [j for j in range(len(steps)) if i in after[j]]
        for j in nxt:
            if all("end" in it["steps"][k] for k in after[j]):
                ready(it, j, t)
        if all("end" in s for s in it["steps"]):
            it["done"] = t

    for k, v in (m.get("stocks") or {}).items():
        for t, n in v.get("supply", []):
            at(float(t), supply, k, int(n))
    for n, t in enumerate(_arrivals(m["arrivals"], r)):
        it = {"id": n, "arrive": t, "steps": [{} for _ in steps]}
        items.append(it)
        for j in range(len(steps)):
            if not after[j]:
                at(t, lambda tt, it=it, j=j: ready(it, j, tt))

    while ev:
        t, _, fn, a = heapq.heappop(ev)
        if horizon is not None and t > horizon:
            break
        fn(t, *a)
    end_t = horizon if horizon is not None else max([it.get("done", it["arrive"]) for it in items] + [0])
    for k, v in stock.items():
        res["stock:" + k] = {"left": v["n"], "waiting": len(v["q"])}
    return items, res, end_t, names


def parts(st, clock):
    """Days in each part of one step: hold (deps met, limit/gate), wait, queue, work."""
    if "ready" not in st:
        return None
    pts = [("hold", st["ready"], st.get("admit")), ("wait", st.get("admit"), st.get("queued")),
           ("queue", st.get("queued"), st.get("start", st.get("queued"))), ("work", st.get("start", st.get("queued")), st.get("end"))]
    out = {}
    for k, a, b in pts:
        if a is None:
            out[k] = 0.0
            continue
        out[k] = max(0.0, (b if b is not None else clock) - a)
        if b is None:
            for k2, _, _ in pts[pts.index((k, a, b)) + 1:]:
                out[k2] = 0.0
            break
    return out


def summarize(items, res, clock, names, census=None):
    lead = [it["done"] - it["arrive"] for it in items if "done" in it]
    by = {n: dict.fromkeys(PARTS, 0.0) for n in names}
    for it in items:
        for n, st in zip(names, it["steps"]):
            p = parts(st, clock)
            if p:
                for k in PARTS:
                    by[n][k] += p[k]
    util = {}
    stocks = {k[6:]: v for k, v in res.items() if k.startswith("stock:")}
    for k, rs in res.items():
        if k.startswith("stock:"):
            continue
        avail = (rs["cal"].open_days(0, clock) if rs["cal"] else clock) * rs["cap"]
        util[k] = {"used": rnd(rs["used"]), "util": rnd(rs["used"] / avail) if avail else 0}
    reach, to_end = {}, {}
    for j, n in enumerate(names):
        e = [it["steps"][j]["end"] - it["arrive"] for it in items if "end" in it["steps"][j]]
        reach[n], to_end[n] = len(e), rnd(median(e))
    out = {"items": len(items), "done": len(lead), "reach": reach, "to_end": to_end, "lead_median": rnd(median(lead)),
           "lead_p90": rnd(sorted(lead)[int(0.9 * (len(lead) - 1))]) if lead else 0,
           "step_days": {n: {k: rnd(v) for k, v in d.items()} for n, d in by.items()},
           "step_total": {n: rnd(sum(d.values())) for n, d in by.items()},
           "resources": util, "stocks": stocks}
    if census is not None:
        out["open_at"] = {}
        for t in census:
            c = dict.fromkeys(names, 0)
            for it in items:
                if it["arrive"] > t or it.get("done", 1e18) <= t:
                    continue
                for n, st in zip(names, it["steps"]):
                    if st.get("ready", 1e18) <= t < st.get("end", 1e18):
                        c[n] += 1
            out["open_at"][str(t)] = c
    return out


def _band(vals):
    s = sorted(vals)
    q = lambda p: rnd(s[int(p * (len(s) - 1))])
    return {"p10": q(0.1), "p50": q(0.5), "p90": q(0.9)}


def simulate(m):
    """Run reps; return per-rep summaries reduced to p10/p50/p90 bands."""
    reps = int(m.get("reps", 1))
    seed = int(m.get("seed", 1))
    runs = []
    for k in range(reps):
        items, res, clock, names = run_once(m, seed + k)
        runs.append(summarize(items, res, clock, names, m.get("census")))
    first = runs[0]
    out = {"reps": reps, "steps": first and list(first["step_total"]),
           "lead_median": _band([x["lead_median"] for x in runs]),
           "lead_p90": _band([x["lead_p90"] for x in runs]),
           "done": _band([x["done"] for x in runs]),
           "step_total": {n: _band([x["step_total"][n] for x in runs]) for n in first["step_total"]},
           "reach": {n: _band([x["reach"][n] for x in runs]) for n in first["reach"]},
           "to_end": {n: _band([x["to_end"][n] for x in runs]) for n in first["to_end"]},
           "step_days": {n: {k: _band([x["step_days"][n][k] for x in runs])["p50"] for k in PARTS} for n in first["step_days"]},
           "resources": {k: {"used": _band([x["resources"][k]["used"] for x in runs]), "util": _band([x["resources"][k]["util"] for x in runs])} for k in first["resources"]}}
    out["stocks"] = {k: {f: _band([x["stocks"][k][f] for x in runs])["p50"] for f in ("left", "waiting")} for k in first["stocks"]}
    if "open_at" in first:
        out["open_at"] = {t: {n: _band([x["open_at"][t][n] for x in runs])["p50"] for n in first["open_at"][t]} for t in first["open_at"]}
    return out

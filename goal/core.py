"""Shared math. Mirror of app/core.js. Parity: tests/vectors.json."""
import calendar
import json
import csv
import io
import math
import re

M32 = 0xFFFFFFFF


def _imul(a, b):
    return (a * b) & M32


def mulberry32(seed):
    a = seed & M32

    def r():
        nonlocal a
        a = (a + 0x6D2B79F5) & M32
        t = a
        t = _imul(t ^ (t >> 15), 1 | t)
        t = ((t + _imul(t ^ (t >> 7), 61 | t)) & M32) ^ t
        return ((t ^ (t >> 14)) & M32) / 4294967296

    return r


def randint(r, lo, hi):
    return lo + math.floor(r() * (hi - lo + 1))


def rnd(x, d=3):
    m = 10 ** d
    return math.floor(x * m + 0.5) / m


def median(a):
    if not a:
        return 0
    s = sorted(a)
    m = len(s) >> 1
    return s[m] if len(s) % 2 else (s[m - 1] + s[m]) / 2


def dice(p):
    n = p.get("stations", 5) or 5
    rounds = p.get("rounds", 20) or 20
    seed = p.get("seed", 1)
    dc = list(p.get("dice") or [])
    while len(dc) < n:
        dc.append([1, 6])
    dc = [list(d) if d else [1, 6] for d in dc[:n]]
    means = [(d[0] + d[1]) / 2 for d in dc]
    herbie = 0
    for i in range(1, n):
        if means[i] < means[herbie]:
            herbie = i
    rope = bool(p.get("rope"))
    buffer = p.get("buffer", 6)
    init = p.get("initWip", 0) or 0
    r = mulberry32(seed)
    q = [0 if i in (0, n) else init for i in range(n + 1)]
    out, cum, max_wip, released = [], 0, 0, 0
    for _ in range(rounds):
        rel = 0
        if rope:
            ahead = sum(q[: herbie + 1])
            rel = max(0, buffer - ahead)
            q[0] += rel
            released += rel
        rolls, moved = [], []
        for i in range(n):
            roll = randint(r, dc[i][0], dc[i][1])
            free = i == 0 and not rope
            m = roll if free else min(roll, q[i])
            if not free:
                q[i] -= m
            else:
                released += m
            q[i + 1] += m
            rolls.append(roll)
            moved.append(m)
        shipped = q[n]
        q[n] = 0
        cum += shipped
        wip = sum(q[:n])
        max_wip = max(max_wip, wip)
        out.append({"release": rel, "rolls": rolls, "moved": moved, "queues": q[:n], "out": shipped, "cum": cum, "wip": wip})
    expected = rounds * min(means)
    avg_cap = rounds * sum(means) / n
    return {
        "params": {"stations": n, "rounds": rounds, "seed": seed, "dice": dc, "rope": rope, "buffer": buffer, "initWip": init},
        "herbie": herbie,
        "rounds": out,
        "totals": {"throughput": cum, "expected": rnd(expected), "averageCapacity": rnd(avg_cap), "deficit": rnd(expected - cum),
                   "finalWip": out[-1]["wip"] if out else 0, "maxWip": max_wip, "released": released},
    }


# Dice score 0-100 = T% x I%. T% = net shipped / bound, max 100; net = shipped - start WIP drained.
# bound = lowest roll total of the slowest-die stations (one slow station: Herbie rolls; balanced line: all stations).
# I% = 1 while avg WIP <= needed (2 x Herbie max face + 1 per station), else needed / avg WIP.
GRADES = [(90, "A"), (80, "B"), (70, "C"), (60, "D"), (0, "F")]


def grade(sc):
    for lim, g in GRADES:
        if sc >= lim:
            return g
    return "F"


def _dice_prefix(res, upto=None):
    """Raw score of rounds 1..k for k = 1..upto (default all rounds)."""
    p = res["params"]
    n, hb = p["stations"], res["herbie"]
    hd = p["dice"][hb]
    means = [(d[0] + d[1]) / 2 for d in p["dice"]]
    slow = [i for i in range(n) if means[i] == means[hb]]
    rs = res["rounds"] if upto is None else res["rounds"][:upto]
    start = p["initWip"] * (n - 1)
    needed = 2 * hd[1] + n - 1
    wip, tot, out = 0, [0] * n, []
    for k, r in enumerate(rs):
        wip += r["wip"]
        for i in slow:
            tot[i] += r["rolls"][i]
        bound = min(tot[i] for i in slow)
        net = r["cum"] - max(0, start - r["wip"])
        t_pct = max(0, min(1, net / bound)) if bound > 0 else 1
        avg_wip = wip / (k + 1)
        i_pct = 1 if avg_wip <= needed else needed / avg_wip
        out.append({"score": 100 * t_pct * i_pct, "tPct": t_pct, "iPct": i_pct, "avgWip": avg_wip, "needed": needed, "bound": bound, "shipped": r["cum"], "net": net})
    return out


def _dice_score_raw(res, upto=None):
    xs = _dice_prefix(res, upto)
    if xs:
        return xs[-1]
    p = res["params"]
    return {"score": 100, "tPct": 1, "iPct": 1, "avgWip": 0, "needed": 2 * p["dice"][res["herbie"]][1] + p["stations"] - 1, "bound": 0, "shipped": 0, "net": 0}


def dice_score(res, upto=None):
    x = _dice_score_raw(res, upto)
    sc = math.floor(x["score"] + 0.5)
    return {"score": sc, "grade": grade(sc), "tPct": rnd(100 * x["tPct"], 1), "iPct": rnd(100 * x["iPct"], 1), "avgWip": rnd(x["avgWip"], 2),
            "needed": x["needed"], "bound": rnd(x["bound"], 1), "shipped": x["shipped"], "net": x["net"]}


def dice_move(dc, frm, to):
    d = [list(x) for x in dc]
    x = d.pop(frm)
    d.insert(to, x)
    return d


def _herbie_of(dc):
    h = 0
    for i in range(1, len(dc)):
        if (dc[i][0] + dc[i][1]) / 2 < (dc[h][0] + dc[h][1]) / 2:
            h = i
    return h


def _dice_mean(p, seeds):
    """Mean over seeds 1..N of the full-game score; byRound[k-1] = mean score of rounds 1..k."""
    t = {"score": 0, "tPct": 0, "avgWip": 0, "shipped": 0}
    by = [0] * (p["rounds"] or 20)
    for sd in range(1, seeds + 1):
        q = {"stations": p["stations"], "rounds": p["rounds"], "seed": sd, "dice": p["dice"], "rope": p["rope"], "buffer": p["buffer"], "initWip": p["initWip"]}
        xs = _dice_prefix(dice(q))
        for k in t:
            t[k] += xs[-1][k]
        for k, x in enumerate(xs):
            by[k] += x["score"]
    m = {k: v / seeds for k, v in t.items()}
    m["byRound"] = [v / seeds for v in by]
    return m


def dice_optimal(p, seeds=20, max_buffer=40, max_init=8):
    """Optimal controllable settings (Herbie position, rope, buffer, start WIP) for a fixed problem
    (stations, dice set, rounds). Max mean score over seeds 1..N; first best wins."""
    base = dice({"stations": p.get("stations"), "rounds": p.get("rounds"), "seed": 1, "dice": p.get("dice"), "rope": p.get("rope"),
                 "buffer": p.get("buffer", 6), "initWip": p.get("initWip")})["params"]
    dc, n = base["dice"], base["stations"]
    h0 = _herbie_of(dc)
    same = all(d == dc[0] for d in dc)
    pos = [i for i in range(n) if not same or i == h0]
    cur = _dice_mean(base, seeds)
    best = {"herbie": _herbie_of(dc), "rope": base["rope"], "buffer": base["buffer"], "initWip": base["initWip"], "dice": dc, "mean": cur}
    by = [{"herbie": best["herbie"], "rope": best["rope"], "buffer": best["buffer"], "initWip": best["initWip"], "score": v} for v in cur["byRound"]]
    for at in pos:
        moved = dice_move(dc, h0, at)
        for w in range(max_init + 1):
            for b in range(-1, max_buffer + 1):
                c = {"stations": n, "rounds": base["rounds"], "dice": moved, "rope": b >= 0, "buffer": b if b >= 0 else base["buffer"], "initWip": w}
                m = _dice_mean(c, seeds)
                if m["score"] > best["mean"]["score"] + 1e-9:
                    best = {"herbie": at, "rope": c["rope"], "buffer": c["buffer"], "initWip": w, "dice": moved, "mean": m}
                for k, v in enumerate(m["byRound"]):
                    if v > by[k]["score"] + 1e-9:
                        by[k] = {"herbie": at, "rope": c["rope"], "buffer": c["buffer"], "initWip": w, "score": v}

    def out(m):
        return {"score": rnd(m["score"], 1), "tPct": rnd(100 * m["tPct"], 1), "avgWip": rnd(m["avgWip"], 2), "shipped": rnd(m["shipped"], 2)}

    changed = []
    if best["herbie"] != _herbie_of(dc):
        changed.append("herbie")
    if best["rope"] != base["rope"]:
        changed.append("rope")
    if best["rope"] and best["buffer"] != base["buffer"]:
        changed.append("buffer")
    if best["initWip"] != base["initWip"]:
        changed.append("initWip")
    return {"seeds": seeds, "settings": {"herbie": best["herbie"], "rope": best["rope"], "buffer": best["buffer"], "initWip": best["initWip"], "dice": best["dice"]},
            "current": out(cur), "optimal": out(best["mean"]), "changed": changed, "byRound": by}


def dice_headline(p, opt, upto=None, seeds=None):
    """Headline scores for the Dice tab. Both sides: mean score over seeds 1..N of rounds 1..upto (the measure
    dice_optimal maximizes). opt may come from a different start config (cache); mine is a candidate too,
    so optimal >= mine. mineOptimal: mine within 0.5 of optimal."""
    seeds = seeds or opt["seeds"]
    base = dice(dict(p, seed=1))["params"]
    k = (upto or base["rounds"]) - 1
    mine = _dice_mean(base, seeds)["byRound"][k]
    o = dict(opt["byRound"][k])
    h0 = _herbie_of(base["dice"])
    if mine > o["score"]:
        o = {"herbie": h0, "rope": base["rope"], "buffer": base["buffer"], "initWip": base["initWip"], "score": mine}
    o["dice"] = dice_move(base["dice"], h0, o["herbie"])

    def side(v):
        sc = math.floor(v + 0.5)
        return {"score": sc, "grade": grade(sc), "mean": rnd(v, 1)}

    sc = o.pop("score")
    return {"seeds": seeds, "upto": k + 1, "mine": side(mine), "optimal": dict(side(sc), settings=o), "mineOptimal": mine >= sc - 0.5}


def constraint_index(caps):
    c = 0
    for i in range(1, len(caps)):
        if caps[i] < caps[c]:
            c = i
    return c


def flow(p):
    stages = p["stages"]
    days = p.get("days", 30) or 30
    seed = p.get("seed", 1)
    pol = p.get("policy") or {}
    n = len(stages)
    caps = [s["cap"] for s in stages]
    def eff_of():
        return [x * (1 - (stages[i].get("var", 0) or 0) / 2) for i, x in enumerate(caps)]

    c0 = constraint_index(eff_of())
    elev = pol.get("elevate", 1) or 1
    if elev != 1:
        caps[c0] = caps[c0] * elev
    if pol.get("add"):
        caps[c0] = caps[c0] + pol["add"]
    eff0 = eff_of()
    c = constraint_index(eff0)
    buffer = pol.get("buffer", 2 * caps[c])
    r = mulberry32(seed)
    q = [s.get("wip", 0) or 0 for s in stages] + [0]
    used = [0] * n
    series, cum, wip_sum = [], 0, 0
    for _ in range(days):
        if pol.get("rope"):
            ahead = sum(q[: c + 1])
            q[0] += max(0, math.floor(buffer - ahead + 0.5))
        moved = []
        for i in range(n):
            v = stages[i].get("var", 0) or 0
            u = r()
            capd = caps[i] if (pol.get("exploit") and i == c) else caps[i] * (1 - v * u)
            capd = max(0, math.floor(capd + 0.5))
            free = i == 0 and not pol.get("rope")
            m = capd if free else min(capd, q[i])
            if not free:
                q[i] -= m
            q[i + 1] += m
            used[i] += m
            moved.append(m)
        o = q[n]
        q[n] = 0
        cum += o
        wip = sum(q[:n])
        wip_sum += wip
        series.append({"out": o, "cum": cum, "wip": wip, "queues": q[:n], "moved": moved})
    th = cum / days
    eff = [rnd(used[i] / (caps[i] * days)) for i in range(n)]
    avg_wip = wip_sum / days
    return {
        "constraint": c, "originalConstraint": c0, "caps": [rnd(x) for x in caps], "effCaps": [rnd(x) for x in eff0], "days": series,
        "totals": {"throughput": cum, "perDay": rnd(th), "finalWip": series[-1]["wip"], "avgWip": rnd(avg_wip),
                   "leadTime": rnd(avg_wip / th) if th > 0 else None, "localEfficiency": eff, "avgLocalEfficiency": rnd(sum(eff) / n)},
    }



def flow_net(p, pol, seeds):
    """Mean over seeds 1..N of net/day for days 1..k (see app/core.js flowNet)."""
    e, days = p["econ"], p.get("days", 30) or 30
    by, tp, tw = [0] * days, 0, 0
    for sd in range(1, seeds + 1):
        r = flow({"stages": p["stages"], "days": days, "seed": sd, "policy": pol})
        ws = 0
        for k in range(days):
            d = r["days"][k]
            ws += d["wip"]
            by[k] += e["tu"] * d["cum"] / (k + 1) - e["oe"] - e["ec"] * (pol.get("add") or 0) - e["ic"] * ws / (k + 1)
        tp += r["totals"]["throughput"] / days
        tw += ws / days
    return {"net": by[days - 1] / seeds, "perDay": tp / seeds, "avgWip": tw / seeds, "byDay": [v / seeds for v in by]}


def _flow_max_add(e, max_add):
    return min(max_add, math.floor(e["budget"] / e["ec"] + 1e-9)) if e["ec"] > 0 else max_add


def _flow_pol(ex, rope, buf, add):
    x = {"exploit": ex, "rope": rope, "add": add}
    if rope:
        x["buffer"] = buf
    return x


def flow_optimal(p, seeds=20, max_buffer=40, max_add=10):
    """Best exploit, rope buffer (0 = no rope) and +cap under the budget for max mean net/day; first best wins."""
    a_max = _flow_max_add(p["econ"], max_add)
    best, by = None, None
    for ex in (False, True):
        for b in range(max_buffer + 1):
            for a in range(a_max + 1):
                pol = _flow_pol(ex, b > 0, b, a)
                m = flow_net(p, pol, seeds)
                if best is None or m["net"] > best[1]["net"] + 1e-9:
                    best = (pol, m)
                if by is None:
                    by = [{"settings": pol, "net": v} for v in m["byDay"]]
                else:
                    for k in range(len(by)):
                        if m["byDay"][k] > by[k]["net"] + 1e-9:
                            by[k] = {"settings": pol, "net": m["byDay"][k]}
    m = best[1]
    return {"seeds": seeds, "maxAdd": a_max, "settings": best[0],
            "optimal": {"net": rnd(m["net"], 2), "perDay": rnd(m["perDay"], 2), "avgWip": rnd(m["avgWip"], 2)}, "byDay": by}


def flow_headline(p, mine, opt, upto=None):
    days = p.get("days", 30) or 30
    k = (upto or days) - 1
    pol = _flow_pol(bool(mine.get("exploit")), bool(mine.get("rope")), mine.get("buffer"), mine.get("add") or 0)
    if mine.get("rope") and mine.get("buffer") is None:
        del pol["buffer"]
    m = flow_net(p, pol, opt["seeds"])
    mv, b = m["byDay"][k], opt["byDay"][k]
    ok = p["econ"]["ec"] * (pol.get("add") or 0) <= p["econ"]["budget"] + 1e-9
    o = {"settings": pol, "net": mv} if ok and mv > b["net"] else b
    return {"seeds": opt["seeds"], "upto": k + 1, "mine": {"net": rnd(mv, 2), "inBudget": ok, "settings": pol},
            "optimal": {"net": rnd(o["net"], 2), "settings": o["settings"]}, "mineOptimal": ok and mv >= o["net"] - 0.5}


def buffer_samples(p):
    """Per seed: n samples of sum(task × f(u)); f median 1, range 1 − s/2 .. 1 + 2s. base 'sum': minus the sum of tasks."""
    seeds, n, s = p.get("seeds") or 20, p.get("n") or 50, p["spread"]
    base = 0
    if p.get("base") == "sum":
        for t in p["tasks"]:
            base += t
    out = []
    for sd in range(1, seeds + 1):
        r = mulberry32(sd)
        xs = []
        for _ in range(n):
            t = 0
            for est in p["tasks"]:
                u = r()
                f = 1 - 0.5 * s * (1 - 2 * u) if u < 0.5 else 1 + 2 * s * (2 * u - 1)
                t += est * f
            xs.append(t - base)
        out.append(xs)
    return out


def buffer_service(xs, b):
    t = 0
    for a in xs:
        t += sum(1 for v in a if v <= b + 1e-9) / len(a)
    return t / len(xs)


def buffer_optimal(p):
    """Smallest whole buffer with mean service >= target; curve[b] = service for b = 0..max."""
    xs = buffer_samples(p)
    mx = max([0] + [v for a in xs for v in a])
    top = max(1, math.ceil(mx - 1e-9))
    curve, best = [], None
    for b in range(top + 1):
        sv = buffer_service(xs, b)
        curve.append(rnd(sv, 4))
        if best is None and sv >= p["target"] - 1e-9:
            best = b
    return {"buffer": best, "service": curve[best], "target": p["target"], "max": top, "curve": curve}


def buffer_headline(p, mine, opt):
    sv = rnd(buffer_service(buffer_samples(p), mine), 4)
    met = sv >= p["target"] - 1e-9
    return {"mine": {"buffer": mine, "service": sv, "met": met}, "optimal": {"buffer": opt["buffer"], "service": opt["service"], "met": True},
            "mineOptimal": met and mine <= opt["buffer"]}


def batch(p):
    unit, b = p["unit"], p["process"]
    t = p.get("transfer") or b
    setup = p.get("setup", 0) or 0
    max_u = max(unit)
    same = sum(setup + b * u for u in unit)
    split = sum(setup + t * u for u in unit) + (b - t) * max_u
    return {"sameBatch": rnd(same), "splitBatch": rnd(min(same, split))}


def littles(p):
    if p.get("wip") is None:
        return {"wip": rnd(p["throughput"] * p["leadTime"])}
    if p.get("leadTime") is None:
        return {"leadTime": rnd(p["wip"] / p["throughput"])}
    return {"throughput": rnd(p["wip"] / p["leadTime"])}


_TIME = re.compile(r"^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?Z?$")


def parse_time(s):
    if not s:
        return None
    m = _TIME.match(str(s).strip())
    if not m:
        raise ValueError("bad time: %s" % s)
    g = [int(x or 0) for x in m.groups()]
    ms = calendar.timegm((g[0], g[1], g[2], g[3], g[4], g[5], 0, 0, 0)) * 1000
    return ms / 86400000


def parse_csv(text):
    rows = [r for r in csv.reader(io.StringIO(str(text).replace("\r\n", "\n").replace("\r", "\n"))) if len(r) > 1 or (r and r[0].strip())]
    head = [h.strip().lower() for h in rows[0]]
    return [{h: (r[j] if j < len(r) else "").strip() for j, h in enumerate(head)} for r in rows[1:]]


def _pareto(mp, order):
    keys = [k for k in order if k in mp]
    total = sum(mp[k] for k in keys)
    keys.sort(key=lambda k: (-mp[k], order.index(k)))
    c, out = 0, []
    for k in keys:
        c += mp[k]
        out.append({"key": k, "days": rnd(mp[k]), "share": rnd(mp[k] / total) if total else 0, "cumShare": rnd(c / total) if total else 0})
    return out


def analyze(rows, opt=None):
    opt = opt or {}
    t0, t1, recs = math.inf, -math.inf, []
    for r in rows:
        s, e = parse_time(r.get("start")), parse_time(r.get("end"))
        if s is None:
            continue
        t0, t1 = min(t0, s), max(t1, s)
        if e is not None:
            t1 = max(t1, e)
        recs.append({"id": r.get("id"), "stage": r.get("stage"), "s": s, "e": e, "cause": r.get("cause") or "", "owner": r.get("owner") or ""})
    as_of = parse_time(opt["asOf"]) if opt.get("asOf") else t1
    stage_order, cause_order, id_order = [], [], []
    by_stage, by_cause, items = {}, {}, {}
    for x in recs:
        is_open = x["e"] is None
        d = max(0, (as_of if is_open else x["e"]) - x["s"])
        if x["stage"] not in by_stage:
            stage_order.append(x["stage"])
            by_stage[x["stage"]] = {"durs": [], "open": 0}
        by_stage[x["stage"]]["durs"].append(d)
        if is_open:
            by_stage[x["stage"]]["open"] += 1
        if x["cause"]:
            if x["cause"] not in by_cause:
                cause_order.append(x["cause"])
                by_cause[x["cause"]] = 0
            by_cause[x["cause"]] += d
        if x["id"] not in items:
            id_order.append(x["id"])
            items[x["id"]] = []
        items[x["id"]].append({"stage": x["stage"], "start": rnd(x["s"] - t0), "days": rnd(d), "open": is_open, "cause": x["cause"], "owner": x["owner"]})
    stage_days, stages = {}, []
    for k in stage_order:
        st = by_stage[k]
        tot = 0
        for v in st["durs"]:
            tot += v
        stage_days[k] = tot
        stages.append({"stage": k, "items": len(st["durs"]), "days": rnd(tot), "median": rnd(median(st["durs"])), "open": st["open"]})
    pareto = _pareto(stage_days, stage_order)
    aging = sorted(({"id": x["id"], "stage": x["stage"], "age": rnd(as_of - x["s"]), "cause": x["cause"]} for x in recs if x["e"] is None),
                   key=lambda a: (-a["age"], a["id"]))
    lanes = []
    for i in id_order:
        seg = items[i]
        end = 0
        for g in seg:
            end = max(end, g["start"] + g["days"])
        start = min(g["start"] for g in seg)
        lanes.append({"id": i, "start": rnd(start), "leadTime": rnd(end - start), "open": any(g["open"] for g in seg), "segments": seg})
    leads = [l["leadTime"] for l in lanes if not l["open"]]
    return {
        "items": len(id_order), "rows": len(recs), "span": rnd(as_of - t0),
        "constraint": {"stage": pareto[0]["key"], "days": pareto[0]["days"], "share": pareto[0]["share"]} if pareto else None,
        "stages": stages, "pareto": pareto, "causes": _pareto(by_cause, cause_order), "aging": aging, "lanes": lanes,
        "leadTime": {"done": len(leads), "median": rnd(median(leads))},
    }


def product_mix(p):
    prods, res = p["products"], p["resources"]
    load = []
    for r in res:
        l = sum(x["minutes"].get(r["id"], 0) * x["demand"] for x in prods)
        load.append({"id": r["id"], "cap": r["cap"], "load": l, "ratio": rnd(l / r["cap"])})
    ci = 0
    for i in range(1, len(load)):
        if load[i]["ratio"] > load[ci]["ratio"]:
            ci = i
    cid = res[ci]["id"]

    def plan(key):
        order = []
        for j, x in enumerate(prods):
            t = x["price"] - x["material"]
            cm = x["minutes"].get(cid, 0)
            order.append({"j": j, "t": t, "k": t if key == "unit" else (t / cm if cm else math.inf)})
        order.sort(key=lambda o: (-o["k"], o["j"]))
        rem = {r["id"]: r["cap"] for r in res}
        mix, T = [0] * len(prods), 0
        for o in order:
            x = prods[o["j"]]
            q = x["demand"]
            for r in res:
                m = x["minutes"].get(r["id"], 0)
                if m:
                    q = min(q, math.floor(rem[r["id"]] / m))
            for r in res:
                rem[r["id"]] -= q * x["minutes"].get(r["id"], 0)
            mix[o["j"]] = q
            T += q * o["t"]
        return {"rank": [prods[o["j"]]["id"] for o in order], "mix": [{"id": x["id"], "qty": mix[j]} for j, x in enumerate(prods)],
                "throughput": rnd(T), "netProfit": rnd(T - p["oe"])}

    products = []
    for x in prods:
        t = x["price"] - x["material"]
        cm = x["minutes"].get(cid, 0)
        products.append({"id": x["id"], "t": t, "tPerConstraintMinute": rnd(t / cm) if cm else None})
    return {"load": load, "constraint": cid if load[ci]["ratio"] > 1 else None, "perUnit": plan("unit"),
            "perConstraintMinute": plan("cm"), "products": products}


def buffer_zone(pen):
    return "black" if pen >= 1 else "red" if pen >= 2 / 3 else "yellow" if pen >= 1 / 3 else "green"


# Machines: old machines vs one new machine vs new + old kept. Per day, deterministic.
MACHINE_BASE = {
    "old": {"count": 3, "rate": 8, "operators": 1, "costHr": 10, "setup": 1, "down": 5},
    "new": {"rate": 30, "operators": 1, "costHr": 40, "setup": 1, "down": 10},
    "plant": {"hours": 16, "breakHr": 1.5, "wage": 25, "demand": 500, "other": 40, "tPerPart": 60, "material": 20, "oe": 20000, "position": "after"},
    "policy": {"old": "scrapped", "breaks": "idle"},
}
MACHINE_PRESETS = {
    "ncx10": {"title": "NCX-10 replaces old machines", "chapters": [2, 18, 19], "set": {"policy.breaks": "covered"}},
    "zmegma": {"title": "Bring back the Zmegma", "chapters": [19, 22], "set": {"old.count": 1, "policy.old": "spare", "policy.breaks": "covered"}},
    "lunch": {"title": "NCX-10 idle at lunch", "chapters": [19, 20], "set": {"plant.breakHr": 2, "policy.breaks": "idle"}},
    "robots": {"title": "Robots: efficiency up, T flat, I up", "chapters": [4, 9], "set": {
        "old.count": 1, "old.rate": 50, "old.operators": 4, "old.costHr": 10, "old.setup": 0, "old.down": 0,
        "new.rate": 68, "new.setup": 0, "new.down": 0, "new.operators": 4, "new.costHr": 20,
        "plant.position": "first", "plant.other": 45, "plant.demand": 800, "plant.breakHr": 0, "plant.tPerPart": 40}},
}


def machine_inputs(preset=None, over=None):
    p = json_copy(MACHINE_BASE)

    def put(sets):
        for k, v in (sets or {}).items():
            a = k.split(".")
            g = p.get(a[0])
            if g is None or len(a) != 2 or a[1] not in g:
                raise ValueError("unknown input: " + k)
            g[a[1]] = str(v) if isinstance(g[a[1]], str) else float(v)

    if preset:
        if preset not in MACHINE_PRESETS:
            raise ValueError("unknown preset: " + preset)
        put(MACHINE_PRESETS[preset]["set"])
    put(over)
    return p


def json_copy(x):
    return json.loads(json.dumps(x))


def machines(p):
    pl = p["plant"]
    idle = p["policy"]["breaks"] == "idle"

    def group(m, count):
        avail = max(0, pl["hours"] - (pl["breakHr"] if idle else 0) - m["setup"]) * (1 - m["down"] / 100)
        return {"rated": count * m["rate"], "cap": count * m["rate"] * avail,
                "costHr": count * (m["costHr"] + m["operators"] * pl["wage"]), "labor": count * m["operators"] * pl["wage"],
                "ops": count * m["operators"], "lostHr": pl["breakHr"] if idle else 0}

    def option(oid, gs):
        cap = sum(g["cap"] for g in gs)
        rated = sum(g["rated"] for g in gs)
        cost_hr = sum(g["costHr"] for g in gs)
        labor = sum(g["labor"] for g in gs)
        ops = sum(g["ops"] for g in gs)
        other_cap = pl["other"] * pl["hours"]
        first = pl["position"] == "first"
        up, down = (cap, other_cap) if first else (other_cap, cap)
        made = min(up, down)
        parts = min(pl["demand"], made)
        wip, fg = max(0, up - down), max(0, made - parts)
        out = cap if first else made
        con = "market" if parts >= pl["demand"] else ("machine" if cap <= other_cap else "other")
        t, oe = parts * pl["tPerPart"], cost_hr * pl["hours"] + pl["oe"]
        mc = con == "machine"
        return {
            "id": oid,
            "cost": {"costPerPart": rnd(cost_hr / rated if rated else 0, 2), "laborPerPart": rnd(labor / rated if rated else 0, 2),
                     "efficiency": rnd(100 * out / (rated * pl["hours"]) if rated else 0, 1), "partsPerHour": rated,
                     "made": rnd(out, 1), "perOperatorHr": rnd(rated / ops if ops else 0, 2)},
            "tioe": {"constraint": con, "machineCap": rnd(cap, 1), "otherCap": rnd(other_cap, 1), "parts": rnd(parts, 1),
                     "T": rnd(t, 0), "OE": rnd(oe, 0), "netProfit": rnd(t - oe, 0),
                     "wipPerDay": rnd(wip + fg, 1), "iPerDay": rnd((wip + fg) * pl["material"], 0),
                     "lostHr": gs[0]["lostHr"] if mc else 0,
                     "hourValue": rnd(pl["tPerPart"] * rated, 0) if mc else 0,
                     "lostT": rnd(pl["tPerPart"] * rated * gs[0]["lostHr"], 0) if mc else 0},
        }

    o, n = group(p["old"], p["old"]["count"]), group(p["new"], 1)
    opts = [option("old", [o]), option("new", [n]), option("both", [n, o])]
    cost = sorted(opts, key=lambda x: x["cost"]["costPerPart"] if x["cost"]["partsPerHour"] else math.inf)[0]["id"]
    tv = sorted(opts, key=lambda x: (-x["tioe"]["netProfit"], x["tioe"]["iPerDay"]))[0]["id"]
    return {"options": opts, "plan": PLAN.get(p["policy"]["old"], "new"), "costPick": cost, "throughputPick": tv}


# Policy "old machines" -> option that runs: scrapped = new only, spare = new + old, only = old only (no new machine).
PLAN = {"scrapped": "new", "spare": "both", "only": "old"}


def machines_optimal(p):
    """Mine: the policy in p. Optimal: the policy (old machines x breaks) with max net profit/day for the same plant; tie: lowest I.
    On a tie with mine, mine is optimal."""
    def run(old, breaks):
        q = json_copy(p)
        q["policy"] = {"old": old, "breaks": breaks}
        r = machines(q)
        o = [x for x in r["options"] if x["id"] == r["plan"]][0]
        return {"old": old, "breaks": breaks, "run": r["plan"], "tioe": o["tioe"]}

    mine = run(p["policy"]["old"], p["policy"]["breaks"])
    best = mine
    for old in PLAN:
        for breaks in ("covered", "idle"):
            c = run(old, breaks)
            a, b = c["tioe"], best["tioe"]
            if a["netProfit"] > b["netProfit"] or (a["netProfit"] == b["netProfit"] and a["iPerDay"] < b["iPerDay"]):
                best = c
    m, o = mine["tioe"], best["tioe"]
    return {"mine": mine, "optimal": best, "same": m["netProfit"] == o["netProfit"] and m["iPerDay"] == o["iPerDay"]}


def machines_sweep(p, key, values):
    out = {"key": key, "values": values}
    for oid in ("old", "new", "both"):
        out[oid] = {"parts": [], "T": []}
    a = key.split(".")
    for v in values:
        q = json_copy(p)
        q[a[0]][a[1]] = v
        for x in machines(q)["options"]:
            out[x["id"]]["parts"].append(x["tioe"]["parts"])
            out[x["id"]]["T"].append(x["tioe"]["T"])
    return out

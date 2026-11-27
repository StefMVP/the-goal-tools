"""Random Flow lab and Buffers configs for the optimal >= mine property test (Python) and parity vectors (JS)."""
import random

FLOW_SEARCH = {"seeds": 2, "maxBuffer": 1, "maxAdd": 0}


def flow_cases(n=200, seed=43):
    """Each case: problem p (stages, days, econ), mine actions, day upto."""
    r = random.Random(seed)
    out = []
    for _ in range(n):
        stages = [{"name": "S%d" % (i + 1), "cap": r.randint(1, 12), "var": r.choice([0, 0.1, 0.3, 0.5, 0.8]), "wip": r.randint(0, 4)} for i in range(r.randint(2, 4))]
        days = r.randint(1, 8)
        econ = {"tu": r.choice([10, 50, 100]), "oe": r.choice([0, 100, 500]), "ec": r.choice([0, 20, 60, 150]), "ic": r.choice([0, 1, 5, 20]),
                "budget": r.choice([0, 60, 300])}
        mine = {"exploit": r.random() < 0.5, "rope": r.random() < 0.5, "add": r.randint(0, 3)}
        if mine["rope"] and r.random() < 0.8:
            mine["buffer"] = r.randint(0, 12)
        out.append(dict(FLOW_SEARCH, p={"stages": stages, "days": days, "econ": econ}, mine=mine, upto=r.randint(1, days)))
    return out


def buffer_cases(n=200, seed=44):
    """Each case: problem (tasks, spread, target, base), mine buffer."""
    r = random.Random(seed)
    out = []
    for _ in range(n):
        p = {"tasks": [r.choice([0.5, 1, 2, 3, 5]) for _ in range(r.randint(1, 6))], "spread": r.choice([0, 0.2, 0.5, 1]),
             "target": r.choice([0.5, 0.8, 0.9, 0.95, 1]), "base": r.choice(["sum", "none"]), "seeds": 3, "n": 20}
        out.append({"p": p, "mine": r.randint(0, 30)})
    return out

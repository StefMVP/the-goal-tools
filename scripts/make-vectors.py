#!/usr/bin/env python3
"""Write tests/vectors.json: inputs plus expected outputs from goal/core.py. JS must match (tests/parity.js)."""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from goal import core  # noqa: E402
from tests.dice_cases import headline_cases  # noqa: E402
from tests.machine_cases import optimal_cases  # noqa: E402
from tests.compare_cases import buffer_cases, flow_cases  # noqa: E402

stages = json.load(open(os.path.join(ROOT, "examples", "stages.json")))
small_csv = 'id,stage,start,end,cause\nA,a,2026-01-01,2026-01-03,"x, y"\nA,b,2026-01-03,2026-01-10,z\nB,a,2026-01-02,2026-01-02T12:00,\nB,b,2026-01-02T12:00,,z\n'
cases = [
    ["rng", {"seed": 1, "n": 5}],
    ["rng", {"seed": 123456789, "n": 5}],
    ["dice", {"stations": 5, "rounds": 20, "seed": 7, "initWip": 4}],
    ["dice", {"stations": 5, "rounds": 30, "seed": 11, "dice": [[1, 6], [1, 6], [1, 4], [1, 6], [1, 6]], "rope": True, "buffer": 6}],
    ["dice", {"stations": 4, "rounds": 15, "seed": 3, "dice": [[1, 4], [1, 6], [1, 6], [1, 6]]}],
    ["dscore", {"stations": 5, "rounds": 20, "seed": 7, "initWip": 4, "dice": [[1, 4], [1, 6], [1, 6], [1, 6], [1, 6]]}],
    ["dscore", {"stations": 5, "rounds": 20, "seed": 7, "initWip": 4, "dice": [[1, 6], [1, 6], [1, 4], [1, 6], [1, 6]], "upto": 10}],
    ["dscore", {"stations": 4, "rounds": 12, "seed": 2, "initWip": 0, "dice": [[1, 1], [1, 6], [1, 6], [1, 6]], "rope": True, "buffer": 0}],
    ["dscore", {"stations": 3, "rounds": 30, "seed": 5, "initWip": 9, "dice": [[1, 6], [1, 6], [2, 3]]}],
    ["dopt", {"stations": 5, "rounds": 20, "initWip": 4, "dice": [[1, 4], [1, 6], [1, 6], [1, 6], [1, 6]], "seeds": 4, "maxBuffer": 8, "maxInit": 4}],
    ["dopt", {"stations": 4, "rounds": 15, "initWip": 6, "dice": [[1, 6], [1, 6], [1, 1], [1, 6]], "rope": True, "buffer": 3, "seeds": 3, "maxBuffer": 6, "maxInit": 3}],
    ["dopt", {"stations": 3, "rounds": 10, "initWip": 2, "dice": [[1, 6], [1, 6], [1, 6]], "seeds": 3, "maxBuffer": 5, "maxInit": 2}],
    ["dhead", {"mine": {"stations": 5, "rounds": 20, "seed": 7, "initWip": 4, "dice": [[1, 6]] * 5}, "upto": 20, "seeds": 20, "maxBuffer": 40, "maxInit": 8}],
    ["flow", {"stages": stages, "days": 30, "seed": 3, "policy": {}}],
    ["flow", {"stages": stages, "days": 30, "seed": 3, "policy": {"exploit": True}}],
    ["flow", {"stages": stages, "days": 30, "seed": 3, "policy": {"exploit": True, "rope": True}}],
    ["flow", {"stages": stages, "days": 40, "seed": 9, "policy": {"exploit": True, "rope": True, "elevate": 2, "buffer": 10}}],
    ["batch", {"unit": [0.1, 0.2, 0.5, 0.1], "process": 20, "transfer": 5, "setup": 0.5}],
    ["littles", {"throughput": 4, "leadTime": 5}],
    ["littles", {"throughput": 4, "wip": 30}],
    ["analyze", {"csv": "examples/orders.csv"}],
    ["analyze", {"csv": small_csv, "asOf": "2026-01-12"}],
    ["mix", json.load(open(os.path.join(ROOT, "examples", "pq.json")))],
    ["machines", {"preset": "ncx10"}],
    ["machines", {"preset": "zmegma"}],
    ["machines", {"preset": "lunch"}],
    ["machines", {"preset": "robots"}],
    ["machines", {"preset": "lunch", "over": {"new.down": 33.3, "plant.position": "first", "policy.old": "spare"}}],
    ["machines", {"preset": "ncx10", "over": {"old.count": 0}}],
    ["msweep", {"preset": "ncx10", "key": "new.down", "values": [0, 10, 20, 30, 40, 50]}],
]


def run(kind, inp):
    if kind == "rng":
        r = core.mulberry32(inp["seed"])
        return [r() for _ in range(inp["n"])]
    if kind == "dice":
        return core.dice(inp)
    if kind == "dscore":
        return core.dice_score(core.dice(inp), inp.get("upto"))
    if kind == "dopt":
        return core.dice_optimal(inp, seeds=inp["seeds"], max_buffer=inp["maxBuffer"], max_init=inp["maxInit"])
    if kind == "dhead":
        o = core.dice_optimal(inp.get("other", inp["mine"]), seeds=inp["seeds"], max_buffer=inp["maxBuffer"], max_init=inp["maxInit"])
        return core.dice_headline(inp["mine"], o, inp["upto"])
    if kind == "flow":
        return core.flow(inp)
    if kind == "fhead":
        o = core.flow_optimal(inp["p"], seeds=inp["seeds"], max_buffer=inp["maxBuffer"], max_add=inp["maxAdd"])
        return {"opt": dict(o, byDay=None), "head": core.flow_headline(inp["p"], inp["mine"], o, inp["upto"])}
    if kind == "bopt":
        return core.buffer_optimal(inp)
    if kind == "bhead":
        o = core.buffer_optimal(inp["p"])
        return {"opt": o, "head": core.buffer_headline(inp["p"], inp["mine"], o)}
    if kind == "batch":
        return core.batch(inp)
    if kind == "littles":
        return core.littles(inp)
    if kind == "analyze":
        text = inp["csv"]
        if text.endswith(".csv"):
            text = open(os.path.join(ROOT, text)).read()
        return core.analyze(core.parse_csv(text), {"asOf": inp.get("asOf")})
    if kind == "mix":
        return core.product_mix(inp)
    if kind == "machines":
        return core.machines(core.machine_inputs(inp.get("preset"), inp.get("over")))
    if kind == "mopt":
        return core.machines_optimal(core.machine_inputs(inp["preset"], inp["over"]))
    if kind == "msweep":
        return core.machines_sweep(core.machine_inputs(inp["preset"]), inp["key"], inp["values"])
    raise ValueError(kind)


if __name__ == "__main__":
    cases += [["dhead", c] for c in headline_cases()]
    cases += [["mopt", c] for c in optimal_cases()]
    cases += [["fhead", c] for c in flow_cases()]
    cases += [["bhead", c] for c in buffer_cases()]
    cases += [["flow", {"stages": stages, "days": 20, "seed": 4, "policy": {"exploit": True, "rope": True, "buffer": 8, "add": 2}}],
              ["bopt", {"tasks": [2, 2, 2], "spread": 0.4, "target": 0.9}], ["bopt", {"tasks": [5] * 6, "spread": 0.6, "target": 0.9, "base": "sum"}]]
    out = [{"kind": k, "input": i, "expected": run(k, i)} for k, i in cases]
    json.dump(out, open(os.path.join(ROOT, "tests", "vectors.json"), "w"), separators=(",", ":"))
    print(len(out), "vectors")

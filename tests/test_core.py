import json
import os
import subprocess
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from goal import core  # noqa: E402
from tests.machine_cases import optimal_cases  # noqa: E402

sys.path.insert(0, os.path.join(ROOT, "scripts"))
make_vectors = __import__("make-vectors")


class Vectors(unittest.TestCase):
    def test_python_matches_vectors(self):
        vec = json.load(open(os.path.join(ROOT, "tests", "vectors.json")))
        for i, v in enumerate(vec):
            got = json.loads(json.dumps(make_vectors.run(v["kind"], v["input"])))
            self.assertEqual(got, v["expected"], "vector %d %s" % (i, v["kind"]))


class Dice(unittest.TestCase):
    P = {"stations": 5, "rounds": 40, "seed": 7, "initWip": 4, "dice": [[1, 6], [1, 6], [1, 4], [1, 6], [1, 6]]}

    def test_seeded_replay(self):
        a, b = core.dice(self.P), core.dice(dict(self.P))
        self.assertEqual(a, b)
        self.assertNotEqual(a["rounds"], core.dice(dict(self.P, seed=8))["rounds"])

    def test_rope_caps_wip(self):
        push, rope = core.dice(self.P), core.dice(dict(self.P, rope=True, buffer=6))
        self.assertEqual(push["herbie"], 2)
        self.assertGreater(push["totals"]["maxWip"], rope["totals"]["maxWip"])
        self.assertLessEqual(rope["totals"]["maxWip"], 6 + 4 * 2 + 6)

    def test_fluctuations_lose_throughput(self):
        r = core.dice({"stations": 5, "rounds": 100, "seed": 1})
        self.assertGreater(r["totals"]["deficit"], 0)


class Analyzer(unittest.TestCase):
    def test_synthetic_constraint(self):
        r = core.analyze(core.parse_csv(open(os.path.join(ROOT, "examples", "orders.csv")).read()))
        self.assertEqual(r["constraint"]["stage"], "install")
        self.assertEqual(r["causes"][0]["key"], "tech capacity")
        self.assertEqual(r["items"], 40)

    def test_hand_computed(self):
        csv = 'id,stage,start,end,cause\nA,a,2026-01-01,2026-01-03,"x, y"\nA,b,2026-01-03,2026-01-10,z\nB,a,2026-01-02,2026-01-02T12:00,\nB,b,2026-01-02T12:00,,z\n'
        r = core.analyze(core.parse_csv(csv), {"asOf": "2026-01-12"})
        self.assertEqual(r["constraint"], {"stage": "b", "days": 16.5, "share": 0.868})
        self.assertEqual([(c["key"], c["days"]) for c in r["causes"]], [("z", 16.5), ("x, y", 2.0)])
        self.assertEqual(r["aging"], [{"id": "B", "stage": "b", "age": 9.5, "cause": "z"}])
        self.assertEqual(r["leadTime"], {"done": 1, "median": 9.0})


class Mix(unittest.TestCase):
    def test_pq(self):
        r = core.product_mix(json.load(open(os.path.join(ROOT, "examples", "pq.json"))))
        self.assertEqual(r["constraint"], "B")
        self.assertEqual(r["perUnit"]["netProfit"], -300)
        self.assertEqual(r["perConstraintMinute"]["netProfit"], 300)


class Flow(unittest.TestCase):
    def test_five_steps(self):
        st = json.load(open(os.path.join(ROOT, "examples", "stages.json")))
        f = lambda pol: core.flow({"stages": st, "days": 30, "seed": 3, "policy": pol})
        base, ex, sub, el = f({}), f({"exploit": True}), f({"exploit": True, "rope": True}), f({"exploit": True, "rope": True, "elevate": 2})
        self.assertGreater(ex["totals"]["perDay"], base["totals"]["perDay"])
        self.assertLess(sub["totals"]["avgWip"], ex["totals"]["avgWip"] / 5)
        self.assertGreater(el["totals"]["perDay"], sub["totals"]["perDay"])
        self.assertNotEqual(el["constraint"], el["originalConstraint"])


class Cli(unittest.TestCase):
    def run_cli(self, *args):
        return subprocess.run([os.path.join(ROOT, "bin", "goal")] + list(args), capture_output=True, text=True)

    def test_analyze_json_when_piped(self):
        p = self.run_cli("analyze", os.path.join(ROOT, "examples", "orders.csv"))
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(json.loads(p.stdout)["constraint"]["stage"], "install")

    def test_dice_cli_matches_core(self):
        out = json.loads(self.run_cli("sim", "dice", "--seed", "7", "--slow", "3", "--rounds", "40").stdout)
        self.assertEqual(out["totals"], core.dice(Dice.P)["totals"])

    def test_json_flag_any_position(self):
        p = self.run_cli("concept", "bottleneck", "--json")
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(json.loads(p.stdout)["id"], "bottleneck")

    def test_bad_concept(self):
        self.assertEqual(self.run_cli("concept", "no-such").returncode, 2)

    def test_open(self):
        self.assertTrue(self.run_cli("open", "finder").stdout.strip().endswith("app/index.html#/finder"))


if __name__ == "__main__":
    unittest.main()


class Machines(unittest.TestCase):
    def test_ncx10_views_disagree(self):
        r = core.machines(core.machine_inputs("ncx10"))
        self.assertEqual(r["costPick"], "new")
        self.assertEqual(r["throughputPick"], "both")
        new, both = r["options"][1]["tioe"], r["options"][2]["tioe"]
        self.assertEqual(new["constraint"], "machine")
        self.assertGreater(both["T"], new["T"])

    def test_robots_t_flat_i_up(self):
        old, new, _ = core.machines(core.machine_inputs("robots"))["options"]
        self.assertGreater(new["cost"]["made"], old["cost"]["made"])
        self.assertEqual(new["tioe"]["T"], old["tioe"]["T"])
        self.assertGreater(new["tioe"]["iPerDay"], old["tioe"]["iPerDay"])
        self.assertLess(new["cost"]["costPerPart"], old["cost"]["costPerPart"])

    def test_lunch_idle_costs_t(self):
        idle = core.machines(core.machine_inputs("lunch"))["options"][1]["tioe"]
        cov = core.machines(core.machine_inputs("lunch", {"policy.breaks": "covered"}))["options"][1]["tioe"]
        self.assertGreater(cov["T"], idle["T"])
        self.assertGreater(idle["lostT"], 0)

    def test_unknown_input(self):
        with self.assertRaises(ValueError):
            core.machine_inputs("ncx10", {"old.nope": 1})

    def test_optimal_not_worse_than_mine(self):
        """Property: on 200 random configs the optimal policy has net profit >= mine; on a tie, I <= mine."""
        for c in optimal_cases():
            r = core.machines_optimal(core.machine_inputs(c["preset"], c["over"]))
            m, o = r["mine"]["tioe"], r["optimal"]["tioe"]
            self.assertTrue(o["netProfit"] > m["netProfit"] or (o["netProfit"] == m["netProfit"] and o["iPerDay"] <= m["iPerDay"]), c)
            self.assertEqual(r["same"], o["netProfit"] == m["netProfit"] and o["iPerDay"] == m["iPerDay"], c)
            for k in ("old", "breaks"):
                self.assertEqual(r["mine"][k], c["over"]["policy." + k])

    def test_optimal_ncx10_keeps_old_machines(self):
        r = core.machines_optimal(core.machine_inputs("ncx10"))
        self.assertEqual(r["mine"]["run"], "new")
        self.assertEqual((r["optimal"]["old"], r["optimal"]["run"]), ("spare", "both"))
        self.assertFalse(r["same"])

    def test_optimal_lunch_covers_breaks(self):
        r = core.machines_optimal(core.machine_inputs("lunch"))
        self.assertEqual(r["optimal"]["breaks"], "covered")

    def test_policy_only_runs_old(self):
        self.assertEqual(core.machines(core.machine_inputs("ncx10", {"policy.old": "only"}))["plan"], "old")


class DiceScore(unittest.TestCase):
    # User URL #/dice?r=20&slow=1&lo=1&hp=1: hi defaults to 4, so a 1-4 die at station 1; rope off, start WIP 4.
    USER = {"stations": 5, "rounds": 20, "seed": 7, "initWip": 4, "rope": False, "buffer": 6, "dice": [[1, 4], [1, 6], [1, 6], [1, 6], [1, 6]]}

    def test_user_config_below_optimal(self):
        o = core.dice_optimal(self.USER)
        self.assertLess(o["current"]["score"], o["optimal"]["score"])
        self.assertEqual(o["settings"], {"herbie": 1, "rope": True, "buffer": 7, "initWip": 2, "dice": [[1, 6], [1, 4], [1, 6], [1, 6], [1, 6]]})

    def test_optimal_deterministic_and_seed_free(self):
        a = core.dice_optimal(self.USER, seeds=4, max_buffer=8, max_init=4)
        self.assertEqual(a, core.dice_optimal(dict(self.USER), seeds=4, max_buffer=8, max_init=4))
        self.assertEqual(a, core.dice_optimal(dict(self.USER, seed=99), seeds=4, max_buffer=8, max_init=4))

    def test_score_bounds(self):
        for seed in range(1, 30):
            for init in (0, 4, 20):
                s = core.dice_score(core.dice(dict(self.USER, seed=seed, initWip=init)))
                self.assertTrue(0 <= s["score"] <= 100, s)
                self.assertLessEqual(s["tPct"], 100)

    def test_die_1_1_edge(self):
        p = dict(self.USER, dice=[[1, 1]] + [[1, 6]] * 4)
        s = core.dice_score(core.dice(p))
        self.assertEqual((s["bound"], s["tPct"]), (20, 100))
        starved = core.dice_score(core.dice(dict(p, rope=True, buffer=0, initWip=0)))
        self.assertEqual(starved["score"], 0)

    def test_draining_start_wip_does_not_count(self):
        lo = core.dice_score(core.dice(dict(self.USER, initWip=0)))
        hi = core.dice_score(core.dice(dict(self.USER, initWip=20)))
        self.assertLessEqual(hi["net"], hi["bound"])
        self.assertLess(hi["iPct"], lo["iPct"])


class DiceHeadline(unittest.TestCase):
    """Invariant: optimal headline >= mine headline, both the mean score over seeds of rounds 1..upto."""

    def test_optimal_never_below_mine(self):
        from tests.dice_cases import headline_cases
        bad = []
        for c in headline_cases():
            o = core.dice_optimal(c["other"], seeds=c["seeds"], max_buffer=c["maxBuffer"], max_init=c["maxInit"])
            x = core.dice_headline(c["mine"], o, c["upto"])
            if x["optimal"]["score"] < x["mine"]["score"] or x["optimal"]["mean"] < x["mine"]["mean"]:
                bad.append((c, x))
        self.assertEqual(bad, [])

    def test_flow_optimal_ge_mine(self):
        from tests.compare_cases import flow_cases
        bad = []
        for c in flow_cases():
            o = core.flow_optimal(c["p"], seeds=c["seeds"], max_buffer=c["maxBuffer"], max_add=c["maxAdd"])
            x = core.flow_headline(c["p"], c["mine"], o, c["upto"])
            if x["mine"]["inBudget"] and x["optimal"]["net"] < x["mine"]["net"]:
                bad.append((c, x))
        self.assertEqual(bad, [])

    def test_buffer_optimal_ge_mine(self):
        # rank: target met first, then smaller buffer
        from tests.compare_cases import buffer_cases
        bad = []
        for c in buffer_cases():
            o = core.buffer_optimal(c["p"])
            x = core.buffer_headline(c["p"], c["mine"], o)
            if o["service"] < c["p"]["target"] - 1e-9 or (x["mine"]["met"] and o["buffer"] > c["mine"]):
                bad.append((c, x))
        self.assertEqual(bad, [])

    def test_flow_mine_optimal_default(self):
        p = {"stages": json.load(open(os.path.join(ROOT, "examples", "stages.json"))), "days": 30,
             "econ": {"tu": 100, "oe": 500, "ec": 60, "ic": 5, "budget": 300}}
        o = core.flow_optimal(p, seeds=3, max_buffer=12, max_add=5)
        self.assertTrue(core.flow_headline(p, o["settings"], o)["mineOptimal"])
        self.assertFalse(core.flow_headline(p, {}, o)["mineOptimal"])

    def test_user_case_balanced_line(self):
        # User: no slow station, start WIP 4, no rope, seed 7, r=20.
        p = {"stations": 5, "rounds": 20, "seed": 7, "initWip": 4, "rope": False, "buffer": 6, "dice": [[1, 6]] * 5}
        x = core.dice_headline(p, core.dice_optimal(p), 20)
        self.assertGreaterEqual(x["optimal"]["score"], x["mine"]["score"])
        self.assertEqual(x["mine"]["grade"], core.grade(x["mine"]["score"]))
        s = core.dice_score(core.dice(p))
        self.assertEqual(s["bound"], min(sum(r["rolls"][i] for r in core.dice(p)["rounds"]) for i in range(5)))

    def test_mine_optimal_tie(self):
        p = {"stations": 3, "rounds": 10, "seed": 1, "initWip": 2, "rope": False, "buffer": 6, "dice": [[1, 6]] * 3}
        o = core.dice_optimal(p, seeds=2, max_buffer=4, max_init=2)
        s = o["byRound"][-1]
        best = dict(p, rope=s["rope"], buffer=s["buffer"], initWip=s["initWip"])
        self.assertTrue(core.dice_headline(best, o, 10)["mineOptimal"])

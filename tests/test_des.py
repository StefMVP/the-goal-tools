import json
import math
import os
import sys
import unittest

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, ROOT)
from goal import des  # noqa: E402


def one(steps, arrivals, **kw):
    m = dict(kw, steps=steps, arrivals=arrivals)
    items, res, clock, names = des.run_once(m, m.get("seed", 1))
    return items, des.summarize(items, res, clock, names, m.get("census"))


class DES(unittest.TestCase):
    def test_mm1_matches_queue_theory(self):
        # lambda 1/d, mu 1.25/d: sojourn ~ exp(mean 4), median 4 ln 2
        m = {"seed": 3, "reps": 20, "arrivals": {"gap": {"exp": 1}, "count": 4000},
             "resources": {"s": {"cap": 1}}, "steps": [{"name": "a", "resource": "s", "work": {"exp": 0.8}}]}
        r = des.simulate(m)
        self.assertAlmostEqual(r["lead_median"]["p50"], 4 * math.log(2), delta=0.3)
        self.assertAlmostEqual(r["resources"]["s"]["util"]["p50"], 0.8, delta=0.03)

    def test_calendar(self):
        c = des.Calendar({"days": [0, 1, 2, 3, 4], "hours": [9, 17]})
        self.assertAlmostEqual(c.advance(0, 0), 9 / 24)
        self.assertAlmostEqual(c.advance(0.5, 1 / 3), 1.5)  # Mon 12:00 + 8 h -> Tue 12:00
        self.assertAlmostEqual(c.advance(4.7, 1 / 3), 7.7)  # Fri 16:48 + 8 h -> Mon 16:48
        self.assertAlmostEqual(c.open_days(0, 7), 5 / 3)

    def test_seeded(self):
        with open(os.path.join(ROOT, "examples/des/support-desk.json")) as f:
            m = json.load(f)
        self.assertEqual(des.simulate(m), des.simulate(m))
        m2 = dict(m, seed=2)
        self.assertNotEqual(des.simulate(m)["step_total"], des.simulate(m2)["step_total"])

    def test_gate_and_parallel(self):
        steps = [{"name": "a", "work": 1}, {"name": "b", "after": [], "work": 3},
                 {"name": "c", "after": ["a", "b"], "gate": {"period": 7, "at": [5]}}]
        items, s = one(steps, {"times": [0]})
        self.assertEqual(items[0]["done"], 5)  # waits for b (3), then gate at 5
        self.assertEqual(s["step_days"]["c"]["hold"], 2)
        self.assertEqual(s["to_end"], {"a": 1, "b": 3, "c": 5})
        self.assertEqual(s["reach"]["c"], 1)

    def test_limit_caps_wip(self):
        steps = [{"name": "ship", "limit": {"max": 2, "until": "install"}, "work": 1},
                 {"name": "install", "wait": 5}]
        items, s = one(steps, {"times": [0] * 6}, census=[3])
        self.assertEqual(sum(s["open_at"]["3"].values()), 6)
        self.assertLessEqual(s["open_at"]["3"]["install"] + s["open_at"]["3"]["ship"] - 4, 2)
        self.assertEqual(sorted(i["done"] for i in items), [6, 6, 12, 12, 18, 18])

    def test_fail_reworks(self):
        m = {"steps": [{"name": "a", "work": 1, "fail": {"p": 0.5, "extra": 2}}], "arrivals": {"times": [0] * 200}}
        items, res, clock, names = des.run_once(m, 5)
        fails = sum(i["steps"][0].get("fails", 0) for i in items)
        self.assertAlmostEqual(fails / 200, 1.0, delta=0.3)  # geometric: mean p/(1-p) = 1

    def test_stock(self):
        steps = [{"name": "ship", "take": "units", "work": 1}]
        m = {"steps": steps, "arrivals": {"times": [0, 0, 0]}, "stocks": {"units": {"initial": 1, "supply": [[5, 1], [9, 1]]}}}
        items, res, clock, names = des.run_once(m, 1)
        self.assertEqual([i["done"] for i in items], [1, 6, 10])
        s = des.summarize(items, res, clock, names)
        self.assertEqual(s["step_days"]["ship"]["hold"], 14)
        self.assertEqual(s["stocks"]["units"], {"left": 0, "waiting": 0})

    def test_horizon_cuts_open(self):
        items, s = one([{"name": "a", "work": 10}], {"times": [0, 1]}, horizon=5)
        self.assertEqual(s["done"], 0)
        self.assertEqual(s["step_total"]["a"], 9)


if __name__ == "__main__":
    unittest.main()

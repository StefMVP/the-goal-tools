#!/usr/bin/env python3
"""Write examples/orders.csv: synthetic order -> live process. Seeded; no real names."""
import os
import random
import sys
from datetime import datetime, timedelta

rng = random.Random(42)
STAGES = [  # stage, min days, max days, causes
    ("order", 0.2, 1.5, ["", "", "credit check"]),
    ("build", 1, 3, ["", "parts short"]),
    ("ship", 1, 4, ["", "", "carrier delay"]),
    ("install", 3, 14, ["tech capacity", "tech capacity", "customer reschedule", "site not ready"]),
    ("live", 0.5, 2, ["", "config error"]),
]
OWNERS = ["team-a", "team-b", "team-c"]
start = datetime(2026, 3, 2, 9, 0)
as_of = datetime(2026, 4, 20, 17, 0)
rows = [("id", "stage", "start", "end", "cause", "owner")]
for n in range(1, 41):
    t = start + timedelta(days=n * 1.4 + rng.random())
    for stage, lo, hi, causes in STAGES:
        d = timedelta(days=rng.uniform(lo, hi))
        end = t + d
        cause = rng.choice(causes)
        if end > as_of:
            rows.append(("W-%03d" % n, stage, t.strftime("%Y-%m-%dT%H:%M"), "", cause, rng.choice(OWNERS)))
            break
        rows.append(("W-%03d" % n, stage, t.strftime("%Y-%m-%dT%H:%M"), end.strftime("%Y-%m-%dT%H:%M"), cause, rng.choice(OWNERS)))
        t = end + timedelta(hours=rng.choice([0, 2, 6]))
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "examples", "orders.csv")
with open(sys.argv[1] if len(sys.argv) > 1 else out, "w") as f:
    for r in rows:
        f.write(",".join(r) + "\n")

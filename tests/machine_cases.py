"""Random Machines configs for the optimal-policy property test (Python) and parity vectors (JS)."""
import random

POLICY_OLD = ["scrapped", "spare", "only"]


def optimal_cases(n=200, seed=19):
    """Each case: a preset and overrides with random machine specs, plant and policy."""
    r = random.Random(seed)
    out = []
    for _ in range(n):
        over = {
            "old.count": r.randint(0, 5), "old.rate": r.randint(1, 60), "old.operators": r.randint(0, 4), "old.costHr": r.randint(0, 50),
            "old.setup": r.choice([0, 0.5, 1, 2]), "old.down": r.randint(0, 40),
            "new.rate": r.randint(1, 90), "new.operators": r.randint(0, 4), "new.costHr": r.randint(0, 80),
            "new.setup": r.choice([0, 0.5, 1, 2]), "new.down": r.randint(0, 40),
            "plant.hours": r.choice([8, 16, 24]), "plant.breakHr": r.choice([0, 0.5, 1, 1.5, 2, 3]), "plant.wage": r.randint(10, 40),
            "plant.demand": r.randint(0, 1200), "plant.other": r.randint(1, 80), "plant.tPerPart": r.randint(0, 120),
            "plant.material": r.randint(0, 60), "plant.oe": r.randint(0, 40000), "plant.position": r.choice(["after", "first"]),
            "policy.old": r.choice(POLICY_OLD), "policy.breaks": r.choice(["idle", "covered"]),
        }
        out.append({"preset": r.choice(["ncx10", "zmegma", "lunch", "robots"]), "over": over})
    return out

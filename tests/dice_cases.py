"""Random Dice configs for the headline property test (Python) and parity vectors (JS)."""
import random

SEARCH = {"seeds": 2, "maxBuffer": 4, "maxInit": 2}


def headline_cases(n=200, seed=42):
    """Each case: mine config, the config the cached optimum came from (other), and the current round."""
    r = random.Random(seed)

    def mine(st, rounds, dice):
        return {"stations": st, "rounds": rounds, "seed": r.randint(1, 50), "dice": dice, "rope": r.random() < 0.5,
                "buffer": r.randint(0, 40), "initWip": r.randint(0, 20)}

    out = []
    for _ in range(n):
        st, rounds, slow = r.randint(2, 6), r.randint(1, 20), r.random() < 0.6
        lo = r.randint(1, 6)
        hi, hp = r.randint(lo, 6), r.randrange(st)
        dice = [[lo, hi] if slow and i == hp else [1, 6] for i in range(st)]
        p = mine(st, rounds, dice)
        other = p if r.random() < 0.5 else mine(st, rounds, [[lo, hi] if slow and i == r.randrange(st) else [1, 6] for i in range(st)])
        out.append(dict(SEARCH, mine=p, other=other, upto=r.randint(1, rounds)))
    return out

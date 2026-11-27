#!/usr/bin/env python3
"""Fictional CRM pipeline (Northwind Analytics, B2B SaaS). Seeded synthetic data. Writes inputs/deals.csv."""
import csv, datetime as dt, pathlib, random

R = random.Random(42)
T0 = dt.datetime(2026, 8, 3, 9, 0)
AS_OF = dt.datetime(2026, 10, 30, 17, 0)
REPS = ['a.chen', 'm.okafor', 'j.ruiz', 's.patel', 'l.novak']
# stage, mean days, cause (when slow)
STAGES = [('lead', 1.5, 'no reply'), ('qualify', 2.5, 'no budget owner'), ('demo', 3.0, 'calendar'),
          ('security review', 0.0, 'SE capacity'), ('proposal', 2.0, 'pricing approval'),
          ('contract', 4.0, 'legal redlines'), ('onboard', 3.5, 'data import')]
SE_PER_DAY = 1.0  # security reviews the one solutions engineer can finish per day: the constraint

rows, se_free = [], T0
for n in range(1, 111):
    t = T0 + dt.timedelta(hours=n * 15 + R.uniform(0, 10))
    rep = R.choice(REPS)
    for stage, mean, cause in STAGES:
        if t > AS_OF:
            break
        if stage == 'security review':
            start = t
            begin = max(t, se_free)
            end = begin + dt.timedelta(days=R.uniform(0.45, 1.0) / SE_PER_DAY)
            se_free = end
            why = cause if (begin - t).days >= 2 else ''
        else:
            start = t + dt.timedelta(hours=R.uniform(1, 18))
            d = R.expovariate(1 / mean) + 0.2
            end = start + dt.timedelta(days=d)
            why = cause if d > mean * 1.8 else ''
        if start > AS_OF:
            break
        open_ = end > AS_OF
        rows.append([f'NW-{n:03d}', stage, start.strftime('%Y-%m-%dT%H:%M'),
                     '' if open_ else end.strftime('%Y-%m-%dT%H:%M'), why, rep])
        if open_:
            break
        t = end
        if stage == 'qualify' and R.random() < 0.18:  # disqualified: leaves the pipeline
            break

out = pathlib.Path(__file__).parent / 'inputs' / 'deals.csv'
with out.open('w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['id', 'stage', 'start', 'end', 'cause', 'owner'])
    w.writerows(rows)
print(out, len(rows))

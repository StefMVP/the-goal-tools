---
name: the-goal
description: Apply Theory of Constraints (The Goal by Eliyahu M. Goldratt) to a process or decision with the `goal` CLI and app - find the constraint in stage timestamps, run the dice game or five focusing steps, compare product mix, build evaporating clouds and reality trees. Use for bottleneck, throughput, WIP, constraint, TOC or The Goal questions.
---

# The Goal toolkit

CLI: `goal` (repo `bin/goal`, python3 stdlib). Output is JSON when piped or with `--json`.

## Find the constraint in real work

1. Export work items as CSV: `id,stage,start,end,cause,owner` (ISO times; empty `end` = open; `cause`, `owner` optional).
2. `goal analyze items.csv` gives the constraint stage, the Pareto by stage and cause with cumulative share, WIP aging and the median lead time. `--full` adds per-item lanes. `--as-of 2026-05-01` sets the clock for open items.
3. Show it: add `--show` (prints `url`) or `--shot out.png` (also saves a screenshot). `--unit deal` names the rows in the app.

## Prove it visually

The app shows the agent's result; the user explores, not types data.

- Add `--show` to `analyze`, `flow`, `mix`, `machines` or `sim dice`: the output gets `url`, the app view of that exact result. `analyze` saves the CSV in `local/runs/` (gitignored).
- `--shot out.png` does the same and saves a screenshot (playwright-cli). `goal shot URL|TAB[?QUERY] --out x.png [--width 390] [--full] [--public]` screenshots any view; `--public` hides private case tabs.
- Each claim to the user: the number, its comparator, the `url`, and the screenshot. Read the screenshot before you send it.

## Model a flow and the five focusing steps

`goal flow --stages stages.json` with `[{"name","cap","var","wip"}]` (`cap` = units/day, `var` = max daily loss 0..1). It returns T/day, WIP, lead time and the constraint for each step: identify, exploit, subordinate, elevate. `--step elevate --elevate 1.5` runs one step.

## Other commands

| command | result |
|---|---|
| `goal sim dice --seed 7 --slow 3 --rope --buffer 6` | dice game totals and score 0-100; `--full` gives every round |
| `goal sim dice --slow 1 --die 1-4 --optimal` | best Herbie position, rope, buffer, start WIP by mean score over seeds 1-20 |
| `goal flow --stages s.json --optimal [--exploit --rope --buffer N --add N]` | best exploit, rope buffer, +cap under `--budget` by mean net/day (seeds 1-20); mine vs optimal |
| `goal buffers dbr\|ccpm --tasks 1.5,1.5,1.5 --target 90 --mine 6` | smallest buffer that meets the target service level; mine vs optimal |
| `goal mix pq.json` | product mix: rank by margin/unit vs T per constraint minute |
| `goal machines --preset ncx10\|zmegma\|lunch\|robots [--set new.down=20]` | old machines vs new machine: cost per part vs plant T, I, OE; mine vs optimal policy (`--set policy.old=scrapped\|spare\|only`) |
| `goal des model.json [--reps 50]` | discrete-event flow: steps (after, gate, limit, wait, resource, work, fail), resources with calendars; lead time, step-days by hold/wait/queue/work, resource use (p10/p50/p90). Example: `examples/des/support-desk.json`; schema: `goal/des.py` |
| `goal cloud new` / `goal tree new crt\|frt\|prt\|tt` | example doc (JSON) |
| `goal tree validate doc.json` | exit 1 on unknown id, cycle, orphan, CRT without UDE |
| `goal tree render doc.json --format md\|svg` | Markdown or SVG |
| `goal chapters [--concept id]`, `goal concept id`, `goal search q` | book data |
| `goal open TAB [query]`, `goal serve` | app URL; local server |
| `goal shot TARGET --out x.png` | screenshot of an app view |
| `goal case list\|build NAME\|open NAME` | private case in `local/cases/NAME/` (gitignored); tab `#/case/NAME` |

Tabs: map, dice, flow, finder, tioe, buffers, machines. Tab inputs are in the URL hash, so a printed URL reopens the same view.

Tree DSL (also accepted by `validate` and `render`): `id: text [kind]` and `a + b -> c` (AND) or `a -> c`.

## Rules

- Report the constraint with its share of days and the comparator (for example "install: 50% of stage-days, next ship 18%").
- Data gaps (missing start or end) stop the analysis; fix the CSV, do not guess times.
- Use labels and numbers, not paragraphs.
- Private data goes in `local/cases/NAME/` (copy `examples/case-template/`), never in tracked files.

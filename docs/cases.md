# Case tabs

A private case lives in `local/cases/NAME/` (gitignored). Template: [examples/case-template](../examples/case-template/README.md).

## Subtabs

A case tab can have subtabs: `#/case/NAME/SUB?row=ID`. Code: [app/ui.js](../app/ui.js).

```js
var st = Goal.subtabs([{ id: 'goal', title: '1 Goal' }, { id: 'dbr', title: '2 DBR' }]);
el.appendChild(st.nav);           // subtab bar
if (st.id === 'goal') { ... }     // current subtab; default: first
```

- `#/case/NAME` opens the first subtab. An unknown subtab opens `#/case/NAME`.
- A subtab link drops the params. A row link keeps the subtab.
- Use one book tool per subtab. Top line: `Goal.bookRule`. Then the case data, then the decision.

## Book chips

| function | input | shows |
|---|---|---|
| `Goal.book(id, ch)` | concept id, chapter (optional) | chip `ch N · name`; a click opens the concept in the Map sidebar. No chapter: `TOC`. |
| `Goal.bookRule(text, ids)` | rule, concept ids or `[id, ch]` | one line: book rule + chips |

Concept ids: `#/map` or `data/concepts.json`. An unknown id shows a red chip; the check fails on it.

## Rows

Each case tab shows findings as rows. One row = one plain headline + one effect badge. Code: [app/rows.js](../app/rows.js).

```js
Goal.rows([
  { text: 'Do not hold boxes. Ship when the store orders.', verdict: 'stop',
    badge: { v: 12.4, better: 'down', conf: 'simulated' }, to: 'rope' }
], { unit: 'd to live', num: true })
```

| field | value |
|---|---|
| `text` | headline. ASD-STE100: short sentence, one idea, common words, active voice. No numbers that the badge shows. |
| `badge.v` | number (signed effect; unit added) or short text with its unit (shown as is) |
| `badge.unit` | unit. Default: section `unit`. One unit per section. |
| `badge.conf` | `measured` (fill), `estimated` (dotted), `simulated` (outline), `assumed` (dashed) |
| `badge.better` | `down` or `up`: which sign is better for the goal. Green = better, red = worse. |
| `badge.tone` | `good`, `bad` or `neutral`. Use for a level with no sign. |
| `verdict` | optional chip: `do`, `stop`, `test`, `no` |
| `id` | row id. Target of `to`. |
| `to` | id of the detail row that holds the numbers and proof |
| `cells` | detail columns: labels and numbers. `opt.head` gives the column labels. |

- A click on a row with `to` sets `#/case/NAME?row=ID`, scrolls to the detail row and marks it. Call `Goal.showRow(el)` at the end of `render` so a shared link opens at that row.
- `Goal.rowKey()` shows the badge key.
- A row with no headline, no badge, no unit or no confidence shows a red error badge.

## Check

`node tests/rows.js` renders each case tab and each subtab in `local/cases.js` in headless Chromium. It fails when a row has no headline or not exactly one badge with unit and confidence, on a render error, and on an unknown book concept. `scripts/test.sh` runs it.

## Charts

Code: [app/viz.js](../app/viz.js). HTML and CSS only. Data in, element out. A row with `id` is a link target for `to`.

| function | input | shows |
|---|---|---|
| `Goal.hero(items)` | `[{v, label, sub, tone}]` | big numbers, one-line labels |
| `Goal.shareBar(parts)` | `[{label, v, color}]` | one stacked bar, share of total |
| `Goal.pareto(rows, opt)` | `[{id, label, v, color, chip, cells, hi}]` | ranked rows, inline bar, share, cum. % |
| `Goal.swimlane(lanes, opt)` | `[{id, sub, segs: [{k, s, e, open}], live}]`, `opt.colors`, `opt.labels`, `opt.asOf` | one row per item, a segment per step, open = hatched |
| `Goal.beforeAfter(rows, opt)` | `[{id, label, before, after, verdict, conf}]` | grey bar now, color bar after, effect badge |
| `Goal.dots(rows)` | `[{label, a, b, lo, hi}]` | observed (dot) vs model (ring), model band |
| `Goal.steps(steps)` | `[{id, n, label, actor, where, v, vText, chip, con}]` | step boxes, median bar, failure chip |
| `Goal.spark(values)` | numbers | small trend line |
| `Goal.score(o)` | `{v, max, grade, label, gauges: [{k, label, level, v}]}`; `level`: `weak`, `fair`, `good` | score ring, grade, one small gauge per measure with its key number |
| `Goal.findings(list)` | `[{id, sev, text, ev, act, eff, book}]`; `sev`: `critical`, `high`, `medium`, `low` | one row per finding, ranked by severity: severity chip, headline, evidence badge, action, effect badge, book chip |
| `Goal.details(title, body, open)` | | collapsed section. Put tables here. |
| `Goal.tp.renderSvg(doc)` | cloud or tree doc (`goal cloud new`, `goal tree new crt`; DSL via `Goal.tp.parseDsl`) | Evaporating Cloud or tree as an SVG string. Code: [app/tp.js](../app/tp.js) |

`Goal.findings`: `ev` and `eff` are badges (same fields as `Goal.rows`). `text`: 2 short sentences, no number that `ev` shows. A wrong severity, level or badge shows a red error; `node tests/rows.js` fails on it.

Layout rule: charts, badges and short headlines on the page. Tables only in `Goal.details`.

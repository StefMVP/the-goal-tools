# Data schema

All files are UTF-8 JSON. Each top-level value is an object with one key that holds a list (`chapters`, `concepts`, `sources`, `books`, `tools`) or, for a diagram file, one diagram object.
Check: `python3 scripts/validate_data.py` (exit 0 = pass, 1 = fail).

## Common rules

- `id`: kebab-case, `^[a-z0-9]+(-[a-z0-9]+)*$`, unique in its file.
- Every reference must resolve: concept ids to `data/concepts.json`, source ids to `data/sources.json`, tool ids to `data/tools.json`, diagram ids to `data/diagrams/<id>.json`, chapter numbers to `data/chapters.json`.
- Text is paraphrase. No copied book text. A quote is max one short line (≤ 15 words) and has a `refs` entry.
- Facts trace to a source id in `refs`.

## data/chapters.json

```json
{"edition": {"basis": "string", "chapter_count": 40, "notes": ["string"], "refs": ["source-id"]},
 "chapters": [Chapter]}
```

Chapter:

| key | type | rule |
|---|---|---|
| `n` | int | 1..chapter_count, unique, no gaps |
| `title` | string | own words, ≤ 8 words |
| `concepts` | [concept-id] | ≥ 1 |
| `events_as_mechanism` | [string] | ≥ 1; system behavior the plot shows |
| `jonah_questions` | [string] | paraphrased; may be empty |
| `measures_touched` | [`"T"`\|`"I"`\|`"OE"`] | unique |
| `diagram` | diagram-id \| null | |
| `refs` | [source-id] | ≥ 1 |

## data/concepts.json

```json
{"concepts": [Concept]}
```

| key | type | rule |
|---|---|---|
| `id` | string | kebab-case |
| `name` | string | |
| `group` | enum | `goal-measures`, `flow-physics`, `constraint-mgmt`, `scheduling`, `thinking-processes`, `change`, `later-toc`, `adjacent` |
| `one_line` | string | ≤ 15 words |
| `chapters` | [int] | chapter numbers (derived from `chapters.json`); empty only for `thinking-processes`, `later-toc` and `adjacent` |
| `related` | [concept-id] | not self |
| `formula` | string \| null | formula or rule |
| `misconceptions` | [string] | |
| `how_to_apply` | [string] | 1..3 steps |
| `tools` | [tool-id] | |
| `refs` | [source-id] | ≥ 1 |

## data/tools.json

Tools the app can build. A tool is a calculator, simulator, template or checklist.

```json
{"tools": [Tool]}
```

| key | type | rule |
|---|---|---|
| `id` | string | kebab-case |
| `name` | string | |
| `kind` | enum | `simulator`, `calculator`, `template`, `checklist`, `board` |
| `purpose` | string | ≤ 20 words |
| `inputs` | [string] | |
| `outputs` | [string] | |
| `logic` | string | rule or algorithm the app implements |
| `concepts` | [concept-id] | ≥ 1 |
| `priority` | int | 1 (build first) .. 3 |
| `reuse` | [source-id] | open-source code or method to reuse; may be empty |
| `refs` | [source-id] | ≥ 1 |

## data/sources.json

```json
{"sources": [Source]}
```

| key | type | rule |
|---|---|---|
| `id` | string | kebab-case |
| `title` | string | |
| `author` | string | |
| `year` | int \| null | |
| `url` | string \| null | `http(s)://` |
| `type` | enum | `book`, `paper`, `web`, `repo`, `video`, `image`, `org`, `summary` |
| `license` | string | SPDX id, `CC-BY-4.0` etc., `copyright` or `unknown` |
| `adds` | string | what this source adds |

`type: image` with `license` not `CC*`/`public-domain`: link only, no file in `assets/`.

## data/books.json

```json
{"books": [Book]}
```

| key | type | rule |
|---|---|---|
| `id` | string | kebab-case |
| `title` | string | |
| `author` | string | |
| `year` | int | first edition |
| `level` | 1 \| 2 | 1 = Goldratt/TOC canon; 2 = adjacent field |
| `key_concepts` | [string] | |
| `concepts` | [concept-id] | links to The Goal concepts |
| `link_to_goal` | string | ≤ 30 words |
| `tools` | [{`tool`: tool-id, `rank`: int, `why`: string}] | rank 1 = highest value for own work |
| `refs` | [source-id] | ≥ 1 |

## data/diagrams/&lt;id&gt;.json

File name = `id` + `.json`.

| key | type | rule |
|---|---|---|
| `id` | string | kebab-case |
| `title` | string | |
| `kind` | enum | `flow`, `tree`, `cloud`, `loop`, `series`, `triangle` |
| `concepts` | [concept-id] | ≥ 1 |
| `chapters` | [int] | |
| `nodes` | [{`id`, `label`, `type`?, `x`?, `y`?}] | required for all kinds except `series` |
| `edges` | [{`from`, `to`, `label`?, `type`?}] | `from`/`to` = node ids |
| `series` | [{`name`, `points`: [[x, y]]}] | required for `series` |
| `axes` | {`x`, `y`} | required for `series` |
| `notes` | [string] | how to read it |
| `asset` | string \| null | path in `assets/` of an original SVG |
| `refs` | [source-id] | ≥ 1 |

Tree edge `type`: `cause` (from cause to effect), `and` (AND-connector group, shares `group` key), `necessary` (EC/PRT: from requirement to objective), `conflict`, `injection`.

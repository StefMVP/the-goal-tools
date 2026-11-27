# AGENTS.md

- App: `app/index.html` (vanilla JS, no build, no CDN). Opens from `file://` and `bin/goal serve`.
- Shared math: `app/core.js` and `goal/core.py` must agree. After a change to either, run `python3 scripts/make-vectors.py` only when the change is intended, then `scripts/test.sh`.
- Cloud and tree docs: `app/tp.js` (`Goal.tp`, for case tabs) and `goal/tp.py` (`goal cloud`, `goal tree`) must agree; `tests/test_tp.py` checks parity.
- Data: `data/` (schema: `docs/data-schema.md`, check: `scripts/validate_data.py`). After a data change run `python3 scripts/build-data.py` (writes `app/data.js`).
- Private cases: `local/` (gitignored). `local/cases/NAME/` holds data, `build.sh`, `tab.js`; `bin/goal case list|build NAME|open NAME`. Template: `examples/case-template/`. Never commit case data.
- Git: stage explicit paths (`git add <paths>`), never `git add -A` or `git add .`.
- CLI: `bin/goal --help`. Skill: `skills/the-goal/SKILL.md`.
- Tests: `scripts/test.sh` (local only; no GitHub Actions).
- The app is agent-first: the agent runs the CLI with `--show`/`--shot`, the user opens the link and explores. Inputs go in `Goal.drawer`, never above the result.
- Page layout: `Goal.verdict` (question, verdict, 3-4 numbers, next step + book chip), then `Goal.proofs` cards, then `Goal.drawer`. Red (`Goal.CON`) = the constraint only; other stages `Goal.GRAY`; green = better.
- Text in the app: labels and numbers, ASD-STE100. At most one short sentence per element. No explanatory paragraphs. `scripts/ui-check.py` fails on cut labels, a missing verdict and long text.
- URL state: every tab keeps its inputs in `#/tab?params`.

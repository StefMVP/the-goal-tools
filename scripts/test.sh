#!/usr/bin/env bash
# Local test suite (no CI). Exit non-zero on any failure.
set -euo pipefail
cd "$(dirname "$0")/.."
for f in app/*.js app/tabs/*.js examples/case-template/tab.js; do node --check "$f"; done
python3 scripts/build-data.py --check
python3 scripts/validate_data.py
python3 -m unittest discover -s tests -t . -q
node tests/parity.js
node tests/terms.js
node tests/rows.js
if command -v playwright-cli >/dev/null; then scripts/ui-check.py; else echo "ui-check: skipped (no playwright-cli)"; fi
if command -v skill-check >/dev/null; then skill-check skills/the-goal/SKILL.md; fi
echo "all checks passed"

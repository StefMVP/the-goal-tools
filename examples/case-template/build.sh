#!/usr/bin/env bash
# Template case: inputs/items.csv -> data.js (goal analyze). Synthetic data.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
name="$(basename "$here")"
goal="$here/../../../bin/goal"
as_of="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["as_of"])' "$here/case.json")"
mkdir -p "$here/derived"
"$goal" --json analyze "$here/inputs/items.csv" --as-of "$as_of" > "$here/derived/analyze.json"
python3 - "$here" "$name" <<'PY'
import json, pathlib, sys
d = pathlib.Path(sys.argv[1])
case = json.loads((d / 'case.json').read_text())
case['analyze'] = json.loads((d / 'derived' / 'analyze.json').read_text())
(d / 'data.js').write_text('/* Built by build.sh. Do not edit. */\n(window.GOAL_CASE_DATA = window.GOAL_CASE_DATA || {})[%s] = %s;\n'
                           % (json.dumps(sys.argv[2]), json.dumps(case, sort_keys=True, separators=(',', ':'))))
PY

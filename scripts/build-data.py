#!/usr/bin/env python3
"""Bundle data/*.json and examples/*.csv into app/data.js for file:// use. --check: exit 1 when stale."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from goal.data import ROOT, bundle_js  # noqa: E402

path = os.path.join(ROOT, "app", "data.js")
if "--check" in sys.argv:
    ok = os.path.exists(path) and open(path).read() == bundle_js()
    print("data.js " + ("up to date" if ok else "stale: run scripts/build-data.py"))
    sys.exit(0 if ok else 1)
open(path, "w").write(bundle_js())
print(path)

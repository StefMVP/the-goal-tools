import json
import os
import re
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from goal import tp  # noqa: E402

GOAL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "bin", "goal")


def errors(doc):
    return [v for v in tp.validate(doc) if v["level"] == "error"]


class TP(unittest.TestCase):
    def test_examples_clean(self):
        for k in ["cloud", "crt", "frt", "prt", "tt"]:
            self.assertEqual(tp.validate(tp.new_doc(k)), [], k)

    def test_cycle_and_unknown(self):
        d = {"type": "crt", "title": "x"}
        d.update(tp.parse_dsl("a: A [ude]\nb: B\na -> b\nb -> a\n"))
        self.assertIn("cycle", [e["msg"] for e in errors(d)])
        d = {"type": "frt", "title": "x"}
        d.update(tp.parse_dsl("a: A [de]\na + zz -> a\n"))
        self.assertIn("unknown id: zz", [e["msg"] for e in errors(d)])
        self.assertIn("no UDE", [e["msg"] for e in errors({"type": "crt", "nodes": [], "links": []})])

    def test_dsl_roundtrip(self):
        d = tp.new_doc("crt")
        p = tp.parse_dsl(tp.to_dsl(d))
        self.assertEqual(p["nodes"], d["nodes"])
        self.assertEqual(p["links"], d["links"])

    def test_render(self):
        for k in ["cloud", "crt", "tt"]:
            self.assertTrue(tp.render_svg(tp.new_doc(k)).startswith("<svg"))
            self.assertTrue(tp.render_md(tp.new_doc(k)).startswith("# "))

    def test_cli(self):
        def run(*a):
            return subprocess.run([sys.executable, GOAL] + list(a), capture_output=True, text=True)
        for cmd in (["cloud", "new"], ["tree", "new", "crt"], ["tree", "new", "tt"]):
            r = run(*cmd)
            self.assertEqual(r.returncode, 0, r.stderr)
            with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
                f.write(r.stdout)
            try:
                self.assertEqual(run(cmd[0], "validate", f.name).returncode, 0, cmd)
                self.assertTrue(run(cmd[0], "render", f.name, "--format", "svg").stdout.startswith("<svg"), cmd)
                self.assertTrue(run(cmd[0], "render", f.name).stdout.startswith("# "), cmd)
            finally:
                os.unlink(f.name)
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump({"type": "crt", "title": "x", "nodes": [], "links": []}, f)
        try:
            self.assertEqual(run("tree", "validate", f.name).returncode, 1)
        finally:
            os.unlink(f.name)

    def test_js_parity(self):
        """app/tp.js (case tabs) and goal/tp.py give the same docs, Markdown, SVG and issues."""
        r = subprocess.run(["node", os.path.join(os.path.dirname(GOAL), "..", "tests", "tp_js.js")],
                           capture_output=True, text=True, check=True)
        for k, v in json.loads(r.stdout).items():
            d = tp.new_doc(k)
            self.assertEqual(v["doc"], json.loads(json.dumps(d)), k)
            self.assertEqual(v["md"], tp.render_md(d), k)
            self.assertEqual(v["issues"], tp.validate(d), k)
            self.assertEqual(re.sub(r' width="100%" style="[^"]*"', "", v["svg"], count=1), tp.render_svg(d), k)


if __name__ == "__main__":
    unittest.main()

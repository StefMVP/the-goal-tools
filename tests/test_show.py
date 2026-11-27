"""--show: each command prints an app URL; analyze saves its CSV as a run the app can load."""
import json
import os
import subprocess
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GOAL = os.path.join(ROOT, "bin", "goal")
EX = os.path.join(ROOT, "examples")


def goal(*args):
    r = subprocess.run([GOAL, "--json", "--show"] + list(args), capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


class Show(unittest.TestCase):
    def test_analyze_saves_run(self):
        r = goal("analyze", os.path.join(EX, "orders.csv"), "--unit", "order")
        self.assertIn("#/finder?run=", r["url"])
        rid = r["url"].split("run=")[1].split("&")[0]
        path = os.path.join(ROOT, "local", "runs", rid + ".json")
        run = json.load(open(path))
        self.assertEqual(run["csv"], open(os.path.join(EX, "orders.csv")).read())
        self.assertEqual(run["unit"], "order")
        self.assertIn(json.dumps(rid), open(os.path.join(ROOT, "local", "runs.js")).read())

    def test_links(self):
        self.assertIn("#/tioe?m=", goal("mix", os.path.join(EX, "pq.json"))["url"])
        self.assertIn("#/flow?st=", goal("flow", "--stages", os.path.join(EX, "stages.json"))["url"])
        self.assertIn("slow=1&hp=3", goal("sim", "dice", "--slow", "3")["url"])
        self.assertIn("#/machines?preset=ncx10", goal("machines", "--preset", "ncx10")["url"])

    def test_enc_matches_app(self):
        """bin/goal enc() and Goal.enc in app/ui.js give the same string (URL state)."""
        obj = {"name": "Qualify · é", "cap": 14, "var": 0.3}
        url = goal("mix", os.path.join(EX, "pq.json"))["url"]
        self.assertTrue(url)
        js = ("var g={};g.enc=function(obj){var b=Buffer.from(JSON.stringify(obj),'utf8').toString('base64');"
              "return b.replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');};process.stdout.write(g.enc(%s))" % json.dumps(obj))
        want = subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout
        import importlib.machinery, importlib.util
        spec = importlib.util.spec_from_loader("goalcli", importlib.machinery.SourceFileLoader("goalcli", GOAL))
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        self.assertEqual(m.enc(obj), want)


if __name__ == "__main__":
    unittest.main()

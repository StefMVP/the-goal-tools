#!/usr/bin/env python3
"""UI check: open each app view in headless Chromium (playwright-cli) at 1440 and 390 px and fail on
render errors, a missing verdict, cut-off inputs, clipped chart labels and long paragraphs.
Usage: scripts/ui-check.py [--width 1440,390] [VIEW ...]   (VIEW = TAB[?QUERY])"""
import functools
import http.server
import importlib.machinery
import importlib.util
import json
import os
import subprocess
import sys
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_loader("goalcli", importlib.machinery.SourceFileLoader("goalcli", os.path.join(ROOT, "bin", "goal")))
G = importlib.util.module_from_spec(spec)
spec.loader.exec_module(G)

EX = os.path.join(ROOT, "examples", "demo-crm")
VERDICT = {"finder", "flow", "tioe", "machines", "buffers", "dice"}
MAX_WORDS = 32

CHECK = r"""() => {
  const out = [], vis = el => el.offsetParent !== null && !el.closest('details:not([open])');
  const v = document.getElementById('view');
  const err = v.querySelector(':scope > pre');
  if (err) out.push('render error: ' + err.textContent.slice(0, 160));
  out.push('#verdicts ' + v.querySelectorAll('[data-verdict]').length);
  v.querySelectorAll('input[type=text],input:not([type])').forEach(el => {
    if (vis(el) && el.value && el.scrollWidth > el.clientWidth + 2) out.push('cut input: ' + el.value);
  });
  v.querySelectorAll('svg text').forEach(t => {
    const s = t.ownerSVGElement; if (!s || !vis(s) || !t.textContent.trim()) return;
    const a = t.getBoundingClientRect(), b = s.getBoundingClientRect();
    if (a.width && (a.left < b.left - 1 || a.right > b.right + 1 || a.top < b.top - 2 || a.bottom > b.bottom + 2)) out.push('clipped label: ' + t.textContent.trim().slice(0, 40));
  });
  v.querySelectorAll('svg').forEach(s => {
    if (!vis(s)) return;
    const r = [...s.querySelectorAll('text')].filter(t => t.textContent.trim()).map(t => [t, t.getBoundingClientRect()]).filter(x => x[1].width);
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
      const a = r[i][1], b = r[j][1], w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 2 && h > 3) out.push('overlap: ' + r[i][0].textContent.trim().slice(0, 24) + ' / ' + r[j][0].textContent.trim().slice(0, 24));
    }
  });
  if (document.scrollingElement.scrollWidth > innerWidth + 1) out.push('page scrolls sideways: ' + document.scrollingElement.scrollWidth + ' px');
  const walk = document.createTreeWalker(v, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) {
    const w = n.textContent.trim().split(/\s+/).filter(Boolean).length;
    if (w > %d && vis(n.parentElement)) out.push('long text (' + w + ' words): ' + n.textContent.trim().slice(0, 60));
  }
  return JSON.stringify(out);
}""" % MAX_WORDS


def views():
    st = json.load(open(os.path.join(EX, "stages.json")))
    m = json.load(open(os.path.join(EX, "plans.json")))
    rid = G.write_run({"tab": "finder", "name": "deals.csv", "csv": open(os.path.join(EX, "inputs", "deals.csv")).read(),
                       "asOf": "2026-10-30T17:00", "unit": "deal"})
    return ["finder?run=" + rid, "finder", "flow?st=" + G.enc(st), "tioe?m=" + G.enc(m), "tioe",
            "machines", "machines?preset=ncx10", "buffers", "buffers?v=cc", "dice?slow=1&hp=3&rope=1", "map"]


def main():
    args = sys.argv[1:]
    widths = [1440, 390]
    if args[:1] == ["--width"]:
        widths = [int(x) for x in args[1].split(",")]
        args = args[2:]
    todo = args or views()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(G.handler(True), directory=ROOT))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d/app/index.html#/" % srv.server_address[1]
    ses = "goal-ui-check-%d" % os.getpid()
    pw = lambda *a: subprocess.run(["playwright-cli", "-s=" + ses] + list(a), capture_output=True, text=True)
    bad = 0
    try:
        if pw("open", "about:blank", "--browser=chromium").returncode:
            sys.exit("ui-check: playwright-cli could not open a browser")
        for w in widths:
            pw("resize", str(w), "900")
            for v in todo:
                pw("goto", base + v)
                pw("eval", "() => new Promise(r => setTimeout(() => r(1), 400))")
                r = pw("eval", CHECK)
                txt = r.stdout.split("### Result", 1)[-1].strip().split("\n", 1)[0]
                try:
                    issues = json.loads(json.loads(txt))
                except ValueError:
                    issues = ["could not read check result: " + (r.stdout + r.stderr)[:200]]
                nv = [int(x.split()[1]) for x in issues if x.startswith("#verdicts ")]
                issues = [x for x in issues if not x.startswith("#verdicts ")]
                tab = v.split("?")[0]
                if tab in VERDICT and nv and nv[0] != 1:
                    issues.append("verdicts: %d (want 1)" % nv[0])
                seen = set()
                for i in issues:
                    if i not in seen:
                        seen.add(i)
                        print("%4d  %-28s %s" % (w, v[:28], i))
                bad += len(seen)
    finally:
        pw("close")
        srv.shutdown()
    print("ui-check: %d issue(s)" % bad)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()

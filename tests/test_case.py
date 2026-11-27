"""Private cases: goal case build/list and the serve fallback for a missing local/cases.js."""
import json, os, pathlib, shutil, subprocess, sys, tempfile, unittest, urllib.request

REPO = pathlib.Path(__file__).resolve().parents[1]


class CaseTest(unittest.TestCase):
    def setUp(self):
        self.root = pathlib.Path(tempfile.mkdtemp())
        for d in ('bin', 'goal', 'app', 'data', 'examples'):
            if (REPO / d).exists():
                shutil.copytree(REPO / d, self.root / d, ignore=shutil.ignore_patterns('__pycache__'))
        self.goal = [sys.executable, str(self.root / 'bin' / 'goal'), '--json']

    def tearDown(self):
        shutil.rmtree(self.root)

    def run_goal(self, *a):
        return subprocess.run(self.goal + list(a), capture_output=True, text=True)

    def test_no_local(self):
        r = self.run_goal('case', 'list')
        self.assertEqual(json.loads(r.stdout)['cases'], [])
        self.assertNotEqual(self.run_goal('case', 'build', 'x').returncode, 0)

    def test_template_build(self):
        shutil.copytree(self.root / 'examples' / 'case-template', self.root / 'local' / 'cases' / 'acme')
        r = self.run_goal('case', 'build', 'acme')
        self.assertEqual(r.returncode, 0, r.stderr)
        js = (self.root / 'local' / 'cases.js').read_text()
        self.assertIn('window.GOAL_CASE_NAME = "acme";', js)
        self.assertIn('"constraint":{"days"', js)
        if shutil.which('node'):
            subprocess.run(['node', '--check', str(self.root / 'local' / 'cases.js')], check=True)
            subprocess.run(['node', str(REPO / 'tests' / 'rows.js'), str(self.root)], check=True, capture_output=True)
        self.assertTrue(self.run_goal('case', 'open', 'acme').stdout.strip().endswith('#/case/acme'))

    def test_serve_missing_cases_js(self):
        p = subprocess.Popen([sys.executable, str(self.root / 'bin' / 'goal'), 'serve'], stdout=subprocess.PIPE, text=True)
        try:
            base = p.stdout.readline().split('/app/')[0]
            with urllib.request.urlopen(base + '/local/cases.js') as r:
                self.assertEqual((r.status, r.read()), (200, b''))
            with urllib.request.urlopen(base + '/app/index.html') as r:
                self.assertIn(b'../local/cases.js', r.read())
            (self.root / 'local' / 'cases').mkdir(parents=True)
            (self.root / 'local' / 'cases' / 'secret.txt').write_text('x')
            for path in ('/local/cases/secret.txt', '/app/../local/cases/secret.txt', '/app/%2e%2e/local/cases/secret.txt', '/bin/goal'):
                with self.assertRaises(urllib.error.HTTPError, msg=path) as e:
                    urllib.request.urlopen(base + path)
                self.assertEqual(e.exception.code, 404, path)
                e.exception.close()
        finally:
            p.terminate(); p.wait(); p.stdout.close()


if __name__ == '__main__':
    unittest.main()

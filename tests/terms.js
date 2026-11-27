/* Term help test: every data-term id resolves to text. Run: node tests/terms.js
   1. Static: every literal id in Goal.term('id') / T('id') / 'data-term': 'id' in app/.
   2. DOM: each tab rendered in headless Chromium; every data-term in the DOM (skipped if no Chromium). */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.join(__dirname, '..'), app = path.join(root, 'app');
const TERMS = require(path.join(app, 'terms.js'));
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(app, 'data.js'), 'utf8'), ctx);
const concepts = {};
(ctx.window.GOAL_DATA.concepts || []).forEach(c => { concepts[c.id] = c; });
const words = s => s.trim().split(/\s+/).length;
let fail = 0;
function bad(msg) { fail++; console.log('FAIL', msg); }
function resolve(id) {
  const t = TERMS[id] || (concepts[id] ? { c: id } : null);
  if (!t) return 'no entry in app/terms.js and no concept with this id';
  if (t.c && !concepts[t.c]) return 'concept ' + t.c + ' not in data';
  const text = t.t || (t.c && concepts[t.c].one_line);
  return text ? null : 'no text';
}
/* Entries: own text is one short sentence. */
Object.keys(TERMS).forEach(id => {
  const e = resolve(id);
  if (e) bad(id + ': ' + e);
  const t = TERMS[id];
  [t.t].concat(Object.values(t.tab || {})).filter(Boolean).forEach(s => { if (words(s) > 22) bad(id + ': over 22 words: ' + s); });
});
/* Static ids in source. */
const files = ['ui.js'].concat(fs.readdirSync(path.join(app, 'tabs')).map(f => 'tabs/' + f)).filter(f => f.endsWith('.js'));
const used = {};
const re = /(?:Goal\.term|\bTm?)\(\s*'([^']+)'|'data-term':\s*'([^']+)'/g;
files.forEach(f => {
  const src = fs.readFileSync(path.join(app, f), 'utf8');
  let m;
  while ((m = re.exec(src))) used[m[1] || m[2]] = f;
});
Object.keys(used).forEach(id => { const e = resolve(id); if (e) bad(used[id] + ': ' + id + ': ' + e); });
console.log(Object.keys(used).length + ' literal term ids in source');
/* DOM ids per tab. */
const chrome = ['chromium', 'google-chrome-stable', 'google-chrome'].find(b => { try { cp.execFileSync('which', [b], { stdio: 'ignore' }); return true; } catch (e) { return false; } });
const routes = process.env.TERMS_ROUTES ? process.env.TERMS_ROUTES.split(',') :
  ['dice?slow=1&rope=1', 'flow', 'finder', 'tioe', 'buffers', 'machines']
    .concat(cases());
/* Private case tabs: names from local/cases.js (gitignored, optional). */
function cases() {
  const f = path.join(app, '..', 'local', 'cases.js');
  if (!fs.existsSync(f)) return [];
  return [...fs.readFileSync(f, 'utf8').matchAll(/^window\.GOAL_CASE_NAME = "([^"]+)";$/gm)].map(m => 'case/' + m[1]);
}
if (!chrome) console.log('skip DOM check: no Chromium');
else {
  let n = 0;
  routes.forEach(r => {
    const url = 'file://' + path.join(app, 'index.html') + '#/' + r;
    let dom = '';
    try {
      dom = cp.execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--virtual-time-budget=2000', '--dump-dom', url], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 });
    } catch (e) { bad(r + ': Chromium failed: ' + e.message); return; }
    const ids = new Set();
    for (const m of dom.matchAll(/data-term="([^"]+)"/g)) ids.add(m[1]);
    if (!ids.size && !r.startsWith('case/')) bad(r + ': no data-term in DOM');
    ids.forEach(id => { const e = resolve(id); if (e) bad(r + ': ' + id + ': ' + e); });
    n += ids.size;
  });
  console.log(n + ' DOM term ids in ' + routes.length + ' tab views');
}
console.log(fail ? fail + ' term failures' : 'all term ids resolve');
process.exit(fail ? 1 : 0);

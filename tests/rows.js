/* Case rows test. Run: node tests/rows.js [ROOT]
   1. Goal.rowErrors: good rows pass, bad rows fail.
   2. DOM: each case tab in ROOT/local/cases.js rendered in headless Chromium. Each .crow has a headline and
      one badge with unit and confidence; a number badge shows its unit (skipped if no Chromium or no cases).
      Each subtab (#/case/NAME/SUB) is checked: no render error, no unknown book concept, no finding (Goal.findings) or gauge with an error. */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..')), app = path.join(root, 'app');
let fail = 0;
function bad(msg) { fail++; console.log('FAIL', msg); }

const ctx = { window: { Goal: { fmt: v => v } } };
vm.runInNewContext(fs.readFileSync(path.join(app, 'rows.js'), 'utf8'), ctx);
const E = ctx.window.Goal.rowErrors;
const ok = { text: 'Ship when the store orders.', badge: { v: -1.5, unit: 'd to live', better: 'down', conf: 'simulated' } };
[[ok, null], [{ ...ok, verdict: 'do' }, 'd to live'], [{ text: 'x', badge: { v: '8 of 32', unit: 'boxes', conf: 'measured' } }, null],
 [{ text: 'x', badge: { v: 3, conf: 'assumed', tone: 'bad' } }, 'd']]
  .forEach(([r, u], i) => { const e = E(r, u); if (e.length) bad('good row ' + i + ': ' + e.join('; ')); });
[[{ text: 'x' }, null, 'no badge'], [{ badge: ok.badge }, null, 'no headline'], [{ text: 'x', badge: { v: 1, better: 'up', conf: 'measured' } }, null, 'no unit'],
 [{ text: 'x', badge: { ...ok.badge, conf: 'sure' } }, null, 'confidence'], [{ text: 'x', badge: { v: 1, unit: 'd', conf: 'measured' } }, null, 'better'],
 [{ text: 'x', badge: [ok.badge, ok.badge] }, null, 'no badge'], [{ ...ok, verdict: 'maybe' }, null, 'verdict'], [ok, 'store-days', 'section unit']]
  .forEach(([r, u, want], i) => { const e = E(r, u).join('; '); if (e.indexOf(want) < 0) bad('bad row ' + i + ': want "' + want + '", got "' + e + '"'); });

const chrome = ['chromium', 'google-chrome-stable', 'google-chrome'].find(b => { try { cp.execFileSync('which', [b], { stdio: 'ignore' }); return true; } catch (e) { return false; } });
const f = path.join(root, 'local', 'cases.js');
const names = fs.existsSync(f) ? [...fs.readFileSync(f, 'utf8').matchAll(/^window\.GOAL_CASE_NAME = "([^"]+)";$/gm)].map(m => m[1]) : [];
if (!chrome || !names.length) console.log('skip DOM check: ' + (chrome ? 'no cases' : 'no Chromium'));
else names.forEach(n => {
  const dump = sub => {
    const url = 'file://' + path.join(app, 'index.html') + '#/case/' + n + (sub ? '/' + sub : '');
    try {
      return cp.execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--virtual-time-budget=2000', '--dump-dom', url], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 });
    } catch (e) { bad(n + (sub ? '/' + sub : '') + ': Chromium failed: ' + e.message); return null; }
  };
  const first = dump('');
  if (first === null) return;
  /* Subtabs: #/case/NAME/SUB. Check each one. */
  const subs = [...first.matchAll(/<a [^>]*data-sub="([^"]+)"/g)].map(m => m[1]);
  let total = 0;
  (subs.length ? subs : ['']).forEach((sub, k) => {
    const dom = k ? dump(sub) : first, tag = n + (sub ? '/' + sub : '');
    if (dom === null) return;
    if (/<pre style="color:#d33b2c">/.test(dom)) bad(tag + ': render error');
    [...dom.matchAll(/<span class="bchip err" data-concept="([^"]*)"/g)].forEach(m => bad(tag + ': unknown book concept ' + m[1]));
    [...dom.matchAll(/<div class="(?:frow|gauge)[^"]*"[^>]*data-err="([^"]*)"/g)].forEach(m => bad(tag + ': finding or gauge: ' + m[1]));
    const rows = [...dom.matchAll(/<tr class="crow[^"]*"([^>]*)>([\s\S]*?)<\/tr>/g)];
    if (!sub && !rows.length) bad(tag + ': no case rows');
    rows.forEach((m, i) => {
      const err = /data-err="([^"]*)"/.exec(m[1]);
      const head = /<td class="crow-h">([\s\S]*?)<\/td>/.exec(m[2]);
      const badges = [...m[2].matchAll(/<span class="bdg [^"]*" data-conf="(measured|estimated|simulated|assumed)" data-unit="[^"]+"/g)];
      const bare = [...m[2].matchAll(/<span class="bdg [^>]*>([^<]*)<\/span>/g)].map(x => x[1]).filter(t => /^[+\u2212-]?[\d.]+$/.test(t.trim()));
      const where = tag + ' row ' + (i + 1) + ' ' + (head ? head[1].replace(/<[^>]+>/g, '').trim().slice(0, 50) : '');
      if (err) bad(where + ': ' + err[1]);
      else if (!head || !head[1].replace(/<[^>]+>/g, '').trim()) bad(where + ': no headline');
      else if (badges.length !== 1) bad(where + ': ' + badges.length + ' badges');
      else if (bare.length) bad(where + ': badge shows no unit: ' + bare[0]);
    });
    total += rows.length;
  });
  console.log(n + ': ' + total + ' case rows' + (subs.length ? ' in ' + subs.length + ' subtabs' : ''));
});
console.log(fail ? fail + ' failures' : 'all case rows have a headline and one badge');
process.exit(fail ? 1 : 0);

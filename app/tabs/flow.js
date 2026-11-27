/* Flow lab: own stages; Mine (five focusing steps actions) | Best for the same stages and economics.
   URL: #/flow?st=&days=&seed=&d=&tu=&oe=&ec=&ic=&bud=&ex=&rope=&buf=&add=&pb=&tb=&setup= */
(function () {
  var h = Goal.h, T = Goal.term;
  var DEF = [
    { name: 'Intake', cap: 12, 'var': 0.3, wip: 0 }, { name: 'Design', cap: 8, 'var': 0.2, wip: 0 },
    { name: 'Build', cap: 6, 'var': 0.5, wip: 0 }, { name: 'Review', cap: 9, 'var': 0.3, wip: 0 },
    { name: 'Release', cap: 14, 'var': 0.2, wip: 0 }];
  /* Five focusing steps as presets for Mine. */
  var STEPS = [
    ['identify', 'Identify', { ex: null, rope: null, add: 0 }],
    ['exploit', 'Exploit', { ex: 1, rope: null, add: 0 }],
    ['subordinate', 'Subordinate', { ex: 1, rope: 1, add: 0 }],
    ['elevate', 'Elevate', { ex: 1, rope: 1, add: 1 }],
    ['repeat', 'Repeat', { ex: 1, rope: 1, add: 2 }]];
  var INK = '#15181e', GRN = '#1f8a4c', SEEDS = 20, MAXBUF = 40, MAXADD = 10;
  var OPT = {}, NET = {};
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function money(v) { v = Math.round(v); return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US'); }
  function signedMoney(v) { v = Math.round(v); return (v > 0 ? '+' : v < 0 ? '−' : '±') + '$' + Math.abs(v).toLocaleString('en-US'); }

  Goal.tab({
    id: 'flow', title: 'Flow lab',
    render: function (el, p) {
      var st = Goal.dec(p.st, DEF), out = h('div'), tableBox = h('div');
      function cfg() {
        var q = Goal.params(), days = clamp(Math.round(Goal.int(q, 'days', 30)), 1, 120);
        var econ = { tu: Math.max(0, Goal.int(q, 'tu', 100)), oe: Math.max(0, Goal.int(q, 'oe', 500)), ec: Math.max(0, Goal.int(q, 'ec', 60)),
          ic: Math.max(0, Goal.int(q, 'ic', 5)), budget: Math.max(0, Goal.int(q, 'bud', 300)) };
        var maxAdd = econ.ec > 0 ? Math.min(MAXADD, Math.floor(econ.budget / econ.ec + 1e-9)) : MAXADD;
        var buf = clamp(Math.round(Goal.int(q, 'buf', 0)), 0, MAXBUF), pb = Math.max(1, Math.round(Goal.int(q, 'pb', 20)));
        return { days: days, seed: Goal.int(q, 'seed', 3), k: clamp(Math.round(Goal.int(q, 'd', days)), 1, days) - 1, econ: econ, maxAdd: maxAdd,
          mine: { exploit: q.ex === '1', rope: q.rope === '1', buffer: buf > 0 ? buf : undefined, add: clamp(Math.round(Goal.int(q, 'add', 0)), 0, maxAdd) },
          buf: buf, pb: pb, tb: clamp(Math.round(Goal.int(q, 'tb', 5)), 1, pb), setup: Math.max(0, Goal.int(q, 'setup', 0)) };
      }
      var c = cfg();
      function prob() { return { stages: st, days: c.days, econ: c.econ }; }
      function key() { return JSON.stringify(prob()); }
      function save() { Goal.set({ st: Goal.enc(st) }); upd(); }
      /* Mean net/day over the seeds at day k for one policy (cached). */
      function netOf(pol) {
        var kk = key() + JSON.stringify(pol);
        if (!NET[kk]) NET[kk] = Goal.core.flowNet(prob(), pol, SEEDS);
        return NET[kk].byDay[c.k];
      }
      function pol(ex, rope, buf, add) { var x = { exploit: !!ex, rope: !!rope, add: add || 0 }; if (rope && buf !== undefined) x.buffer = buf; return x; }
      function conIndex() { return Goal.core.constraintIndex(st.map(function (x) { return x.cap * (1 - (x['var'] || 0) / 2); })); }
      function stagesTable() {
        tableBox.innerHTML = '';
        var ci = conIndex();
        var t = h('table', null, h('tr', null, h('th', null, 'stage'), h('th', { class: 'n' }, T('cap-day', 'cap/day')), h('th', { class: 'n' }, T('loss', 'loss up to')), h('th', { class: 'n' }, T('start-wip', 'start WIP')), h('th')));
        st.forEach(function (x, i) {
          function f(k, w, num) {
            return h('input', { value: x[k], style: 'width:' + w + 'px', type: num ? 'number' : 'text', step: k === 'var' ? 0.1 : 1, min: 0, max: k === 'var' ? 1 : null,
              onchange: function (e) { var v = parseFloat(e.target.value) || 0; x[k] = num ? Math.max(0, k === 'var' ? Math.min(1, v) : v) : e.target.value; save(); stagesTable(); } });
          }
          t.appendChild(h('tr', null, h('td', { class: i === ci ? 'con' : null }, f('name', 120)), h('td', { class: 'n' }, f('cap', 64, 1)), h('td', { class: 'n' }, f('var', 64, 1)), h('td', { class: 'n' }, f('wip', 64, 1)),
            h('td', null, h('button', { 'aria-label': 'remove stage', onclick: function () { if (st.length > 2) { st.splice(i, 1); save(); stagesTable(); } } }, '×'))));
        });
        tableBox.appendChild(t);
        tableBox.appendChild(h('div', { class: 'row', style: 'margin-top:8px' },
          h('button', { onclick: function () { st.push({ name: 'Stage ' + (st.length + 1), cap: 10, 'var': 0.3, wip: 0 }); save(); stagesTable(); } }, '+ stage'),
          h('button', { onclick: function () { st = JSON.parse(JSON.stringify(DEF)); save(); stagesTable(); } }, 'Reset'),
          h('button', { onclick: function () { Goal.download('stages.json', JSON.stringify(st, null, 1), 'application/json'); } }, 'Export'),
          h('button', { onclick: function () { Goal.readFile(function (txt) { try { st = JSON.parse(txt); if (st.stages) st = st.stages; save(); stagesTable(); } catch (e) { alert('bad JSON'); } }); } }, 'Import')));
      }
      function runOf(set) {
        return Goal.core.flow({ stages: st, days: c.days, seed: c.seed, policy: { exploit: set.exploit, rope: set.rope, buffer: set.buffer, add: set.add } });
      }
      function setText(set) {
        var a = [];
        if (set.exploit) a.push('exploit');
        if (set.rope) a.push('rope ' + (set.buffer === undefined ? '2 days' : set.buffer));
        if (set.add) a.push('+' + set.add + ' cap');
        return a.length ? a.join(' · ') : 'no change';
      }
      function go(d) { Goal.set({ d: clamp(d, 1, c.days) }); upd(); }
      /* Which step preset matches Mine (index or -1). */
      function stepOn() {
        var i = -1;
        STEPS.forEach(function (x, j) {
          if (!!c.mine.exploit === !!x[2].ex && !!c.mine.rope === !!x[2].rope && (c.mine.add || 0) === Math.min(x[2].add, c.maxAdd)) i = j;
        });
        return i;
      }
      /* The one change from Mine to Best that earns the most. */
      function biggest(mineNet, os) {
        var m = c.mine, list = [];
        if (!!os.exploit !== !!m.exploit) list.push({ pol: pol(os.exploit, m.rope, m.buffer, m.add), step: 'Step 2 · Exploit', book: 'exploit-constraint',
          text: os.exploit ? 'Exploit the constraint: no lost time, no bad parts.' : 'Stop the exploit rule here.' });
        if (!!os.rope !== !!m.rope || (os.rope && os.buffer !== m.buffer)) list.push({ pol: pol(m.exploit, os.rope, os.buffer, m.add), step: 'Step 3 · Subordinate', book: 'rope',
          text: os.rope ? 'Release work at the pace of the constraint: rope, buffer ' + os.buffer + '.' : 'Remove the rope.' });
        if ((os.add || 0) !== (m.add || 0)) list.push({ pol: pol(m.exploit, m.rope, m.buffer, os.add), step: 'Step 4 · Elevate', book: 'elevate-constraint',
          text: (os.add || 0) > (m.add || 0) ? 'Add ' + ((os.add || 0) - (m.add || 0)) + ' capacity at the constraint.' : 'Use ' + ((m.add || 0) - (os.add || 0)) + ' less added capacity.' });
        list.forEach(function (x) { x.gain = netOf(x.pol) - mineNet; });
        list.sort(function (a, b) { return b.gain - a.gain; });
        return list[0] || null;
      }
      function upd() {
        c = cfg();
        out.innerHTML = '';
        var k = c.k, pr = prob(), kk = key(), opt = OPT[kk], ci = conIndex(), conName = st[ci] ? st[ci].name : '–';
        var mres = runOf(c.mine);
        if (!opt) {
          out.appendChild(Goal.verdict({ q: 'What does each focusing step earn?', head: [{ con: conName }, ' is the constraint.'], sub: 'Finding the best policy…' }));
          setTimeout(function () {
            if (!OPT[kk]) OPT[kk] = Goal.core.flowOptimal(pr, { seeds: SEEDS, maxBuffer: MAXBUF, maxAdd: MAXADD });
            if (key() === kk) upd();
          }, 20);
          return;
        }
        var hl = Goal.core.flowHeadline(pr, c.mine, opt, k + 1), os = hl.optimal.settings, ores = runOf(os);
        var unit = st.map(function (x) { return x.cap > 0 ? 1 / x.cap : 0; });
        var mb = Goal.core.batch({ unit: unit, process: c.pb, transfer: c.tb, setup: c.setup }).splitBatch, obb = Goal.core.batch({ unit: unit, process: c.pb, transfer: 1, setup: c.setup }).splitBatch;
        var same = hl.mineOptimal, md = mres.days[k], od = ores.days[k];
        var mPer = md.cum / (k + 1), oPer = od.cum / (k + 1), gap = hl.optimal.net - hl.mine.net;
        var nx = same ? null : biggest(hl.mine.net, os);
        if (!nx && !same && c.tb > 1) nx = { step: 'Step 3 · Subordinate', book: 'batch-size', text: 'Move work in transfer batches of 1.' };
        var conBest = ores.constraint !== mres.constraint && st[ores.constraint] ? st[ores.constraint].name : null;
        out.appendChild(h('div', { 'data-primary': '' }, Goal.verdict({
          q: 'What does each focusing step earn?',
          top: [Goal.runChip(!!p.st, st.length + ' stages · ' + c.days + ' days · seed ' + c.seed)],
          head: [{ con: conName }, ' is the constraint. ', same ? { good: 'Your policy is the best.' } : ['The best policy earns ', { good: signedMoney(gap) }, ' a day more.']].reduce(function (a, x) { return a.concat(x); }, []),
          sub: 'Your policy: ' + setText(c.mine) + '. Best: ' + setText(os) + '.' + (conBest ? ' With the best policy, the constraint moves to ' + conBest + '.' : ''),
          metrics: [
            { v: money(hl.mine.net), unit: '/day', label: 'net profit, your policy', tone: same ? 'good' : 'bad' },
            { v: money(hl.optimal.net), unit: '/day', label: 'net profit, best policy', tone: 'good' },
            { v: Goal.n(mPer), unit: '/day', label: 'output, your policy · best ' + Goal.n(oPer) },
            { v: md.wip, unit: 'units', label: 'WIP on day ' + (k + 1) + ' · best ' + od.wip },
            { v: mres.totals.leadTime === null ? '–' : Goal.n(mres.totals.leadTime), unit: 'd', label: 'lead time · best ' + (ores.totals.leadTime === null ? '–' : Goal.n(ores.totals.leadTime)) + ' d' }
          ],
          next: same ? { step: 'Step 5 · Repeat', text: 'Find the next constraint. Do not let inertia stop you.', book: ['inertia'] }
            : nx ? { step: nx.step, text: nx.text + (nx.gain ? ' ' + signedMoney(nx.gain) + '/day.' : ''), book: [nx.book] } : null
        })));

        /* What if: the few levers that change the result. */
        var si = stepOn();
        var useBest = h('button', { class: 'pri', disabled: same && c.tb === 1, onclick: function () {
          Goal.set({ ex: os.exploit ? 1 : null, rope: os.rope ? 1 : null, buf: os.rope ? os.buffer : null, add: os.add || null, tb: 1 }); rerender();
        } }, same && c.tb === 1 ? 'Your policy is the best' : 'Use best policy');
        out.appendChild(h('div', { class: 'whatif fl-whatif' }, h('b', null, 'What if'),
          Goal.seg(STEPS.map(function (x, i) { return [i, (i + 1) + ' ' + x[1]]; }), si, function (i) {
            var x = STEPS[i][2]; Goal.set({ ex: x.ex, rope: x.rope, add: Math.min(x.add, c.maxAdd) || null }); rerender();
          }),
          Goal.check(T('exploit'), 'ex', c.mine.exploit, rerender), Goal.check(T('rope'), 'rope', c.mine.rope, rerender),
          c.mine.rope ? Goal.num([T('buffer'), ' (0 = 2 days)'], 'buf', c.buf, re, { min: 0, max: MAXBUF, w: 64 }) : null,
          Goal.num(T('elevate', '+cap'), 'add', c.mine.add, re, { min: 0, max: c.maxAdd, w: 56 }),
          Goal.num(T('transfer-batch', 'transfer batch'), 'tb', c.tb, re, { min: 1, max: c.pb, w: 64 }),
          useBest));

        /* Proof 1: the staircase of the five steps, and the capacity per stage. */
        var ladder = STEPS.map(function (x, i) { return { i: i, name: (i + 1) + ' ' + x[1], net: netOf(pol(x[2].ex, x[2].rope, undefined, Math.min(x[2].add, c.maxAdd))) }; });
        out.appendChild(Goal.proofs('2', [
          Goal.proof('Net profit per day at each step', Goal.fit(function (w) { return stairs(ladder, si, hl.optimal.net, w); }), { note: 'dark = your policy · mean of ' + SEEDS + ' seeds' }),
          Goal.proof('Capacity per stage', h('div', null,
            Goal.fit(function (w) { return capBars(c.mine, mres, mPer, w); }),
            h('div', { class: 'fl-key' }, h('span', null, h('i', { class: 'fl-tick' }), 'output per day, your policy'))), { note: 'your policy · red = constraint' })
        ]));
        out.appendChild(h('div', { style: 'height:var(--gap)' }));

        /* Proof 2: output and WIP over the days, with a day scrubber. */
        var cum = function (r) { return r.days.map(function (x) { return x.cum; }); }, wip = function (r) { return r.days.map(function (x) { return x.wip; }); };
        var scrub = h('span', { class: 'fl-scrub' },
          h('button', { 'aria-label': 'previous day', onclick: function () { go(k); }, disabled: k === 0 }, '◀'),
          h('span', { class: 'fl-day' }, 'Day ' + (k + 1) + ' / ' + c.days),
          h('button', { 'aria-label': 'next day', onclick: function () { go(k + 2); }, disabled: k >= c.days - 1 }, '▶'),
          h('input', { type: 'range', min: 1, max: c.days, value: k + 1, 'aria-label': 'day', oninput: function (e) { go(+e.target.value); } }));
        var lines = [{ name: 'yours', color: INK }, { name: 'best', color: GRN }];
        out.appendChild(h('div', { class: 'fl-scrubrow' }, scrub, Goal.legend({ 'your policy': INK, 'best policy': GRN })));
        out.appendChild(Goal.proofs('2', [
          Goal.proof('Total output', Goal.fit(function (w) {
            return Goal.line([{ name: lines[0].name, values: cum(mres), color: INK }, { name: lines[1].name, values: cum(ores), color: GRN }], { xlabel: 'day', w: w, h: 180, mark: k });
          }), { note: T('throughput', 'units shipped') }),
          Goal.proof('WIP per day', Goal.fit(function (w) {
            return Goal.line([{ name: lines[0].name, values: wip(mres), color: INK }, { name: lines[1].name, values: wip(ores), color: GRN }], { xlabel: 'day', w: w, h: 180, mark: k });
          }), { note: T('wip', 'units in the line') })
        ]));
        out.appendChild(h('div', { style: 'height:var(--gap)' }));

        /* Proof 3: one table, your policy vs best. */
        var rows = [
          ['Policy', setText(c.mine), setText(os), null],
          [T('flow-net', 'Net profit per day'), money(hl.mine.net), money(hl.optimal.net), [hl.mine.net - hl.optimal.net, 'high', signedMoney]],
          ['Output per day', Goal.n(mPer), Goal.n(oPer), [mPer - oPer, 'high']],
          ['Total output, day ' + (k + 1), md.cum, od.cum, [md.cum - od.cum, 'high']],
          ['WIP, day ' + (k + 1), md.wip, od.wip, [md.wip - od.wip, 'low']],
          [T('lead-time', 'Lead time, d'), mres.totals.leadTime === null ? '–' : Goal.n(mres.totals.leadTime), ores.totals.leadTime === null ? '–' : Goal.n(ores.totals.leadTime), null],
          [T('transfer-batch', 'Batch time, d'), Goal.n(mb), Goal.n(obb), [mb - obb, 'low']]];
        var tbl = h('table', { class: 'fl-cmp' }, h('tr', null, h('th', null, ''), h('th', { class: 'n' }, 'Your policy'), h('th', { class: 'n' }, 'Best policy'), h('th', { class: 'n' }, 'Difference')),
          rows.map(function (r) {
            var d = r[3], cell = '';
            if (d) {
              var v = d[0], worse = d[1] === 'high' ? v < -1e-6 : v > 1e-6, better = d[1] === 'high' ? v > 1e-6 : v < -1e-6;
              cell = h('span', { class: worse ? 'fl-bad' : better ? 'fl-good' : 'mut' }, Math.abs(v) < 1e-6 ? '±0' : d[2] ? d[2](v) : (v > 0 ? '+' : '−') + Goal.n(Math.abs(v)));
            }
            return h('tr', null, h('td', null, r[0]), h('td', { class: 'n' }, r[1]), h('td', { class: 'n' }, r[2]), h('td', { class: 'n' }, cell));
          }));
        out.appendChild(Goal.proof('Your policy against the best policy', tbl, { note: 'seed ' + c.seed + ' · net is the mean of ' + SEEDS + ' seeds' }));

        /* Inputs: closed by default. */
        out.appendChild(Goal.drawer('Stages and economics', st.length + ' stages · T $' + c.econ.tu + '/unit · OE $' + c.econ.oe + '/day', h('div', { class: 'fl-in' },
          h('div', null, h('h3', null, 'Stages'), tableBox),
          h('div', { class: 'fl-fields' },
            h('h3', null, 'Run'),
            Goal.num('days', 'days', c.days, re, { min: 1, max: 120, w: 72 }), Goal.num(T('seed'), 'seed', c.seed, re, { w: 72 }),
            Goal.num(T('process-batch', 'process batch'), 'pb', c.pb, re, { min: 1, w: 72 }), Goal.num(T('setup'), 'setup', c.setup, re, { min: 0, step: 0.1, w: 72 }),
            h('h3', null, 'Money'),
            Goal.num(T('throughput', 'T per unit, $'), 'tu', c.econ.tu, re, { min: 0, w: 80 }), Goal.num(T('oe', 'OE per day, $'), 'oe', c.econ.oe, re, { min: 0, w: 80 }),
            Goal.num(T('elevate', '+1 cap per day, $'), 'ec', c.econ.ec, rerender, { min: 0, w: 80 }), Goal.num(T('inventory', 'I per unit-day, $'), 'ic', c.econ.ic, re, { min: 0, w: 80 }),
            Goal.num('budget per day, $', 'bud', c.econ.budget, rerender, { min: 0, w: 80 })))));
      }
      /* Bars of net/day per step preset; the step that matches Mine is dark; a green line marks the best policy. */
      function stairs(ladder, on, best, W) {
        var s = Goal.s, H = 220, L = 60, R = 16, TP = 14, B = 44, n = ladder.length;
        var vals = ladder.map(function (x) { return x.net; }).concat([best, 0]);
        var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals), span = (max - min) || 1;
        max += span * 0.08; if (min < 0) min -= span * 0.04;
        var Y = function (v) { return TP + (H - TP - B) * (max - v) / (max - min); };
        var bw = (W - L - R) / n, g = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%' });
        g.appendChild(s('line', { class: 'ax', x1: L, x2: W - R, y1: Y(0), y2: Y(0) }));
        g.appendChild(s('text', { class: 'mt', x: L - 8, y: Y(0) + 4, 'text-anchor': 'end' }, '$0'));
        ladder.forEach(function (x, i) {
          var x0 = L + i * bw + bw * 0.2, w = bw * 0.6, y = Math.min(Y(x.net), Y(0)), hh = Math.max(2, Math.abs(Y(x.net) - Y(0)));
          var fill = i === on ? (x.net < 0 ? Goal.CON : '#15181e') : x.net < 0 ? '#ecc3be' : Goal.GRAY;
          g.appendChild(s('rect', { x: x0, y: y, width: w, height: hh, rx: 3, fill: fill }));
          g.appendChild(s('text', { x: x0 + w / 2, y: H - 24, 'text-anchor': 'middle', style: i === on ? 'font-weight:700' : 'fill:#6b7280' }, bw < 110 ? 'Step ' + (i + 1) : x.name));
          g.appendChild(s('text', { x: x0 + w / 2, y: H - 8, 'text-anchor': 'middle', style: 'font-weight:600;font-size:12px;fill:' + (x.net < 0 ? Goal.CON : '#15181e') }, money(x.net)));
        });
        var yb = Y(best);
        g.appendChild(s('line', { x1: L, x2: W - R, y1: yb, y2: yb, stroke: GRN, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
        g.appendChild(s('text', { x: L - 8, y: yb + 4, 'text-anchor': 'end', style: 'fill:' + GRN + ';font-weight:600' }, money(best)));
        g.appendChild(s('text', { x: W - R, y: yb - 6, 'text-anchor': 'end', style: 'fill:' + GRN }, 'best policy'));
        return g;
      }
      /* Capacity bars: constraint red, others gray, tick = output per day. */
      function capBars(set, res, per, W) {
        var s = Goal.s, rowH = 26, L = 130, R = 60, H = st.length * rowH + 10, ci = res.constraint, d = res.days[c.k];
        var caps = st.map(function (x, i) { return set.exploit && i === ci ? res.caps[i] : res.effCaps[i]; });
        var max = Math.max.apply(null, caps.concat([per, 1])) * 1.05, X = function (v) { return L + (W - L - R) * v / max; };
        var g = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%' });
        st.forEach(function (x, i) {
          var y = i * rowH + 4, con = i === ci;
          g.appendChild(s('text', { x: L - 8, y: y + 14, 'text-anchor': 'end', style: con ? 'font-weight:700;fill:' + Goal.CON : '' }, x.name));
          g.appendChild(s('rect', { x: L, y: y + 3, width: Math.max(1, X(caps[i]) - L), height: rowH - 10, rx: 3, fill: con ? Goal.CON : Goal.GRAY }));
          g.appendChild(s('text', { x: X(caps[i]) + 6, y: y + 14, class: 'mt' }, Goal.n(caps[i]) + (i === 0 && !set.rope ? '' : ' · q ' + d.queues[i])));
        });
        var xp = X(per);
        g.appendChild(s('line', { x1: xp, x2: xp, y1: 2, y2: H - 4, stroke: INK, 'stroke-width': 1.5 }));
        return g;
      }
      function rerender() { el.innerHTML = ''; tab.render(el, Goal.params()); }
      var re = function () { upd(); };
      el.appendChild(out);
      var tab = this;
      stagesTable();
      upd();
    }
  });
})();

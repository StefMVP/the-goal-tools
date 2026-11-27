/* Buffers: DBR time buffer board and Critical Chain fever chart. Verdict first: which order needs help, will the project finish on time.
   Optimal = smallest buffer that meets the target service level (mean of 20 seeds).
   Layout: verdict and proofs re-render; the what-if bar and the input drawer stay, so inputs keep focus.
   URL: #/buffers?v=dbr|cc  DBR: today, buffer, done, rs, rd, sp, tg, rate  CC: cc, cn, ce, fn, fe, sp, tg, pbuf, fbuf */
(function () {
  'use strict';
  var h = Goal.h, s = Goal.s, C = Goal.core, Tm = Goal.term;
  /* Buffer zones (book colors). Soft fills for chart backgrounds. */
  var ZC = { green: '#1f8a4c', yellow: '#d39b00', red: '#c2352a', black: '#15181e' };
  var ZS = { green: '#e8f5ee', yellow: '#fdf4d8', red: '#fbeceb', black: '#e6e8ec' };
  var ORDERS = [
    ['O-101', 0], ['O-102', 1], ['O-103', 2], ['O-104', 2], ['O-105', 3], ['O-106', 4], ['O-107', 5],
    ['O-108', 6], ['O-109', 6], ['O-110', 7], ['O-111', 8], ['O-112', 9], ['O-113', 10], ['O-114', 11]
  ];
  var DONE = { 'O-101': 1, 'O-103': 1, 'O-106': 1 };
  var TRAIL = [[1, 5, 3], [2, 12, 8], [3, 20, 22], [4, 26, 38], [5, 31, 55], [6, 36, 70], [7, 45, 74], [8, 58, 71], [9, 70, 72], [10, 85, 63]];
  /* Fever zone lines: % buffer = a + b * % chain */
  var GY = [15, 0.6], YR = [35, 0.6];
  var OPEN = {};
  function feverZone(x, y) { return y >= 100 ? 'black' : y >= YR[0] + YR[1] * x ? 'red' : y >= GY[0] + GY[1] * x ? 'yellow' : 'green'; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function pc(v) { return Math.round(v * 100); }
  function fill(n, v) { var a = []; for (var i = 0; i < n; i++) a.push(v); return a; }
  function fields() { return h('div', { class: 'bf-in' }, Array.prototype.slice.call(arguments)); }
  function viewSwitch(v, rerender) {
    return Goal.seg([['dbr', 'Orders · DBR'], ['cc', 'Project · critical chain']], v, function (x) { Goal.set({ v: x }); rerender(); });
  }
  /* Drawer that stays open over re-renders of the tab. */
  function keepOpen(d, k) { d.open = !!OPEN[k]; d.addEventListener('toggle', function () { OPEN[k] = d.open; }); return d; }
  /* Range control in the what-if bar: writes key to the URL, then calls onset. set(value, text) updates it. */
  function slider(label, min, max, key, onset) {
    var v = h('b'), r = h('input', { type: 'range', min: min, max: max, 'aria-label': label, oninput: function (e) { var o = {}; o[key] = +e.target.value; Goal.set(o); onset(); } });
    return { el: h('label', { class: 'bf-sl' }, label + ' ', v, r), set: function (x, txt) { r.value = x; v.textContent = txt; } };
  }

  /* Service level by buffer days: target line, your buffer, the optimal buffer. */
  function curve(o, mine, W) {
    var H = 172, L = 38, R = 14, T = 10, B = 46, n = o.curve.length - 1;
    var X = function (d) { return L + (W - L - R) * Math.min(d, n) / Math.max(1, n); }, Y = function (v) { return T + (H - T - B) * (1 - v); };
    var g = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%' });
    [0, 0.5, 1].forEach(function (v) {
      g.appendChild(s('line', { class: 'ax', x1: L, x2: W - R, y1: Y(v), y2: Y(v) }));
      g.appendChild(s('text', { class: 'mt', x: L - 5, y: Y(v) + 4, 'text-anchor': 'end' }, pc(v) + '%'));
    });
    g.appendChild(s('line', { x1: L, x2: W - R, y1: Y(o.target), y2: Y(o.target), stroke: '#9aa1ad', 'stroke-dasharray': '4 3' }));
    g.appendChild(s('path', { d: o.curve.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(''), fill: 'none', stroke: '#6f7784', 'stroke-width': 2 }));
    [0, Math.round(n / 2), n].forEach(function (d, i) { g.appendChild(s('text', { class: 'mt', x: X(d), y: H - 30, 'text-anchor': ['start', 'middle', 'end'][i] }, d + ' d')); });
    var ov = o.curve[Math.min(o.buffer, n)], mv = o.curve[Math.min(mine, n)], same = o.buffer === mine;
    if (!same) g.appendChild(s('circle', { cx: X(mine), cy: Y(mv), r: 5, fill: '#fff', stroke: '#15181e', 'stroke-width': 2 }));
    g.appendChild(s('circle', { cx: X(o.buffer), cy: Y(ov), r: 5, fill: ZC.green }));
    /* Key row under the axis: no labels on the curve, so nothing collides. */
    var y = H - 7, x = L;
    g.appendChild(s('circle', { cx: x + 5, cy: y - 4, r: 5, fill: ZC.green }));
    g.appendChild(s('text', { x: x + 14, y: y, style: 'fill:' + ZC.green + ';font-weight:600' }, (same ? 'yours = optimal ' : 'optimal ') + o.buffer + ' d · ' + pc(ov) + '%'));
    x += 150;
    if (!same) {
      g.appendChild(s('circle', { cx: x + 5, cy: y - 4, r: 4, fill: '#fff', stroke: '#15181e', 'stroke-width': 2 }));
      g.appendChild(s('text', { x: x + 14, y: y, style: 'font-weight:600' }, 'yours ' + mine + ' d · ' + pc(mv) + '%'));
      x += 140;
    }
    if (x + 90 < W) {
      g.appendChild(s('line', { x1: x, x2: x + 16, y1: y - 4, y2: y - 4, stroke: '#9aa1ad', 'stroke-dasharray': '4 3' }));
      g.appendChild(s('text', { class: 'mt', x: x + 22, y: y }, 'target ' + pc(o.target) + '%'));
    }
    return g;
  }

  /* DBR board: one bar per open order = share of its time buffer used. */
  function board(open, W) {
    var L = 58, R = 46, rh = 22, Hh = Math.max(1, open.length) * rh + 24, max = 1.5;
    var X = function (v) { return L + (W - L - R) * Math.min(v, max) / max; };
    var g = s('svg', { viewBox: '0 0 ' + W + ' ' + Hh, width: '100%' });
    [[0, 1 / 3, 'green'], [1 / 3, 2 / 3, 'yellow'], [2 / 3, 1, 'red'], [1, max, 'black']].forEach(function (z) {
      g.appendChild(s('rect', { x: X(z[0]), y: 0, width: X(z[1]) - X(z[0]), height: Hh - 20, fill: ZS[z[2]] }));
    });
    [0, 1 / 3, 2 / 3, 1].forEach(function (v, i) { g.appendChild(s('text', { class: 'mt', x: X(v), y: Hh - 5, 'text-anchor': 'middle' }, ['0', '⅓', '⅔', 'due'][i])); });
    g.appendChild(s('line', { x1: X(1), x2: X(1), y1: 0, y2: Hh - 20, stroke: '#15181e', 'stroke-width': 1 }));
    open.forEach(function (r, i) {
      var y = i * rh + 3, hot = r.zone === 'red' || r.zone === 'black';
      g.appendChild(s('text', { x: L - 8, y: y + 13, 'text-anchor': 'end', style: hot ? 'font-weight:700' : null }, r.id));
      g.appendChild(s('rect', { x: L, y: y + 3, width: Math.max(2, X(Math.max(0, r.pen)) - L), height: rh - 9, rx: 2, fill: ZC[r.zone] }));
      g.appendChild(s('text', { class: hot ? null : 'mt', x: X(Math.max(0, r.pen)) + 5, y: y + 13, style: hot ? 'font-weight:600' : null }, pc(r.pen) + '%'));
    });
    if (!open.length) g.appendChild(s('text', { class: 'mt', x: L, y: 14 }, 'no open orders'));
    return g;
  }

  function dbr(el, p, rerender) {
    var done = Goal.dec(p.done, null) || DONE;
    var vbox = h('div'), pbox = h('div', { class: 'bf' }), o = null;
    function cfg() {
      var q = Goal.params();
      return { today: clamp(Math.round(Goal.int(q, 'today', 12)), 0, 20), buffer: clamp(Math.round(Goal.int(q, 'buffer', 6)), 1, 60),
        rs: clamp(Math.round(Goal.int(q, 'rs', 3)), 1, 10), rd: clamp(Goal.int(q, 'rd', 4.5), 0.1, 100), sp: clamp(Goal.int(q, 'sp', 0.4), 0, 1),
        tg: clamp(Goal.int(q, 'tg', 90), 1, 100), rate: Math.max(0, Goal.int(q, 'rate', 4)) };
    }
    var c = cfg(), re = function () { draw(); };
    var sDay = slider('day', 0, 20, 'today', draw), sBuf = slider('buffer', 1, 20, 'buffer', draw);
    var btn = h('button', { onclick: function () { Goal.set({ buffer: o.buffer }); draw(); } });
    var bufNum = Goal.num(Tm('buffer', 'buffer d'), 'buffer', c.buffer, re, { min: 1, max: 60 });
    var note = h('small');
    function draw() {
      c = cfg();
      var prob = { tasks: fill(c.rs, c.rd / c.rs), spread: c.sp, target: c.tg / 100 };
      o = C.bufferOptimal(prob);
      var hl = C.bufferHeadline(prob, c.buffer, o);
      var open = ORDERS.map(function (x) {
        var pen = (c.today - x[1]) / c.buffer;
        return { id: x[0], rel: x[1], pen: pen, done: !!done[x[0]], zone: C.bufferZone(pen) };
      }).filter(function (r) { return r.rel <= c.today && !r.done; }).sort(function (a, b) { return b.pen - a.pen; });
      var cnt = { green: 0, yellow: 0, red: 0, black: 0 };
      open.forEach(function (r) { cnt[r.zone]++; });
      var top = open[0], hot = open.filter(function (r) { return r.zone === 'red' || r.zone === 'black'; }), ids = hot.length > 3 ? 'the ' + hot.length + ' orders in red or late, first ' + hot.slice(0, 3).map(function (r) { return r.id; }).join(', ') : hot.map(function (r) { return r.id; }).join(', ');
      var head, next;
      if (!top) { head = [{ good: 'No open orders.' }]; next = 'Nothing to expedite.'; }
      else if (top.zone === 'black') { head = [{ con: top.id }, ' is late.']; next = 'Expedite ' + ids + ' now. Find where each one waits.'; }
      else if (top.zone === 'red') { head = [{ con: top.id }, ' needs help now.']; next = 'Expedite ' + ids + '. Find where each one waits.'; }
      else if (top.zone === 'yellow') { head = [top.id + ' is in yellow. No order is in red.']; next = 'Find where ' + top.id + ' waits. Plan help; act only at red.'; }
      else { head = [{ good: 'All orders are green.' }]; next = 'Nothing to expedite. Do not release work early.'; }
      var diff = c.buffer - o.buffer;
      vbox.innerHTML = '';
      vbox.appendChild(Goal.verdict({
        q: 'Which order needs help now?',
        top: [viewSwitch('dbr', rerender)],
        head: head,
        sub: 'Day ' + c.today + ' · ' + open.length + ' open orders · time buffer ' + c.buffer + ' d. ' +
          (diff === 0 ? 'Your buffer is the smallest that meets the ' + c.tg + '% target.' : diff > 0 ? 'Your buffer is ' + diff + ' d longer than necessary: more WIP, longer lead time.' : 'Your buffer is ' + (-diff) + ' d too short for the ' + c.tg + '% target.'),
        metrics: [
          { v: cnt.red + cnt.black, unit: cnt.black ? '· ' + cnt.black + ' late' : '', label: 'orders in red or late', tone: cnt.red + cnt.black ? 'bad' : 'good' },
          { v: pc(hl.mine.service), unit: '%', label: 'on time with ' + c.buffer + ' d · target ' + c.tg + '%', tone: hl.mine.met ? 'good' : 'bad' },
          { v: o.buffer, unit: 'd', label: 'smallest buffer that meets the target' },
          { v: Goal.n(c.rate * c.buffer), label: 'units of WIP before the drum' }
        ],
        next: { step: 'Buffer management', text: next, book: hot.length ? ['buffer'] : ['rope'] }
      }));
      sDay.set(c.today, String(c.today)); sBuf.set(Math.min(c.buffer, 20), c.buffer + ' d');
      btn.className = diff ? 'pri' : ''; btn.disabled = !diff; btn.textContent = diff ? 'Use optimal ' + o.buffer + ' d' : 'Yours is optimal';
      bufNum.querySelector('input').value = c.buffer;
      note.textContent = 'route ' + c.rs + ' stages · ' + Goal.n(c.rd) + ' d · spread ' + c.sp + ' · drum ' + c.rate + '/day';
      pbox.innerHTML = '';
      pbox.appendChild(Goal.proofs('21', [
        Goal.proof('Buffer board · day ' + c.today, h('div', null,
          h('div', { class: 'lg' }, ['green', 'yellow', 'red', 'black'].map(function (z) { return h('span', null, h('i', { style: 'background:' + ZC[z] }), (z === 'black' ? 'late' : z) + ' ' + cnt[z]); })),
          Goal.fit(function (w) { return board(open, w); })), { note: 'share of the time buffer used' }),
        Goal.proof('On time by buffer size', Goal.fit(function (w) { return curve(o, c.buffer, w); }), { note: 'mean of 20 seeds' })
      ]));
    }
    var tags = h('div', { class: 'row', style: 'gap:4px' });
    function drawTags() {
      tags.innerHTML = '';
      ORDERS.forEach(function (x) {
        tags.appendChild(h('a', { class: 'tag' + (done[x[0]] ? ' on' : ''), href: 'javascript:void 0', onclick: function () {
          if (done[x[0]]) delete done[x[0]]; else done[x[0]] = 1;
          Goal.set({ done: Goal.enc(done) }); drawTags(); draw();
        } }, x[0]));
      });
    }
    drawTags();
    var dr = keepOpen(Goal.drawer('Inputs', null, h('div', { class: 'stack' },
      fields(Goal.num(Tm('route-stages', 'stages to constraint'), 'rs', c.rs, re, { min: 1, max: 10 }), Goal.num(Tm('touch-time', 'route days'), 'rd', c.rd, re, { min: 0.1, step: 0.5 }),
        Goal.num(Tm('loss', 'spread'), 'sp', c.sp, re, { min: 0, max: 1, step: 0.1 }), Goal.num(Tm('service-level', 'target %'), 'tg', c.tg, re, { min: 1, max: 100 }),
        Goal.num(Tm('drum', 'drum units/day'), 'rate', c.rate, re, { min: 0 }), bufNum),
      h('div', null, h('div', { class: 'mut', style: 'margin-bottom:4px' }, 'Arrived at the constraint'), tags))), 'dbr');
    dr.querySelector('summary').appendChild(note);
    el.appendChild(vbox);
    el.appendChild(h('div', { class: 'whatif' }, h('b', null, 'What if'), sDay.el, sBuf.el, btn));
    el.appendChild(pbox);
    el.appendChild(dr);
    draw();
  }

  function fever(snaps, W) {
    var H = Math.round(Math.min(380, Math.max(240, W * 0.55))), L = 40, B = 26, T = 10, R = 16;
    var X = function (v) { return L + (W - L - R) * v / 100; }, Y = function (v) { return T + (H - T - B) * (1 - Math.min(v, 100) / 100); };
    var g = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%' });
    function poly(a, b, fc) {
      var pts = [];
      [0, 100].forEach(function (x) { pts.push(X(x) + ',' + Y(a ? Math.min(100, a[0] + a[1] * x) : 0)); });
      [100, 0].forEach(function (x) { pts.push(X(x) + ',' + Y(b ? Math.min(100, b[0] + b[1] * x) : 100)); });
      g.appendChild(s('polygon', { points: pts.join(' '), fill: fc }));
    }
    poly(null, GY, ZS.green); poly(GY, YR, ZS.yellow); poly(YR, null, ZS.red);
    [0, 50, 100].forEach(function (v) {
      g.appendChild(s('text', { class: 'mt', x: X(v), y: H - 8, 'text-anchor': v ? v === 100 ? 'end' : 'middle' : 'start' }, v + '%'));
      g.appendChild(s('text', { class: 'mt', x: L - 5, y: Y(v) + 4, 'text-anchor': 'end' }, v + '%'));
    });
    g.appendChild(s('text', { class: 'mt', x: X(50) + 30, y: H - 8 }, 'chain done →'));
    g.appendChild(s('text', { class: 'mt', x: L + 6, y: T + 12 }, '↑ buffer used'));
    var pts = snaps.slice().sort(function (a, b) { return a[0] - b[0]; });
    if (pts.length) {
      g.appendChild(s('path', { d: pts.map(function (q, i) { return (i ? 'L' : 'M') + X(q[1]) + ' ' + Y(q[2]); }).join(''), fill: 'none', stroke: '#15181e', 'stroke-width': 1.5 }));
      pts.forEach(function (q, i) {
        var last = i === pts.length - 1;
        g.appendChild(s('circle', { cx: X(q[1]), cy: Y(q[2]), r: last ? 7 : 3.5, fill: ZC[feverZone(q[1], q[2])], stroke: '#fff', 'stroke-width': last ? 2 : 1 }));
        if (last) g.appendChild(s('text', { x: X(q[1]) - 10, y: Y(q[2]) - 12, 'text-anchor': 'end', style: 'font-weight:700' }, 'week ' + q[0]));
      });
    }
    return g;
  }

  function ccpm(el, p, rerender) {
    var snaps = Goal.dec(p.cc, null) || TRAIL.map(function (t) { return t.slice(); });
    var vbox = h('div'), pbox = h('div', { class: 'bf' }), po = null, fo = null;
    function cfg() {
      var q = Goal.params();
      return { cn: clamp(Math.round(Goal.int(q, 'cn', 6)), 1, 20), ce: clamp(Goal.int(q, 'ce', 30), 1, 1000), fn: clamp(Math.round(Goal.int(q, 'fn', 3)), 1, 20),
        fe: clamp(Goal.int(q, 'fe', 12), 1, 1000), sp: clamp(Goal.int(q, 'sp', 0.4), 0, 1), tg: clamp(Goal.int(q, 'tg', 90), 1, 100),
        pbuf: clamp(Math.round(Goal.int(q, 'pbuf', 15)), 0, 2000), fbuf: clamp(Math.round(Goal.int(q, 'fbuf', 6)), 0, 2000) };
    }
    var c = cfg(), re = function () { draw(); };
    var sP = slider('project buffer', 0, 40, 'pbuf', draw), sF = slider('feeding buffer', 0, 20, 'fbuf', draw);
    var btn = h('button', { onclick: function () { Goal.set({ pbuf: po.buffer, fbuf: fo.buffer }); draw(); } });
    var pNum = Goal.num(Tm('project-buffer', 'project buffer d'), 'pbuf', c.pbuf, re, { min: 0 }), fNum = Goal.num(Tm('feeding-buffer', 'feeding buffer d'), 'fbuf', c.fbuf, re, { min: 0 });
    var note = h('small');
    function draw() {
      c = cfg();
      var pp = { tasks: fill(c.cn, c.ce / c.cn), spread: c.sp, target: c.tg / 100, base: 'sum' };
      var fp = { tasks: fill(c.fn, c.fe / c.fn), spread: c.sp, target: c.tg / 100, base: 'sum' };
      po = C.bufferOptimal(pp); fo = C.bufferOptimal(fp);
      var ph = C.bufferHeadline(pp, c.pbuf, po), fh = C.bufferHeadline(fp, c.fbuf, fo);
      var last = snaps.length ? snaps.slice().sort(function (a, b) { return a[0] - b[0]; })[snaps.length - 1] : null;
      var z = last ? feverZone(last[1], last[2]) : 'green';
      var head = { green: [{ good: 'On time.' }, ' The project buffer is green.'], yellow: ['Watch. The project buffer is in yellow.'],
        red: [{ con: 'At risk.' }, ' The project buffer is in red.'], black: [{ con: 'Late.' }, ' The project buffer is used up.'] }[z];
      var next = { green: 'Nothing to do. Do not change the plan.', yellow: 'Plan a recovery for the chain task that uses the buffer. Act if it goes red.',
        red: 'Recover now: put the best people on the chain task that uses the buffer.', black: 'Recover now and tell the customer the new date.' }[z];
      var same = ph.mineOptimal && fh.mineOptimal;
      vbox.innerHTML = '';
      vbox.appendChild(Goal.verdict({
        q: 'Will the project finish on time?',
        top: [viewSwitch('cc', rerender)],
        head: head,
        sub: last ? 'Week ' + last[0] + ': chain ' + last[1] + '% done, project buffer ' + last[2] + '% used. Plan: ' + Goal.n(c.ce) + ' d chain + ' + c.pbuf + ' d buffer.' : 'No weekly data.',
        metrics: [
          { v: last ? last[2] : 0, unit: '%', label: 'project buffer used', tone: z === 'green' ? 'good' : z === 'yellow' ? '' : 'bad' },
          { v: last ? last[1] : 0, unit: '%', label: 'critical chain done' },
          { v: pc(ph.mine.service), unit: '%', label: 'on time with ' + c.pbuf + ' d · target ' + c.tg + '%', tone: ph.mine.met ? 'good' : 'bad' },
          { v: Goal.n(c.ce + c.pbuf), unit: 'd', label: 'project length · optimal ' + Goal.n(c.ce + po.buffer) + ' d' }
        ],
        next: { step: 'Buffer management', text: next, book: ['critical-chain'] }
      }));
      sP.set(c.pbuf, c.pbuf + ' d'); sF.set(c.fbuf, c.fbuf + ' d');
      btn.className = same ? '' : 'pri'; btn.disabled = same; btn.textContent = same ? 'Yours is optimal' : 'Use optimal ' + po.buffer + ' d + ' + fo.buffer + ' d';
      pNum.querySelector('input').value = c.pbuf; fNum.querySelector('input').value = c.fbuf;
      note.textContent = 'chain ' + c.cn + ' tasks · ' + Goal.n(c.ce) + ' d · feeding ' + c.fn + ' tasks · ' + Goal.n(c.fe) + ' d · ' + snaps.length + ' weeks';
      pbox.innerHTML = '';
      pbox.appendChild(Goal.proofs('21', [
        Goal.proof('Fever chart', Goal.fit(function (w) { return fever(snaps, w); }), { note: 'one dot per week' }),
        h('div', { class: 'stack' },
          Goal.proof('Project buffer: on time by size', Goal.fit(function (w) { return curve(po, c.pbuf, w); }), { note: 'mean of 20 seeds' }),
          Goal.proof('Feeding buffer: on time by size', Goal.fit(function (w) { return curve(fo, c.fbuf, w); })))
      ]));
    }
    function save() { Goal.set({ cc: Goal.enc(snaps) }); }
    var weeks = h('div');
    function drawWeeks() {
      function inp(row, k) {
        return h('input', { type: 'number', value: row[k], min: 0, max: k === 1 ? 100 : k === 2 ? 120 : null, style: 'width:64px',
          onchange: function (e) { row[k] = Math.max(0, Math.min(+e.target.max || Infinity, parseFloat(e.target.value) || 0)); save(); draw(); } });
      }
      weeks.innerHTML = '';
      weeks.appendChild(h('table', null,
        h('tr', null, h('th', null, 'week'), h('th', null, Tm('chain-done', 'chain %')), h('th', null, Tm('buffer-used', 'buffer %')), h('th')),
        snaps.map(function (r, i) {
          return h('tr', null, h('td', null, inp(r, 0)), h('td', null, inp(r, 1)), h('td', null, inp(r, 2)),
            h('td', null, h('button', { onclick: function () { snaps.splice(i, 1); save(); drawWeeks(); draw(); } }, '×')));
        })));
      weeks.appendChild(h('div', { class: 'row', style: 'margin-top:6px' },
        h('button', { onclick: function () { var l = snaps[snaps.length - 1] || [0, 0, 0]; snaps.push([l[0] + 1, l[1], l[2]]); save(); drawWeeks(); draw(); } }, '+ week'),
        h('button', { onclick: function () { snaps = TRAIL.map(function (t) { return t.slice(); }); Goal.set({ cc: null }); drawWeeks(); draw(); } }, 'reset')));
    }
    drawWeeks();
    var dr = keepOpen(Goal.drawer('Inputs', null, h('div', { class: 'stack' },
      fields(Goal.num(Tm('critical-chain', 'chain tasks'), 'cn', c.cn, re, { min: 1, max: 20 }), Goal.num(Tm('critical-chain', 'chain days'), 'ce', c.ce, re, { min: 1 }),
        Goal.num(Tm('feeding-buffer', 'feeding tasks'), 'fn', c.fn, re, { min: 1, max: 20 }), Goal.num(Tm('feeding-buffer', 'feeding days'), 'fe', c.fe, re, { min: 1 }),
        Goal.num(Tm('loss', 'spread'), 'sp', c.sp, re, { min: 0, max: 1, step: 0.1 }), Goal.num(Tm('service-level', 'target %'), 'tg', c.tg, re, { min: 1, max: 100 }),
        pNum, fNum),
      weeks)), 'cc');
    dr.querySelector('summary').appendChild(note);
    el.appendChild(vbox);
    el.appendChild(h('div', { class: 'whatif' }, h('b', null, 'What if'), sP.el, sF.el, btn));
    el.appendChild(pbox);
    el.appendChild(dr);
    draw();
  }

  var tab = {
    id: 'buffers', title: 'Buffers',
    render: function (el, p) {
      function rerender() { el.innerHTML = ''; tab.render(el, Goal.params()); }
      (p.v === 'cc' ? ccpm : dbr)(el, p, rerender);
    }
  };
  Goal.tab(tab);
})();

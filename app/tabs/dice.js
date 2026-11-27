/* Dice game: dependent events + statistical fluctuations, one round per step. URL: #/dice?r=&n=&rounds=&seed=&init=&slow=&lo=&hi=&hp=&rope=&buf= */
(function () {
  var h = Goal.h, s = Goal.s;
  var BLUE = '#4b5361', RED = '#c2352a', GRN = '#1f8a4c', INK = '#15181e', MUT = '#6b7280', TOK = '#c9a46a';
  /* Input limits. Dependent limits: slow position 1..stations, die low 1..high, die high low..6. */
  var LIM = { n: [2, 8], rounds: [1, 200], init: [0, 20], buf: [0, 40], die: [1, 6] };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, Math.round(v))); }
  function cfg(p) {
    var n = clamp(Goal.int(p, 'n', 5), LIM.n[0], LIM.n[1]), slow = p.slow === '1', hp = clamp(Goal.int(p, 'hp', 3), 1, n) - 1;
    var lo = clamp(Goal.int(p, 'lo', 1), LIM.die[0], LIM.die[1]), hi = clamp(Goal.int(p, 'hi', 4), lo, LIM.die[1]);
    var dice = [];
    for (var i = 0; i < n; i++) dice.push(slow && i === hp ? [lo, hi] : [1, 6]);
    return {
      stations: n, rounds: clamp(Goal.int(p, 'rounds', 20), LIM.rounds[0], LIM.rounds[1]), seed: Goal.int(p, 'seed', 7), dice: dice,
      rope: p.rope === '1', buffer: clamp(Goal.int(p, 'buf', 6), LIM.buf[0], LIM.buf[1]), initWip: clamp(Goal.int(p, 'init', 4), LIM.init[0], LIM.init[1]),
      slow: slow, hp: hp, lo: lo, hi: hi
    };
  }
  function face(v, x, y, sz, col, fill) {
    var g = s('g'), pips = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
    g.appendChild(s('rect', { x: x, y: y, width: sz, height: sz, rx: 5, fill: fill || '#fff', stroke: col, 'stroke-width': 2 }));
    (pips[v] || []).forEach(function (q) {
      g.appendChild(s('circle', { cx: x + sz * (0.25 + q[0] * 0.25), cy: y + sz * (0.25 + q[1] * 0.25), r: sz * 0.08, fill: col }));
    });
    return g;
  }
  function tokens(g, x, yBottom, q, per) {
    var rows = 4, cap = per * rows;
    for (var j = 0; j < Math.min(q, cap); j++) g.appendChild(s('rect', { x: x + (j % per) * 7, y: yBottom - 6 - Math.floor(j / per) * 7, width: 5, height: 5, rx: 1, fill: TOK }));
    if (q > cap) g.appendChild(s('text', { x: x, y: yBottom - 34, class: 'mt' }, '+' + (q - cap)));
  }
  /* Line diagram for one side. Compact: fits half of a 1440 px screen. */
  function line(res, k, c) {
    var n = c.stations, OUT = 64, W = 660, step = (W - OUT) / n, H = 84, rd = res.rounds[k];
    var g = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', class: 'dline' });
    g.appendChild(s('defs', null, s('marker', { id: 'ar', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, s('path', { d: 'M0 0L10 5L0 10z', fill: '#9aa3af' }))));
    var SZ = Math.min(28, step * 0.3), dieX = function (i) { return i * step + step - SZ - 22; }, DY = 18;
    for (var i = 0; i < n; i++) {
      var x0 = i * step + 2, dx = dieX(i), isH = c.slow && i === res.herbie, col = isH ? RED : BLUE;
      var starved = rd.moved[i] < rd.rolls[i], raw = i === 0 && !c.rope;
      if (raw) g.appendChild(s('text', { x: x0, y: 40, class: 'mt' }, 'raw ∞'));
      else {
        var after = rd.queues[i];
        tokens(g, x0, 50, after, Math.max(3, Math.floor((dx - x0 - 4) / 7)));
        g.appendChild(s('text', { x: x0, y: 64, class: 'mt' }, 'q ' + after));
      }
      g.appendChild(s('text', { x: dx, y: 12, style: 'font-weight:600;fill:' + col }, (isH ? 'H ' : 'S' + (i + 1) + ' ') + c.dice[i][0] + '–' + c.dice[i][1]));
      g.appendChild(face(rd.rolls[i], dx, DY, SZ, col, starved ? (isH ? '#fbeceb' : '#eef0f3') : null));
      g.appendChild(s('text', { x: dx, y: 64 }, rd.moved[i] + '/' + rd.rolls[i]));
      if (starved) g.appendChild(s('text', { x: dx, y: 78, style: 'font-weight:600;fill:' + (isH ? RED : MUT) }, '−' + (rd.rolls[i] - rd.moved[i])));
      var ax = dx + SZ + 3, bx = i < n - 1 ? (i + 1) * step + 1 : W - OUT + 6;
      if (bx - ax > 10) {
        g.appendChild(s('path', { d: 'M' + ax + ' ' + (DY + SZ / 2) + ' L' + bx + ' ' + (DY + SZ / 2), stroke: '#9aa3af', 'marker-end': 'url(#ar)', fill: 'none' }));
        g.appendChild(s('text', { x: (ax + bx) / 2, y: DY + SZ / 2 - 4, 'text-anchor': 'middle', style: 'font-weight:600' }, '+' + rd.moved[i]));
      }
    }
    if (c.rope) g.appendChild(s('text', { x: 2, y: 78, style: 'fill:' + GRN + ';font-weight:600' }, 'rope +' + rd.release));
    var ox = W - OUT + 10;
    g.appendChild(s('text', { x: ox, y: 12, class: 'mt' }, 'shipped'));
    g.appendChild(s('text', { x: ox, y: 40, style: 'font-size:20px;font-weight:700' }, String(rd.out)));
    g.appendChild(s('text', { x: ox, y: 64, class: 'mt' }, 'total ' + rd.cum));
    return g;
  }
  /* Optimal settings per problem (stations, dice set, rounds); cached, computed after first paint. */
  var OPT = {};
  function probKey(c) { return [c.stations, c.rounds, c.slow ? c.lo + '-' + c.hi : 'none'].join('|'); }
  function optCfg(c, st) {
    var hp = c.hp;
    var isSlow = function (d) { return d[0] === c.lo && d[1] === c.hi; };
    if (c.slow) hp = isSlow(st.dice[st.herbie]) ? st.herbie : st.dice.map(isSlow).indexOf(true);
    return { stations: c.stations, rounds: c.rounds, seed: c.seed, dice: st.dice, rope: st.rope, buffer: st.buffer, initWip: st.initWip, slow: c.slow, hp: hp, lo: c.lo, hi: c.hi };
  }
  function delta(v) { v = Math.round(v * 10) / 10; return (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v); }
  var tab = {
    id: 'dice', title: 'Dice game',
    render: function (el, p) {
      var c = cfg(p), k = (p.r === undefined ? c.rounds : Goal.int(p, 'r', c.rounds)) - 1, out = h('div'), T = Goal.term;
      function pl(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
      if (tab.timer) { clearInterval(tab.timer); tab.timer = null; }
      function go(r) {
        k = Math.min(Math.max(0, r), c.rounds - 1);
        Goal.set({ r: k + 1 });
        upd();
      }
      function play() {
        if (tab.timer) { clearInterval(tab.timer); tab.timer = null; upd(); return; }
        if (k >= c.rounds - 1) k = -1;
        tab.timer = setInterval(function () {
          if (!/^#\/dice/.test(location.hash) || k >= c.rounds - 1) { clearInterval(tab.timer); tab.timer = null; upd(); return; }
          go(k + 1);
        }, 450);
        go(k + 1);
      }
      tab.key = function (e) {
        if (/SELECT|TEXTAREA|BUTTON/.test(e.target.tagName) || e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') return;
        if (e.key === ' ') { e.preventDefault(); play(); return; }
        var m = { ArrowRight: k + 1, ArrowLeft: k - 1, Home: 0, End: c.rounds - 1 }[e.key];
        if (m === undefined) return;
        e.preventDefault(); go(m);
      };
      function summary(cc) {
        return [cc.slow ? 'Herbie at ' + (cc.hp + 1) : 'no slow station', 'start WIP ' + cc.initWip, cc.rope ? 'rope ' + cc.buffer : 'no rope'].join(' · ');
      }
      /* Starved rolls up to round k: count, lost units, and the station that lost the most. */
      function starve(res) {
        var n = 0, lost = 0, by = res.rounds[0].rolls.map(function () { return 0; });
        for (var r = 0; r <= k; r++) res.rounds[r].rolls.forEach(function (v, i) { var m = res.rounds[r].moved[i]; if (m < v) { n++; lost += v - m; by[i] += v - m; } });
        var worst = 0;
        by.forEach(function (v, i) { if (v > by[worst]) worst = i; });
        var hn = 0;
        if (c.slow) for (r = 0; r <= k; r++) if (res.rounds[r].moved[res.herbie] < res.rounds[r].rolls[res.herbie]) hn++;
        return { n: n, lost: lost, worst: worst, worstLost: by[worst], hn: hn, hLost: c.slow ? by[res.herbie] : 0 };
      }
      function side(title, sub, res, cc, best) {
        var rd = res.rounds[k];
        return h('div', { class: 'pc dc-side' + (best ? ' best' : '') },
          h('h3', null, title, h('small', null, sub)),
          h('div', { class: 'dc-scroll' }, line(res, k, cc)),
          h('div', { class: 'dc-mini' }, 'Round ' + (k + 1) + ': shipped ', h('b', null, rd.out), ' · total ', h('b', null, rd.cum), ' · WIP ', h('b', null, rd.wip),
            cc.rope ? [' · released ', h('b', null, rd.release)] : null));
      }
      function upd() {
        c = cfg(Goal.params());
        k = Math.min(Math.max(0, k), c.rounds - 1);
        var res = Goal.core.dice(c), key = probKey(c), opt = OPT[key];
        out.innerHTML = '';
        if (!opt) {
          out.appendChild(Goal.verdict({ q: 'Why does the line ship less than the average roll?', head: ['Round ' + (k + 1) + ' of ' + c.rounds + '.'], sub: 'Finding the best setup…' }));
          setTimeout(function () {
            if (!OPT[key]) OPT[key] = Goal.core.diceOptimal({ stations: c.stations, rounds: c.rounds, dice: c.dice, rope: c.rope, buffer: c.buffer, initWip: c.initWip });
            if (probKey(cfg(Goal.params())) === key) upd();
          }, 20);
          return;
        }
        var hl = Goal.core.diceHeadline(c, opt, k + 1), st = hl.optimal.settings;
        var oc = optCfg(c, st), ores = Goal.core.dice(oc), same = hl.mineOptimal;
        var rd = res.rounds[k], ob = ores.rounds[k], sv = starve(res);
        var minMean = Math.min.apply(null, c.dice.map(function (d) { return (d[0] + d[1]) / 2; }));
        var expect = Math.round((k + 1) * minMean), short = rd.cum < expect;
        var copy = function () { Goal.set({ hp: c.slow ? oc.hp + 1 : null, rope: oc.rope ? 1 : null, buf: oc.rope ? oc.buffer : null, init: oc.initWip }); rerender(); };
        var nextBook = same ? 'statistical-fluctuations' : oc.rope && !c.rope ? 'rope' : c.slow && oc.hp !== c.hp ? 'herbie-hike' : 'dependent-events';
        out.appendChild(h('div', { 'data-primary': '' }, Goal.verdict({
          q: 'Why does the line ship less than the average roll?',
          top: [Goal.runChip(!!(p.slow || p.rope || p.n), c.stations + ' stations · ' + c.rounds + ' rounds · seed ' + c.seed)],
          head: ['After ' + pl(k + 1, 'round') + ', the line shipped ', short ? { con: String(rd.cum) } : { good: String(rd.cum) }, ' of ' + expect + ' expected.'],
          sub: c.slow ? (sv.hn ? 'Herbie (station ' + (res.herbie + 1) + ') starved ' + pl(sv.hn, 'time') + ' and lost ' + pl(sv.hLost, 'unit') + '. The line cannot get that output back.' : 'Herbie (station ' + (res.herbie + 1) + ') never starved. Idle time at the other stations costs nothing.')
            : sv.n ? 'Stations starved ' + pl(sv.n, 'time') + ' and lost ' + pl(sv.lost, 'unit') + '. Station ' + (sv.worst + 1) + ' lost the most: ' + sv.worstLost + '.' : 'No station starved yet.',
          metrics: [
            { v: hl.mine.score, unit: hl.mine.grade, label: 'score, mean of 20 seeds · best ' + hl.optimal.score, tone: hl.mine.score >= 80 ? 'good' : hl.mine.score < 60 ? 'bad' : '' },
            { v: rd.cum, unit: 'units', label: 'shipped · best ' + ob.cum, tone: rd.cum < ob.cum ? 'bad' : '' },
            { v: rd.wip, unit: 'units', label: 'WIP · best ' + ob.wip, tone: rd.wip > ob.wip ? 'bad' : '' },
            c.slow ? { v: sv.hLost, unit: 'units', label: 'lost at Herbie · other stations ' + (sv.lost - sv.hLost), tone: sv.hLost ? 'bad' : 'good' } : { v: sv.lost, unit: 'units', label: 'lost to starved rolls' }
          ],
          next: { step: same ? 'Done' : 'Best setup', text: same ? 'Your setup is the best. Try a slower die or a longer line.' : 'Use ' + summary(oc) + '.', book: [nextBook] }
        })));

        /* Play bar: hands-on. */
        out.appendChild(h('div', { class: 'dc-bar' },
          h('button', { class: 'pri dc-play', onclick: play, title: 'Play (space)' }, tab.timer ? '❚❚ Pause' : '▶ Play'),
          h('button', { title: 'First (Home)', 'aria-label': 'first round', onclick: function () { go(0); }, disabled: k === 0 }, '⏮'),
          h('button', { title: 'Back (←)', 'aria-label': 'previous round', onclick: function () { go(k - 1); }, disabled: k === 0 }, '◀'),
          h('b', { class: 'dc-no' }, 'Round ' + (k + 1) + ' / ' + c.rounds),
          h('button', { title: 'Next (→)', 'aria-label': 'next round', onclick: function () { go(k + 1); }, disabled: k >= c.rounds - 1 }, '▶'),
          h('button', { title: 'Last (End)', 'aria-label': 'last round', onclick: function () { go(c.rounds - 1); }, disabled: k >= c.rounds - 1 }, '⏭'),
          h('input', { type: 'range', min: 1, max: c.rounds, value: k + 1, 'aria-label': 'round', oninput: function (e) { go(+e.target.value - 1); } })));

        /* What if. */
        out.appendChild(h('div', { class: 'whatif dc-in' }, h('b', null, 'What if'),
          Goal.check(T('slow-station', 'slow station'), 'slow', c.slow, rerender),
          c.slow ? h('label', null, T('die-range', 'die'),
            inputOf(Goal.num('', 'lo', c.lo, rerender, { min: LIM.die[0], max: c.hi, w: 52 })), '–',
            inputOf(Goal.num('', 'hi', c.hi, rerender, { min: c.lo, max: LIM.die[1], w: 52 }))) : null,
          c.slow ? h('label', null, T('slow-pos', 'Herbie at'), inputOf(Goal.num('', 'hp', c.hp + 1, rerender, { min: 1, max: c.stations, w: 52 })), h('span', { class: 'mut' }, 'of ' + c.stations)) : null,
          h('button', { 'data-term': 'herbie-front', onclick: function () { Goal.set({ hp: 1, slow: 1 }); rerender(); }, disabled: c.slow && c.hp === 0 }, 'Herbie to front'),
          Goal.check(T('rope'), 'rope', c.rope, rerender),
          c.rope ? Goal.num(T('buffer'), 'buf', c.buffer, re, { min: LIM.buf[0], max: LIM.buf[1], w: 60 }) : null,
          Goal.num(T('start-wip', 'start WIP'), 'init', c.initWip, re, { min: LIM.init[0], max: LIM.init[1], w: 60 }),
          h('button', { class: 'pri', disabled: same, onclick: copy }, same ? 'Your setup is the best' : 'Use best setup')));

        /* Proof: the two lines, then the totals. */
        out.appendChild(Goal.proofs('2', [side('Your line', summary(c), res, c), side('Best line', summary(oc), ores, oc, true)]));
        out.appendChild(h('div', { style: 'height:var(--gap)' }));
        var cum = function (r) { return r.rounds.map(function (x) { return x.cum; }); }, wip = function (r) { return r.rounds.map(function (x) { return x.wip; }); };
        out.appendChild(Goal.proofs('2', [
          Goal.proof('Total shipped', Goal.fit(function (w) {
            return Goal.line([
              { name: 'expected', values: res.rounds.map(function (_, i) { return (i + 1) * minMean; }), color: '#9aa1ad', dash: true },
              { name: 'yours', values: cum(res), color: INK }, { name: 'best', values: cum(ores), color: GRN }], { xlabel: 'round', w: w, h: 170, mark: k });
          }), { note: 'expected = rounds × slowest average roll' }),
          Goal.proof('WIP per round', Goal.fit(function (w) {
            return Goal.line([{ name: 'yours', values: wip(res), color: INK }, { name: 'best', values: wip(ores), color: GRN }], { xlabel: 'round', w: w, h: 170, mark: k });
          }), { note: 'units that wait in the queues' })
        ]));

        /* Rounds table and setup: closed. */
        var n = c.stations, sideCols = function (cls) {
          var r = [];
          for (var i = 0; i < n; i++) r.push(h('th', { class: 'n ' + (i === 0 ? cls : '') }, 'S' + (i + 1)));
          return r.concat([h('th', { class: 'n' }, 'out'), h('th', { class: 'n' }, 'total'), h('th', { class: 'n' }, 'WIP')]);
        };
        var cells = function (r, cls) {
          return r.rolls.map(function (v, j) { return h('td', { class: 'n' + (r.moved[j] < v ? ' starved' : '') + (j === 0 ? ' ' + cls : '') }, r.moved[j] + '/' + v); })
            .concat([h('td', { class: 'n' }, r.out), h('td', { class: 'n' }, r.cum), h('td', { class: 'n' }, r.wip)]);
        };
        var tbl = h('table', { class: 'rt rt2' },
          h('thead', null,
            h('tr', null, h('th', { rowspan: 2, class: 'n' }, 'round'), h('th', { colspan: n + 3, class: 'grp gl' }, 'Yours'), h('th', { colspan: n + 3, class: 'grp gl' }, 'Best'), h('th', { colspan: 2, class: 'grp gl' }, 'Yours − best')),
            h('tr', null, sideCols('gl'), sideCols('gl'), h('th', { class: 'n gl' }, 'total'), h('th', { class: 'n' }, 'WIP'))));
        var body = h('tbody');
        res.rounds.forEach(function (r, i) {
          var o = ores.rounds[i], dt = r.cum - o.cum, dw = r.wip - o.wip;
          body.appendChild(h('tr', { class: i === k ? 'on' : null, onclick: function () { go(i); } }, h('td', { class: 'n' }, i + 1),
            cells(r, 'gl'), cells(o, 'gl'),
            h('td', { class: 'n gl' + (dt < 0 ? ' starved' : '') }, delta(dt)), h('td', { class: 'n' + (dw > 0 ? ' starved' : '') }, delta(dw))));
        });
        tbl.appendChild(body);
        out.appendChild(Goal.drawer('Every round', 'moved / rolled · red = starved', h('div', { class: 'rtbox', style: 'max-height:420px' }, tbl)));
        out.appendChild(Goal.drawer('Setup', c.stations + ' stations · ' + c.rounds + ' rounds · seed ' + c.seed, h('div', { class: 'row dc-setup' },
          Goal.num(T('stations'), 'n', c.stations, re, { min: LIM.n[0], max: LIM.n[1], w: 64 }),
          Goal.num('rounds', 'rounds', c.rounds, re, { min: LIM.rounds[0], max: LIM.rounds[1], w: 68 }),
          Goal.num(T('seed'), 'seed', c.seed, re, { w: 68 }))));
      }
      function rerender() { el.innerHTML = ''; tab.render(el, Goal.params()); }
      var re = function () { upd(); };
      function inputOf(label) { return label.querySelector('input'); }
      el.appendChild(out);
      upd();
    }
  };
  document.addEventListener('keydown', function (e) { if (/^#\/dice/.test(location.hash) && tab.key) tab.key(e); });
  Goal.tab(tab);
})();

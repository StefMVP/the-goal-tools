/* Case charts: hero numbers, score card, severity findings, share bar, pareto bars, swimlane, before/after bars, dot chart, step diagram.
   HTML and CSS only. Docs: docs/cases.md. */
(function () {
  'use strict';
  var Goal = window.Goal, h = Goal.h;
  function pct(x) { return Math.round(x * 1000) / 10 + '%'; }
  function n1(x) { return Goal.n ? Goal.n(x) : Goal.fmt(Math.round(x * 10) / 10); }

  Goal.card = function (title, body, cls) { return h('div', { class: 'card ' + (cls || '') }, title ? h('h3', null, title) : null, body); };
  /* Collapsed detail section. */
  Goal.details = function (title, body, open) { return h('details', { class: 'cdet', open: !!open }, h('summary', null, title), body); };

  /* Book chip: concept id -> 'ch N · name'. A click opens the concept in the Map sidebar. ch: chapter (default: first chapter of the concept).
     A concept with no chapter in The Goal shows 'TOC'. An unknown id shows a red chip. */
  var cById = null;
  Goal.book = function (id, ch) {
    if (!cById) { cById = {}; (Goal.data.concepts || []).forEach(function (c) { cById[c.id] = c; }); }
    var c = cById[id];
    if (!c) { console.error('unknown concept', id); return h('span', { class: 'bchip err', 'data-concept': id }, 'unknown concept ' + id); }
    ch = ch || (c.chapters || [])[0];
    return h('a', { class: 'bchip', 'data-concept': id, href: '#/map?' + new URLSearchParams(ch ? { c: id, ch: ch } : { c: id }).toString(), title: c.one_line || c.name },
      h('b', null, ch ? 'ch ' + ch : 'TOC'), ' ', c.name);
  };
  /* Book rule line: one short rule from the book + its chips. ids: concept ids or [id, chapter]. */
  Goal.bookRule = function (text, ids) {
    return h('div', { class: 'brule' }, h('span', { class: 'brule-k' }, 'Book'), h('b', null, text),
      (ids || []).map(function (x) { return Array.isArray(x) ? Goal.book(x[0], x[1]) : Goal.book(x); }));
  };

  /* items: [{v, label, sub, tone: good|bad|warn}] */
  Goal.hero = function (items) {
    return h('div', { class: 'hero' }, items.map(function (x) {
      return h('div', { class: 'hcard ' + (x.tone || '') }, h('b', null, x.v), h('div', { class: 'hl' }, x.label), x.sub ? h('div', { class: 'mut hs' }, x.sub) : null);
    }));
  };

  /* parts: [{label, v, color}]. One bar, width = share of the total. */
  Goal.shareBar = function (parts) {
    var tot = parts.reduce(function (a, p) { return a + p.v; }, 0) || 1;
    return h('div', { class: 'sbar' }, parts.map(function (p) {
      var s = p.v / tot;
      return h('div', { class: 'sseg' + (s < 0.07 ? ' thin' : ''), style: 'flex:' + p.v + ' 1 0;background:' + p.color, title: p.label + ' ' + pct(s) },
        h('span', null, p.label), h('b', null, Math.round(s * 100) + '%'));
    }));
  };

  /* rows: [{label, v, color, chip, cells}]. opt: {unit, cum (default true), head: [cell labels]}. Sorted by v. */
  Goal.pareto = function (rows, opt) {
    opt = opt || {};
    var tot = rows.reduce(function (a, r) { return a + r.v; }, 0) || 1, max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1e-9])), cum = 0;
    var cumOn = opt.cum !== false;
    return h('table', { class: 'pbars' },
      h('tr', null, h('th', null, ''), h('th', null, opt.unit || ''), h('th', { class: 'n' }, 'share'), cumOn ? h('th', { class: 'n' }, 'cum.') : null,
        (opt.head || []).map(function (x) { return h('th', null, x); })),
      rows.slice().sort(function (a, b) { return b.v - a.v; }).map(function (r) {
        cum += r.v;
        return h('tr', { class: r.hi ? 'hi' : null, 'data-row': r.id || null },
          h('td', null, h('i', { class: 'dot', style: 'background:' + r.color }), r.label, r.chip ? h('span', { class: 'ochip' }, r.chip) : null),
          h('td', { class: 'pb' }, h('span', { class: 'pbar', style: 'width:' + (100 * r.v / max) + '%;background:' + r.color }), h('span', { class: 'pv' }, n1(r.v))),
          h('td', { class: 'n' }, h('b', null, pct(r.v / tot))), cumOn ? h('td', { class: 'n mut' }, Math.round(100 * cum / tot) + '%') : null,
          (r.cells || []).map(function (c) { return h('td', { class: 'n' }, c); }));
      }));
  };

  /* lanes: [{id, sub, segs: [{k, s, e, open}], live}]. Times: ISO, UTC. opt: {colors: {k}, labels: {k}, asOf}. */
  Goal.swimlane = function (lanes, opt) {
    var T = function (s) { return Date.parse(s.length <= 16 ? s + 'Z' : s); }, D = 864e5;
    var t0 = Infinity, t1 = opt.asOf ? T(opt.asOf) : -Infinity;
    lanes.forEach(function (l) { l.segs.forEach(function (g) { t0 = Math.min(t0, T(g.s)); t1 = Math.max(t1, T(g.e)); }); });
    t0 = Math.floor(t0 / D) * D;
    var X = function (t) { return 100 * (t - t0) / (t1 - t0) + '%'; };
    var ticks = [];
    for (var t = t0; t <= t1; t += D) if (new Date(t).getUTCDay() === 1) ticks.push(t);
    var lab = function (t) { return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };
    var keys = Object.keys(opt.colors);
    return h('div', { class: 'swim' },
      h('div', { class: 'slg' }, keys.map(function (k) { return h('span', null, h('i', { class: 'dot', style: 'background:' + opt.colors[k] }), (opt.labels || {})[k] || k); }),
        h('span', null, h('i', { class: 'dot hatch' }), 'open'), h('span', null, h('i', { class: 'dot', style: 'background:var(--grn);border-radius:50%' }), 'live')),
      h('div', { class: 'srow sax' }, h('div', { class: 'sl' }), h('div', { class: 'st' }, ticks.map(function (t) { return h('span', { class: 'tick', style: 'left:' + X(t) }, lab(t)); }))),
      lanes.map(function (l) {
        var last = l.segs[l.segs.length - 1], open = last && last.open;
        var end = l.live ? h('span', { class: 'sel live' }, '● live')
          : open ? h('span', { class: 'sel open' }, Math.round((t1 - T(l.segs[0].s)) / D) + ' d open') : h('span', { class: 'sel mut' }, 'closed');
        return h('div', { class: 'srow' }, h('div', { class: 'sl' }, h('b', null, l.id), ' ', h('span', { class: 'mut' }, l.sub || '')),
          h('div', { class: 'st' }, ticks.map(function (t) { return h('span', { class: 'grid', style: 'left:' + X(t) }); }),
            l.segs.map(function (g) {
              var a = T(g.s), b = Math.max(T(g.e), a + D / 24);
              return h('span', { class: 'seg' + (g.open ? ' hatch' : ''), title: ((opt.labels || {})[g.k] || g.k) + ' ' + n1((T(g.e) - a) / D) + ' d' + (g.open ? ', open' : ''),
                style: 'left:' + X(a) + ';width:calc(' + X(b) + ' - ' + X(a) + ');background-color:' + opt.colors[g.k] });
            }),
            l.live ? h('span', { class: 'lmark', style: 'left:' + X(T(l.live)) }) : null),
          end);
      }),
      h('div', { class: 'srow' }, h('div', { class: 'sl' }), h('div', { class: 'st now' }, h('span', { class: 'tick', style: 'left:100%' }, 'now'))));
  };

  /* rows: [{label, before, after, verdict, conf}]. opt: {unit, better: down|up}. Grey = before, color = after (verdict color, else better/worse). */
  Goal.beforeAfter = function (rows, opt) {
    opt = opt || {};
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(r.before, r.after); }));
    return h('div', { class: 'ba' }, rows.map(function (r) {
      var d = Math.round((r.after - r.before) * 10) / 10;
      var tone = !d ? 'neutral' : (d < 0) === (opt.better !== 'up') ? 'good' : 'bad';
      return h('div', { class: 'barow', 'data-row': r.id || null },
        h('div', { class: 'bal' }, r.verdict ? Goal.verdict(r.verdict) : null, r.label),
        h('div', { class: 'bat' }, h('span', { class: 'bb', style: 'width:' + (85 * r.before / max) + '%' }),
          h('span', { class: 'baa ' + tone + (r.verdict ? ' v-' + r.verdict : ''), style: 'width:' + (85 * r.after / max) + '%' }, h('em', null, n1(r.after)))),
        Goal.badge({ v: d, conf: r.conf || 'simulated', better: opt.better || 'down' }, opt.unit));
    }));
  };

  /* rows: [{label, a, b, lo, hi}]: a = observed (fill), b = model (ring), lo-hi = model band. Own scale per row. */
  Goal.dots = function (rows, opt) {
    opt = opt || {};
    return h('div', { class: 'dots' }, h('div', { class: 'dlg mut' }, h('i', { class: 'dt a' }), opt.a || 'observed', ' ', h('i', { class: 'dt b' }), opt.b || 'model'),
      rows.map(function (r) {
        var m = Math.max(r.a, r.b, r.hi || 0) * 1.15 || 1, P = function (x) { return 100 * x / m + '%'; };
        var err = r.a ? Math.round(100 * (r.b - r.a) / r.a) : null;
        return h('div', { class: 'drow' }, h('div', { class: 'dl' }, r.label),
          h('div', { class: 'dtr' }, r.lo != null ? h('span', { class: 'band', style: 'left:' + P(r.lo) + ';width:calc(' + P(r.hi) + ' - ' + P(r.lo) + ')' }) : null,
            h('i', { class: 'dt a', style: 'left:' + P(r.a), title: 'observed ' + n1(r.a) }), h('i', { class: 'dt b', style: 'left:' + P(r.b), title: 'model ' + n1(r.b) })),
          h('div', { class: 'dv' }, n1(r.a), ' / ', n1(r.b), err == null ? '' : h('span', { class: Math.abs(err) > 20 ? 'bad' : 'mut' }, ' ' + (err > 0 ? '+' : '') + err + '%')));
      }));
  };

  /* values: numbers. Small trend line, last point marked. */
  Goal.spark = function (values, opt) {
    opt = opt || {};
    var W = opt.w || 120, H = opt.h || 30, lo = Math.min.apply(null, values), hi = Math.max.apply(null, values), r = hi - lo || 1;
    var pts = values.map(function (v, i) { return [values.length > 1 ? 2 + (W - 4) * i / (values.length - 1) : W / 2, H - 3 - (H - 6) * (v - lo) / r]; });
    var c = opt.color || 'var(--acc)', last = pts[pts.length - 1];
    return Goal.s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'spark' },
      Goal.s('polyline', { points: pts.map(function (p) { return p.join(','); }).join(' '), fill: 'none', stroke: c, 'stroke-width': 2 }),
      Goal.s('circle', { cx: last[0], cy: last[1], r: 3, fill: c }));
  };

  /* steps: [{n, label, actor, where, v (median d), chip: {text, tone}, con}]. Horizontal boxes. */
  Goal.steps = function (steps, opt) {
    opt = opt || {};
    var max = opt.max || Math.max.apply(null, steps.map(function (s) { return s.v || 0; }).concat([1e-9]));
    return h('div', { class: 'steps' }, steps.map(function (s) {
      return h('div', { class: 'step' + (s.con ? ' con' : ''), 'data-row': s.id || null },
        h('div', { class: 'sn mut' }, s.n), h('div', { class: 'sh' }, s.label), h('div', { class: 'sa mut' }, s.actor, s.where ? ' · ' + s.where : ''),
        s.v == null ? null : h('div', { class: 'sbr' }, h('span', { style: 'width:' + (100 * s.v / max) + '%' })),
        h('div', { class: 'sv' }, h('b', null, s.v == null ? (s.vText || '-') : n1(s.v) + ' ' + (opt.unit || 'd'))),
        s.chip ? h('span', { class: 'fchip ' + (s.chip.tone || '') }, s.chip.text) : null);
    }));
  };

  /* Score card. o: {v, max (default 100), grade, label, gauges: [{k, label, level: weak|fair|good, v}]}. v of a gauge: its one key number. */
  var LEVEL = { weak: 0, fair: 1, good: 2 }, LCOL = ['var(--red)', 'var(--yel)', 'var(--grn)'];
  function gauge(g) {
    var s = Goal.s, lv = LEVEL[g.level], bad = lv === undefined, R = 26, cx = 32, cy = 30;
    var pt = function (a, r) { return (cx - r * Math.cos(a)).toFixed(1) + ' ' + (cy - r * Math.sin(a)).toFixed(1); };
    var svg = s('svg', { viewBox: '0 0 64 36', width: 64, height: 36 });
    [0, 1, 2].forEach(function (i) {
      svg.appendChild(s('path', { d: 'M' + pt(i * Math.PI / 3 + 0.04, R) + ' A' + R + ' ' + R + ' 0 0 1 ' + pt((i + 1) * Math.PI / 3 - 0.04, R), fill: 'none', 'stroke-width': 7, stroke: LCOL[i], opacity: i === lv ? 1 : 0.25 }));
    });
    var a = (lv + 0.5) * Math.PI / 3;
    if (!bad) svg.appendChild(s('line', { x1: cx, y1: cy, x2: cx - (R - 8) * Math.cos(a), y2: cy - (R - 8) * Math.sin(a), stroke: '#1d2330', 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
    return h('div', { class: 'gauge', 'data-err': bad ? 'level not weak|fair|good' : null }, svg,
      h('div', null, h('div', { class: 'gk' }, h('b', null, g.k), ' ', g.label), h('div', { class: 'gl', style: bad ? '' : 'color:' + LCOL[lv] }, bad ? 'level?' : g.level), g.v ? h('div', { class: 'gv' }, g.v) : null));
  }
  Goal.score = function (o) {
    var s = Goal.s, max = o.max || 100, f = Math.max(0, Math.min(1, o.v / max)), R = 34, C = 2 * Math.PI * R;
    var col = f < 0.5 ? 'var(--red)' : f < 0.75 ? 'var(--yel)' : 'var(--grn)';
    var ring = s('svg', { viewBox: '0 0 84 84', width: 84, height: 84 },
      s('circle', { cx: 42, cy: 42, r: R, fill: 'none', stroke: 'var(--line)', 'stroke-width': 9 }),
      s('circle', { cx: 42, cy: 42, r: R, fill: 'none', stroke: col, 'stroke-width': 9, 'stroke-dasharray': (C * f).toFixed(1) + ' ' + C.toFixed(1), transform: 'rotate(-90 42 42)', 'stroke-linecap': 'round' }),
      s('text', { x: 42, y: 47, 'text-anchor': 'middle', style: 'font-size:22px;font-weight:800;fill:#1d2330' }, String(o.v)));
    return h('div', { class: 'score' },
      h('div', { class: 'score-m' }, ring, h('div', null, h('div', { class: 'score-g', style: 'color:' + col }, o.grade || ''), h('div', { class: 'mut hs' }, o.v + ' / ' + max), h('div', { class: 'mut hs' }, o.label || ''))),
      h('div', { class: 'score-gs' }, (o.gauges || []).map(gauge)));
  };

  /* Findings ranked by severity. list: [{id, sev: critical|high|medium|low, text, ev: badge, act, eff: badge, book: element}].
     text: headline. ev: one evidence badge. act: one action. eff: its effect badge. Badges: same fields as Goal.rows. Sorted by sev. */
  var SEV = ['critical', 'high', 'medium', 'low'];
  Goal.SEV = SEV;
  Goal.findingErrors = function (f) {
    var e = SEV.indexOf(f && f.sev) < 0 ? ['sev not ' + SEV.join('|')] : [];
    return e.concat(Goal.rowErrors({ text: f.text, badge: f.ev }).map(function (x) { return 'evidence ' + x; }),
      Goal.rowErrors({ text: f.act, badge: f.eff }).map(function (x) { return 'action ' + x.replace('headline', 'action'); }));
  };
  Goal.findings = function (list) {
    var rank = function (f) { var i = SEV.indexOf(f.sev); return i < 0 ? -1 : i; };
    return h('div', { class: 'fnds' }, list.slice().sort(function (a, b) { return rank(a) - rank(b); }).map(function (f) {
      var err = Goal.findingErrors(f);
      return h('div', { class: 'frow sev-' + f.sev, 'data-row': f.id || null, 'data-err': err.length ? err.join('; ') : null },
        h('span', { class: 'sevc' }, f.sev),
        h('div', { class: 'fnd-h' }, f.text),
        h('div', { class: 'fnd-e' }, err.length ? h('span', { class: 'bdg err' }, err[0]) : Goal.badge(f.ev)),
        h('div', { class: 'fnd-a' }, f.act),
        h('div', { class: 'fnd-f' }, err.length ? null : Goal.badge(f.eff)),
        h('div', { class: 'fnd-b' }, f.book || null));
    }));
  };

  /* ---- Verdict layout. One page = question, verdict, numbers, next step; then proof cards. ----
     o: {q, head: [text | {con: text} | {good: text}], sub, metrics: [{v, unit, label, tone}], next: {step, text, book: [id, ch]}, top: [nodes]} */
  Goal.verdict = function (o) {
    var head = (o.head || []).map(function (x) { return typeof x === 'string' ? x : h('span', { class: x.con ? 'con' : 'good' }, x.con || x.good); });
    return h('section', { class: 'vd', 'data-verdict': '' },
      h('div', { class: 'vd-top' }, o.q ? h('div', { class: 'vd-q' }, o.q) : null, o.top || null),
      h('h1', { class: 'vd-h' }, head),
      o.sub ? h('p', { class: 'vd-s' }, o.sub) : null,
      o.metrics && o.metrics.length ? h('div', { class: 'vd-m' }, o.metrics.map(function (m) {
        return h('div', { class: 'vd-mi ' + (m.tone || '') }, h('b', null, Goal.fmt(m.v), m.unit ? h('small', null, m.unit) : null), h('span', null, m.label));
      })) : null,
      o.next ? h('div', { class: 'vd-n' }, h('b', null, 'Next'), o.next.step ? h('span', { class: 'mut' }, o.next.step) : null, h('span', null, o.next.text),
        o.next.book ? Goal.book(o.next.book[0], o.next.book[1]) : null) : null);
  };
  /* Proof card. title: short sentence case; note: small gray text; act: node at the right of the title. */
  Goal.proof = function (title, body, o) {
    o = o || {};
    return h('div', { class: 'pc ' + (o.cls || ''), 'data-proof': '' }, title ? h('h3', null, title, o.note ? h('small', null, o.note) : null, o.act ? h('span', { class: 'pa' }, o.act) : null) : null, body);
  };
  /* Grid of proof cards. kind: '2' | '21' | '12'. */
  Goal.proofs = function (kind, cards) { return h('div', { class: 'pf pf' + kind }, cards); };
  Goal.sec = function (text) { return h('div', { class: 'sec' }, text); };
  /* Closed panel at the foot of a page for inputs and raw data. */
  Goal.drawer = function (title, note, body, open) {
    return h('details', { class: 'drawer', open: !!open }, h('summary', null, title, note ? h('small', null, note) : null), h('div', null, body));
  };
  /* Agent runs: window.GOAL_RUNS (local/runs.js, written by bin/goal --show). */
  Goal.run = function (p) { var r = (window.GOAL_RUNS || {})[p && p.run]; return r || null; };
  Goal.runChip = function (run, text) {
    return h('span', { class: 'runchip' + (run ? '' : ' ex'), title: run ? 'Result of an agent run (bin/goal --show)' : 'Built-in example' }, h('i'), text);
  };
  /* Segmented control. opts: [[value, label]]. */
  Goal.seg = function (opts, val, onpick) {
    return h('span', { class: 'seg-c' }, opts.map(function (o) {
      return h('button', { class: String(o[0]) === String(val) ? 'on' : null, onclick: function () { onpick(o[0]); } }, o[1]);
    }));
  };
  /* Colors: the constraint is red; every other stage is a gray. */
  Goal.CON = '#c2352a';
  Goal.GRAYS = ['#8a929f', '#c3c9d2', '#6f7784', '#a9b0bb', '#d6dae0', '#959ca8', '#b8bec7'];
  Goal.GRAY = '#c3c9d2';
  Goal.stageColors = function (order, con) {
    var m = {}, i = 0;
    order.forEach(function (k) { m[k] = k === con ? Goal.CON : Goal.GRAYS[i++ % Goal.GRAYS.length]; });
    return m;
  };
  Goal.legend = function (col) {
    return h('div', { class: 'lg' }, Object.keys(col).map(function (k) { return h('span', null, h('i', { style: 'background:' + col[k] }), k); }));
  };
  /* Number with sensible precision: >= 100 -> integer, >= 10 -> 1 decimal, else up to 2. */
  Goal.n = function (v) {
    if (typeof v !== 'number' || !isFinite(v)) return v;
    var a = Math.abs(v);
    return a >= 100 ? String(Math.round(v)) : a >= 1 ? String(Math.round(v * 10) / 10) : String(Math.round(v * 100) / 100);
  };
})();

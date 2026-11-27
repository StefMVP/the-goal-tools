/* Bottleneck finder: CSV of work items with stage timestamps. Math: GoalCore.analyze. */
(function () {
  var h = Goal.h, s = Goal.s, T = Goal.term, KEY = 'goal.finder.csv';
  function stageColor(order) {
    var m = {};
    order.forEach(function (k, i) { m[k] = Goal.colors[i % Goal.colors.length]; });
    return m;
  }
  function pareto(list, color, o) {
    o = o || {};
    var W = o.w || 520, rowH = 20, L = 130, R = 110, H = list.length * rowH + 20, max = Math.max.apply(null, list.map(function (x) { return x.days; }).concat([1e-9]));
    var g = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', style: 'max-width:' + W + 'px' });
    var pts = [];
    list.forEach(function (x, i) {
      var y = i * rowH + 2, w = (W - L - R) * x.days / max;
      g.appendChild(s('text', { x: L - 6, y: y + 14, 'text-anchor': 'end', style: i === 0 && o.top ? 'font-weight:700' : null }, x.key));
      g.appendChild(s('rect', { x: L, y: y + 3, width: w, height: rowH - 6, rx: 2, fill: color(x.key, i) }));
      g.appendChild(s('text', { x: L + w + 4, y: y + 14, class: 'mt' }, Math.round(x.days) + ' d · ' + Math.round(x.share * 100) + '%'));
      pts.push([W - 40, y + rowH / 2, x.cumShare]);
    });
    g.appendChild(s('text', { x: W - 4, y: H - 4, 'text-anchor': 'end', class: 'mt' }, 'cum %'));
    pts.forEach(function (q) {
      g.appendChild(s('text', { x: W - 4, y: q[1] + 4, 'text-anchor': 'end', style: q[2] <= 0.8 ? 'font-weight:700' : 'fill:#6b7280' }, Math.round(q[2] * 100) + '%'));
    });
    return g;
  }
  function lanes(res, col, sel, onpick, W) {
    W = W || 1300;
    var L = 60, rowH = 14, span = res.span || 1, H = res.lanes.length * rowH + 24;
    var X = function (d) { return L + (W - L - 10) * d / span; };
    var g = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%' });
    for (var d = 0; d <= span; d += 7) {
      g.appendChild(s('line', { class: 'ax', x1: X(d), x2: X(d), y1: 0, y2: H - 18 }));
      g.appendChild(s('text', { class: 'mt', x: X(d), y: H - 6, 'text-anchor': 'middle' }, 'd' + d));
    }
    res.lanes.forEach(function (ln, i) {
      var y = i * rowH;
      g.appendChild(s('text', { x: L - 4, y: y + 10, 'text-anchor': 'end', style: ln.id === sel ? 'font-weight:700' : 'fill:#6b7280', onclick: function () { onpick(ln.id); } }, ln.id));
      ln.segments.forEach(function (sg) {
        var r = s('rect', { x: X(sg.start), y: y + 2, width: Math.max(1, X(sg.start + sg.days) - X(sg.start)), height: rowH - 4, fill: col[sg.stage], opacity: sel && ln.id !== sel ? 0.35 : 1, stroke: sg.open ? '#15181e' : 'none', 'stroke-dasharray': sg.open ? '2 2' : null, onclick: function () { onpick(ln.id); } });
        r.appendChild(s('title', null, ln.id + ' · ' + sg.stage + ' · ' + sg.days + ' d' + (sg.cause ? ' · ' + sg.cause : '') + (sg.open ? ' · open' : '')));
        g.appendChild(r);
      });
    });
    return g;
  }
  function cap(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
  function med(a) { a = a.slice().sort(function (x, y) { return x - y; }); var n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : 0; }
  Goal.tab({
    id: 'finder', title: 'Bottleneck finder',
    render: function (el, p) {
      var run = Goal.run(p), src = run ? 'run' : (p.src || 'example'), sel = p.id || '';
      var EX = (Goal.data.examples || {}).orders || '';
      var csv = run ? run.csv : src === 'local' ? (localStorage.getItem(KEY) || '') : EX;
      var name = run ? run.name : src === 'local' ? (localStorage.getItem(KEY + '.name') || 'pasted') : 'example orders';
      var unit = (run && run.unit) || p.unit || 'item', asOf = p.asof || (run && run.asOf) || '';
      var out = h('div');
      function rows(t) { return Math.max(0, String(t).split('\n').filter(function (x) { return x.trim(); }).length - 1); }
      function openImport() {
        var ta = h('textarea', { rows: 14, spellcheck: 'false', 'aria-label': 'CSV' }), nm = name, err = h('span', { class: 'mut' });
        ta.value = csv;
        ta.addEventListener('input', function () { nm = 'pasted'; });
        var d = Goal.modal('Import work items', h('div', { class: 'modal-body' },
          h('div', { class: 'mut' }, 'id, stage, start, end, cause, owner · ISO dates · empty end = open'),
          ta,
          h('div', { class: 'acts' },
            h('button', { onclick: function () { Goal.readFile(function (t, f) { ta.value = t; nm = f ? f.name : 'file'; }); } }, 'Load file'),
            h('button', { onclick: function () { ta.value = EX; nm = 'example orders'; } }, 'Load example'),
            err,
            h('button', { class: 'pri', onclick: function () {
              try { if (!Goal.core.analyze(Goal.core.parseCsv(ta.value)).rows) throw new Error('no rows'); } catch (e) { err.textContent = 'error: ' + e.message; return; }
              d.close();
              if (nm === 'example orders' && ta.value === EX) Goal.go('finder');
              else { localStorage.setItem(KEY, ta.value); localStorage.setItem(KEY + '.name', nm); Goal.go('finder', { src: 'local' }); }
            } }, 'Analyze'))));
        ta.focus();
      }
      function upd() {
        out.innerHTML = '';
        var res;
        try { res = Goal.core.analyze(Goal.core.parseCsv(csv), { asOf: asOf || undefined }); } catch (e) { out.appendChild(h('div', { class: 'mut' }, 'error: ' + e.message)); return; }
        if (!res.rows) { out.appendChild(h('div', { class: 'mut' }, 'no rows')); return; }
        var c = res.constraint, con = c.stage, U = unit + 's', UD = unit + '-days';
        var col = Goal.stageColors(res.stages.map(function (x) { return x.stage; }), con);
        var cs = res.stages.filter(function (x) { return x.stage === con; })[0];
        var others = med(res.stages.filter(function (x) { return x.stage !== con; }).map(function (x) { return x.median; }));
        var openCon = res.aging.filter(function (a) { return a.stage === con; });
        /* Top cause at the constraint: days with a cause, from the lanes. */
        var cause = {};
        res.lanes.forEach(function (ln) { ln.segments.forEach(function (g) { if (g.stage === con && g.cause) cause[g.cause] = (cause[g.cause] || 0) + g.days; }); });
        var topCause = Object.keys(cause).sort(function (a, b) { return cause[b] - cause[a]; })[0];
        var second = res.pareto[1], close = second && second.share * 1.3 > c.share;
        out.appendChild(Goal.verdict({
          q: 'Which stage sets the pace?',
          top: [Goal.runChip(run, name + ' · ' + res.items + ' ' + U + (asOf ? ' · as of ' + asOf.replace('T', ' ') : ''))],
          head: [{ con: cap(con) }, close ? ' is probably the constraint.' : ' is the constraint.'],
          sub: Math.round(c.share * 100) + '% of all ' + UD + ' are at ' + con + '. A ' + unit + ' stays there ' + Goal.n(cs.median) + ' d (median); at the other stages, ' + Goal.n(others) + ' d.' +
            (close ? ' ' + cap(second.key) + ' is close: ' + Math.round(second.share * 100) + '%.' : ''),
          metrics: [
            { v: Math.round(c.share * 100), unit: '%', label: 'of ' + UD + ' at ' + con, tone: 'bad' },
            { v: Goal.n(cs.median), unit: 'd', label: 'median time at ' + con },
            { v: openCon.length, unit: openCon.length ? 'open · oldest ' + Goal.n(openCon[0].age) + ' d' : 'open', label: U + ' that wait at ' + con },
            { v: Goal.n(res.leadTime.median), unit: 'd', label: 'median lead time · ' + res.leadTime.done + ' done' }
          ],
          next: { step: 'Step 2 · Exploit', text: 'Use every hour of ' + con + ' on good work.' + (topCause ? ' Remove the top cause there first: ' + topCause + '.' : ''), book: ['exploit-constraint'] }
        }));
        var pick = function (id) { sel = sel === id ? '' : id; Goal.set({ id: sel || null }); upd(); };
        var detail = null;
        if (sel) {
          var ln = res.lanes.filter(function (l) { return l.id === sel; })[0];
          if (ln) detail = h('div', { style: 'margin-bottom:10px' }, h('table', { style: 'width:100%' },
            h('tr', null, h('th', null, sel), h('th', { class: 'n' }, 'start d'), h('th', { class: 'n' }, 'days'), h('th', null, 'cause'), h('th', null, 'owner')),
            ln.segments.map(function (g) { return h('tr', null, h('td', { class: g.stage === con ? 'con' : null }, g.stage + (g.open ? ' (open)' : '')), h('td', { class: 'n' }, Goal.n(g.start)), h('td', { class: 'n' }, Goal.n(g.days)), h('td', null, g.cause), h('td', null, g.owner)); })));
        }
        var causeCon = function (k, i) { return k === topCause ? Goal.CON : Goal.GRAY; };
        out.appendChild(Goal.proofs('2', [
          Goal.proof('Where the ' + UD + ' go', Goal.fit(function (w) { return pareto(res.pareto, function (k) { return k === con ? Goal.CON : Goal.GRAY; }, { top: true, w: w }); }), { note: T('pareto', 'Pareto') }),
          Goal.proof('Why ' + U + ' wait', res.causes.length ? Goal.fit(function (w) { return pareto(res.causes, causeCon, { w: w }); }) : h('div', { class: 'mut' }, 'no cause column'),
            { note: topCause ? 'red = top cause at ' + con : '' })
        ]));
        var ag = res.aging.slice(0, 14);
        out.appendChild(h('div', { style: 'height:var(--gap)' }));
        out.appendChild(Goal.proofs('21', [
          Goal.proof('Every ' + unit + ', start to end', h('div', null, Goal.legend(col), detail,
            h('div', { class: 'scroll', style: 'max-height:460px' }, Goal.fit(function (w) { return lanes(res, col, sel, pick, w); }))), { note: 'dashed = open · click a row' }),
          h('div', { class: 'stack' },
            Goal.proof('Open ' + U + ' by stage', Goal.fit(function (w) {
              return Goal.hbars(res.stages.map(function (x) { return { label: x.stage, value: x.open, color: x.stage === con ? Goal.CON : Goal.GRAY, note: String(x.open) }; }),
                { w: w, right: 40, max: Math.max.apply(null, res.stages.map(function (x) { return x.open; }).concat([1])) });
            })),
            Goal.proof('Oldest open ' + U, ag.length ? Goal.fit(function (w) {
              return Goal.hbars(ag.map(function (a) { return { label: a.id, value: a.age, color: a.stage === con ? Goal.CON : Goal.GRAY, note: Goal.n(a.age) + ' d · ' + a.stage }; }),
                { left: 60, right: 150, w: w, rowH: 17, max: Math.max(ag[0].age, 1) });
            }) : h('div', { class: 'mut' }, 'no open ' + U), { note: T('wip-aging', 'WIP aging') }))
        ]));
        var st = h('table', { style: 'width:100%' }, h('tr', null, h('th', null, 'stage'), h('th', { class: 'n' }, U), h('th', { class: 'n' }, UD), h('th', { class: 'n' }, 'median d'), h('th', { class: 'n' }, 'open')),
          res.stages.map(function (x) {
            return h('tr', null, h('td', { class: x.stage === con ? 'con' : null }, x.stage), h('td', { class: 'n' }, x.items), h('td', { class: 'n' }, Math.round(x.days)), h('td', { class: 'n' }, Goal.n(x.median)), h('td', { class: 'n' }, x.open));
          }));
        out.appendChild(Goal.drawer('Data', name + ' · ' + rows(csv) + ' rows · span ' + Goal.n(res.span) + ' d', h('div', { class: 'stack' },
          h('div', { class: 'row', style: 'align-items:center' },
            h('button', { onclick: openImport }, 'Import CSV'),
            h('label', { class: 'mut' }, 'as of ', h('input', { type: 'text', placeholder: 'last time in data', value: p.asof || '', style: 'width:160px', onchange: function (e) { Goal.set({ asof: e.target.value || null }); asOf = e.target.value || (run && run.asOf) || ''; upd(); } })),
            h('span', { class: 'mut' }, run ? 'agent run ' + p.run : src === 'local' ? 'saved in this browser' : 'built-in example')),
          st)));
      }
      el.appendChild(out);
      upd();
    }
  });
})();

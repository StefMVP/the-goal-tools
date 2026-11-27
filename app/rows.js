/* Case rows: one plain headline and one effect badge per row. Docs: docs/cases.md. */
(function () {
  'use strict';
  var Goal = window.Goal;
  var CONF = ['measured', 'estimated', 'simulated', 'assumed'];
  var VERDICT = ['do', 'stop', 'test', 'no'];
  Goal.ROW_CONF = CONF;
  Goal.ROW_VERDICT = VERDICT;

  /* row: {id, text, badge: {v, unit, conf, better, tone}, verdict, to, cells}. unit: section unit. Returns a list of errors. */
  Goal.rowErrors = function (row, unit) {
    var e = [], b = row && row.badge;
    if (!row || typeof row.text !== 'string' || !row.text.trim()) e.push('no headline');
    if (!b || typeof b !== 'object' || Array.isArray(b)) return e.concat('no badge');
    if (b.v === undefined || b.v === null || b.v === '') e.push('badge: no value');
    var u = b.unit || unit;
    if (!u) e.push('badge: no unit');
    else if (unit && b.unit && b.unit !== unit) e.push('badge: unit ' + b.unit + ', section unit ' + unit);
    if (CONF.indexOf(b.conf) < 0) e.push('badge: confidence not ' + CONF.join('|'));
    if (typeof b.v === 'number' && b.v !== 0 && !b.tone && ['up', 'down'].indexOf(b.better) < 0) e.push('badge: number needs better up|down or tone');
    if (row.verdict && VERDICT.indexOf(row.verdict) < 0) e.push('verdict not ' + VERDICT.join('|'));
    return e;
  };

  function tone(b) {
    if (b.tone) return b.tone;
    if (typeof b.v !== 'number' || !b.v) return 'neutral';
    return (b.v < 0) === (b.better === 'down') ? 'good' : 'bad';
  }
  function text(b, unit) {
    var v = b.v;
    if (typeof v === 'string') return v;
    return (b.better && v > 0 ? '+' : v < 0 ? '−' : '') + Goal.fmt(Math.abs(v)) + ' ' + (b.unit || unit);
  }
  Goal.badge = function (b, unit) {
    return Goal.h('span', { class: 'bdg ' + tone(b) + ' ' + b.conf, 'data-conf': b.conf, 'data-unit': b.unit || unit, title: b.conf }, text(b, unit));
  };
  Goal.verdict = function (v) { return Goal.h('span', { class: 'vchip v-' + v }, v); };

  function tabId() { var h = location.hash.replace(/^#\/?/, ''), i = h.indexOf('?'); return i < 0 ? h : h.slice(0, i); }

  /* Scroll to the row named in #/tab?row=ID and mark it. */
  Goal.showRow = function (root, id) {
    id = id || Goal.params().row;
    root.querySelectorAll('[data-row].hit').forEach(function (r) { r.classList.remove('hit'); });
    if (!id) return;
    var r = root.querySelector('[data-row="' + String(id).replace(/"/g, '') + '"]');
    if (!r) return;
    r.classList.add('hit');
    setTimeout(function () { if (r.scrollIntoView) r.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 0);
  };

  /* list: rows. opt: {unit, head: [cell labels], num: true (row numbers)}. Returns a table. */
  Goal.rows = function (list, opt) {
    opt = opt || {};
    var h = Goal.h, u = opt.unit;
    var head = opt.head ? h('tr', null, opt.num ? h('th', null, '') : null, h('th', { class: 'n' }, u || ''), h('th', null, ''),
      opt.head.map(function (x) { return h('th', null, x); })) : null;
    return h('table', { class: 'crows' }, head, list.map(function (r, i) {
      var err = Goal.rowErrors(r, u);
      var head = r.to ? h('a', { href: '#/' + tabId() + '?row=' + encodeURIComponent(r.to), class: 'crow-to',
        onclick: function (e) { e.preventDefault(); Goal.set({ row: r.to }); Goal.showRow(document); } }, r.text) : r.text;
      return h('tr', { class: 'crow', 'data-row': r.id || null, 'data-err': err.length ? err.join('; ') : null },
        opt.num ? h('td', { class: 'mut n' }, i + 1) : null,
        h('td', { class: 'crow-b' }, err.length ? h('span', { class: 'bdg err' }, err[0]) : Goal.badge(r.badge, u)),
        h('td', { class: 'crow-h' }, r.verdict ? Goal.verdict(r.verdict) : null, ' ', head),
        (r.cells || []).map(function (c) { return h('td', { class: 'crow-c' }, c); }));
    }));
  };

  /* Badge key: labels only. */
  Goal.rowKey = function () {
    var h = Goal.h;
    return h('div', { class: 'rkey' },
      h('span', { class: 'bdg good measured' }, 'better'), h('span', { class: 'bdg bad measured' }, 'worse'),
      h('span', { class: 'mut' }, '·'), h('span', { class: 'bdg neutral measured' }, 'measured'),
      h('span', { class: 'bdg neutral estimated' }, 'estimated'), h('span', { class: 'bdg neutral simulated' }, 'simulated'), h('span', { class: 'bdg neutral assumed' }, 'assumed'));
  };
})();

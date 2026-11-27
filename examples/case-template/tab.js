/* Case tab. Case name: folder name (set by bin/goal case build). Data: C.analyze (goal analyze), C.title, C.as_of, C.unit (optional, default 'item').
   Layout: one verdict (constraint in red, measured numbers, next step + book chip), then proof cards, then fact rows. */
(function () {
  'use strict';
  var NAME = window.GOAL_CASE_NAME, h = Goal.h;
  function cap(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
  Goal.tab({
    id: 'case/' + NAME, title: ((window.GOAL_CASE_DATA || {})[NAME] || {}).tab || NAME,
    render: function (el) {
      var C = (window.GOAL_CASE_DATA || {})[NAME];
      if (!C) { el.appendChild(h('div', { class: 'mut' }, 'no case data: run bin/goal case build ' + NAME)); return; }
      var r = C.analyze, unit = C.unit || 'item', U = unit + 's', UD = unit + '-days';
      var top = r.pareto[0], con = top.key, second = r.pareto[1];
      var openCon = r.aging.filter(function (a) { return a.stage === con; });
      el.appendChild(h('div', { class: 'case-t' }, C.title));
      /* Subtabs: #/case/NAME/SUB. One book tool per subtab. */
      var st = Goal.subtabs([{ id: 'constraint', title: 'Constraint' }, { id: 'data', title: 'Data' }]);
      el.appendChild(st.nav);
      var bars = Goal.pareto(r.pareto.map(function (x) {
        return { id: 'stage-' + x.key, label: x.key, v: Math.round(x.days), color: x.key === con ? Goal.CON : Goal.GRAY, hi: x.key === con };
      }), { unit: UD });
      if (st.id === 'constraint') {
        el.appendChild(Goal.verdict({
          q: 'Which stage sets the pace?',
          top: [h('span', { class: 'runchip ex' }, h('i'), r.items + ' ' + U + ' · as of ' + String(C.as_of).replace('T', ' '))],
          head: [{ con: cap(con) }, ' is the constraint.'],
          sub: Math.round(top.share * 100) + '% of all ' + UD + ' are at ' + con + '.' + (second ? ' The next stage, ' + second.key + ', has ' + Math.round(second.share * 100) + '%.' : ''),
          metrics: [
            { v: Math.round(top.share * 100), unit: '%', label: 'of ' + UD + ' at ' + con, tone: 'bad' },
            { v: openCon.length, unit: 'open', label: U + ' that wait at ' + con },
            { v: Goal.n(r.leadTime.median), unit: 'd', label: 'median lead time · ' + r.leadTime.done + ' done' }
          ],
          next: { step: 'Step 2 · Exploit', text: 'Use every hour of ' + con + ' on good work.', book: ['exploit-constraint'] }
        }));
        /* Facts that the verdict does not show: plain headline, one badge, link to the row that holds the numbers. */
        var rows = [];
        if (r.causes.length) rows.push({ text: 'The top cause of waiting is ' + r.causes[0].key + '.', badge: { v: Math.round(r.causes[0].share * 100), unit: '% of days with a cause', conf: 'measured', tone: 'bad' } });
        if (r.aging.length) rows.push({ text: 'The oldest open ' + unit + ' waits at ' + r.aging[0].stage + '.', badge: { v: Math.round(r.aging[0].age * 10) / 10, unit: 'd in stage', conf: 'measured', tone: r.aging[0].stage === con ? 'bad' : 'neutral' } });
        if (second) rows.push({ text: cap(second.key) + ' is next in line if ' + con + ' gets faster.', badge: { v: Math.round(second.share * 100), unit: '% of ' + UD, conf: 'measured', tone: 'neutral' }, to: 'stage-' + second.key });
        el.appendChild(Goal.proofs('21', [
          Goal.proof('Where the ' + UD + ' go', bars, { note: 'red = the constraint' }),
          Goal.proof('What else the data says', Goal.rows(rows, { num: true }))
        ]));
      } else {
        el.appendChild(Goal.proof('Stages', h('table', { style: 'width:100%' },
          h('tr', null, h('th', null, 'stage'), h('th', { class: 'n' }, U), h('th', { class: 'n' }, UD), h('th', { class: 'n' }, 'median d'), h('th', { class: 'n' }, 'open')),
          r.stages.map(function (x) {
            return h('tr', null, h('td', { class: x.stage === con ? 'con' : null }, x.stage), h('td', { class: 'n' }, x.items), h('td', { class: 'n' }, Math.round(x.days)),
              h('td', { class: 'n' }, Goal.n(x.median)), h('td', { class: 'n' }, x.open));
          })), { note: r.rows + ' rows · span ' + Goal.n(r.span) + ' d' }));
        el.appendChild(h('div', { style: 'height:var(--gap)' }));
        el.appendChild(Goal.proof('Where the ' + UD + ' go', bars));
      }
      Goal.showRow(el);
    }
  });
})();

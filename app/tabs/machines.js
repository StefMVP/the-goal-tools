/* Machines: old machines vs new machine vs new + old. Cost view vs throughput view. URL: #/machines?preset=&<group.key>=&sw=&m= */
(function () {
  'use strict';
  var h = Goal.h, C = Goal.core;
  var NAMES = { old: 'Old machines', new: 'New machine', both: 'New + old' };
  var SHORT = { old: 'Old', new: 'New', both: 'New + old' };
  var PRE = { ncx10: 'NCX-10 replaces old', zmegma: 'Zmegma back', lunch: 'Idle at lunch', robots: 'Robots' };
  var OLD = [['scrapped', 'scrap the old machines'], ['spare', 'keep old as spare'], ['only', 'old only, no new machine']];
  var BREAKS = [['idle', 'machine idle at breaks'], ['covered', 'breaks covered']];
  var SWEEPS = {
    'new.down': { label: 'new downtime %', values: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50] },
    'plant.demand': { label: 'demand / day', values: [200, 300, 400, 500, 600, 700, 800, 900, 1000] },
    'plant.breakHr': { label: 'break hr / day', values: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4] },
    'old.count': { label: 'old machines', values: [0, 1, 2, 3, 4, 5] }
  };
  var FIELDS = [
    ['old', 'Old machines', [['count', 'count'], ['rate', 'parts / hr each'], ['operators', 'operators each'], ['costHr', 'machine $ / hr'], ['setup', 'setup hr / day'], ['down', 'downtime %']]],
    ['new', 'New machine', [['rate', 'parts / hr'], ['operators', 'operators'], ['costHr', 'machine $ / hr'], ['setup', 'setup hr / day'], ['down', 'downtime %']]],
    ['plant', 'Plant', [['demand', 'demand / day'], ['other', 'other stations parts / hr'], ['tPerPart', 'T $ / part', 'throughput'], ['material', 'material $ / part', 'inventory'],
      ['hours', 'hours / day'], ['breakHr', 'break hr / day', 'bottleneck-idle-time'], ['wage', 'wage $ / hr'], ['oe', 'other OE $ / day', 'operating-expense']]]
  ];
  var DIGITS = { oe: 6, demand: 5, tPerPart: 5, material: 5, wage: 5, costHr: 5 };
  function money(v) { return (v < 0 ? '−$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US'); }
  function signed(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US'); }
  function term(id, text) { return h('span', { 'data-term': id }, text); }
  function policyText(x) {
    var a = { scrapped: 'Run the new machine only.', spare: 'Keep the old machines and run them with the new one.', only: 'Do not buy the new machine.' }[x.old];
    return a + (x.breaks === 'covered' ? ' Cover the breaks at the constraint.' : '');
  }
  /* Bar row: label, bar (share of max, may be negative), value, pick chip. */
  function mrow(o) {
    var w = Math.max(0, Math.min(1, Math.abs(o.frac))) * 100;
    return h('div', { class: 'mx-row' + (o.pick ? ' pick' : '') },
      h('span', { class: 'mx-l' }, o.label, o.pick ? h('span', { class: 'mx-pick' }, 'pick') : null),
      h('span', { class: 'mx-b' }, h('i', { style: 'width:' + w + '%;background:' + o.color })),
      h('span', { class: 'mx-v' }, h('b', { class: o.tone || null }, o.value), o.sub ? h('small', null, o.sub) : null));
  }

  function render(el, p) {
    var preset = C.MACHINE_PRESETS[p.preset] ? p.preset : 'ncx10';
    var over = {};
    Object.keys(p).forEach(function (k) { if (k.indexOf('.') > 0) over[k] = p[k]; });
    var inp;
    try { inp = C.machineInputs(preset, over); } catch (e) { inp = C.machineInputs(preset); }
    var st = { sw: SWEEPS[p.sw] ? p.sw : 'new.down', m: p.m === 'parts' ? 'parts' : 'T' };
    var pr = C.MACHINE_PRESETS[preset];
    var out = h('div');

    function sel(key, opts) {
      var a = key.split('.');
      return h('select', { 'aria-label': key, onchange: function (e) { var o = {}; o[key] = e.target.value; Goal.set(o); inp[a[0]][a[1]] = e.target.value; upd(); } },
        opts.map(function (o) { return h('option', { value: o[0], selected: o[0] === inp[a[0]][a[1]] ? 'selected' : null }, o[1]); }));
    }

    function upd() {
      out.innerHTML = '';
      var r = C.machines(inp), opt = C.machinesOptimal(inp);
      var by = {};
      r.options.forEach(function (o) { by[o.id] = o; });
      var tp = r.throughputPick, cp = r.costPick, np = function (id) { return by[id].tioe.netProfit; }, gain = np(tp) - np(cp);
      var best = by[tp].tioe, mine = opt.mine, bo = opt.optimal;
      var metrics = [{ v: money(np(tp)), label: 'net profit / day · ' + NAMES[tp], tone: np(tp) >= 0 ? 'good' : 'bad' }];
      if (cp !== tp) metrics.push({ v: money(np(cp)), label: 'net profit / day · cost pick, ' + NAMES[cp], tone: 'bad' }, { v: signed(gain), label: 'gain / day', tone: 'good' });
      metrics.push({ v: signed(np('new') - np('old')), label: 'new machine vs old only, per day', tone: np('new') > np('old') ? 'good' : np('new') < np('old') ? 'bad' : '' });
      if (best.hourValue) metrics.push({ v: money(best.hourValue), label: 'T per hour at the machine' });
      out.appendChild(Goal.verdict({
        q: 'Does the new machine make money?',
        top: [Goal.runChip(null, 'book case · ' + pr.title + ' · ch ' + pr.chapters.join(', '))],
        head: [{ good: NAMES[tp] }, tp === 'old' ? ' make the most money.' : ' makes the most money.', cp === tp ? ' Both views agree.' : ''],
        sub: cp === tp ? 'Cost accounting and the throughput view pick the same option.' :
          'Cost accounting picks ' + NAMES[cp] + ' for the lowest cost per part. That gives ' + money(np(cp)) + ' a day; ' + NAMES[tp] + ' gives ' + money(np(tp)) + '.',
        metrics: metrics,
        next: { step: opt.same ? 'Your policy is the best' : 'Best policy', text: policyText(bo),
          book: bo.breaks === 'covered' ? ['bottleneck-idle-time'] : bo.old === 'spare' ? ['offload-bottleneck'] : ['cost-world-vs-throughput-world'] }
      }));

      out.appendChild(h('div', { class: 'whatif' }, h('b', null, 'What if'),
        Goal.seg(Object.keys(C.MACHINE_PRESETS).map(function (id) { return [id, PRE[id] || C.MACHINE_PRESETS[id].title]; }), preset, function (id) { Goal.go('machines', { preset: id }); }),
        sel('policy.old', OLD), sel('policy.breaks', BREAKS),
        h('span', { class: 'mx-mine' }, 'yours ', h('b', { class: opt.same ? 'good' : 'bad' }, money(mine.tioe.netProfit)), ' / day',
          opt.same ? null : [' · best ', h('b', null, money(bo.tioe.netProfit))]),
        opt.same ? null : h('button', { class: 'pri', onclick: function () {
          inp.policy.old = bo.old; inp.policy.breaks = bo.breaks;
          Goal.set({ 'policy.old': bo.old, 'policy.breaks': bo.breaks }); upd();
        } }, 'Use best')));

      var maxCost = Math.max.apply(null, r.options.map(function (o) { return o.cost.costPerPart; }).concat([1e-9]));
      var maxNP = Math.max.apply(null, r.options.map(function (o) { return Math.abs(o.tioe.netProfit); }).concat([1]));
      var cpLose = np(cp) < np(tp);
      out.appendChild(Goal.proofs('2', [
        Goal.proof([term('cost-world', 'Cost accounting')], h('div', null,
          r.options.map(function (o) {
            return mrow({ label: NAMES[o.id], frac: o.cost.costPerPart / maxCost, color: o.id === cp ? '#6f7784' : Goal.GRAY, pick: o.id === cp,
              value: '$' + o.cost.costPerPart.toFixed(2), sub: 'per part · ' + Goal.n(o.cost.efficiency) + '% efficient' });
          }),
          h('div', { class: 'mx-foot' }, 'Its pick makes ', h('b', { class: cpLose ? 'bad' : 'good' }, money(np(cp))), ' a day')),
          { note: 'picks the lowest cost per part', cls: 'tx-side ' + (cpLose ? 'lose' : 'win') }),
        Goal.proof([term('throughput', 'Throughput view')], h('div', null,
          r.options.map(function (o) {
            var t = o.tioe;
            return mrow({ label: NAMES[o.id], frac: t.netProfit / maxNP, color: t.netProfit < 0 ? Goal.CON : o.id === tp ? 'var(--grn)' : Goal.GRAY, pick: o.id === tp,
              value: money(t.netProfit), tone: t.netProfit < 0 ? 'bad' : null, sub: 'per day · constraint ' + (t.constraint === 'other' ? 'other stations' : t.constraint) });
          }),
          h('div', { class: 'mx-foot' }, 'Its pick makes ', h('b', { class: 'good' }, money(np(tp))), ' a day')),
          { note: 'picks the most net profit', cls: 'tx-side win' })
      ]));

      var tbl = h('table', { class: 'm-tbl', style: 'width:100%' },
        h('tr', null, h('th', null, ''), h('th', { class: 'n' }, term('bottleneck', 'constraint')), h('th', { class: 'n' }, 'parts / day'), h('th', { class: 'n' }, term('throughput', 'T')),
          h('th', { class: 'n' }, term('inventory', 'I')), h('th', { class: 'n' }, term('operating-expense', 'OE')), h('th', { class: 'n' }, 'net profit')),
        r.options.map(function (o) {
          var t = o.tioe;
          return h('tr', { class: o.id === tp ? 'mx-best' : null }, h('td', null, h('b', null, NAMES[o.id])),
            h('td', { class: 'n' + (t.constraint === 'machine' ? ' con' : '') }, t.constraint), h('td', { class: 'n' }, Math.round(t.parts)),
            h('td', { class: 'n' }, money(t.T)), h('td', { class: 'n' }, money(t.iPerDay)), h('td', { class: 'n' }, money(t.OE)),
            h('td', { class: 'n' }, h('b', { class: t.netProfit < 0 ? 'bad' : o.id === tp ? 'good' : null }, money(t.netProfit))));
        }));
      var plan = by[r.plan].tioe;
      var sw = SWEEPS[st.sw], s = C.machinesSweep(inp, st.sw, sw.values);
      var a = st.sw.split('.'), cur = inp[a[0]][a[1]], mark;
      sw.values.forEach(function (v, i) { if (mark === undefined || Math.abs(v - cur) < Math.abs(sw.values[mark] - cur)) mark = i; });
      var COL = { old: '#9aa1ad', new: '#15181e', both: '#1f8a4c' };
      var series = ['old', 'new', 'both'].map(function (id) {
        return { name: SHORT[id], values: s[id][st.m].map(function (v) { return st.m === 'T' ? v / 1000 : v; }), color: COL[id], dash: id === 'old' };
      });
      out.appendChild(h('div', { style: 'height:var(--gap)' }));
      out.appendChild(Goal.proofs('2', [
        Goal.proof('Per day, T · I · OE', h('div', null, tbl,
          plan.lostT ? h('div', { class: 'mx-foot' }, term('bottleneck-hour-lost', 'An hour lost at the machine'), ' costs ', h('b', null, money(plan.hourValue)), ' of T. Breaks lose ',
            h('b', { class: 'bad' }, money(plan.lostT)), ' a day.') : null), { note: 'all three options' }),
        Goal.proof('What changes the answer', Goal.fit(function (w, hh) {
          return Goal.line(series, { w: w, h: hh, mark: mark, x0: sw.label + ' ' + sw.values[0], x1: String(sw.values[sw.values.length - 1]) });
        }), { act: h('span', { class: 'row', style: 'gap:6px' },
          Goal.select('', 'sw', st.sw, Object.keys(SWEEPS).map(function (k) { return [k, SWEEPS[k].label]; }), function (v) { st.sw = v; upd(); }),
          Goal.select('', 'm', st.m, [['T', 'T $k / day'], ['parts', 'parts / day']], function (v) { st.m = v; upd(); })) })
      ]));
    }

    function field(g, key, label, tid) {
      return Goal.num(tid ? term(tid, label) : label, g + '.' + key, inp[g][key], function (v) { inp[g][key] = isNaN(v) ? 0 : v; upd(); }, { ch: DIGITS[key] || 4, step: 'any', min: 0 });
    }
    var cost = h('div');
    el.appendChild(out);
    el.appendChild(Goal.drawer('Data', 'machines, plant, all cost numbers · defaults, not from the book', h('div', null,
      h('div', { class: 'm-in' }, FIELDS.map(function (f) {
        return h('fieldset', { class: f[0] === 'plant' ? 'c3' : null }, h('legend', null, f[1]), f[2].map(function (x) { return field(f[0], x[0], x[1], x[2]); }),
          f[0] === 'plant' ? h('label', null, h('span', null, term('dependent-events', 'position')), sel('plant.position', [['after', 'after other stations'], ['first', 'before other stations']])) : null);
      })), cost)));
    function costTable() {
      var r = C.machines(inp);
      cost.innerHTML = '';
      cost.appendChild(h('table', { class: 'm-tbl' }, h('tr', null, h('th', null, ''), h('th', { class: 'n' }, 'cost / part'), h('th', { class: 'n' }, 'labor / part'),
        h('th', { class: 'n' }, 'parts / operator hr'), h('th', { class: 'n' }, 'efficiency %'), h('th', { class: 'n' }, 'made / day')),
        r.options.map(function (o) {
          var c = o.cost;
          return h('tr', null, h('td', null, NAMES[o.id]), h('td', { class: 'n' }, '$' + c.costPerPart.toFixed(2)), h('td', { class: 'n' }, '$' + c.laborPerPart.toFixed(2)),
            h('td', { class: 'n' }, Goal.n(c.perOperatorHr)), h('td', { class: 'n' }, Goal.n(c.efficiency)), h('td', { class: 'n' }, Math.round(c.made)));
        })));
    }
    var base = upd;
    upd = function () { base(); costTable(); };
    upd();
  }

  Goal.tab({ id: 'machines', title: 'Machines', render: render });
})();

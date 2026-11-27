/* T · I · OE: product mix (cost view vs constraint view) and a T / I / OE check for one change.
   URL: #/tioe?m=ENC (mix JSON, written by bin/goal --show mix) & dT, dI, dOE, I, NP (change check). */
(function () {
  'use strict';
  var h = Goal.h, C = Goal.core, T = Goal.term;
  var PQ = {
    oe: 6000,
    resources: [{ id: 'A', cap: 2400 }, { id: 'B', cap: 2400 }, { id: 'C', cap: 2400 }, { id: 'D', cap: 2400 }],
    products: [
      { id: 'P', price: 90, material: 45, demand: 100, minutes: { A: 15, B: 15, C: 15, D: 15 } },
      { id: 'Q', price: 100, material: 40, demand: 50, minutes: { A: 10, B: 30, C: 5, D: 5 } }
    ]
  };
  function money(v) { return (v < 0 ? '−$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US'); }
  function signed(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US'); }
  function list(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }

  /* One plan: net profit, then each product in rank order with sold / demand and the constraint minutes it takes. */
  function planCard(title, note, pl, m, cid, win) {
    var by = {};
    m.products.forEach(function (x) { by[x.id] = x; });
    var qty = {};
    pl.mix.forEach(function (x) { qty[x.id] = x.qty; });
    var cap = cid ? m.resources.filter(function (r) { return r.id === cid; })[0].cap : 0;
    var used = pl.rank.map(function (id) { return { id: id, v: cid ? qty[id] * (by[id].minutes[cid] || 0) : 0 }; });
    var tone = win ? 'good' : pl.netProfit < 0 ? 'bad' : '';
    return Goal.proof(title, h('div', { class: 'tx-plan' },
      h('div', { class: 'tx-np ' + tone }, h('b', null, money(pl.netProfit)), h('span', null, 'net profit / period · T ' + money(pl.throughput))),
      h('table', { class: 'tx-mix' },
        h('tr', null, h('th', null, ''), h('th', null, 'product'), h('th', null, 'sold of demand'), h('th', { class: 'n' }, 'T')),
        pl.rank.map(function (id, i) {
          var x = by[id], q = qty[id], d = x.demand, t = (x.price - x.material) * q;
          return h('tr', null, h('td', { class: 'mut' }, i + 1), h('td', null, h('b', null, id)),
            h('td', null, h('div', { class: 'tx-sold' }, h('span', { class: 'tx-bar' }, h('i', { style: 'width:' + (d ? 100 * q / d : 0) + '%' })), h('span', { class: q < d ? 'tx-short' : 'mut' }, q + ' / ' + d))),
            h('td', { class: 'n' }, money(t)));
        })),
      cid ? h('div', { class: 'tx-cap' }, h('div', { class: 'tx-capl' }, h('span', { class: 'con' }, cid), ' minutes go to'),
        h('div', { class: 'tx-stack' }, used.filter(function (u) { return u.v > 0; }).map(function (u, i) {
          return h('span', { style: 'flex:' + u.v + ' 1 0;background:' + Goal.GRAYS[i % 3 === 0 ? 2 : i % 3 === 1 ? 0 : 3], title: u.id + ' ' + u.v + ' min' }, u.id + ' ' + Math.round(100 * u.v / cap) + '%');
        }))) : null), { note: note, cls: 'tx-side ' + (win ? 'win' : 'lose') });
  }

  function changeCheck(p) {
    var st = { dT: Goal.int(p, 'dT', 2000), dI: Goal.int(p, 'dI', 5000), dOE: Goal.int(p, 'dOE', 500), I: Goal.int(p, 'I', 100000), NP: Goal.int(p, 'NP', 10000) };
    var out = h('div', { class: 'tx-chk' });
    function upd() {
      var dNP = st.dT - st.dOE, roi0 = st.I ? st.NP / st.I : 0, roi1 = (st.I + st.dI) ? (st.NP + dNP) / (st.I + st.dI) : 0, cash = dNP - st.dI;
      var v = dNP > 0 && roi1 >= roi0 ? ['Do it', 'good'] : dNP > 0 ? ['Do it, ROI goes down', ''] : dNP === 0 ? ['No effect', ''] : ['Do not do it', 'bad'];
      out.innerHTML = '';
      out.appendChild(h('div', { class: 'tx-v ' + v[1] }, v[0]));
      out.appendChild(h('div', { class: 'vd-m tx-m' },
        h('div', { class: 'vd-mi ' + (dNP > 0 ? 'good' : dNP < 0 ? 'bad' : '') }, h('b', null, signed(dNP)), h('span', null, 'net profit / period')),
        h('div', { class: 'vd-mi' }, h('b', null, (roi0 * 100).toFixed(1), h('small', null, '% → ' + (roi1 * 100).toFixed(1) + '%')), h('span', null, 'ROI')),
        h('div', { class: 'vd-mi ' + (cash < 0 ? 'bad' : '') }, h('b', null, signed(cash)), h('span', null, 'cash, first period'))));
    }
    function n(label, k, term) { return Goal.num(T(term, label), k, st[k], function (v) { st[k] = isNaN(v) ? 0 : v; upd(); }, { ch: 7, step: 100 }); }
    var box = Goal.proof('Check one change', h('div', null,
      h('div', { class: 'tx-in' }, n('ΔT', 'dT', 'throughput'), n('ΔI', 'dI', 'inventory'), n('ΔOE', 'dOE', 'oe'), n('I now', 'I', 'inventory'), n('NP now', 'NP', 'net-profit')),
      out), { note: 'T up, I down, OE down?' });
    upd();
    return box;
  }

  Goal.tab({
    id: 'tioe', title: 'T · I · OE',
    render: function (el, p) {
      var m = Goal.dec(p.m, null), own = !!m;
      if (!m) m = JSON.parse(JSON.stringify(PQ));
      var out = h('div'), tbl = h('div');
      function save() { Goal.set({ m: Goal.enc(m) }); own = true; }

      function upd() {
        out.innerHTML = '';
        if (!m.products.length || !m.resources.length) { out.appendChild(h('div', { class: 'mut' }, 'Add a product and a resource in Data.')); return; }
        var r = C.productMix(m), cid = r.constraint, pu = r.perUnit, cv = r.perConstraintMinute, gain = cv.netProfit - pu.netProfit;
        var chip = Goal.runChip(own ? {} : null, own ? m.products.length + ' products · ' + m.resources.length + ' resources' : 'book example · P and Q');
        var full = cv.rank.filter(function (id) { var x = cv.mix.filter(function (y) { return y.id === id; })[0]; return x.qty >= m.products.filter(function (y) { return y.id === id; })[0].demand; });
        var lead = r.products.filter(function (x) { return x.id === cv.rank[0]; })[0];
        if (!cid) {
          out.appendChild(Goal.verdict({
            q: 'Which mix makes the most money?', top: [chip],
            head: ['Demand fits. ', { good: 'Sell all of it.' }],
            sub: 'No resource has more load than capacity. Both views give the same mix.',
            metrics: [{ v: money(cv.netProfit), label: 'net profit / period', tone: cv.netProfit >= 0 ? 'good' : 'bad' }, { v: money(cv.throughput), label: 'T / period' }],
            next: { step: 'Step 5 · Repeat', text: 'The market is the constraint. Find more demand.', book: ['product-mix-pq'] }
          }));
        } else {
          var first = full.length ? full.slice(0, 2) : [cv.rank[0]];
          var same = gain === 0 && pu.rank.join() === cv.rank.join();
          out.appendChild(Goal.verdict({
            q: 'Which mix makes the most money?', top: [chip],
            head: ['Sell ', { good: list(first) }, ' first. ', { con: cid }, ' is the constraint.'],
            sub: same ? 'The cost view gives the same mix.' :
              'The cost view sells ' + pu.rank[0] + ' first and makes ' + money(pu.netProfit) + '. Rank by T per ' + cid + ' minute and make ' + money(cv.netProfit) + '.',
            metrics: [
              { v: money(cv.netProfit), label: 'net profit · constraint view', tone: cv.netProfit >= 0 ? 'good' : 'bad' },
              { v: money(pu.netProfit), label: 'net profit · cost view', tone: pu.netProfit < cv.netProfit ? 'bad' : '' },
              { v: signed(gain), label: 'gain / period', tone: gain > 0 ? 'good' : '' },
              { v: '$' + Goal.n(lead.tPerConstraintMinute), label: 'T per ' + cid + ' minute · ' + lead.id }
            ],
            next: { step: 'Step 2 · Exploit', text: 'Sell in this order: ' + cv.rank.join(', ') + '. Give ' + cid + ' minutes to the most T per minute.', book: ['product-mix-pq'] }
          }));
        }
        out.appendChild(Goal.proofs('2', [
          planCard('Cost view', 'rank by margin per unit', pu, m, cid, false),
          planCard('Constraint view', cid ? 'rank by T per ' + cid + ' minute' : 'rank by T per unit', cv, m, cid, true)
        ]));
        var bars = r.load.map(function (l) {
          return { label: l.id, value: l.load, mark: l.cap, color: l.id === cid ? Goal.CON : Goal.GRAY, bold: l.id === cid, note: Math.round(l.ratio * 100) + '% of capacity' };
        });
        var rk = {};
        pu.rank.forEach(function (id, i) { rk[id] = i + 1; });
        var flip = Goal.proof('Why the rank changes', h('table', { class: 'tx-rk' },
          h('tr', null, h('th', null, 'product'), h('th', { class: 'n' }, 'T / unit'), h('th', { class: 'n' }, 'rank'), h('th', { class: 'n' }, cid ? 'T / ' + cid + ' min' : 'T / min'), h('th', { class: 'n' }, 'rank')),
          cv.rank.map(function (id, i) {
            var x = r.products.filter(function (y) { return y.id === id; })[0];
            return h('tr', null, h('td', null, h('b', null, id)), h('td', { class: 'n' }, money(x.t)), h('td', { class: 'n mut' }, rk[id]),
              h('td', { class: 'n' }, x.tPerConstraintMinute === null ? '–' : '$' + Goal.n(x.tPerConstraintMinute)), h('td', { class: 'n' }, h('b', null, i + 1)));
          })), { note: T('t-per-min', 'T per constraint minute') });
        out.appendChild(h('div', { style: 'height:var(--gap)' }));
        out.appendChild(Goal.proofs('2', [
          Goal.proof('Load at full demand', Goal.fit(function (w) {
            var L = Math.min(220, Math.max(50, 12 + 7 * Math.max.apply(null, r.load.map(function (l) { return String(l.id).length; }))));
            return Goal.hbars(bars, { left: L, right: 130, w: w, rowH: 24, max: Math.max.apply(null, r.load.map(function (l) { return Math.max(l.load, l.cap); })) });
          }), { note: '| = capacity' }),
          flip
        ]));
        out.appendChild(h('div', { style: 'height:var(--gap)' }));
        out.appendChild(changeCheck(p));
      }

      function inp(obj, key, w) {
        return h('input', { type: 'number', value: obj[key], style: 'width:' + (w || 76) + 'px', oninput: function (e) { obj[key] = parseFloat(e.target.value) || 0; save(); upd(); } });
      }
      function txt(obj, key, w) {
        return h('input', { value: obj[key], style: 'width:' + Math.max(w || 110, 24 + 8 * String(obj[key]).length) + 'px', onchange: function (e) {
          var old = obj[key], nv = e.target.value.trim() || old;
          if (obj.cap !== undefined) m.products.forEach(function (x) { x.minutes[nv] = x.minutes[old] || 0; if (nv !== old) delete x.minutes[old]; });
          obj[key] = nv; save(); build();
        } });
      }
      function build() {
        tbl.innerHTML = '';
        var rs = m.resources;
        tbl.appendChild(h('div', { class: 'scroll', style: 'max-height:none' }, h('table', { class: 'tx-edit' },
          h('tr', null, h('th', null, 'product'), h('th', null, 'price'), h('th', null, T('material', 'material')), h('th', null, 'demand'),
            rs.map(function (r) { return h('th', null, 'min ' + r.id); }), h('th')),
          m.products.map(function (x, j) {
            rs.forEach(function (r) { if (x.minutes[r.id] === undefined) x.minutes[r.id] = 0; });
            return h('tr', null, h('td', null, txt(x, 'id')), h('td', null, inp(x, 'price')), h('td', null, inp(x, 'material')), h('td', null, inp(x, 'demand')),
              rs.map(function (r) { return h('td', null, inp(x.minutes, r.id, 68)); }),
              h('td', null, h('button', { title: 'remove product', onclick: function () { m.products.splice(j, 1); save(); build(); } }, '×')));
          }),
          h('tr', null, h('td', { class: 'mut', colspan: 4 }, 'resource'), rs.map(function (r, i) {
            return h('td', { style: 'white-space:nowrap' }, txt(r, 'id', 68), h('button', { title: 'remove resource', onclick: function () {
              rs.splice(i, 1); m.products.forEach(function (x) { delete x.minutes[r.id]; }); save(); build();
            } }, '×'));
          }), h('td')),
          h('tr', null, h('td', { class: 'mut', colspan: 4 }, 'capacity, min / period'), rs.map(function (r) { return h('td', null, inp(r, 'cap', 68)); }), h('td')))));
        tbl.appendChild(h('div', { class: 'row', style: 'margin-top:10px;align-items:center' },
          h('button', { onclick: function () { m.products.push({ id: 'Product ' + (m.products.length + 1), price: 50, material: 20, demand: 10, minutes: {} }); save(); build(); } }, '+ product'),
          h('button', { onclick: function () { rs.push({ id: 'R' + (rs.length + 1), cap: 2400 }); save(); build(); } }, '+ resource'),
          h('label', { class: 'mut' }, T('oe', 'OE'), ' / period ', inp(m, 'oe', 90)),
          h('button', { onclick: function () { m = JSON.parse(JSON.stringify(PQ)); own = false; Goal.set({ m: null }); build(); } }, 'Book example')));
        upd();
      }
      el.appendChild(out);
      el.appendChild(Goal.drawer('Data', 'products, resources, OE · NP = T − OE · ROI = NP / I', tbl));
      build();
    }
  });
})();

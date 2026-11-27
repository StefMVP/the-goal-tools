/* Split compare: Mine | Optimal sides, delta row, copy button. Used by tabs that compare user settings with an optimum.
   Goal.compare({ mine: side, optimal: side | null (computing), same: bool, onCopy: fn, copyTerm: id,
     delta: { label: node, items: [{ label: node, value: number, better: 'high' | 'low', unit: '' }] } })
   side: { title, sub, head: node, body: [nodes] }. Goal.compare.score(value, label, sub, cls) gives a headline block. */
(function () {
  var h = Goal.h;
  function signed(v, d) {
    var m = Math.pow(10, d === undefined ? 1 : d);
    v = Math.round(v * m) / m;
    return (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v);
  }
  function side(x, extra) {
    return h('div', { class: 'card dside' },
      h('div', { class: 'dsh' }, h('h3', null, x.title), x.sub ? h('span', { class: 'mut' }, x.sub) : null, extra || null),
      x.head || null, x.body || null);
  }
  function compare(o) {
    var copy = o.optimal ? h('button', { class: 'pri', 'data-term': o.copyTerm || null, disabled: !!o.same, onclick: o.onCopy },
      o.same ? 'mine is optimal' : 'copy optimal to mine') : null;
    var right = o.optimal ? side(o.optimal, copy) : h('div', { class: 'card dside mut' }, 'Optimal: computing…');
    var wrap = h('div', { class: 'cmp' }, h('div', { class: 'dsplit' }, side(o.mine), right));
    if (o.optimal && o.delta) {
      wrap.appendChild(h('div', { class: 'ddelta' }, h('b', null, o.delta.label || 'Mine − optimal:'),
        o.same ? h('span', { class: 'kpi good' }, h('b', null, 'mine is optimal')) : null,
        o.delta.items.map(function (it) {
          var worse = it.better === 'low' ? it.value > 1e-9 : it.better === 'high' ? it.value < -1e-9 : false;
          return Goal.kpi(it.label, signed(it.value, it.d) + (it.unit || ''), worse ? 'bad' : '');
        })));
    }
    return wrap;
  }
  compare.score = function (value, label, sub, cls) {
    return h('div', { class: 'dscore ' + (cls || '') },
      h('div', { class: 'dsv' }, h('b', null, String(value))),
      h('div', { class: 'dsl' }, label), sub ? h('div', { class: 'dsp' }, sub) : null);
  };
  compare.signed = signed;
  Goal.compare = compare;
})();

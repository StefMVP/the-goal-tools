/* Map: concepts x chapters matrix that fills the view; click a cell or header for the sidebar. URL: #/map?c=&ch=&q= */
(function () {
  var h = Goal.h;
  var GROUPS = ['goal-measures', 'flow-physics', 'constraint-mgmt', 'scheduling', 'thinking-processes', 'change', 'later-toc', 'adjacent'];
  /* One ink color for all cells; groups are header rows, not colors. */
  var GNAME = { 'goal-measures': 'The goal and its measures', 'flow-physics': 'Flow', 'constraint-mgmt': 'Constraints', scheduling: 'Scheduling',
    'thinking-processes': 'Thinking processes', change: 'Change', 'later-toc': 'Later TOC', adjacent: 'Related methods' };
  var TAB = [[/dice|herbie|matchstick|dependent|fluctuat|dbr/, 'dice'], [/flow|five|focus|batch|little|wip|kanban|step/, 'flow'], [/finder|bottleneck|pareto|csv|aging/, 'finder'],
    [/tioe|t-i-oe|decision|product|mix|accounting|throughput|roi/, 'tioe'], [/buffer|fever|chain|drum/, 'buffers']];
  /* Tool id -> tab params, so the link opens with inputs prefilled. */
  var PRESET = [[/herbie/, { slow: 1, hp: 1, r: 1 }], [/dbr|drum|rope/, { slow: 1, hp: 3, rope: 1, r: 1 }], [/dice/, { r: 1 }]];
  var FLOWSTEP = [[/identify|bottleneck/, 1], [/exploit/, 2], [/subordinat/, 3], [/elevat/, 4], [/inertia|repeat/, 5]];
  Goal.toolTab = function (id) {
    for (var i = 0; i < TAB.length; i++) if (TAB[i][0].test(id)) return TAB[i][1];
    return null;
  };
  function toolHref(tool, conceptId) {
    var tab = Goal.toolTab(tool), p = {};
    if (!tab) return null;
    if (tab === 'dice') PRESET.some(function (x) { if (x[0].test(tool) || x[0].test(conceptId)) { p = x[1]; return true; } return false; });
    if (tab === 'flow') FLOWSTEP.some(function (x) { if (x[0].test(conceptId)) { p = { step: x[1] }; return true; } return false; });
    var q = new URLSearchParams(p).toString();
    return '#/' + tab + (q ? '?' + q : '');
  }
  function concepts() {
    var c = (Goal.data.concepts || []).slice();
    c.sort(function (a, b) { return GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group); });
    return c;
  }
  function index() {
    var chs = Goal.data.chapters || [], byCh = {}, byId = {}, inCh = {}, tools = {};
    chs.forEach(function (x) { byCh[x.n] = x; });
    (Goal.data.tools || []).forEach(function (t) { tools[t.id] = t; });
    (Goal.data.concepts || []).forEach(function (c) {
      byId[c.id] = c;
      var m = inCh[c.id] = {};
      (c.chapters || []).forEach(function (n) { m[n] = 1; });
    });
    chs.forEach(function (x) { (x.concepts || []).forEach(function (id) { if (inCh[id]) inCh[id][x.n] = 1; }); });
    var N = chs.length ? Math.max.apply(null, chs.map(function (x) { return x.n; })) : 40;
    return { byCh: byCh, byId: byId, inCh: inCh, tools: tools, N: N };
  }
  function list(title, items, ordered) {
    items = (items || []).filter(Boolean);
    if (!items.length) return null;
    return h('section', null, h('h3', null, title), h(ordered ? 'ol' : 'ul', null, items.map(function (x) { return h('li', null, x); })));
  }
  function tags(title, items) {
    return items.length ? h('section', null, h('h3', null, title), h('div', null, items)) : null;
  }
  function link(text, params, cls, title) {
    return h('a', { class: 'tag ' + (cls || ''), href: '#/map?' + new URLSearchParams(params).toString(), title: title }, text);
  }
  function sidebar(ix, cid, chn, q) {
    var c = ix.byId[cid], ch = ix.byCh[chn], keep = q ? { q: q } : {};
    function P(o) { return Object.assign({}, keep, o); }
    var body = [];
    if (c) {
      body.push(h('div', { class: 'sb-kicker' }, (GNAME[c.group] || c.group) + (ch ? ' · chapter ' + ch.n + ', ' + ch.title : '')));
      body.push(h('div', { class: 'sb-title' }, c.name));
      if (c.one_line) body.push(h('p', { class: 'sb-lede' }, c.one_line));
    } else if (ch) {
      body.push(h('div', { class: 'sb-kicker' }, 'Chapter ' + ch.n), h('div', { class: 'sb-title' }, ch.title));
    }
    if (ch) {
      body.push(list(c ? 'In this chapter' : 'Mechanism', ch.events_as_mechanism));
      body.push(list('Jonah asks', ch.jonah_questions));
      if ((ch.measures_touched || []).length) body.push(tags('Measures', ch.measures_touched.map(function (m) { return h('span', { class: 'tag' }, m); })));
    }
    if (c) {
      if (c.formula) body.push(h('section', null, h('h3', null, 'Rule'), h('pre', { class: 'rule' }, c.formula)));
      body.push(list('How to apply', c.how_to_apply, true));
      body.push(list('Misconceptions', c.misconceptions));
      var tl = (c.tools || []).map(function (t) {
        var href = toolHref(t, c.id), nm = ix.tools[t] ? ix.tools[t].name : t;
        return href ? h('a', { class: 'tag on', href: href }, nm + ' →') : h('span', { class: 'tag' }, nm);
      });
      body.push(tags('Try it', tl));
      body.push(tags('Related', (c.related || []).filter(function (r) { return ix.byId[r]; }).map(function (r) {
        var both = chn && ix.inCh[r][chn];
        return link(ix.byId[r].name, P(both ? { c: r, ch: chn } : { c: r }), both ? 'hit' : '', both ? 'also in ch ' + chn : null);
      })));
      body.push(tags('Chapters', Object.keys(ix.inCh[c.id]).map(Number).sort(function (a, b) { return a - b; }).map(function (n) {
        return link(n, P({ c: c.id, ch: n }), n === chn ? 'on' : '', ix.byCh[n] ? ix.byCh[n].title : null);
      })));
    }
    if (ch) {
      var others = Object.keys(ix.byId).filter(function (id) { return ix.inCh[id][chn] && id !== cid; });
      body.push(tags(c ? 'Also in ch ' + chn : 'Concepts', others.map(function (id) { return link(ix.byId[id].name, P({ c: id, ch: chn })); })));
      if (c) body.push(h('div', { style: 'margin-top:8px' }, link('Chapter ' + chn + ' view', P({ ch: chn })), link(c.name + ' view', P({ c: cid }))));
    }
    return h('aside', { class: 'sb' },
      h('a', { class: 'sb-x', href: '#/map' + (q ? '?q=' + encodeURIComponent(q) : ''), title: 'Close (Esc)' }, '×'),
      body);
  }
  function matrix(ix, cs, cid, chn, q) {
    var keep = q ? { q: q } : {}, N = ix.N;
    function P(o) { return '#/map?' + new URLSearchParams(Object.assign({}, keep, o)).toString(); }
    var g = h('div', { class: 'mx', style: 'grid-template-columns:minmax(140px,max-content) repeat(' + N + ',minmax(18px,1fr));grid-auto-rows:minmax(18px,auto)' });
    g.appendChild(h('div', { class: 'mx-corner' }));
    for (var n = 1; n <= N; n++) {
      var ch = ix.byCh[n];
      g.appendChild(h('a', { class: 'mx-ch' + (n === chn ? ' on' : ''), href: P({ ch: n }), title: ch ? n + ' · ' + ch.title : String(n) }, String(n)));
    }
    var grp = null;
    cs.forEach(function (c) {
      var rowOn = c.id === cid;
      if (c.group !== grp) { grp = c.group; g.appendChild(h('div', { class: 'mx-g', style: 'grid-column:1 / -1' }, h('span', null, GNAME[grp] || grp))); }
      g.appendChild(h('a', { class: 'mx-c' + (rowOn ? ' on' : ''), href: P({ c: c.id }), title: c.one_line }, c.name));
      for (var k = 1; k <= N; k++) {
        var hit = ix.inCh[c.id][k], on = rowOn && k === chn;
        var cls = 'mx-x' + (rowOn ? ' row' : '') + (k === chn ? ' col' : '') + (on ? ' on' : '');
        g.appendChild(hit
          ? h('a', { class: cls, href: P({ c: c.id, ch: k }), title: c.name + ' · ch ' + k + (ix.byCh[k] ? ' · ' + ix.byCh[k].title : '') }, h('b'))
          : h('span', { class: cls }));
      }
    });
    return g;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !/^#\/map/.test(location.hash) || /INPUT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'search') return;
    var q = Goal.params().q;
    location.hash = '#/map' + (q ? '?q=' + encodeURIComponent(q) : '');
  });
  Goal.tab({
    id: 'map', title: 'Map',
    render: function (el, p) {
      var ix = index(), cs = concepts(), q = p.q || '';
      var cid = ix.byId[p.c] ? p.c : '', chn = ix.byCh[+p.ch] ? +p.ch : 0;
      var shown = q ? cs.filter(function (c) { return (c.name + ' ' + c.one_line + ' ' + c.id).toLowerCase().indexOf(q.toLowerCase()) >= 0; }) : cs;
      var search = h('input', { type: 'search', placeholder: 'filter concepts', value: q, onchange: function (e) {
        var o = { q: e.target.value }; if (cid) o.c = cid; if (chn) o.ch = chn; Goal.go('map', Object.keys(o).reduce(function (a, k) { if (o[k]) a[k] = o[k]; return a; }, {}));
      } });
      el.appendChild(h('div', { class: 'map' },
        h('div', { class: 'map-bar' },
          h('div', { class: 'map-t' }, h('div', { class: 'vd-q' }, 'Where is it in the book?'),
            h('h1', null, 'The Goal, concept by chapter')),
          h('span', { class: 'mut' }, shown.length + ' concepts · ' + ix.N + ' chapters'),
          search),
        h('div', { class: 'map-body' },
          h('div', { class: 'mx-wrap' }, matrix(ix, shown, cid, chn, q)),
          cid || chn ? sidebar(ix, cid, chn, q) : null)));
    }
  });
})();

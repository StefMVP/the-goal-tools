/* App shell: router, URL state, DOM and SVG helpers. */
(function () {
  'use strict';
  var tabs = [], cur = null;
  var Goal = window.Goal = { core: window.GoalCore, data: window.GOAL_DATA || {} };

  /* tab: {id, title, render(el, params)} */
  Goal.tab = function (t) { tabs.push(t); };

  function parseHash() {
    var h = location.hash.replace(/^#\/?/, ''), i = h.indexOf('?');
    var id = i < 0 ? h : h.slice(0, i), params = {};
    if (i >= 0) new URLSearchParams(h.slice(i + 1)).forEach(function (v, k) { params[k] = v; });
    return { id: id || 'finder', params: params };
  }
  Goal.params = function () { return parseHash().params; };
  /* Merge params into the URL without re-render. null deletes. */
  Goal.set = function (obj) {
    var s = parseHash(), p = s.params;
    Object.keys(obj).forEach(function (k) {
      if (obj[k] === null || obj[k] === undefined || obj[k] === '') delete p[k]; else p[k] = String(obj[k]);
    });
    var q = new URLSearchParams(p).toString();
    history.replaceState(null, '', '#/' + s.id + (q ? '?' + q : ''));
  };
  Goal.go = function (id, params) {
    var q = params ? new URLSearchParams(params).toString() : '';
    location.hash = '#/' + id + (q ? '?' + q : '');
  };
  /* Tab for a path: exact id, or the longest id that is a prefix of the path (#/TAB/SUB). */
  function tabFor(id) {
    var t = null;
    tabs.forEach(function (x) { if ((id === x.id || id.indexOf(x.id + '/') === 0) && (!t || x.id.length > t.id.length)) t = x; });
    return t;
  }
  /* Subtab path of the current tab: #/TAB/SUB -> 'SUB', #/TAB -> ''. */
  Goal.sub = function () { var id = parseHash().id; return cur && id.indexOf(cur.id + '/') === 0 ? id.slice(cur.id.length + 1) : ''; };
  /* Subtab bar for the current tab. list: [{id, title}]. Returns {id: current subtab (default: first), nav}. Links reset the params. */
  Goal.subtabs = function (list) {
    var sub = Goal.sub(), on = list.some(function (x) { return x.id === sub; }) ? sub : list[0].id;
    if (sub && sub !== on) history.replaceState(null, '', '#/' + cur.id);
    return { id: on, nav: h('nav', { class: 'subtabs' }, list.map(function (x) {
      return h('a', { href: '#/' + cur.id + '/' + x.id, class: x.id === on ? 'on' : null, 'data-sub': x.id }, x.title);
    })) };
  };
  function render() {
    var s = parseHash(), t = tabFor(s.id);
    if (!t) { history.replaceState(null, '', '#/' + tabs[0].id); s = { id: tabs[0].id, params: {} }; t = tabs[0]; }
    document.querySelectorAll('#tabs a').forEach(function (a) { a.classList.toggle('on', a.dataset.id === t.id); if (a.dataset.id === t.id && a.scrollIntoView) a.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
    var v = document.getElementById('view');
    v.innerHTML = '';
    cur = t;
    document.title = t.title + ' · The Goal';
    try { t.render(v, s.params); } catch (e) { v.appendChild(h('pre', { style: 'color:#d33b2c' }, String(e.stack || e))); throw e; }
  }
  Goal.start = function () {
    var nav = document.getElementById('tabs');
    tabs.forEach(function (t) { nav.appendChild(h('a', { href: '#/' + t.id, 'data-id': t.id }, t.title)); });
    nav.parentNode.appendChild(h('button', { id: 'legend-btn', class: 'qbtn', title: 'Terms on this tab', 'aria-expanded': 'false', onclick: toggleLegend }, '?'));
    window.addEventListener('hashchange', function () { hideTip(); closeLegend(); render(); });
    /* Inline terms made by tabs as plain span[data-term] also get keyboard focus. */
    new MutationObserver(function () {
      document.querySelectorAll('#view span[data-term]:not([tabindex])').forEach(function (el) { el.tabIndex = 0; });
    }).observe(document.getElementById('view'), { childList: true, subtree: true });
    render();
  };

  /* Term help. Any element with data-term="id" gets a tooltip; text from Goal.TERMS (app/terms.js) and data concepts. */
  var byId = null;
  function concept(id) {
    if (!byId) { byId = {}; (Goal.data.concepts || []).forEach(function (c) { byId[c.id] = c; }); }
    return byId[id];
  }
  Goal.termInfo = function (id, tabId) {
    var t = (Goal.TERMS || {})[id] || (concept(id) ? { c: id } : null);
    if (!t) return null;
    var c = t.c ? concept(t.c) : null, text = t.t || (c && c.one_line);
    if (!text || (t.c && !c)) return null;
    return { id: id, name: t.n || (c && c.name) || id, text: text, note: t.tab && t.tab[tabId || (cur && cur.id)] || null,
      concept: c ? c.id : null, ch: c && c.chapters && c.chapters.length ? c.chapters[0] : null };
  };
  /* Inline term: dotted underline, focusable. */
  Goal.term = function (id, label) {
    if (!(Goal.TERMS || {})[id]) console.error('unknown term', id);
    return h('span', { class: 'term', 'data-term': id, tabindex: 0 }, label === undefined ? id : label);
  };
  function infoNodes(i) {
    return [h('div', { class: 'tt' }, i.text), i.note ? h('div', { class: 'tn' }, i.note) : null,
      i.concept ? h('a', { class: 'tl', href: '#/map?c=' + i.concept }, (i.ch ? 'chapter ' + i.ch + ' · ' : '') + 'open in Map') : null];
  }
  var tip = null, tipFor = null, hideT = 0;
  function tipEl() {
    if (!tip) {
      tip = h('div', { id: 'tip', role: 'tooltip', onmouseenter: function () { clearTimeout(hideT); }, onmouseleave: function () { hideLater(); } });
      document.body.appendChild(tip);
    }
    return tip;
  }
  function showTip(el) {
    var i = Goal.termInfo(el.getAttribute('data-term'));
    if (!i) return;
    clearTimeout(hideT);
    var t = tipEl();
    if (tipFor && tipFor !== el) tipFor.removeAttribute('aria-describedby');
    tipFor = el;
    el.setAttribute('aria-describedby', 'tip');
    t.innerHTML = '';
    infoNodes(i).forEach(function (n) { if (n) t.appendChild(n); });
    t.style.display = 'block';
    var r = el.getBoundingClientRect(), w = t.offsetWidth, ht = t.offsetHeight;
    var x = Math.max(6, Math.min(r.left, innerWidth - w - 6)), y = r.bottom + 6;
    if (y + ht > innerHeight - 6) y = Math.max(6, r.top - ht - 6);
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  function hideTip() {
    clearTimeout(hideT);
    if (tip) tip.style.display = 'none';
    if (tipFor) tipFor.removeAttribute('aria-describedby');
    tipFor = null;
  }
  function hideLater() { clearTimeout(hideT); hideT = setTimeout(hideTip, 200); }
  function termOf(e) { return e.target.closest && e.target.closest('[data-term]'); }
  document.addEventListener('mouseover', function (e) { var el = termOf(e); if (el && el !== tipFor) showTip(el); });
  document.addEventListener('mouseout', function (e) { var el = termOf(e); if (el && !el.contains(e.relatedTarget)) hideLater(); });
  document.addEventListener('focusin', function (e) { var el = termOf(e); if (el) showTip(el); else if (!(tip && tip.contains(e.target))) hideTip(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { hideTip(); closeLegend(); } });
  /* Tap or click on an inline term: show the tooltip; do not toggle the control in its label. */
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('span[data-term]');
    if (el) { e.preventDefault(); showTip(el); return; }
    if (tip && !tip.contains(e.target) && !termOf(e)) hideTip();
    var lg = document.getElementById('legend');
    if (lg && !lg.contains(e.target) && e.target.id !== 'legend-btn') closeLegend();
  }, true);

  /* Legend: the terms on the current tab, same text as the tooltips. */
  Goal.tabTerms = function () {
    var seen = {}, out = [];
    document.querySelectorAll('#view [data-term]').forEach(function (el) {
      var id = el.getAttribute('data-term');
      if (!seen[id]) { seen[id] = 1; out.push(id); }
    });
    return out;
  };
  function closeLegend() {
    var lg = document.getElementById('legend');
    if (lg) lg.remove();
    var b = document.getElementById('legend-btn');
    if (b) b.setAttribute('aria-expanded', 'false');
  }
  function toggleLegend() {
    if (document.getElementById('legend')) { closeLegend(); return; }
    var ids = Goal.tabTerms();
    var lg = h('div', { id: 'legend', role: 'dialog', 'aria-label': 'Terms' }, h('h3', null, 'Terms · ' + (cur ? cur.title : '')),
      ids.length ? h('dl', null, ids.map(function (id) {
        var i = Goal.termInfo(id);
        return i ? [h('dt', null, i.name), h('dd', null, infoNodes(i))] : null;
      })) : h('div', { class: 'mut' }, 'no terms'));
    document.body.appendChild(lg);
    document.getElementById('legend-btn').setAttribute('aria-expanded', 'true');
  }

  /* h('div', {class:'x', onclick:fn}, child, ...) */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    setAttrs(el, attrs);
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function setAttrs(el, attrs) {
    if (!attrs) return;
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false) return;
      if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    });
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  Goal.h = h;
  var NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs) {
    var el = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === undefined || v === null) return;
      if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) el.appendChild(x); });
      else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  Goal.s = s;

  /* Labeled number/select/checkbox controls bound to URL params. */
  /* Number input. opt.ch: width for that many digits plus padding and spinner. On commit (change), the value is clamped to the current min/max. */
  Goal.num = function (label, key, val, onchange, opt) {
    opt = opt || {};
    function commit(e, clamp) {
      var v = parseFloat(e.target.value);
      if (clamp && !isNaN(v)) {
        var mn = parseFloat(e.target.min), mx = parseFloat(e.target.max), c = v;
        if (!isNaN(mn) && c < mn) c = mn;
        if (!isNaN(mx) && c > mx) c = mx;
        if (c === v) return;
        e.target.value = v = c;
      }
      var o = {}; o[key] = e.target.value; Goal.set(o); onchange(v);
    }
    return h('label', null, h('span', null, label), h('input', {
      type: 'number', value: val, min: opt.min, max: opt.max, step: opt.step || 1,
      style: opt.ch ? 'width:calc(' + opt.ch + 'ch + 32px)' : opt.w ? 'width:' + opt.w + 'px' : null,
      oninput: function (e) { commit(e, false); }, onchange: function (e) { commit(e, true); }
    }));
  };
  Goal.check = function (label, key, val, onchange) {
    return h('label', null, h('input', {
      type: 'checkbox', checked: val,
      onchange: function (e) { var o = {}; o[key] = e.target.checked ? 1 : null; Goal.set(o); onchange(e.target.checked); }
    }), label);
  };
  Goal.select = function (label, key, val, options, onchange) {
    return h('label', null, h('span', null, label), h('select', {
      onchange: function (e) { var o = {}; o[key] = e.target.value; Goal.set(o); onchange(e.target.value); }
    }, options.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
      return h('option', { value: v, selected: String(v) === String(val) ? 'selected' : null }, t);
    })));
  };
  /* Source line at the bottom of a tab's result area: chapters, data notes, data set. Parts are joined with ' · '. */
  Goal.src = function () {
    var parts = Array.prototype.slice.call(arguments).filter(function (x) { return x !== null && x !== undefined && x !== ''; });
    return h('div', { class: 'srcf' }, h('b', null, 'source'), parts.map(function (x, i) { return [i ? ' · ' : '', x]; }));
  };
  Goal.fmt = function (v) { return typeof v === 'number' && v % 1 ? (Math.abs(v) >= 10 ? v.toFixed(1) : String(Math.round(v * 100) / 100)) : v; };
  Goal.kpi = function (label, value, cls) { value = Goal.fmt(value); return h('div', { class: 'kpi ' + (cls || '') }, h('b', null, value), h('span', null, label)); };
  Goal.int = function (p, k, d) { var v = parseFloat(p[k]); return isNaN(v) ? d : v; };

  /* base64url JSON for URL state */
  Goal.enc = function (obj) {
    var b = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  Goal.dec = function (str, fallback) {
    if (!str) return fallback;
    try { return JSON.parse(decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return fallback; }
  };
  Goal.download = function (name, text, type) {
    var a = h('a', { href: URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })), download: name });
    document.body.appendChild(a); a.click(); a.remove();
  };
  Goal.readFile = function (cb) {
    var i = h('input', { type: 'file', onchange: function () { var f = i.files[0]; if (f) f.text().then(function (t) { cb(t, f); }); } });
    i.click();
  };

  /* Chart sized to its box. draw(w, h) returns an svg at 1:1 pixel scale; it is drawn again when the box size changes.
     cls 'tall': box height from the viewport (CSS); else height comes from the chart. */
  Goal.fit = function (draw, cls) {
    var box = h('div', { class: 'fit ' + (cls || '') }), lw = 0, lh = 0;
    var ro = new ResizeObserver(function () {
      if (!box.isConnected) { ro.disconnect(); return; }
      var w = Math.floor(box.clientWidth), ht = /\btall\b/.test(box.className) ? Math.floor(box.clientHeight) : 0;
      if (!w || (Math.abs(w - lw) < 2 && Math.abs(ht - lh) < 2)) return;
      lw = w; lh = ht;
      box.innerHTML = '';
      box.appendChild(draw(w, ht));
    });
    ro.observe(box);
    return box;
  };
  /* Modal dialog. Closes on Esc and backdrop click. Returns the dialog; dialog.close() closes it. */
  Goal.modal = function (title, body) {
    var d = h('dialog', { class: 'modal', onclose: function () { d.remove(); },
      onclick: function (e) { if (e.target === d) d.close(); } },
      h('div', { class: 'modal-in' }, h('div', { class: 'modal-hd' }, h('b', null, title),
        h('button', { class: 'x', 'aria-label': 'close', onclick: function () { d.close(); } }, '×')), body));
    document.body.appendChild(d);
    d.showModal();
    return d;
  };

  /* Charts. series: [{name, values:[y], color, dash}] */
  var COLORS = ['#2457d6', '#d33b2c', '#2f9e55', '#e0a400', '#7a4fd1', '#0e9aa7', '#c2410c', '#64748b'];
  Goal.colors = COLORS;
  function nice(max) {
    if (max <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(max))), f = max / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }
  Goal.line = function (series, o) {
    o = o || {};
    var W = o.w || 560, H = o.h || 200, L = 36, R = 90, T = 10, B = 22;
    var n = Math.max.apply(null, series.map(function (x) { return x.values.length; }));
    var ymax = o.ymax || nice(Math.max.apply(null, [1].concat(series.map(function (x) { return Math.max.apply(null, x.values.concat([0])); }))));
    var X = function (i) { return L + (n <= 1 ? 0 : i * (W - L - R) / (n - 1)); };
    var Y = function (v) { return T + (H - T - B) * (1 - v / ymax); };
    var g = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', style: 'max-width:' + W + 'px' });
    [0, 0.5, 1].forEach(function (f) {
      g.appendChild(s('line', { class: 'ax', x1: L, x2: W - R, y1: Y(ymax * f), y2: Y(ymax * f) }));
      g.appendChild(s('text', { class: 'mt', x: L - 4, y: Y(ymax * f) + 4, 'text-anchor': 'end' }, String(Math.round(ymax * f * 10) / 10)));
    });
    g.appendChild(s('text', { class: 'mt', x: L, y: H - 6 }, o.x0 || '1'));
    g.appendChild(s('text', { class: 'mt', x: W - R, y: H - 6, 'text-anchor': 'end' }, o.x1 || ((o.xlabel ? o.xlabel + ' ' : '') + n)));
    var labels = [];
    series.forEach(function (sr, k) {
      var c = sr.color || COLORS[k % COLORS.length];
      var d = sr.values.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join('');
      g.appendChild(s('path', { d: d, fill: 'none', stroke: c, 'stroke-width': sr.width || 2, 'stroke-dasharray': sr.dash ? '4 3' : null }));
      var last = sr.values[o.mark !== undefined ? Math.min(o.mark, sr.values.length - 1) : sr.values.length - 1];
      if (o.mark !== undefined) g.appendChild(s('circle', { cx: X(o.mark), cy: Y(last), r: 3, fill: c }));
      labels.push({ y: Y(last) + 4, c: c, t: sr.name + ' ' + (Math.round(last * 10) / 10) });
    });
    if (o.mark !== undefined) g.appendChild(s('line', { x1: X(o.mark), x2: X(o.mark), y1: T, y2: H - B, stroke: '#1d2330', 'stroke-dasharray': '2 2' }));
    labels.sort(function (a, b) { return a.y - b.y; });
    for (var i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 12) labels[i].y = labels[i - 1].y + 12;
    /* Keep the end labels inside the chart: shift the stack up when it runs past the bottom. */
    var over = labels.length ? labels[labels.length - 1].y - (H - 2) : 0;
    if (over > 0) labels.forEach(function (l) { l.y -= over; });
    for (var j = labels.length - 2; j >= 0; j--) if (labels[j + 1].y - labels[j].y < 12) labels[j].y = labels[j + 1].y - 12;
    labels.forEach(function (l) { g.appendChild(s('text', { x: W - R + 4, y: l.y, style: 'fill:' + l.c }, l.t)); });
    return g;
  };
  /* bars: [{label, value, color, note}] horizontal */
  Goal.hbars = function (bars, o) {
    o = o || {};
    var W = o.w || 560, rowH = o.rowH || 20, L = o.left || 110, R = o.right || 130;
    var H = bars.length * rowH + 4, max = o.max || Math.max.apply(null, bars.map(function (b) { return b.value; }).concat([1e-9]));
    var g = s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', style: 'max-width:' + W + 'px' });
    bars.forEach(function (b, i) {
      var y = i * rowH + 2, w = Math.max(0, (W - L - R) * b.value / max);
      g.appendChild(s('text', { x: L - 6, y: y + rowH * 0.65, 'text-anchor': 'end', style: b.bold ? 'font-weight:700' : null }, b.label));
      g.appendChild(s('rect', { x: L, y: y + 2, width: w, height: rowH - 6, rx: 2, fill: b.color || COLORS[0] }));
      if (b.mark !== undefined) g.appendChild(s('line', { x1: L + (W - L - R) * b.mark / max, x2: L + (W - L - R) * b.mark / max, y1: y, y2: y + rowH - 2, stroke: '#111', 'stroke-width': 2 }));
      g.appendChild(s('text', { x: L + w + 4, y: y + rowH * 0.65, class: 'mt' }, b.note !== undefined ? b.note : String(b.value)));
    });
    return g;
  };
})();

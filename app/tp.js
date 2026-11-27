/* Thinking processes: cloud and tree docs (DSL, validate, Markdown, SVG) for case tabs. Mirror: goal/tp.py (same JSON, DSL and layout). */
(function () {
  'use strict';
  var KINDS = ['ude', 'cause', 'root', 'injection', 'de', 'obstacle', 'io', 'action', 'need', 'effect'];
  var TREES = { crt: 'Current Reality Tree', frt: 'Future Reality Tree', prt: 'Prerequisite Tree', tt: 'Transition Tree' };
  var CLR = [['clarity', 'Clarity'], ['entity', 'Entity existence'], ['causality', 'Causality existence'],
    ['insufficiency', 'Cause insufficiency'], ['additional', 'Additional cause'], ['reversal', 'Cause-effect reversal'],
    ['predicted', 'Predicted effect existence'], ['tautology', 'Tautology']];
  var COLORS = { ude: '#fbe0dc', root: '#f3d0f0', cause: '#eef1f5', injection: '#dce7fb', de: '#e3f4e8',
    obstacle: '#fbe0dc', io: '#dce7fb', action: '#fff4cc', need: '#eef1f5', effect: '#e3f4e8' };
  var EX = {
    crt: ['Bearington plant: current reality', [
      'm1: Performance measured by local efficiency [root]', 'p2: Material released to keep workers busy [root]',
      'p1: Managers push work to keep every worker busy [cause]', 'c1: Non-bottlenecks make more than the bottleneck can process [cause]',
      'c2: Bottleneck time lost to idle, setups, bad parts [cause]', 'u1: Inventory piles up before bottlenecks [ude]',
      'u2: Orders ship late [ude]', 'u3: Constant expediting and overtime [ude]', 'u4: Plant loses money [ude]',
      'm1 -> p1', 'p1 + p2 -> c1', 'c1 -> u1', 'u1 + c2 -> u2', 'u2 -> u3', 'u1 + u3 -> u4']],
    frt: ['Bearington plant: future reality', [
      "i1: Release material at the bottleneck's pace [injection]", 'i2: Measure system throughput, not local efficiency [injection]',
      'i3: Inspect before the bottleneck; run it through breaks [injection]', 'e1: Inventory falls [de]',
      'e2: Bottleneck time not wasted [de]', 'e3: Orders ship on time [de]', 'e4: Plant makes money [de]',
      'i1 + i2 -> e1', 'i3 -> e2', 'e1 + e2 -> e3', 'e3 -> e4']],
    prt: ['Bearington plant: prerequisites', [
      'g: Ship on time with low inventory [de]', 'o1: Supervisors resist idle workers [obstacle]',
      'io1: Supervisors measured on throughput [io]', 'o2: No release schedule [obstacle]',
      'io2: Release schedule set from bottleneck queue [io]', 'o3: Bottleneck load unknown [obstacle]',
      'io3: Bottlenecks found from queue data [io]', 'o1 -> io1', 'o2 -> io2', 'o3 -> io3', 'io3 -> io2', 'io1 + io2 -> g']],
    tt: ['Bearington plant: transition', [
      'n1: Bottleneck parts wait behind other work [need]', 'a1: Tag bottleneck parts red [action]',
      'e1: Workers process red-tag parts first [effect]', 'a2: Release material by bottleneck schedule [action]',
      'e2: Queue before NCX-10 stays at buffer size [effect]', 'g: Orders ship on time [de]',
      'n1 + a1 -> e1', 'e1 + a2 -> e2', 'e2 -> g']]
  };
  var CLOUD = {
    type: 'cloud', title: 'Bearington plant: release conflict',
    a: 'Run a profitable plant', b: 'Keep everyone busy', c: 'Reduce inventory',
    d: 'Release more material', dp: "Release only at the constraint's pace",
    assumptions: { ab: 'Idle workers waste money', ac: 'Inventory costs cash and hides delays',
      bd: 'Workers need material to stay busy', cdp: 'Material past constraint pace piles up', ddp: 'One release policy at a time' },
    injections: ['Idle time at a non-bottleneck costs nothing', 'Measure throughput, not efficiency']
  };

  var NODE = /^([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*(?:\[(\w+)\])?\s*$/, LINK = /^(.+?)\s*->\s*([A-Za-z0-9_-]+)\s*$/;
  function parseDsl(text) {
    var nodes = [], links = [];
    String(text).split('\n').forEach(function (raw) {
      var line = raw.trim(), m;
      if (!line || line[0] === '#') return;
      m = NODE.exec(line);
      if (m && line.split(':')[0].indexOf('->') < 0) { nodes.push({ id: m[1], text: m[2], kind: (m[3] || 'cause').toLowerCase() }); return; }
      m = LINK.exec(line);
      if (m) links.push({ from: m[1].split('+').map(function (s) { return s.trim(); }).filter(Boolean), to: m[2] });
    });
    return { nodes: nodes, links: links };
  }
  function toDsl(doc) {
    return (doc.nodes || []).map(function (n) { return n.id + ': ' + n.text + ' [' + (n.kind || 'cause') + ']'; })
      .concat((doc.links || []).map(function (l) { return l.from.join(' + ') + ' -> ' + l.to; })).join('\n') + '\n';
  }
  function newDoc(kind) {
    if (kind === 'cloud') return JSON.parse(JSON.stringify(CLOUD));
    var p = parseDsl(EX[kind][1].join('\n')), clr = {};
    CLR.forEach(function (c) { clr[c[0]] = false; });
    return { type: kind, title: EX[kind][0], nodes: p.nodes, links: p.links, clr: clr };
  }
  function validate(doc) {
    var out = [], t = doc.type;
    if (t === 'cloud') {
      ['a', 'b', 'c', 'd', 'dp'].forEach(function (k) {
        if (!String(doc[k] || '').trim()) out.push({ level: 'error', msg: 'empty box: ' + (k === 'dp' ? "D'" : k.toUpperCase()) });
      });
      return out;
    }
    if (!TREES[t]) return [{ level: 'error', msg: 'unknown type: ' + t }];
    var ids = {}, seen = {}, adj = {}, nodes = doc.nodes || [];
    nodes.forEach(function (n) {
      if (ids[n.id]) out.push({ level: 'error', msg: 'duplicate id: ' + n.id });
      ids[n.id] = 1; adj[n.id] = [];
      if (KINDS.indexOf(n.kind) < 0) out.push({ level: 'warn', msg: 'unknown kind: ' + n.kind + ' (' + n.id + ')' });
    });
    (doc.links || []).forEach(function (l) {
      l.from.concat([l.to]).forEach(function (x) {
        if (!ids[x]) out.push({ level: 'error', msg: 'unknown id: ' + x });
        seen[x] = 1;
      });
      l.from.forEach(function (f) { if (adj[f] && ids[l.to]) adj[f].push(l.to); });
    });
    var st = {};
    function dfs(u) {
      st[u] = 1;
      for (var i = 0; i < adj[u].length; i++) { var v = adj[u][i]; if (st[v] === 1 || (!st[v] && dfs(v))) return true; }
      st[u] = 2; return false;
    }
    var keys = Object.keys(ids).sort();
    for (var i = 0; i < keys.length; i++) if (!st[keys[i]] && dfs(keys[i])) { out.push({ level: 'error', msg: 'cycle' }); break; }
    nodes.forEach(function (n) { if (!seen[n.id] && keys.length > 1) out.push({ level: 'warn', msg: 'orphan: ' + n.id }); });
    if (t === 'crt' && !nodes.some(function (n) { return n.kind === 'ude'; })) out.push({ level: 'error', msg: 'no UDE' });
    return out;
  }
  function renderMd(doc) {
    var md = ['# ' + (doc.title || doc.type), ''];
    if (doc.type === 'cloud') {
      var a = doc.assumptions || {};
      md = md.concat(['| Box | Entity | Assumption |', '|---|---|---|', '| A objective | ' + doc.a + ' | |',
        '| B need | ' + doc.b + ' | ' + (a.ab || '') + ' |', '| C need | ' + doc.c + ' | ' + (a.ac || '') + ' |',
        '| D prerequisite | ' + doc.d + ' | ' + (a.bd || '') + ' |', "| D' prerequisite | " + doc.dp + ' | ' + (a.cdp || '') + ' |',
        "| D vs D' | conflict | " + (a.ddp || '') + ' |', '', '## Injections', ''], (doc.injections || []).map(function (x) { return '- ' + x; }));
      return md.join('\n') + '\n';
    }
    md.push('Type: ' + (TREES[doc.type] || doc.type), '', '## Entities', '');
    (doc.nodes || []).forEach(function (n) { md.push('- **' + n.id + '** `' + (n.kind || '') + '` ' + n.text); });
    md.push('', '## Links', '');
    (doc.links || []).forEach(function (l) { md.push('- ' + l.from.join(' + ') + ' -> ' + l.to); });
    md.push('', '## CLR', '');
    var clr = doc.clr || {};
    CLR.forEach(function (c) { md.push('- [' + (clr[c[0]] ? 'x' : ' ') + '] ' + c[1]); });
    return md.join('\n') + '\n';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function wrap(text, w) {
    var lines = [], cur = '';
    String(text).split(/\s+/).filter(Boolean).forEach(function (word) {
      if (cur && cur.length + 1 + word.length > w) { lines.push(cur); cur = word; } else cur = (cur + ' ' + word).trim();
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function layout(doc) {
    var ids = (doc.nodes || []).map(function (n) { return n.id; }), preds = {}, lvl = {};
    ids.forEach(function (i) { preds[i] = []; });
    (doc.links || []).forEach(function (l) {
      if (preds[l.to]) l.from.forEach(function (f) { if (preds[f]) preds[l.to].push(f); });
    });
    for (var it = 0; it <= ids.length; it++) {
      var changed = false;
      ids.forEach(function (i) {
        var v = 0;
        preds[i].forEach(function (p) { v = Math.max(v, (lvl[p] || 0) + 1); });
        v = Math.min(v, ids.length);
        if (lvl[i] !== v) { lvl[i] = v; changed = true; }
      });
      if (!changed) break;
    }
    var rows = {}, pos = {};
    ids.forEach(function (i) { (rows[lvl[i]] = rows[lvl[i]] || []).push(i); });
    var ks = Object.keys(rows).map(Number).sort(function (a, b) { return a - b; });
    ks.forEach(function (k) {
      var r = rows[k];
      if (k > 0) {
        var bc = function (i) { var ps = preds[i].filter(function (p) { return pos[p]; }).map(function (p) { return pos[p][0]; }); return ps.length ? ps.reduce(function (a, b) { return a + b; }, 0) / ps.length : 0; };
        r.sort(function (a, b) { return bc(a) - bc(b) || ids.indexOf(a) - ids.indexOf(b); });
      }
      r.forEach(function (i, j) { pos[i] = [j, k]; });
    });
    var nw = 0;
    ks.forEach(function (k) { nw = Math.max(nw, rows[k].length); });
    return { pos: pos, nl: ks.length ? ks[ks.length - 1] + 1 : 0, nw: nw };
  }
  var DEFS = '<defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="#555"/></marker></defs>';
  function f1(x) { return x.toFixed(1); }
  function renderSvg(doc) {
    if (doc.type === 'cloud') return cloudSvg(doc);
    var BW = 170, BH = 56, GX = 30, GY = 60, L = layout(doc), pos = L.pos;
    var W = Math.max(1, L.nw) * (BW + GX) + GX, H = L.nl * (BH + GY) + GY, byid = {}, rows = {};
    (doc.nodes || []).forEach(function (n) { byid[n.id] = n; });
    Object.keys(pos).forEach(function (i) { var p = pos[i]; rows[p[1]] = Math.max(rows[p[1]] || 0, p[0] + 1); });
    function xy(i) {
      var p = pos[i], off = (W - rows[p[1]] * (BW + GX) + GX) / 2;
      return [off + p[0] * (BW + GX), H - GY / 2 - (p[1] + 1) * (BH + GY) + GY];
    }
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" font-family="sans-serif" font-size="11" width="100%" style="max-width:' + W + 'px">', DEFS];
    (doc.links || []).forEach(function (l) {
      if (!pos[l.to]) return;
      var t = xy(l.to), tx = t[0] + BW / 2, ty = t[1] + BH, src = l.from.filter(function (f) { return pos[f]; });
      if (src.length > 1) {
        var jx = tx, jy = ty + GY * 0.45;
        src.forEach(function (f) { var p = xy(f); out.push('<line x1="' + f1(p[0] + BW / 2) + '" y1="' + f1(p[1]) + '" x2="' + f1(jx) + '" y2="' + f1(jy) + '" stroke="#555"/>'); });
        out.push('<ellipse cx="' + f1(jx) + '" cy="' + f1(jy) + '" rx="16" ry="7" fill="#fff" stroke="#555"/>');
        out.push('<line x1="' + f1(jx) + '" y1="' + f1(jy - 7) + '" x2="' + f1(tx) + '" y2="' + f1(ty) + '" stroke="#555" marker-end="url(#ar)"/>');
      } else if (src.length) {
        var p = xy(src[0]);
        out.push('<line x1="' + f1(p[0] + BW / 2) + '" y1="' + f1(p[1]) + '" x2="' + f1(tx) + '" y2="' + f1(ty) + '" stroke="#555" marker-end="url(#ar)"/>');
      }
    });
    Object.keys(pos).forEach(function (i) {
      var n = byid[i], p = xy(i);
      out.push('<rect x="' + f1(p[0]) + '" y="' + f1(p[1]) + '" width="' + BW + '" height="' + BH + '" rx="5" fill="' + (COLORS[n.kind] || '#fff') + '" stroke="#999"/>');
      out.push('<text x="' + f1(p[0] + 5) + '" y="' + f1(p[1] + 11) + '" fill="#666" font-size="9">' + esc(i) + ' ' + esc(n.kind || '') + '</text>');
      wrap(n.text, 24).slice(0, 3).forEach(function (line, k) {
        out.push('<text x="' + f1(p[0] + 5) + '" y="' + f1(p[1] + 25 + k * 12) + '">' + esc(line) + '</text>');
      });
    });
    out.push('</svg>');
    return out.join('\n') + '\n';
  }
  function cloudSvg(doc) {
    var a = doc.assumptions || {}, BW = 170, BH = 60;
    var box = { a: [10, 130], b: [270, 30], c: [270, 230], d: [580, 30], dp: [580, 230] };
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 300" font-family="sans-serif" font-size="11" width="100%" style="max-width:760px">', DEFS];
    var note = function (x, y, txt, col, anchor) {
      wrap(txt || '', 26).slice(0, 2).forEach(function (line, j) {
        out.push('<text x="' + x + '" y="' + (y + j * 11) + '" fill="' + (col || '#666') + '" font-size="9.5" text-anchor="' + (anchor || 'middle') + '">' + esc(line) + '</text>');
      });
    };
    [['b', 'a', 'ab'], ['c', 'a', 'ac'], ['d', 'b', 'bd'], ['dp', 'c', 'cdp']].forEach(function (e) {
      var f = box[e[0]], t = box[e[1]], x1 = f[0], y1 = f[1] + BH / 2, x2 = t[0] + BW, y2 = t[1] + BH / 2;
      out.push('<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#555" marker-end="url(#ar)"/>');
      if (e[1] === 'a') note((x1 + x2) / 2 - 8, (y1 + y2) / 2 + (e[0] === 'b' ? -6 : 14), a[e[2]], null, 'end'); else note((x1 + x2) / 2, (y1 + y2) / 2 + 14, a[e[2]]);
    });
    out.push('<path d="M665 92 L655 140 L675 180 L665 228" fill="none" stroke="#d33b2c" stroke-width="2"/>');
    note(645, 158, a.ddp, '#d33b2c', 'end');
    var lab = { a: 'A', b: 'B', c: 'C', d: 'D', dp: "D'" };
    Object.keys(box).forEach(function (k) {
      var x = box[k][0], y = box[k][1];
      out.push('<rect x="' + x + '" y="' + y + '" width="' + BW + '" height="' + BH + '" rx="5" fill="' + (k === 'a' ? '#dce7fb' : '#fff') + '" stroke="#999"/>');
      out.push('<text x="' + (x + 6) + '" y="' + (y + 14) + '" font-weight="700">' + lab[k] + '</text>');
      wrap(doc[k] || '', 27).slice(0, 3).forEach(function (line, j) {
        out.push('<text x="' + (x + 6) + '" y="' + (y + 28 + j * 12) + '">' + esc(line) + '</text>');
      });
    });
    out.push('</svg>');
    return out.join('\n') + '\n';
  }
  Goal.tp = { parseDsl: parseDsl, toDsl: toDsl, newDoc: newDoc, validate: validate, renderMd: renderMd, renderSvg: renderSvg };
})();

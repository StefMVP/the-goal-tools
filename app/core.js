/* Shared math. Mirror: goal/core.py. Parity: tests/vectors.json. */
(function (root) {
  'use strict';

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randint(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  function rnd(x, d) { var m = Math.pow(10, d === undefined ? 3 : d); return Math.floor(x * m + 0.5) / m; }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function median(a) {
    if (!a.length) return 0;
    var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /* Dice game. dice[i] = [min,max] face range of station i.
     rope: release to station 0 only up to `buffer` units between release and the constraint. */
  function dice(p) {
    var n = p.stations || 5, rounds = p.rounds || 20, seed = p.seed === undefined ? 1 : p.seed;
    var dice = (p.dice || []).slice();
    for (var i = 0; i < n; i++) if (!dice[i]) dice[i] = [1, 6];
    dice = dice.slice(0, n);
    var means = dice.map(function (d) { return (d[0] + d[1]) / 2; });
    var herbie = 0;
    for (i = 1; i < n; i++) if (means[i] < means[herbie]) herbie = i;
    var rope = !!p.rope, buffer = p.buffer === undefined ? 6 : p.buffer;
    var init = p.initWip || 0;
    var r = mulberry32(seed);
    var q = [];
    for (i = 0; i <= n; i++) q.push(i === 0 || i === n ? 0 : init);
    var out = [], cum = 0, maxWip = 0, released = 0;
    for (var k = 0; k < rounds; k++) {
      var rel = 0;
      if (rope) {
        var ahead = 0;
        for (i = 0; i <= herbie; i++) ahead += q[i];
        rel = Math.max(0, buffer - ahead);
        q[0] += rel; released += rel;
      }
      var rolls = [], moved = [];
      for (i = 0; i < n; i++) {
        var roll = randint(r, dice[i][0], dice[i][1]);
        var m = (i === 0 && !rope) ? roll : Math.min(roll, q[i]);
        if (!(i === 0 && !rope)) q[i] -= m;
        else released += m;
        q[i + 1] += m;
        rolls.push(roll); moved.push(m);
      }
      var shipped = q[n]; q[n] = 0; cum += shipped;
      var wip = sum(q.slice(0, n));
      if (wip > maxWip) maxWip = wip;
      out.push({ release: rel, rolls: rolls, moved: moved, queues: q.slice(0, n), out: shipped, cum: cum, wip: wip });
    }
    var expected = rounds * Math.min.apply(null, means);
    var avgCap = rounds * sum(means) / n;
    return {
      params: { stations: n, rounds: rounds, seed: seed, dice: dice, rope: rope, buffer: buffer, initWip: init },
      herbie: herbie, rounds: out,
      totals: { throughput: cum, expected: rnd(expected), averageCapacity: rnd(avgCap), deficit: rnd(expected - cum), finalWip: out.length ? out[out.length - 1].wip : 0, maxWip: maxWip, released: released }
    };
  }

  /* Flow lab. stages: [{name, cap, var, wip}]; policy: {rope, exploit, elevate, buffer}. */
  function constraintIndex(caps) {
    var c = 0;
    for (var i = 1; i < caps.length; i++) if (caps[i] < caps[c]) c = i;
    return c;
  }
  function flow(p) {
    var stages = p.stages, days = p.days || 30, seed = p.seed === undefined ? 1 : p.seed;
    var pol = p.policy || {}, n = stages.length;
    var caps = stages.map(function (s) { return s.cap; });
    var effOf = function () { return caps.map(function (x, i) { return x * (1 - (stages[i]['var'] || 0) / 2); }); };
    var c0 = constraintIndex(effOf());
    var elev = pol.elevate || 1;
    if (elev !== 1) caps[c0] = caps[c0] * elev;
    if (pol.add) caps[c0] = caps[c0] + pol.add;
    var eff0 = effOf(), c = constraintIndex(eff0);
    var buffer = pol.buffer === undefined ? 2 * caps[c] : pol.buffer;
    var r = mulberry32(seed);
    var q = stages.map(function (s) { return s.wip || 0; });
    q.push(0);
    var done = [], used = stages.map(function () { return 0; }), series = [], cum = 0, wipSum = 0;
    for (var d = 0; d < days; d++) {
      if (pol.rope) {
        var ahead = 0;
        for (var i = 0; i <= c; i++) ahead += q[i];
        q[0] += Math.max(0, Math.floor(buffer - ahead + 0.5));
      }
      var moved = [];
      for (i = 0; i < n; i++) {
        var v = stages[i]['var'] || 0, u = r();
        var capd = (pol.exploit && i === c) ? caps[i] : caps[i] * (1 - v * u);
        capd = Math.max(0, Math.floor(capd + 0.5));
        var m = (i === 0 && !pol.rope) ? capd : Math.min(capd, q[i]);
        if (!(i === 0 && !pol.rope)) q[i] -= m;
        q[i + 1] += m;
        used[i] += m;
        moved.push(m);
      }
      var o = q[n]; q[n] = 0; cum += o;
      var wip = sum(q.slice(0, n));
      wipSum += wip;
      series.push({ out: o, cum: cum, wip: wip, queues: q.slice(0, n), moved: moved });
    }
    var th = cum / days;
    var eff = stages.map(function (s, i) { return rnd(used[i] / (caps[i] * days)); });
    var avgWip = wipSum / days;
    return {
      constraint: c, originalConstraint: c0, caps: caps.map(function (x) { return rnd(x); }), effCaps: eff0.map(function (x) { return rnd(x); }),
      days: series,
      totals: {
        throughput: cum, perDay: rnd(th), finalWip: series[days - 1].wip, avgWip: rnd(avgWip),
        leadTime: th > 0 ? rnd(avgWip / th) : null,
        localEfficiency: eff, avgLocalEfficiency: rnd(sum(eff) / n)
      }
    };
  }

  /* Transfer batch vs process batch. unit[i] = time per unit at stage i. */
  function batch(p) {
    var unit = p.unit, b = p.process, t = p.transfer || b, setup = p.setup || 0;
    var maxU = Math.max.apply(null, unit);
    var same = sum(unit.map(function (u) { return setup + b * u; }));
    var split = sum(unit.map(function (u) { return setup + t * u; })) + (b - t) * maxU;
    return { sameBatch: rnd(same), splitBatch: rnd(Math.min(same, split)) };
  }

  function littles(p) {
    if (p.wip === undefined) return { wip: rnd(p.throughput * p.leadTime) };
    if (p.leadTime === undefined) return { leadTime: rnd(p.wip / p.throughput) };
    return { throughput: rnd(p.wip / p.leadTime) };
  }

  /* CSV analyzer. rows: [{id, stage, start, end, cause, owner}] with ISO dates. */
  function parseTime(s) {
    if (!s) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?Z?$/.exec(String(s).trim());
    if (!m) throw new Error('bad time: ' + s);
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) / 86400000;
  }
  function parseCsv(text) {
    var rows = [], row = [], f = '', i = 0, inq = false;
    text = String(text).replace(/\r\n?/g, '\n');
    for (; i < text.length; i++) {
      var ch = text[i];
      if (inq) {
        if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else inq = false; }
        else f += ch;
      } else if (ch === '"') inq = true;
      else if (ch === ',') { row.push(f); f = ''; }
      else if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else f += ch;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    rows = rows.filter(function (r) { return r.length > 1 || r[0].trim() !== ''; });
    var head = rows.shift().map(function (h) { return h.trim().toLowerCase(); });
    return rows.map(function (r) {
      var o = {};
      head.forEach(function (h, j) { o[h] = (r[j] || '').trim(); });
      return o;
    });
  }
  function paretoOf(map, order) {
    var keys = order.filter(function (k) { return map[k] !== undefined; });
    var total = sum(keys.map(function (k) { return map[k]; }));
    keys.sort(function (a, b) { return map[b] - map[a] || order.indexOf(a) - order.indexOf(b); });
    var c = 0;
    return keys.map(function (k) {
      c += map[k];
      return { key: k, days: rnd(map[k]), share: total ? rnd(map[k] / total) : 0, cumShare: total ? rnd(c / total) : 0 };
    });
  }
  function analyze(rows, opt) {
    opt = opt || {};
    var t0 = Infinity, t1 = -Infinity, recs = [];
    rows.forEach(function (r) {
      var s = parseTime(r.start), e = parseTime(r.end);
      if (s === null) return;
      if (s < t0) t0 = s; if (s > t1) t1 = s;
      if (e !== null && e > t1) t1 = e;
      recs.push({ id: r.id, stage: r.stage, s: s, e: e, cause: r.cause || '', owner: r.owner || '' });
    });
    var asOf = opt.asOf ? parseTime(opt.asOf) : t1;
    var stageOrder = [], causeOrder = [], idOrder = [];
    var byStage = {}, byCause = {}, items = {};
    recs.forEach(function (x) {
      var open = x.e === null, d = (open ? asOf : x.e) - x.s;
      if (d < 0) d = 0;
      if (stageOrder.indexOf(x.stage) < 0) { stageOrder.push(x.stage); byStage[x.stage] = { durs: [], open: 0 }; }
      byStage[x.stage].durs.push(d);
      if (open) byStage[x.stage].open++;
      if (x.cause) {
        if (causeOrder.indexOf(x.cause) < 0) { causeOrder.push(x.cause); byCause[x.cause] = 0; }
        byCause[x.cause] += d;
      }
      if (idOrder.indexOf(x.id) < 0) { idOrder.push(x.id); items[x.id] = []; }
      items[x.id].push({ stage: x.stage, start: rnd(x.s - t0), days: rnd(d), open: open, cause: x.cause, owner: x.owner });
    });
    var stageDays = {};
    var stages = stageOrder.map(function (k) {
      var st = byStage[k], tot = sum(st.durs);
      stageDays[k] = tot;
      return { stage: k, items: st.durs.length, days: rnd(tot), median: rnd(median(st.durs)), open: st.open };
    });
    var pareto = paretoOf(stageDays, stageOrder);
    var aging = recs.filter(function (x) { return x.e === null; }).map(function (x) {
      return { id: x.id, stage: x.stage, age: rnd(asOf - x.s), cause: x.cause };
    }).sort(function (a, b) { return b.age - a.age || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    var lanes = idOrder.map(function (id) {
      var seg = items[id], end = 0;
      seg.forEach(function (g) { if (g.start + g.days > end) end = g.start + g.days; });
      var start = Math.min.apply(null, seg.map(function (g) { return g.start; }));
      return { id: id, start: rnd(start), leadTime: rnd(end - start), open: seg.some(function (g) { return g.open; }), segments: seg };
    });
    var leads = lanes.filter(function (l) { return !l.open; }).map(function (l) { return l.leadTime; });
    return {
      items: idOrder.length, rows: recs.length, span: rnd(asOf - t0),
      constraint: pareto.length ? { stage: pareto[0].key, days: pareto[0].days, share: pareto[0].share } : null,
      stages: stages, pareto: pareto, causes: paretoOf(byCause, causeOrder),
      aging: aging, lanes: lanes,
      leadTime: { done: leads.length, median: rnd(median(leads)) }
    };
  }

  /* Product mix. products: [{id, price, material, demand, minutes:{res:min}}], resources: [{id, cap}], oe. */
  function productMix(p) {
    var prods = p.products, res = p.resources;
    var load = res.map(function (r) {
      var l = sum(prods.map(function (x) { return (x.minutes[r.id] || 0) * x.demand; }));
      return { id: r.id, cap: r.cap, load: l, ratio: rnd(l / r.cap) };
    });
    var ci = 0;
    for (var i = 1; i < load.length; i++) if (load[i].ratio > load[ci].ratio) ci = i;
    var cid = res[ci].id;
    function plan(key) {
      var order = prods.map(function (x, j) {
        var t = x.price - x.material, cm = x.minutes[cid] || 0;
        return { j: j, t: t, k: key === 'unit' ? t : (cm ? t / cm : Infinity) };
      }).sort(function (a, b) { return b.k - a.k || a.j - b.j; });
      var rem = {};
      res.forEach(function (r) { rem[r.id] = r.cap; });
      var mix = prods.map(function () { return 0; }), T = 0;
      order.forEach(function (o) {
        var x = prods[o.j], q = x.demand;
        res.forEach(function (r) { var m = x.minutes[r.id] || 0; if (m) q = Math.min(q, Math.floor(rem[r.id] / m)); });
        res.forEach(function (r) { rem[r.id] -= q * (x.minutes[r.id] || 0); });
        mix[o.j] = q; T += q * o.t;
      });
      return {
        rank: order.map(function (o) { return prods[o.j].id; }),
        mix: prods.map(function (x, j) { return { id: x.id, qty: mix[j] }; }),
        throughput: rnd(T), netProfit: rnd(T - p.oe)
      };
    }
    return {
      load: load, constraint: load[ci].ratio > 1 ? cid : null,
      perUnit: plan('unit'), perConstraintMinute: plan('cm'),
      products: prods.map(function (x) {
        var t = x.price - x.material, cm = x.minutes[cid] || 0;
        return { id: x.id, t: t, tPerConstraintMinute: cm ? rnd(t / cm) : null };
      })
    };
  }

  function bufferZone(pen) { return pen >= 1 ? 'black' : pen >= 2 / 3 ? 'red' : pen >= 1 / 3 ? 'yellow' : 'green'; }

  /* Machines: old machines vs one new machine vs new + old kept. Per day, deterministic.
     Cost view: standard cost per part and local efficiency. Throughput view: plant T, I, OE. */
  var MACHINE_BASE = {
    old: { count: 3, rate: 8, operators: 1, costHr: 10, setup: 1, down: 5 },
    new: { rate: 30, operators: 1, costHr: 40, setup: 1, down: 10 },
    plant: { hours: 16, breakHr: 1.5, wage: 25, demand: 500, other: 40, tPerPart: 60, material: 20, oe: 20000, position: 'after' },
    policy: { old: 'scrapped', breaks: 'idle' }
  };
  var MACHINE_PRESETS = {
    ncx10: { title: 'NCX-10 replaces old machines', chapters: [2, 18, 19], set: { 'policy.breaks': 'covered' } },
    zmegma: { title: 'Bring back the Zmegma', chapters: [19, 22], set: { 'old.count': 1, 'policy.old': 'spare', 'policy.breaks': 'covered' } },
    lunch: { title: 'NCX-10 idle at lunch', chapters: [19, 20], set: { 'plant.breakHr': 2, 'policy.breaks': 'idle' } },
    robots: { title: 'Robots: efficiency up, T flat, I up', chapters: [4, 9], set: {
      'old.count': 1, 'old.rate': 50, 'old.operators': 4, 'old.costHr': 10, 'old.setup': 0, 'old.down': 0,
      'new.rate': 68, 'new.setup': 0, 'new.down': 0,
      'new.operators': 4, 'new.costHr': 20,
      'plant.position': 'first', 'plant.other': 45, 'plant.demand': 800, 'plant.breakHr': 0, 'plant.tPerPart': 40 } }
  };
  function machineInputs(preset, over) {
    var p = JSON.parse(JSON.stringify(MACHINE_BASE));
    function put(sets) {
      Object.keys(sets || {}).forEach(function (k) {
        var a = k.split('.'), g = p[a[0]];
        if (!g || a.length !== 2 || !(a[1] in g)) throw new Error('unknown input: ' + k);
        g[a[1]] = typeof g[a[1]] === 'number' ? Number(sets[k]) : String(sets[k]);
      });
    }
    if (preset) { if (!MACHINE_PRESETS[preset]) throw new Error('unknown preset: ' + preset); put(MACHINE_PRESETS[preset].set); }
    put(over);
    return p;
  }
  function machines(p) {
    var pl = p.plant, idle = p.policy.breaks === 'idle';
    function group(m, count) {
      var avail = Math.max(0, pl.hours - (idle ? pl.breakHr : 0) - m.setup) * (1 - m.down / 100);
      return { count: count, rated: count * m.rate, cap: count * m.rate * avail,
        costHr: count * (m.costHr + m.operators * pl.wage), labor: count * m.operators * pl.wage, ops: count * m.operators, lostHr: idle ? pl.breakHr : 0 };
    }
    function option(id, gs) {
      var cap = 0, rated = 0, costHr = 0, labor = 0, ops = 0;
      gs.forEach(function (g) { cap += g.cap; rated += g.rated; costHr += g.costHr; labor += g.labor; ops += g.ops; });
      var otherCap = pl.other * pl.hours, first = pl.position === 'first';
      var upCap = first ? cap : otherCap, downCap = first ? otherCap : cap;
      var made = Math.min(upCap, downCap);
      var parts = Math.min(pl.demand, made);
      var wip = Math.max(0, upCap - downCap), fg = Math.max(0, made - parts);
      var machineOut = first ? cap : made;
      var constraint = parts >= pl.demand ? 'market' : (cap <= otherCap ? 'machine' : 'other');
      var T = parts * pl.tPerPart, OE = costHr * pl.hours + pl.oe;
      return {
        id: id,
        cost: { costPerPart: rnd(rated ? costHr / rated : 0, 2), laborPerPart: rnd(rated ? labor / rated : 0, 2),
          efficiency: rnd(rated ? 100 * machineOut / (rated * pl.hours) : 0, 1), partsPerHour: rated,
          made: rnd(machineOut, 1), perOperatorHr: rnd(ops ? rated / ops : 0, 2) },
        tioe: { constraint: constraint, machineCap: rnd(cap, 1), otherCap: rnd(otherCap, 1), parts: rnd(parts, 1),
          T: rnd(T, 0), OE: rnd(OE, 0), netProfit: rnd(T - OE, 0),
          wipPerDay: rnd(wip + fg, 1), iPerDay: rnd((wip + fg) * pl.material, 0),
          lostHr: constraint === 'machine' ? gs[0].lostHr : 0,
          hourValue: constraint === 'machine' ? rnd(pl.tPerPart * rated, 0) : 0,
          lostT: constraint === 'machine' ? rnd(pl.tPerPart * rated * gs[0].lostHr, 0) : 0 }
      };
    }
    var o = group(p.old, p.old.count), n = group(p.new, 1);
    var opts = [option('old', [o]), option('new', [n]), option('both', [n, o])];
    function cpp(o) { return o.cost.partsPerHour ? o.cost.costPerPart : Infinity; }
    var cost = opts.slice().sort(function (a, b) { return cpp(a) - cpp(b); })[0].id;
    var tv = opts.slice().sort(function (a, b) { return b.tioe.netProfit - a.tioe.netProfit || a.tioe.iPerDay - b.tioe.iPerDay; })[0].id;
    return { options: opts, plan: PLAN[p.policy.old] || 'new', costPick: cost, throughputPick: tv };
  }
  /* Policy "old machines" -> option that runs: scrapped = new only, spare = new + old, only = old only (no new machine). */
  var PLAN = { scrapped: 'new', spare: 'both', only: 'old' };
  /* Mine: the policy in p. Optimal: the policy (old machines x breaks) with max net profit/day for the same plant; tie: lowest I.
     On a tie with mine, mine is optimal. */
  function machinesOptimal(p) {
    function run(old, breaks) {
      var q = JSON.parse(JSON.stringify(p));
      q.policy = { old: old, breaks: breaks };
      var r = machines(q), o = r.options.filter(function (x) { return x.id === r.plan; })[0];
      return { old: old, breaks: breaks, run: r.plan, tioe: o.tioe };
    }
    var mine = run(p.policy.old, p.policy.breaks), best = mine;
    Object.keys(PLAN).forEach(function (old) {
      ['covered', 'idle'].forEach(function (breaks) {
        var c = run(old, breaks), a = c.tioe, b = best.tioe;
        if (a.netProfit > b.netProfit || (a.netProfit === b.netProfit && a.iPerDay < b.iPerDay)) best = c;
      });
    });
    var m = mine.tioe, o = best.tioe;
    return { mine: mine, optimal: best, same: m.netProfit === o.netProfit && m.iPerDay === o.iPerDay };
  }
  /* Sweep one input over values; returns per option arrays of parts and T. */
  function machinesSweep(p, key, values) {
    var out = { key: key, values: values, old: { parts: [], T: [] }, new: { parts: [], T: [] }, both: { parts: [], T: [] } };
    values.forEach(function (v) {
      var q = JSON.parse(JSON.stringify(p)), a = key.split('.');
      q[a[0]][a[1]] = v;
      machines(q).options.forEach(function (x) { out[x.id].parts.push(x.tioe.parts); out[x.id].T.push(x.tioe.T); });
    });
    return out;
  }

  /* Dice score 0-100 = T% x I%. T% = net shipped / bound, max 100; net = shipped - start WIP drained.
     bound = lowest roll total of the slowest-die stations (one slow station: Herbie rolls; balanced line: all stations).
     I% = 1 while avg WIP <= needed (2 x Herbie max face + 1 per station), else needed / avg WIP. */
  var GRADES = [[90, 'A'], [80, 'B'], [70, 'C'], [60, 'D'], [0, 'F']];
  function grade(sc) { for (var i = 0; i < GRADES.length; i++) if (sc >= GRADES[i][0]) return GRADES[i][1]; return 'F'; }
  /* Raw score of rounds 1..k for k = 1..upto (default all rounds). */
  function dicePrefix(res, upto) {
    var p = res.params, n = p.stations, hb = res.herbie, hd = p.dice[hb], i, k;
    var mh = (hd[0] + hd[1]) / 2, slow = [];
    for (i = 0; i < n; i++) if ((p.dice[i][0] + p.dice[i][1]) / 2 === mh) slow.push(i);
    var rs = upto === undefined ? res.rounds : res.rounds.slice(0, upto), start = p.initWip * (n - 1), needed = 2 * hd[1] + n - 1;
    var wip = 0, tot = [], out = [];
    for (i = 0; i < n; i++) tot.push(0);
    for (k = 0; k < rs.length; k++) {
      var r = rs[k];
      wip += r.wip;
      for (i = 0; i < slow.length; i++) tot[slow[i]] += r.rolls[slow[i]];
      var bound = Infinity;
      for (i = 0; i < slow.length; i++) bound = Math.min(bound, tot[slow[i]]);
      var net = r.cum - Math.max(0, start - r.wip);
      var tPct = bound > 0 ? Math.max(0, Math.min(1, net / bound)) : 1;
      var avgWip = wip / (k + 1), iPct = avgWip <= needed ? 1 : needed / avgWip;
      out.push({ score: 100 * tPct * iPct, tPct: tPct, iPct: iPct, avgWip: avgWip, needed: needed, bound: bound, shipped: r.cum, net: net });
    }
    return out;
  }
  function diceScoreRaw(res, upto) {
    var xs = dicePrefix(res, upto), p = res.params;
    return xs.length ? xs[xs.length - 1] : { score: 100, tPct: 1, iPct: 1, avgWip: 0, needed: 2 * p.dice[res.herbie][1] + p.stations - 1, bound: 0, shipped: 0, net: 0 };
  }
  /* upto: score of rounds 1..upto (default all). */
  function diceScore(res, upto) {
    var x = diceScoreRaw(res, upto), sc = Math.floor(x.score + 0.5);
    return { score: sc, grade: grade(sc), tPct: rnd(100 * x.tPct, 1), iPct: rnd(100 * x.iPct, 1), avgWip: rnd(x.avgWip, 2), needed: x.needed, bound: rnd(x.bound, 1), shipped: x.shipped, net: x.net };
  }
  /* Move die `from` to position `to`; other dice keep their order. */
  function diceMove(dc, from, to) {
    var d = dc.map(function (x) { return x.slice(); }), x = d.splice(from, 1)[0];
    d.splice(to, 0, x);
    return d;
  }
  function herbieOf(dc) {
    var h = 0;
    for (var i = 1; i < dc.length; i++) if ((dc[i][0] + dc[i][1]) / 2 < (dc[h][0] + dc[h][1]) / 2) h = i;
    return h;
  }
  /* Mean over seeds 1..N of the full-game score; byRound[k-1] = mean score of rounds 1..k. */
  function diceMean(p, seeds) {
    var t = { score: 0, tPct: 0, avgWip: 0, shipped: 0 }, by = [], k;
    for (k = 0; k < (p.rounds || 20); k++) by.push(0);
    for (var sd = 1; sd <= seeds; sd++) {
      var q = { stations: p.stations, rounds: p.rounds, seed: sd, dice: p.dice, rope: p.rope, buffer: p.buffer, initWip: p.initWip };
      var xs = dicePrefix(dice(q)), x = xs[xs.length - 1];
      t.score += x.score; t.tPct += x.tPct; t.avgWip += x.avgWip; t.shipped += x.shipped;
      for (k = 0; k < xs.length; k++) by[k] += xs[k].score;
    }
    return { score: t.score / seeds, tPct: t.tPct / seeds, avgWip: t.avgWip / seeds, shipped: t.shipped / seeds, byRound: by.map(function (v) { return v / seeds; }) };
  }
  /* Optimal controllable settings (Herbie position, rope, buffer 0..maxBuffer, start WIP 0..maxInit) for a fixed
     problem (stations, dice set, rounds). Max mean score over seeds 1..N; first best wins. */
  function diceOptimal(p, o) {
    o = o || {};
    var seeds = o.seeds || 20, maxBuf = o.maxBuffer === undefined ? 40 : o.maxBuffer, maxInit = o.maxInit === undefined ? 8 : o.maxInit;
    var base = dice({ stations: p.stations, rounds: p.rounds, seed: 1, dice: p.dice, rope: p.rope, buffer: p.buffer, initWip: p.initWip }).params;
    var dc = base.dice, h0 = herbieOf(dc), n = base.stations, same = true;
    for (var i = 1; i < n; i++) if (dc[i][0] !== dc[0][0] || dc[i][1] !== dc[0][1]) same = false;
    var pos = [];
    for (i = 0; i < n; i++) if (!same || i === h0) pos.push(i);
    function cand(at, rope, buf, init) {
      return { stations: n, rounds: base.rounds, dice: diceMove(dc, h0, at), rope: rope, buffer: buf, initWip: init };
    }
    var cur = diceMean(base, seeds);
    var best = { herbie: herbieOf(base.dice), rope: base.rope, buffer: base.buffer, initWip: base.initWip, dice: base.dice, mean: cur };
    var by = cur.byRound.map(function (v) { return { herbie: best.herbie, rope: best.rope, buffer: best.buffer, initWip: best.initWip, score: v }; });
    pos.forEach(function (at) {
      for (var w = 0; w <= maxInit; w++) for (var b = -1; b <= maxBuf; b++) {
        var c = cand(at, b >= 0, b >= 0 ? b : base.buffer, w), m = diceMean(c, seeds);
        if (m.score > best.mean.score + 1e-9) best = { herbie: at, rope: c.rope, buffer: c.buffer, initWip: w, dice: c.dice, mean: m };
        for (var k = 0; k < m.byRound.length; k++) if (m.byRound[k] > by[k].score + 1e-9) by[k] = { herbie: at, rope: c.rope, buffer: c.buffer, initWip: w, score: m.byRound[k] };
      }
    });
    function out(m) { return { score: rnd(m.score, 1), tPct: rnd(100 * m.tPct, 1), avgWip: rnd(m.avgWip, 2), shipped: rnd(m.shipped, 2) }; }
    var changed = [];
    if (best.herbie !== herbieOf(base.dice)) changed.push('herbie');
    if (best.rope !== base.rope) changed.push('rope');
    if (best.rope && best.buffer !== base.buffer) changed.push('buffer');
    if (best.initWip !== base.initWip) changed.push('initWip');
    return { seeds: seeds, settings: { herbie: best.herbie, rope: best.rope, buffer: best.buffer, initWip: best.initWip, dice: best.dice },
      current: out(cur), optimal: out(best.mean), changed: changed, byRound: by };
  }
  /* Headline scores for the Dice tab. Both sides: mean score over seeds 1..N of rounds 1..upto (the measure
     diceOptimal maximizes). opt may come from a different start config (cache); mine is a candidate too,
     so optimal >= mine. mineOptimal: mine within 0.5 of optimal. */
  function diceHeadline(p, opt, upto, seeds) {
    seeds = seeds || opt.seeds;
    var base = dice({ stations: p.stations, rounds: p.rounds, seed: 1, dice: p.dice, rope: p.rope, buffer: p.buffer, initWip: p.initWip }).params;
    var k = (upto || base.rounds) - 1, mine = diceMean(base, seeds).byRound[k], b = opt.byRound[k], h0 = herbieOf(base.dice);
    var o = mine > b.score ? { herbie: h0, rope: base.rope, buffer: base.buffer, initWip: base.initWip, score: mine } : b;
    function side(v) { var sc = Math.floor(v + 0.5); return { score: sc, grade: grade(sc), mean: rnd(v, 1) }; }
    var os = side(o.score);
    os.settings = { herbie: o.herbie, rope: o.rope, buffer: o.buffer, initWip: o.initWip, dice: diceMove(base.dice, h0, o.herbie) };
    return { seeds: seeds, upto: k + 1, mine: side(mine), optimal: os, mineOptimal: mine >= o.score - 0.5 };
  }


  /* Flow lab optimum. Problem: stages, days, econ {tu: T per unit, oe: OE/day, ec: cost/day per +1 cap, ic: I cost per WIP unit/day, budget: max elevate spend/day}.
     Actions: exploit, rope + buffer (units), add (+cap/day at the constraint; add × ec <= budget).
     Net/day over days 1..k = tu × out/day − oe − ec × add − ic × avg WIP; mean over seeds 1..N. */
  function flowNet(p, pol, seeds) {
    var e = p.econ, days = p.days || 30, by = [], tp = 0, tw = 0, k;
    for (k = 0; k < days; k++) by.push(0);
    for (var sd = 1; sd <= seeds; sd++) {
      var r = flow({ stages: p.stages, days: days, seed: sd, policy: pol }), ws = 0;
      for (k = 0; k < days; k++) {
        var d = r.days[k];
        ws += d.wip;
        by[k] += e.tu * d.cum / (k + 1) - e.oe - e.ec * (pol.add || 0) - e.ic * ws / (k + 1);
      }
      tp += r.totals.throughput / days; tw += ws / days;
    }
    return { net: by[days - 1] / seeds, perDay: tp / seeds, avgWip: tw / seeds, byDay: by.map(function (v) { return v / seeds; }) };
  }
  function flowMaxAdd(e, maxAdd) { return e.ec > 0 ? Math.min(maxAdd, Math.floor(e.budget / e.ec + 1e-9)) : maxAdd; }
  function flowPol(ex, rope, buf, add) { var x = { exploit: ex, rope: rope, add: add }; if (rope) x.buffer = buf; return x; }
  function flowOptimal(p, o) {
    o = o || {};
    var seeds = o.seeds || 20, maxBuf = o.maxBuffer === undefined ? 40 : o.maxBuffer, A = flowMaxAdd(p.econ, o.maxAdd === undefined ? 10 : o.maxAdd);
    var best = null, by = null;
    [false, true].forEach(function (ex) {
      for (var b = 0; b <= maxBuf; b++) for (var a = 0; a <= A; a++) {
        var pol = flowPol(ex, b > 0, b, a), m = flowNet(p, pol, seeds);
        if (!best || m.net > best.mean.net + 1e-9) best = { settings: pol, mean: m };
        if (!by) by = m.byDay.map(function (v) { return { settings: pol, net: v }; });
        else for (var k = 0; k < by.length; k++) if (m.byDay[k] > by[k].net + 1e-9) by[k] = { settings: pol, net: m.byDay[k] };
      }
    });
    return { seeds: seeds, maxAdd: A, settings: best.settings, optimal: { net: rnd(best.mean.net, 2), perDay: rnd(best.mean.perDay, 2), avgWip: rnd(best.mean.avgWip, 2) }, byDay: by };
  }
  /* Mine vs optimum at day upto (default last). Mine inside the budget is a candidate too, so optimal >= mine. */
  function flowHeadline(p, mine, opt, upto) {
    var days = p.days || 30, k = (upto || days) - 1, pol = flowPol(!!mine.exploit, !!mine.rope, mine.buffer, mine.add || 0);
    if (mine.rope && mine.buffer === undefined) delete pol.buffer;
    var m = flowNet(p, pol, opt.seeds), mv = m.byDay[k], b = opt.byDay[k], ok = p.econ.ec * (pol.add || 0) <= p.econ.budget + 1e-9;
    var o = ok && mv > b.net ? { settings: pol, net: mv } : b;
    return { seeds: opt.seeds, upto: k + 1, mine: { net: rnd(mv, 2), inBudget: ok, settings: pol }, optimal: { net: rnd(o.net, 2), settings: o.settings },
      mineOptimal: ok && mv >= o.net - 0.5 };
  }

  /* Buffer size. Each sample = sum of task estimates × f(u); f median 1, from 1 − s/2 to 1 + 2s (s = spread 0..1).
     base 'sum': the buffer covers the overrun over the sum of estimates (CCPM). Else it covers the full time (DBR). */
  function bufferSamples(p) {
    var seeds = p.seeds || 20, n = p.n || 50, s = p.spread, out = [], base = 0, i;
    if (p.base === 'sum') for (i = 0; i < p.tasks.length; i++) base += p.tasks[i];
    for (var sd = 1; sd <= seeds; sd++) {
      var r = mulberry32(sd), xs = [];
      for (var j = 0; j < n; j++) {
        var t = 0;
        for (i = 0; i < p.tasks.length; i++) {
          var u = r(), f = u < 0.5 ? 1 - 0.5 * s * (1 - 2 * u) : 1 + 2 * s * (2 * u - 1);
          t += p.tasks[i] * f;
        }
        xs.push(t - base);
      }
      out.push(xs);
    }
    return out;
  }
  /* Mean over seeds of the share of samples that need no more than buffer b. */
  function bufferService(xs, b) {
    var t = 0;
    xs.forEach(function (a) { var c = 0; a.forEach(function (v) { if (v <= b + 1e-9) c++; }); t += c / a.length; });
    return t / xs.length;
  }
  /* Smallest whole buffer with service >= target. curve[b] = service for b = 0..max. */
  function bufferOptimal(p) {
    var xs = bufferSamples(p), mx = 0;
    xs.forEach(function (a) { a.forEach(function (v) { if (v > mx) mx = v; }); });
    var max = Math.max(1, Math.ceil(mx - 1e-9)), curve = [], best = null;
    for (var b = 0; b <= max; b++) {
      var sv = bufferService(xs, b);
      curve.push(rnd(sv, 4));
      if (best === null && sv >= p.target - 1e-9) best = b;
    }
    return { buffer: best, service: curve[best], target: p.target, max: max, curve: curve };
  }
  /* rank: met target first, then smaller buffer. */
  function bufferHeadline(p, mine, opt) {
    var sv = rnd(bufferService(bufferSamples(p), mine), 4), met = sv >= p.target - 1e-9;
    return { mine: { buffer: mine, service: sv, met: met }, optimal: { buffer: opt.buffer, service: opt.service, met: true },
      mineOptimal: met && mine <= opt.buffer };
  }

  var api = { mulberry32: mulberry32, dice: dice, flow: flow, batch: batch, littles: littles, parseTime: parseTime, parseCsv: parseCsv, analyze: analyze, productMix: productMix, bufferZone: bufferZone, constraintIndex: constraintIndex, rnd: rnd, median: median,
    diceScore: diceScore, diceOptimal: diceOptimal, diceHeadline: diceHeadline, diceGrade: grade, diceMean: diceMean, diceMove: diceMove,
    flowOptimal: flowOptimal, flowHeadline: flowHeadline, flowNet: flowNet, bufferSamples: bufferSamples, bufferService: bufferService, bufferOptimal: bufferOptimal, bufferHeadline: bufferHeadline,
    machines: machines, machinesOptimal: machinesOptimal, machinesSweep: machinesSweep, machineInputs: machineInputs, MACHINE_PRESETS: MACHINE_PRESETS, MACHINE_BASE: MACHINE_BASE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GoalCore = api;
})(this);

/* JS side of the parity test: app/core.js must reproduce tests/vectors.json. Run: node tests/parity.js */
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const core = require(path.join(root, 'app', 'core.js'));
const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, 'vectors.json'), 'utf8'));
function run(kind, inp) {
  if (kind === 'rng') { const r = core.mulberry32(inp.seed); return Array.from({ length: inp.n }, () => r()); }
  if (kind === 'dice') return core.dice(inp);
  if (kind === 'dscore') return core.diceScore(core.dice(inp), inp.upto === undefined ? undefined : inp.upto);
  if (kind === 'dopt') return core.diceOptimal(inp, { seeds: inp.seeds, maxBuffer: inp.maxBuffer, maxInit: inp.maxInit });
  if (kind === 'dhead') {
    const o = core.diceOptimal(inp.other || inp.mine, { seeds: inp.seeds, maxBuffer: inp.maxBuffer, maxInit: inp.maxInit });
    const x = core.diceHeadline(inp.mine, o, inp.upto);
    assert.ok(x.optimal.score >= x.mine.score && x.optimal.mean >= x.mine.mean, 'optimal headline < mine headline');
    return x;
  }
  if (kind === 'flow') return core.flow(inp);
  if (kind === 'fhead') {
    const o = core.flowOptimal(inp.p, { seeds: inp.seeds, maxBuffer: inp.maxBuffer, maxAdd: inp.maxAdd });
    const x = core.flowHeadline(inp.p, inp.mine, o, inp.upto);
    assert.ok(!x.mine.inBudget || x.optimal.net >= x.mine.net, 'flow: optimal < mine');
    return { opt: Object.assign({}, o, { byDay: null }), head: x };
  }
  if (kind === 'bopt') return core.bufferOptimal(inp);
  if (kind === 'bhead') {
    const o = core.bufferOptimal(inp.p), x = core.bufferHeadline(inp.p, inp.mine, o);
    assert.ok(o.service >= inp.p.target - 1e-9 && (!x.mine.met || o.buffer <= inp.mine), 'buffers: optimal < mine');
    return { opt: o, head: x };
  }
  if (kind === 'batch') return core.batch(inp);
  if (kind === 'littles') return core.littles(inp);
  if (kind === 'analyze') {
    let text = inp.csv;
    if (text.endsWith('.csv')) text = fs.readFileSync(path.join(root, text), 'utf8');
    return core.analyze(core.parseCsv(text), { asOf: inp.asOf });
  }
  if (kind === 'mix') return core.productMix(inp);
  if (kind === 'machines') return core.machines(core.machineInputs(inp.preset, inp.over));
  if (kind === 'mopt') {
    const x = core.machinesOptimal(core.machineInputs(inp.preset, inp.over)), m = x.mine.tioe, o = x.optimal.tioe;
    assert.ok(o.netProfit > m.netProfit || (o.netProfit === m.netProfit && o.iPerDay <= m.iPerDay), 'optimal worse than mine');
    return x;
  }
  if (kind === 'msweep') return core.machinesSweep(core.machineInputs(inp.preset), inp.key, inp.values);
  throw new Error(kind);
}
let fail = 0;
vectors.forEach((v, i) => {
  const got = JSON.parse(JSON.stringify(run(v.kind, v.input)));
  try { assert.deepStrictEqual(got, v.expected); }
  catch (e) { fail++; console.log('FAIL', i, v.kind, e.message.split('\n').slice(0, 12).join('\n')); }
});
console.log(vectors.length - fail + '/' + vectors.length + ' parity vectors match');
process.exit(fail ? 1 : 0);

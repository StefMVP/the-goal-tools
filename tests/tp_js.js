/* Print app/tp.js output for each example doc as JSON. Used by tests/test_tp.py. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { Goal: {} };
ctx.window = ctx;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'app', 'tp.js'), 'utf8'), ctx);
const tp = ctx.Goal.tp, out = {};
['cloud', 'crt', 'frt', 'prt', 'tt'].forEach(k => {
  const d = tp.newDoc(k);
  out[k] = { doc: d, md: tp.renderMd(d), svg: tp.renderSvg(d), issues: tp.validate(d) };
});
console.log(JSON.stringify(out));

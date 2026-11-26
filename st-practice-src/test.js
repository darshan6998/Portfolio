// Checks every problem before it ships:  node st-practice-src/test.js
const fs = require('fs'), path = require('path');
const code = ['engine.js', 'problems.js', 'problems2.js', 'explain.js', 'ladder.js'].map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n') + ';\nreturn {E: STEngine, P: PROBLEMS, X: EXPLAIN};';
const { E, P, X } = new Function('module', code)(undefined);
// ---- checks
let errors = [];
const ids = new Set();
for (const p of P) {
  const where = `[${p.id}]`;
  if (ids.has(p.id)) errors.push(`${where} duplicate id`); ids.add(p.id);
  for (const f of ['title', 'diff', 'desc', 'tags', 'tests', 'hints']) if (!p[f]) errors.push(`${where} missing ${f}`);
  if (!['Easy', 'Medium', 'Hard'].includes(p.diff)) errors.push(`${where} bad diff`);
  if (!p.tests.some(t => !t.hidden)) errors.push(`${where} needs at least one visible test`);
  if (!p.tests.some(t => t.hidden)) errors.push(`${where} needs at least one hidden test`);
  if (p.solution && !X[p.id]) errors.push(`${where} ST problem has no EXPLAIN entry`);
  if (p.ld && !p.ldHow) errors.push(`${where} ladder solution has no explanation`);
  if (!p.solution && !p.ld) errors.push(`${where} no reference solution`);
  for (const t of p.tests) {
    let exp = null;
    try { exp = E.simulate(p.solution || p.ld, p, t, p.solution ? 'st' : 'ld'); }
    catch (e) { errors.push(`${where} reference fails on "${t.name}": ${e.kind}: ${e.message} (line ${e.line})`); continue; }
    if (p.solution && p.ld) {
      try {
        const got = E.simulate(p.ld, p, t, 'ld');
        const ok = exp.every((c, i) => Object.keys(c.out).every(k => E.same(got[i].out[k], c.out[k])));
        if (!ok) errors.push(`${where} ladder solution disagrees with ST on "${t.name}"`);
      } catch (e) { errors.push(`${where} ladder fails on "${t.name}": ${e.message}`); }
    }
  }
  if (p.solution) { try { E.simulate(p.starter, p, p.tests[0], 'st'); } catch (e) { if (!(e instanceof E.STError)) errors.push(`${where} starter crashes the simulator`); } }
}
console.log(`${P.length} problems, ${P.filter(p => p.solution).length} ST, ${P.filter(p => p.ld).length} ladder`);
if (errors.length) { console.log('FAILED:\n' + errors.join('\n')); process.exit(1); }
console.log('All checks passed.');

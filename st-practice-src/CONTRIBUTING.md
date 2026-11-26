# Adding problems to ST Practice

`st-practice.html` (the published page) is **generated**. Never edit it by hand. Edit the files in this folder, then build.

```
node st-practice-src/test.js      # must print "All checks passed."
python3 st-practice-src/build.py  # writes ../st-practice.html and updates the homepage problem count
```

This folder is excluded from the published site by `.assetsignore`.

## Files

| File | What it holds |
|---|---|
| `engine.js` | ST + ladder simulator. Only change it to fix a bug, and keep every existing test passing. |
| `problems.js`, `problems2.js` | The original problems. |
| `problems3.js` | **Daily additions go here.** Create it if it doesn't exist (see template below). |
| `explain.js` | `EXPLAIN[id] = { how: [...], pitfalls: [...] }`. Required for every problem with an ST solution. |
| `ladder.js` | Ladder solutions (`LADDER[id] = { sol, how, tags? }`) and ladder-only problems. Runs last and sorts problems by difficulty. |
| `index.src.html` | Page shell and UI. |

`problems3.js` must be loaded between `problems2.js` and `explain.js`: in `index.src.html` add `<script>/*PROBLEMS3*/</script>` after the PROBLEMS2 script tag, add `'/*PROBLEMS3*/': 'problems3.js'` to `parts` in `build.py`, and add `'problems3.js'` after `'problems2.js'` in the file list at the top of `test.js`. (Do this once, the first time `problems3.js` is created.)

## Problem format

```js
(function () {
const NEW = [
{
  id: 'kebab-case-unique', title: 'Short title', diff: 'Easy' | 'Medium' | 'Hard', topics: ['Timers', 'Edge detection'],
  desc: `<p>Plain-language task. Name every tag in <code>code</code>. State every rule the tests check, including edge cases.</p>`,
  tags: [
    { name: 'Start_PB', type: 'BOOL', dir: 'in', d: 'note' },        // dir: in | out | int
    { name: 'Data', type: 'DINT', dim: 10, dir: 'in', d: 'ARRAY[0..9] OF DINT' },
    { name: 'Tmr', type: 'FBD_TIMER', dir: 'int', d: 'TONR timer' }, // becomes TIMER in ladder mode automatically
  ],
  starter: `// a few lines that get the learner going, never the answer\n`,
  hints: ['nudge 1', 'nudge 2'],
  solution: `...reference Structured Text...`,
  tests: [
    { name: 'Visible example', dt: 100, steps: [[1, { Start_PB: true }], [3, { Start_PB: false }]] },
    { name: 'Edge case', hidden: true, steps: [ ... ] }
  ]
}];
PROBLEMS.push(...NEW);
})();
```

- `steps` is a list of `[scans, inputsToSet]`. Inputs persist until changed, and the outputs are checked once at the end of each step.
- Expected results come from running the reference solution, so the solution must be right. Check a few values by hand.
- Every problem needs at least one visible test and one hidden test. A hidden test should catch a classic bug, such as no edge detection, integer division, an off-by-one index or a missing clamp.

## Rules that keep it honest

- **Logix-accurate Structured Text only.** Logix ST has **no MIN, MAX, LIMIT or TRUNC** (the engine rejects them). Use IF/ELSIF for clamps. Timers in ST are `TONR` / `TOFR` with `FBD_TIMER` tags. One-shots are `OSRI` / `OSFI`. Use `TRN`, not TRUNC. Indirect bits use `Word.[i]`.
- **Timing tests must be tolerant.** Check outputs mid-phase, at least 3 scans away from any transition, so a correct solution that is a scan early or late still passes. Use 50–250 ms scans.
- **REAL outputs** are compared within 0.001 + 1e-5 × |value|. Prefer test values that are exact in binary (0.5, 0.25, whole numbers).
- **Ladder versions** (optional, add one when the problem suits ladder): add `LADDER[id] = { sol: 'rung text', how: [...] }` in `ladder.js`. Rung text is Studio 5000 format, one rung per line ending with `;`. `test.js` requires the ladder solution to match the ST outputs on every test. Skip ladder for anything that needs loops over arrays.
- **Don't repeat existing problems.** Check the ids and titles first, and aim for practical controls topics: interlocks, sequencing, alarms, scaling, filtering, motion, process control, comms data handling, and production counting and tracking.
- **Explanations** (`explain.js`): 2–4 `how` steps that explain *why* the code works, plus 1–3 `pitfalls` matching what the hidden tests catch.

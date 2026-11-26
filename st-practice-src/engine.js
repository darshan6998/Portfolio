const STEngine = (function () {
  const KW = new Set(['IF','THEN','ELSIF','ELSE','END_IF','CASE','OF','END_CASE','FOR','TO','BY','DO','END_FOR','WHILE','END_WHILE','REPEAT','UNTIL','END_REPEAT','EXIT','RETURN','AND','OR','XOR','NOT','MOD','VAR','END_VAR','ARRAY','TRUE','FALSE']);
  const BITS = { SINT: 8, INT: 16, DINT: 32 };
  const TYPEMAP = { BOOL: 'BOOL', SINT: 'SINT', INT: 'INT', DINT: 'DINT', REAL: 'REAL', FBD_TIMER: 'FBD_TIMER', TIMER: 'TIMER', COUNTER: 'COUNTER', FBD_ONESHOT: 'FBD_ONESHOT' };
  const STRUCTS = {
    FBD_TIMER: { TIMERENABLE: ['TimerEnable', 'BOOL'], PRE: ['PRE', 'DINT'], RESET: ['Reset', 'BOOL'], ACC: ['ACC', 'DINT'], EN: ['EN', 'BOOL'], TT: ['TT', 'BOOL'], DN: ['DN', 'BOOL'] },
    FBD_ONESHOT: { INPUTBIT: ['InputBit', 'BOOL'], OUTPUTBIT: ['OutputBit', 'BOOL'] },
    TIMER: { PRE: ['PRE', 'DINT'], ACC: ['ACC', 'DINT'], EN: ['EN', 'BOOL'], TT: ['TT', 'BOOL'], DN: ['DN', 'BOOL'] },
    COUNTER: { PRE: ['PRE', 'DINT'], ACC: ['ACC', 'DINT'], CU: ['CU', 'BOOL'], CD: ['CD', 'BOOL'], DN: ['DN', 'BOOL'], OV: ['OV', 'BOOL'], UN: ['UN', 'BOOL'] }
  };
  const FUNCS = { ABS: 1, SQRT: 1, SQR: 1, TRN: 1, SIN: 1, COS: 1, TAN: 1, LN: 1, LOG: 1 };
  const NOT_LOGIX = { MIN: 'Logix Structured Text has no MIN function. Compare with IF/ELSE instead', MAX: 'Logix Structured Text has no MAX function. Compare with IF/ELSE instead', LIMIT: 'Logix Structured Text has no LIMIT function. Clamp with IF/ELSIF instead (LIM in ladder is a range test, not a clamp)', TRUNC: 'Logix uses TRN, not TRUNC' };
  const PROCS = { TONR: 'FBD_TIMER', TOFR: 'FBD_TIMER', OSRI: 'FBD_ONESHOT', OSFI: 'FBD_ONESHOT' };
  const EXIT = { sig: 'exit' }, RET = { sig: 'ret' };

  class STError extends Error {
    constructor(msg, line, kind) { super(msg); this.line = line; this.kind = kind || 'Syntax error'; }
  }

  // ---------- lexer ----------
  function lex(src) {
    const toks = []; let i = 0, line = 1; const n = src.length;
    const adv = (k = 1) => { for (let j = 0; j < k && i < n; j++) { if (src[i] === '\n') line++; i++; } };
    const D = c => c >= '0' && c <= '9';
    while (i < n) {
      const c = src[i];
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { adv(); continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') adv(); continue; }
      if ((c === '(' || c === '/') && src[i + 1] === '*') {
        const close = c === '(' ? '*)' : '*/', L = line; adv(2);
        while (i < n && src.substr(i, 2) !== close) adv();
        if (i >= n) throw new STError(`Comment opened with ${c}* is never closed with ${close}`, L);
        adv(2); continue;
      }
      const L = line;
      if (/[A-Za-z_]/.test(c)) {
        let s = ''; while (i < n && /[A-Za-z0-9_]/.test(src[i])) { s += src[i]; adv(); }
        const u = s.toUpperCase(); toks.push({ t: KW.has(u) ? 'kw' : 'id', v: s, u, line: L }); continue;
      }
      if (D(c)) {
        let s = ''; while (i < n && (D(src[i]) || src[i] === '_')) { s += src[i]; adv(); }
        if (src[i] === '#') {
          const radix = parseInt(s.replace(/_/g, ''), 10); adv();
          if (![2, 8, 16].includes(radix)) throw new STError(`Radix ${radix}# is not supported — use 2#, 8# or 16#`, L);
          let d = ''; while (i < n && /[0-9A-Fa-f_]/.test(src[i])) { d += src[i]; adv(); }
          const v = parseInt(d.replace(/_/g, ''), radix);
          if (isNaN(v) || !new RegExp(radix === 16 ? '^[0-9A-Fa-f_]+$' : radix === 8 ? '^[0-7_]+$' : '^[01_]+$').test(d)) throw new STError(`Bad ${radix}# number '${d}'`, L);
          toks.push({ t: 'num', v: v | 0, real: false, line: L }); continue;
        }
        let real = false;
        if (src[i] === '.' && D(src[i + 1] || '')) { real = true; s += '.'; adv(); while (i < n && (D(src[i]) || src[i] === '_')) { s += src[i]; adv(); } }
        if ((src[i] === 'e' || src[i] === 'E') && /[0-9+\-]/.test(src[i + 1] || '')) {
          real = true; s += 'e'; adv(); if (src[i] === '+' || src[i] === '-') { s += src[i]; adv(); }
          while (i < n && D(src[i])) { s += src[i]; adv(); }
        }
        toks.push({ t: 'num', v: Number(s.replace(/_/g, '')), real, line: L }); continue;
      }
      const two = src.substr(i, 2);
      if ([':=', '<=', '>=', '<>', '**', '..'].includes(two)) { toks.push({ t: 'op', v: two, line: L }); adv(2); continue; }
      if ('=<>+-*/()[],;:.&'.includes(c)) { toks.push({ t: 'op', v: c, line: L }); adv(); continue; }
      if (c === "'" || c === '"') throw new STError('String literals are not supported in this simulator', L);
      throw new STError(`Unexpected character '${c}'`, L);
    }
    toks.push({ t: 'eof', v: 'end of code', line });
    return toks;
  }

  // ---------- parser ----------
  function parse(src, mode) {
    const T = lex(src); let p = 0;
    const pk = (o = 0) => T[Math.min(p + o, T.length - 1)];
    const isOp = (v, o = 0) => pk(o).t === 'op' && pk(o).v === v;
    const isKw = (v, o = 0) => pk(o).t === 'kw' && pk(o).u === v;
    const desc = t => t.t === 'eof' ? 'the end of the code' : `'${t.v}'`;
    const prevLine = () => (p > 0 ? T[p - 1].line : 1);
    const expOp = v => { if (!isOp(v)) throw new STError(`Expected '${v}' but found ${desc(pk())}`, pk().line); return T[p++]; };
    const expKw = v => { if (!isKw(v)) throw new STError(`Expected ${v} but found ${desc(pk())}`, pk().line); return T[p++]; };
    const semi = what => { if (!isOp(';')) throw new STError(`Missing ';' at the end of ${what}`, prevLine()); p++; };
    const optSemi = () => { if (isOp(';')) p++; };

    function sInt() {
      let neg = false; if (isOp('-')) { p++; neg = true; }
      const t = pk(); if (t.t !== 'num' || t.real) throw new STError(`Expected an integer constant but found ${desc(t)}`, t.line);
      p++; return neg ? -t.v : t.v;
    }
    function parseType() {
      if (isKw('ARRAY')) {
        const L = pk().line; p++; expOp('['); const lo = sInt(); expOp('..'); const hi = sInt(); expOp(']'); expKw('OF');
        const el = parseType(); if (el.dim != null || !['BOOL', 'SINT', 'INT', 'DINT', 'REAL'].includes(el.type)) throw new STError('Arrays must be of BOOL, SINT, INT, DINT or REAL', L);
        if (hi < lo) throw new STError('Array upper bound is below the lower bound', L);
        return { type: el.type, lo, dim: hi - lo + 1 };
      }
      const t = pk(); if (t.t !== 'id' || !TYPEMAP[t.u]) throw new STError(`Unknown data type ${desc(t)}`, t.line);
      p++; return { type: TYPEMAP[t.u] };
    }
    const decls = [];
    function varBlock() {
      expKw('VAR');
      while (!isKw('END_VAR')) {
        if (pk().t === 'eof') throw new STError('VAR block is missing END_VAR', pk().line);
        const names = []; do { const t = pk(); if (t.t !== 'id') throw new STError(`Expected a tag name but found ${desc(t)}`, t.line); names.push(t); p++; } while (isOp(',') && ++p);
        expOp(':'); const ty = parseType(); let init = null;
        if (isOp(':=')) {
          p++; if (ty.dim != null || STRUCTS[ty.type]) throw new STError('Initial values are only supported on simple tags here', pk().line);
          if (isKw('TRUE') || isKw('FALSE')) { init = pk().u === 'TRUE'; p++; }
          else { let neg = false; if (isOp('-')) { p++; neg = true; } const t = pk(); if (t.t !== 'num') throw new STError('Initial value must be a constant', t.line); p++; init = neg ? -t.v : t.v; }
        }
        semi('the declaration');
        for (const nm of names) decls.push({ name: nm.v, u: nm.u, line: nm.line, ...ty, init });
      }
      p++; optSemi();
    }

    function stmtList(stop, need) {
      const out = [];
      while (!stop()) {
        if (pk().t === 'eof') throw new STError(`Reached the end of the code — missing ${need}`, pk().line);
        const s = statement(); if (s) out.push(s);
      }
      return out;
    }
    const caseLabelStart = () => pk().t === 'num' || (isOp('-') && pk(1).t === 'num');

    function statement() {
      const t = pk(), L = t.line;
      if (isOp(';')) { p++; return null; }
      if (t.t === 'kw') {
        switch (t.u) {
          case 'IF': {
            p++; const arms = []; let cond = expr(); expKw('THEN');
            let body = stmtList(() => isKw('ELSIF') || isKw('ELSE') || isKw('END_IF'), 'END_IF');
            arms.push({ cond, body });
            while (isKw('ELSIF')) { p++; cond = expr(); expKw('THEN'); body = stmtList(() => isKw('ELSIF') || isKw('ELSE') || isKw('END_IF'), 'END_IF'); arms.push({ cond, body }); }
            let els = null; if (isKw('ELSE')) { p++; els = stmtList(() => isKw('END_IF'), 'END_IF'); }
            expKw('END_IF'); optSemi(); return { n: 'if', arms, els, line: L };
          }
          case 'CASE': {
            p++; const sel = expr(); expKw('OF'); const branches = []; let els = null;
            for (;;) {
              if (isKw('END_CASE')) break;
              if (isKw('ELSE')) { p++; els = stmtList(() => isKw('END_CASE'), 'END_CASE'); break; }
              if (!caseLabelStart()) throw new STError(`Expected a case label like '10:' but found ${desc(pk())}`, pk().line);
              const labels = [];
              do { const lo = sInt(); let hi = lo; if (isOp('..')) { p++; hi = sInt(); } labels.push([lo, hi]); } while (isOp(',') && ++p);
              expOp(':');
              const body = stmtList(() => caseLabelStart() || isKw('ELSE') || isKw('END_CASE'), 'END_CASE');
              branches.push({ labels, body });
            }
            expKw('END_CASE'); optSemi(); return { n: 'case', sel, branches, els, line: L };
          }
          case 'FOR': {
            p++; const v = pk(); if (v.t !== 'id') throw new STError(`Expected a loop variable after FOR but found ${desc(v)}`, v.line); p++;
            const ref = { n: 'ref', name: v.v, u: v.u, path: [], line: v.line };
            expOp(':='); const from = expr(); expKw('TO'); const to = expr(); let by = null; if (isKw('BY')) { p++; by = expr(); }
            expKw('DO'); const body = stmtList(() => isKw('END_FOR'), 'END_FOR'); expKw('END_FOR'); optSemi();
            return { n: 'for', ref, from, to, by, body, line: L };
          }
          case 'WHILE': { p++; const cond = expr(); expKw('DO'); const body = stmtList(() => isKw('END_WHILE'), 'END_WHILE'); expKw('END_WHILE'); optSemi(); return { n: 'while', cond, body, line: L }; }
          case 'REPEAT': { p++; const body = stmtList(() => isKw('UNTIL'), 'UNTIL ... END_REPEAT'); expKw('UNTIL'); const cond = expr(); expKw('END_REPEAT'); optSemi(); return { n: 'repeat', cond, body, line: L }; }
          case 'EXIT': p++; semi('EXIT'); return { n: 'exit', line: L };
          case 'RETURN': p++; semi('RETURN'); return { n: 'return', line: L };
          case 'VAR': throw new STError('VAR blocks must come before any statements', L);
          default: throw new STError(`Unexpected ${t.u} — check the structure above this line`, L);
        }
      }
      if (t.t === 'id') {
        if (isOp('(', 1)) {
          p += 2; const args = []; if (!isOp(')')) { do { args.push(expr()); } while (isOp(',') && ++p); }
          expOp(')'); semi('the instruction call'); return { n: 'call', name: t.v, u: t.u, args, line: L };
        }
        const target = postfix();
        if (isOp('=')) throw new STError("Use ':=' to assign a value. '=' is the comparison operator", pk().line);
        if (!isOp(':=')) throw new STError(`Expected ':=' after ${target.name} but found ${desc(pk())}`, pk().line);
        p++; const e = expr(); semi('the assignment'); return { n: 'assign', target, e, line: L };
      }
      throw new STError(`Unexpected ${desc(t)} at the start of a statement`, L);
    }

    function postfix() {
      const t = T[p++]; const node = { n: 'ref', name: t.v, u: t.u, path: [], line: t.line };
      for (;;) {
        if (isOp('[')) { p++; node.path.push({ k: 'idx', e: expr() }); expOp(']'); }
        else if (isOp('.')) {
          p++; const m = pk();
          if (m.t === 'id') { p++; node.path.push({ k: 'mem', name: m.v, u: m.u }); }
          else if (m.t === 'num' && !m.real) { p++; node.path.push({ k: 'bit', b: m.v }); }
          else if (isOp('[')) { p++; node.path.push({ k: 'ibit', e: expr() }); expOp(']'); }
          else throw new STError(`Expected a member name or bit number after '.' but found ${desc(m)}`, m.line);
        } else break;
      }
      return node;
    }
    const binLevel = (next, ops) => () => {
      let a = next();
      for (;;) {
        const t = pk(); const o = t.t === 'op' ? t.v : t.t === 'kw' ? t.u : null;
        if (!ops.includes(o)) return a;
        p++; a = { n: 'bin', op: o === '&' ? 'AND' : o, a, b: next(), line: t.line };
      }
    };
    function unary() {
      const t = pk();
      if (isOp('-') || isKw('NOT')) { p++; return { n: 'un', op: t.t === 'op' ? '-' : 'NOT', a: unary(), line: t.line }; }
      if (isOp('+')) { p++; return unary(); }
      return primary();
    }
    function primary() {
      const t = pk();
      if (t.t === 'num') { p++; return { n: 'num', v: t.v, real: t.real, line: t.line }; }
      if (isKw('TRUE') || isKw('FALSE')) { p++; return { n: 'bool', v: t.u === 'TRUE', line: t.line }; }
      if (isOp('(')) { p++; const e = expr(); expOp(')'); return e; }
      if (t.t === 'id') {
        if (isOp('(', 1)) { p += 2; const args = []; if (!isOp(')')) { do { args.push(expr()); } while (isOp(',') && ++p); } expOp(')'); return { n: 'fn', name: t.v, u: t.u, args, line: t.line }; }
        return postfix();
      }
      throw new STError(`Expected a value or tag but found ${desc(t)}`, t.line);
    }
    const pow = binLevel(unary, ['**']);
    const mul = binLevel(pow, ['*', '/', 'MOD']);
    const add = binLevel(mul, ['+', '-']);
    const rel = binLevel(add, ['<', '>', '<=', '>=']);
    const eq = binLevel(rel, ['=', '<>']);
    const and = binLevel(eq, ['AND', '&']);
    const xor = binLevel(and, ['XOR']);
    const expr = binLevel(xor, ['OR']);

    if (mode === 'expr') {
      if (pk().t === 'eof') throw new STError('Empty operand', pk().line);
      const e = expr(); if (pk().t !== 'eof') throw new STError(`Unexpected ${desc(pk())} in operand`, pk().line); return e;
    }
    while (isKw('VAR')) varBlock();
    const body = stmtList(() => pk().t === 'eof', '');
    return { decls, body };
  }

  // ---------- values ----------
  const kindOf = type => type === 'BOOL' ? 'B' : type === 'REAL' ? 'R' : 'I';
  const tv = (type, v) => ({ t: kindOf(type), v });
  const num = x => x.t === 'B' ? (x.v ? 1 : 0) : x.v;
  const truthy = x => x.t === 'B' ? x.v : x.v !== 0;
  function roundEven(n) { const f = Math.floor(n), d = n - f; if (d > 0.5) return f + 1; if (d < 0.5) return f; return f % 2 === 0 ? f : f + 1; }
  function wrap(type, n) { if (type === 'INT') return (n << 16) >> 16; if (type === 'SINT') return (n << 24) >> 24; return n | 0; }
  function conv(type, x, line) {
    if (type === 'BOOL') return x.t === 'B' ? x.v : x.v !== 0;
    let n = num(x);
    if (type === 'REAL') return Math.fround(n);
    if (!isFinite(n)) throw new STError(`Can't store ${n} in a ${type} tag`, line, 'Runtime fault');
    if (x.t === 'R') n = roundEven(n);
    return wrap(type, n);
  }
  const defVal = type => type === 'BOOL' ? false : 0;
  function makeCell(d) {
    if (d.dim != null) {
      const data = new Array(d.dim).fill(defVal(d.type));
      if (Array.isArray(d.init)) d.init.forEach((v, i) => { data[i] = rawConv(d.type, v); });
      return { kind: 'array', type: d.type, lo: d.lo || 0, len: d.dim, data, name: d.name };
    }
    if (STRUCTS[d.type]) {
      const m = {}; for (const k in STRUCTS[d.type]) { const [nm, t] = STRUCTS[d.type][k]; m[k] = { kind: 'scalar', type: t, v: defVal(t), name: nm }; }
      if (d.init) for (const k in d.init) m[k.toUpperCase()].v = rawConv(m[k.toUpperCase()].type, d.init[k]);
      return { kind: 'struct', type: d.type, m, last: null, prev: false, name: d.name };
    }
    return { kind: 'scalar', type: d.type, v: d.init != null ? rawConv(d.type, d.init) : defVal(d.type), name: d.name };
  }
  const rawConv = (type, v) => conv(type, typeof v === 'boolean' ? { t: 'B', v } : { t: Number.isInteger(v) ? 'I' : 'R', v }, 0);

  // ---------- program ----------
  class Program {
    constructor(src, tagDefs) {
      this.ast = parse(src);
      this.tags = new Map(); this.defs = new Map();
      for (const d of tagDefs) { const u = d.name.toUpperCase(); this.defs.set(u, d); this.tags.set(u, makeCell(d)); }
      for (const d of this.ast.decls) {
        if (this.defs.has(d.u)) throw new STError(`Tag '${d.name}' already exists — remove it from the VAR block`, d.line, 'Verify error');
        this.defs.set(d.u, d); this.tags.set(d.u, makeCell(d));
      }
      this.now = 0; this.loop = 0;
      this.verifyList(this.ast.body);
    }
    // static checks
    sref(r) {
      const d = this.defs.get(r.u);
      if (!d) throw new STError(`Tag '${r.name}' is not defined. Check the tag list (names are not case-sensitive) or declare it in a VAR block`, r.line, 'Verify error');
      let st = d.dim != null ? { arr: d.type } : STRUCTS[d.type] ? { struct: d.type } : { s: d.type };
      let label = d.name;
      for (const seg of r.path) {
        if (seg.k === 'idx') {
          if (!st.arr) throw new STError(`'${label}' is not an array, so it can't be indexed with [ ]`, r.line, 'Verify error');
          if (this.sexpr(seg.e) !== 'I') throw new STError(`Array index for '${label}' must be an integer`, r.line, 'Verify error');
          if (seg.e.n === 'num' && (seg.e.v < d.lo || seg.e.v >= (d.lo || 0) + d.dim)) throw new STError(`Index ${seg.e.v} is outside ${label}[${d.lo || 0}..${(d.lo || 0) + d.dim - 1}]`, r.line, 'Verify error');
          st = { s: st.arr }; label += '[...]';
        } else if (seg.k === 'mem') {
          if (!st.struct) throw new STError(`'${label}' has no member '${seg.name}'`, r.line, 'Verify error');
          const m = STRUCTS[st.struct][seg.u];
          if (!m) throw new STError(`${st.struct} has no member '${seg.name}'. Members: ${Object.values(STRUCTS[st.struct]).map(x => x[0]).join(', ')}`, r.line, 'Verify error');
          st = { s: m[1] }; label += '.' + m[0];
        } else {
          if (!st.s || !BITS[st.s]) throw new STError(`Bit access needs an integer tag; '${label}' is ${st.s || st.arr ? 'an array' : 'a structure'}`, r.line, 'Verify error');
          if (seg.k === 'bit' && seg.b >= BITS[st.s]) throw new STError(`Bit ${seg.b} is out of range for ${st.s} (0..${BITS[st.s] - 1})`, r.line, 'Verify error');
          if (seg.k === 'ibit' && this.sexpr(seg.e) !== 'I') throw new STError('Bit number must be an integer', r.line, 'Verify error');
          st = { s: 'BOOL' }; label += '.bit';
        }
      }
      return st;
    }
    sexpr(e) {
      switch (e.n) {
        case 'num': return e.real ? 'R' : 'I';
        case 'bool': return 'B';
        case 'ref': {
          const st = this.sref(e);
          if (!st.s) throw new STError(`'${e.name}' is ${st.arr ? 'an array — use an element like ' + e.name + '[0]' : 'a structure — use a member like ' + e.name + '.DN'}`, e.line, 'Verify error');
          return kindOf(st.s);
        }
        case 'un': {
          const a = this.sexpr(e.a);
          if (e.op === '-' && a === 'B') throw new STError("Can't negate a BOOL with '-'. Did you mean NOT?", e.line, 'Verify error');
          if (e.op === 'NOT' && a === 'R') throw new STError('NOT needs a BOOL or integer operand, not REAL', e.line, 'Verify error');
          return a;
        }
        case 'bin': {
          const a = this.sexpr(e.a), b = this.sexpr(e.b), o = e.op;
          if (o === 'AND' || o === 'OR' || o === 'XOR') {
            if (a === 'R' || b === 'R') throw new STError(`${o} works on BOOL (logic) or integers (bitwise), not REAL`, e.line, 'Verify error');
            return a === 'B' && b === 'B' ? 'B' : 'I';
          }
          if (['=', '<>', '<', '>', '<=', '>='].includes(o)) return 'B';
          if (o === '**') return 'R';
          return a === 'R' || b === 'R' ? 'R' : 'I';
        }
        case 'fn': {
          if (PROCS[e.u]) throw new STError(`${e.name} is an instruction, not a function — call it on its own line: ${e.name}(MyTag);`, e.line, 'Verify error');
          if (NOT_LOGIX[e.u]) throw new STError(NOT_LOGIX[e.u], e.line, 'Verify error');
          const ar = FUNCS[e.u]; if (ar == null) throw new STError(`Unknown function '${e.name}'`, e.line, 'Verify error');
          if ((ar > 0 && e.args.length !== ar) || (ar < 0 && e.args.length < -ar)) throw new STError(`${e.name} expects ${ar > 0 ? ar : 'at least ' + -ar} argument(s)`, e.line, 'Verify error');
          const ts = e.args.map(a => this.sexpr(a));
          if (ts.includes('B')) throw new STError(`${e.name} needs numeric arguments`, e.line, 'Verify error');
          if (e.u === 'TRN') return 'I';
          if (e.u === 'ABS') return ts.includes('R') ? 'R' : 'I';
          return 'R';
        }
      }
    }
    verifyList(list, depth = 0) {
      for (const s of list) {
        switch (s.n) {
          case 'assign': { const st = this.sref(s.target); if (!st.s) throw new STError(`Can't assign to a whole ${st.arr ? 'array' : 'structure'} '${s.target.name}'`, s.line, 'Verify error'); this.sexpr(s.e); break; }
          case 'if': s.arms.forEach(a => { this.sexpr(a.cond); this.verifyList(a.body, depth); }); if (s.els) this.verifyList(s.els, depth); break;
          case 'case': if (this.sexpr(s.sel) !== 'I') throw new STError('CASE selector must be an integer (DINT, INT or SINT)', s.line, 'Verify error');
            s.branches.forEach(b => this.verifyList(b.body, depth)); if (s.els) this.verifyList(s.els, depth); break;
          case 'for': { const st = this.sref(s.ref); if (!st.s || !BITS[st.s]) throw new STError(`FOR loop variable '${s.ref.name}' must be an integer tag (DINT)`, s.line, 'Verify error');
            [s.from, s.to, s.by].forEach(x => { if (x && this.sexpr(x) !== 'I') throw new STError('FOR bounds and BY step must be integers', s.line, 'Verify error'); });
            this.verifyList(s.body, depth + 1); break; }
          case 'while': case 'repeat': this.sexpr(s.cond); this.verifyList(s.body, depth + 1); break;
          case 'exit': if (!depth) throw new STError('EXIT can only be used inside a FOR, WHILE or REPEAT loop', s.line, 'Verify error'); break;
          case 'call': {
            if (FUNCS[s.u] != null) throw new STError(`${s.name} returns a value — use it in an expression, e.g. X := ${s.name}(...);`, s.line, 'Verify error');
            const need = PROCS[s.u]; if (!need) throw new STError(`Unknown instruction '${s.name}'. Supported: TONR, TOFR, OSRI, OSFI`, s.line, 'Verify error');
            if (s.args.length !== 1 || s.args[0].n !== 'ref') throw new STError(`${s.name} takes one ${need} tag, e.g. ${s.name}(My_Tag);`, s.line, 'Verify error');
            const st = this.sref(s.args[0]); if (st.struct !== need) throw new STError(`${s.name} needs a ${need} tag; '${s.args[0].name}' is not one`, s.line, 'Verify error');
            break;
          }
        }
      }
    }
    // runtime
    fault(msg, line) { return new STError(msg, line, 'Runtime fault'); }
    tick(line) { if (++this.loop > 100000) throw this.fault('Watchdog timeout: more than 100,000 loop passes in one scan — probably an infinite loop (a WHILE/REPEAT condition that never changes, or FOR with BY 0). A real controller would major-fault (Type 6, Code 1).', line); }
    resolve(r) {
      let cell = this.tags.get(r.u), lv = null;
      const asLv = () => { if (lv) return lv; const c = cell; return { type: c.type, get: () => c.v, set: v => { c.v = v; } }; };
      for (const seg of r.path) {
        if (seg.k === 'idx') {
          const arr = cell, i = this.ev(seg.e).v, k = i - arr.lo;
          if (k < 0 || k >= arr.len) throw this.fault(`Array subscript out of range: ${arr.name}[${i}] (valid ${arr.lo}..${arr.lo + arr.len - 1}). On a real controller this is a major fault (Type 4, Code 83).`, r.line);
          lv = { type: arr.type, get: () => arr.data[k], set: v => { arr.data[k] = v; } }; cell = null;
        } else if (seg.k === 'mem') { cell = cell.m[seg.u]; }
        else {
          const base = asLv(), b = seg.k === 'bit' ? seg.b : this.ev(seg.e).v;
          if (b < 0 || b >= BITS[base.type]) throw this.fault(`Bit index ${b} is out of range for ${base.type} (0..${BITS[base.type] - 1}). Major fault (Type 4, Code 83).`, r.line);
          lv = { type: 'BOOL', get: () => ((base.get() >> b) & 1) === 1, set: v => { const x = base.get(); base.set(wrap(base.type, v ? x | (1 << b) : x & ~(1 << b))); } }; cell = null;
        }
      }
      return cell && cell.kind !== 'scalar' ? { whole: cell } : asLv();
    }
    ev(e) {
      switch (e.n) {
        case 'num': return e.real ? { t: 'R', v: e.v } : { t: 'I', v: e.v | 0 };
        case 'bool': return { t: 'B', v: e.v };
        case 'ref': { const lv = this.resolve(e); return tv(lv.type, lv.get()); }
        case 'un': { const a = this.ev(e.a);
          if (e.op === 'NOT') return a.t === 'B' ? { t: 'B', v: !a.v } : { t: 'I', v: ~a.v };
          return a.t === 'R' ? { t: 'R', v: -a.v } : { t: 'I', v: (-a.v) | 0 }; }
        case 'bin': return this.bin(e);
        case 'fn': return this.fn(e);
      }
    }
    bin(e) {
      const a = this.ev(e.a), b = this.ev(e.b), o = e.op;
      if (o === 'AND' || o === 'OR' || o === 'XOR') {
        if (a.t === 'B' && b.t === 'B') return { t: 'B', v: o === 'AND' ? a.v && b.v : o === 'OR' ? a.v || b.v : a.v !== b.v };
        const x = num(a), y = num(b); return { t: 'I', v: o === 'AND' ? x & y : o === 'OR' ? x | y : x ^ y };
      }
      const x = num(a), y = num(b), R = a.t === 'R' || b.t === 'R';
      switch (o) {
        case '=': return { t: 'B', v: x === y }; case '<>': return { t: 'B', v: x !== y };
        case '<': return { t: 'B', v: x < y }; case '>': return { t: 'B', v: x > y };
        case '<=': return { t: 'B', v: x <= y }; case '>=': return { t: 'B', v: x >= y };
        case '+': return R ? { t: 'R', v: Math.fround(x + y) } : { t: 'I', v: (x + y) | 0 };
        case '-': return R ? { t: 'R', v: Math.fround(x - y) } : { t: 'I', v: (x - y) | 0 };
        case '*': return R ? { t: 'R', v: Math.fround(x * y) } : { t: 'I', v: Math.imul(x, y) };
        case '/': if (y === 0) throw this.fault('Division by zero. (A real controller logs a minor fault — Type 4, Code 4 — and the result is garbage.)', e.line);
          return R ? { t: 'R', v: Math.fround(x / y) } : { t: 'I', v: Math.trunc(x / y) | 0 };
        case 'MOD': if (y === 0) throw this.fault('MOD by zero', e.line);
          return R ? { t: 'R', v: Math.fround(x - y * Math.trunc(x / y)) } : { t: 'I', v: (x % y) | 0 };
        case '**': return { t: 'R', v: Math.fround(Math.pow(x, y)) };
      }
    }
    fn(e) {
      const a = e.args.map(x => this.ev(x)), v = a.map(num), R = a.some(x => x.t === 'R'), mk = n => R ? { t: 'R', v: Math.fround(n) } : { t: 'I', v: n | 0 };
      const rr = n => { if (isNaN(n)) throw this.fault(`${e.name} got an invalid argument (${v[0]})`, e.line); return { t: 'R', v: Math.fround(n) }; };
      switch (e.u) {
        case 'ABS': return mk(Math.abs(v[0]));
        case 'SQRT': case 'SQR': if (v[0] < 0) throw this.fault(`SQRT of a negative number (${v[0]})`, e.line); return rr(Math.sqrt(v[0]));
        case 'TRN': return { t: 'I', v: Math.trunc(v[0]) | 0 };
        case 'SIN': return rr(Math.sin(v[0])); case 'COS': return rr(Math.cos(v[0])); case 'TAN': return rr(Math.tan(v[0]));
        case 'LN': if (v[0] <= 0) throw this.fault('LN of a number ≤ 0', e.line); return rr(Math.log(v[0]));
        case 'LOG': if (v[0] <= 0) throw this.fault('LOG of a number ≤ 0', e.line); return rr(Math.log10(v[0]));
      }
    }
    exec(list) {
      for (const s of list) {
        switch (s.n) {
          case 'assign': { const lv = this.resolve(s.target); lv.set(conv(lv.type, this.ev(s.e), s.line)); break; }
          case 'if': { let done = false; for (const a of s.arms) { if (truthy(this.ev(a.cond))) { this.exec(a.body); done = true; break; } } if (!done && s.els) this.exec(s.els); break; }
          case 'case': { const x = this.ev(s.sel).v; const br = s.branches.find(b => b.labels.some(([lo, hi]) => x >= lo && x <= hi)); if (br) this.exec(br.body); else if (s.els) this.exec(s.els); break; }
          case 'for': {
            const lv = this.resolve(s.ref); lv.set(conv(lv.type, this.ev(s.from), s.line));
            const to = this.ev(s.to).v, by = s.by ? this.ev(s.by).v : 1;
            for (;;) {
              const c = lv.get(); if (by >= 0 ? c > to : c < to) break;
              this.tick(s.line);
              try { this.exec(s.body); } catch (x) { if (x === EXIT) break; throw x; }
              lv.set(wrap(lv.type, lv.get() + by));
            }
            break;
          }
          case 'while': { try { while (truthy(this.ev(s.cond))) { this.tick(s.line); this.exec(s.body); } } catch (x) { if (x !== EXIT) throw x; } break; }
          case 'repeat': { try { do { this.tick(s.line); this.exec(s.body); } while (!truthy(this.ev(s.cond))); } catch (x) { if (x !== EXIT) throw x; } break; }
          case 'exit': throw EXIT;
          case 'return': throw RET;
          case 'call': this.proc(s.u, this.resolve(s.args[0]).whole); break;
        }
      }
    }
    proc(name, c) {
      const m = c.m, now = this.now;
      if (name === 'OSRI' || name === 'OSFI') { const i = m.INPUTBIT.v; m.OUTPUTBIT.v = name === 'OSRI' ? i && !c.prev : !i && c.prev; c.prev = i; return; }
      const en = m.TIMERENABLE.v, pre = Math.max(0, m.PRE.v);
      if (m.RESET.v) { m.ACC.v = 0; m.DN.v = false; m.TT.v = false; m.EN.v = en; c.last = now; return; }
      if (name === 'TONR') {
        if (en) {
          if (c.last != null) m.ACC.v = m.ACC.v + (now - c.last);
          c.last = now;
          if (m.ACC.v >= pre) { m.ACC.v = pre; m.DN.v = true; } else m.DN.v = false;
          m.EN.v = true; m.TT.v = !m.DN.v;
        } else { m.ACC.v = 0; m.DN.v = false; m.EN.v = false; m.TT.v = false; c.last = null; }
      } else { // TOFR
        if (en) { m.EN.v = true; m.DN.v = true; m.ACC.v = 0; m.TT.v = false; c.last = null; }
        else {
          m.EN.v = false;
          if (m.DN.v) { if (c.last != null) m.ACC.v += now - c.last; c.last = now; if (m.ACC.v >= pre) { m.ACC.v = pre; m.DN.v = false; } }
          m.TT.v = m.DN.v;
        }
      }
    }
    scan(dt) {
      this.now += dt; this.loop = 0;
      try { this.exec(this.ast.body); } catch (x) { if (x !== RET) throw x; }
    }
    write(name, v) {
      const c = this.tags.get(name.toUpperCase());
      if (c.kind === 'array') v.forEach((x, i) => { c.data[i] = rawConv(c.type, x); }); else c.v = rawConv(c.type, v);
    }
    read(name) { const c = this.tags.get(name.toUpperCase()); return c.kind === 'array' ? c.data.slice() : c.v; }
  }

  // ---------- ladder (Logix rung text) ----------
  const LD = {
    XIC: ['bit'], XIO: ['bit'], OTE: ['bitw'], OTL: ['bitw'], OTU: ['bitw'], ONS: ['bitw'], OSR: ['bitw', 'bitw'], OSF: ['bitw', 'bitw'],
    TON: ['timer', 'lit', 'lit'], TOF: ['timer', 'lit', 'lit'], RTO: ['timer', 'lit', 'lit'],
    CTU: ['counter', 'lit', 'lit'], CTD: ['counter', 'lit', 'lit'], RES: ['tc'],
    EQU: ['num', 'num'], NEQ: ['num', 'num'], GRT: ['num', 'num'], GEQ: ['num', 'num'], LES: ['num', 'num'], LEQ: ['num', 'num'],
    LIM: ['num', 'num', 'num'], CMP: ['expr'],
    MOV: ['num', 'dest'], ADD: ['num', 'num', 'dest'], SUB: ['num', 'num', 'dest'], MUL: ['num', 'num', 'dest'], DIV: ['num', 'num', 'dest'], MOD: ['num', 'num', 'dest'],
    CPT: ['dest', 'expr'], CLR: ['dest'], ABS: ['num', 'dest'], AFI: [], NOP: []
  };
  const LD_HINT = { TONR: 'TONR is the Structured Text timer. In ladder, use TON with a TIMER tag', XOR: 'Ladder XOR works on integers. For BOOL logic, use contacts on parallel branches', JSR: 'Subroutines are not part of this simulator', FOR: 'FOR loops are not supported in this ladder simulator. Use Structured Text for array problems' };
  function parseLadder(src) {
    const toks = []; let i = 0, line = 1; const n = src.length;
    while (i < n) {
      const c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (/\s/.test(c)) { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === ';') { toks.push({ t: ';', line }); i++; continue; }
      if (/[A-Za-z_]/.test(c)) {
        const L = line; let name = ''; while (i < n && /[A-Za-z0-9_]/.test(src[i])) name += src[i++];
        const u = name.toUpperCase();
        if (u === 'BST' || u === 'NXB' || u === 'BND') { toks.push({ t: u, line: L }); continue; }
        while (i < n && (src[i] === ' ' || src[i] === '\t')) i++;
        const args = [];
        if (src[i] === '(') {
          i++; let depth = 0, cur = '', curLine = line;
          for (;;) {
            if (i >= n) throw new STError(`${name}( is missing its closing ')'`, L);
            const ch = src[i++];
            if (ch === '\n') line++;
            if (ch === '(') depth++;
            if (ch === ')') { if (depth === 0) { args.push({ s: cur.trim(), line: curLine }); break; } depth--; }
            if (ch === ',' && depth === 0) { args.push({ s: cur.trim(), line: curLine }); cur = ''; curLine = line; continue; }
            cur += ch;
          }
          if (args.length === 1 && args[0].s === '') args.length = 0;
        }
        toks.push({ t: 'ins', name, u, args, line: L }); continue;
      }
      throw new STError(`Unexpected '${c}' in rung text. Each rung is instructions like XIC(Tag) OTE(Out); ending with ';'`, line);
    }
    let p = 0, id = 0; const rungs = [];
    const series = (stops) => {
      const out = [];
      while (p < toks.length && !stops.includes(toks[p].t)) {
        const t = toks[p];
        if (t.t === 'BST') {
          p++; const br = { k: 'br', branches: [], id: id++, line: t.line };
          br.branches.push(series(['NXB', 'BND', ';']));
          while (toks[p] && toks[p].t === 'NXB') { p++; br.branches.push(series(['NXB', 'BND', ';'])); }
          if (!toks[p] || toks[p].t !== 'BND') throw new STError('Branch opened with BST is never closed with BND', t.line);
          p++; out.push(br);
        } else if (t.t === 'ins') { p++; out.push({ k: 'ins', name: t.name, u: t.u, args: t.args, line: t.line, id: id++ }); }
        else throw new STError(`${t.t} without a matching BST`, t.line);
      }
      return out;
    };
    while (p < toks.length) {
      const L = toks[p].line, elems = series([';']);
      if (!toks[p]) throw new STError(`Rung ${rungs.length} is missing its closing ';'`, L);
      p++; rungs.push({ elems, line: L, n: rungs.length });
    }
    return rungs;
  }

  class LadderProgram extends Program {
    constructor(src, tagDefs) {
      super('', tagDefs);
      this.rungs = parseLadder(src);
      this.trace = {};
      const walk = list => { for (const e of list) { if (e.k === 'br') e.branches.forEach(walk); else this.verifyIns(e); } };
      try { this.rungs.forEach(r => walk(r.elems)); }
      catch (err) { if (err.message) err.message = err.message.replace(' or declare it in a VAR block', ''); throw err; }
    }
    verifyIns(e) {
      const spec = LD[e.u];
      const V = m => new STError(m, e.line, 'Verify error');
      if (!spec) throw V(LD_HINT[e.u] || `Unknown ladder instruction '${e.name}'. Supported: ${Object.keys(LD).join(', ')}`);
      if (e.args.length !== spec.length) throw V(`${e.u} takes ${spec.length} operand${spec.length === 1 ? '' : 's'} (${spec.join(', ')}), got ${e.args.length}`);
      e.ex = e.args.map((a, k) => {
        if (a.s === '' || a.s === '?') throw V(`${e.u}: operand ${k + 1} is empty`);
        let x; try { x = parse(a.s, 'expr'); } catch (err) { throw V(`${e.u}: can't read operand '${a.s}': ${err.message}`); }
        const kind = spec[k];
        const isRef = x.n === 'ref';
        const fix = n => { const r = JSON.parse(JSON.stringify(n)); const set = o => { if (o && typeof o === 'object') { if ('line' in o) o.line = e.line; Object.values(o).forEach(set); } }; set(r); return r; };
        x = fix(x);
        if (kind === 'bit' || kind === 'bitw') {
          if (!isRef) throw V(`${e.u} needs a BOOL tag or bit, not '${a.s}'`);
          if (this.sexpr(x) !== 'B') throw V(`${e.u} needs a BOOL. '${a.s}' is not a bit. For a DINT bit, write Tag.5`);
        } else if (kind === 'timer' || kind === 'counter' || kind === 'tc') {
          if (!isRef) throw V(`${e.u} needs a ${kind === 'counter' ? 'COUNTER' : 'TIMER'} tag`);
          const st = this.sref(x);
          const ok = kind === 'tc' ? (st.struct === 'TIMER' || st.struct === 'COUNTER') : st.struct === (kind === 'timer' ? 'TIMER' : 'COUNTER');
          if (!ok) throw V(`${e.u} needs a ${kind === 'tc' ? 'TIMER or COUNTER' : kind.toUpperCase()} tag; '${a.s}' is ${st.struct || st.s || 'an array'}`);
        } else if (kind === 'lit') {
          const v = x.n === 'num' ? x.v : (x.n === 'un' && x.op === '-' && x.a.n === 'num') ? -x.a.v : null;
          if (v == null || !Number.isInteger(v)) throw V(`${e.u}: preset and accum must be whole-number constants (ms for timers)`);
          x = { n: 'num', v, real: false };
        } else if (kind === 'dest') {
          if (!isRef) throw V(`${e.u}: the destination must be a tag`);
          const t = this.sexpr(x); if (t === 'B') throw V(`${e.u}: the destination must be a DINT or REAL tag. Use OTE/OTL/OTU for bits`);
        } else this.sexpr(x);
        return x;
      });
      if (['TON', 'TOF', 'RTO', 'CTU', 'CTD'].includes(e.u)) {
        const cell = this.resolve(e.ex[0]).whole; cell.m.PRE.v = e.ex[1].v; cell.m.ACC.v = e.ex[2].v;
      }
    }
    run(list, r) {
      for (const e of list) {
        this.tick(e.line);
        if (e.k === 'br') { let any = false; for (const b of e.branches) { if (this.run(b, r)) any = true; } this.trace[e.id] = [r, any]; r = any; }
        else { const o = this.ins(e, r); this.trace[e.id] = [r, o]; r = o; }
      }
      return r;
    }
    ins(e, r) {
      const X = e.ex, lv = k => this.resolve(X[k]), val = k => this.ev(X[k]), N = k => num(val(k));
      const store = (k, x) => { const d = lv(k); d.set(conv(d.type, x, e.line)); };
      const bin = (op) => this.bin({ n: 'bin', op, a: X[0], b: X[1], line: e.line });
      switch (e.u) {
        case 'XIC': return r && lv(0).get();
        case 'XIO': return r && !lv(0).get();
        case 'OTE': lv(0).set(r); return r;
        case 'OTL': if (r) lv(0).set(true); return r;
        case 'OTU': if (r) lv(0).set(false); return r;
        case 'ONS': { const s = lv(0), o = r && !s.get(); s.set(r); return o; }
        case 'OSR': { const s = lv(0); lv(1).set(r && !s.get()); s.set(r); return r; }
        case 'OSF': { const s = lv(0); lv(1).set(!r && s.get()); s.set(r); return r; }
        case 'TON': case 'TOF': case 'RTO': this.timer(e.u, lv(0).whole, r); return r;
        case 'CTU': case 'CTD': {
          const m = lv(0).whole.m, bit = e.u === 'CTU' ? m.CU : m.CD;
          if (r && !bit.v) { m.ACC.v = wrap('DINT', m.ACC.v + (e.u === 'CTU' ? 1 : -1)); }
          bit.v = r; m.DN.v = m.ACC.v >= m.PRE.v; return r;
        }
        case 'RES': if (r) { const c = lv(0).whole, m = c.m; m.ACC.v = 0; m.DN.v = false; ['EN', 'TT', 'CU', 'CD', 'OV', 'UN'].forEach(k => { if (m[k]) m[k].v = false; }); c.last = null; } return r;
        case 'EQU': return r && N(0) === N(1);
        case 'NEQ': return r && N(0) !== N(1);
        case 'GRT': return r && N(0) > N(1);
        case 'GEQ': return r && N(0) >= N(1);
        case 'LES': return r && N(0) < N(1);
        case 'LEQ': return r && N(0) <= N(1);
        case 'LIM': { const lo = N(0), t = N(1), hi = N(2); return r && (lo <= hi ? (t >= lo && t <= hi) : (t >= lo || t <= hi)); }
        case 'CMP': return r && truthy(val(0));
        case 'MOV': if (r) store(1, val(0)); return r;
        case 'ADD': if (r) store(2, bin('+')); return r;
        case 'SUB': if (r) store(2, bin('-')); return r;
        case 'MUL': if (r) store(2, bin('*')); return r;
        case 'DIV': if (r) store(2, bin('/')); return r;
        case 'MOD': if (r) store(2, bin('MOD')); return r;
        case 'CPT': if (r) store(0, val(1)); return r;
        case 'CLR': if (r) { const d = lv(0); d.set(d.type === 'BOOL' ? false : 0); } return r;
        case 'ABS': if (r) store(1, this.fn({ n: 'fn', u: 'ABS', name: 'ABS', args: [X[0]], line: e.line })); return r;
        case 'AFI': return false;
        case 'NOP': return r;
      }
    }
    timer(kind, c, en) {
      const m = c.m, now = this.now, pre = Math.max(0, m.PRE.v);
      if (kind === 'TON' || kind === 'RTO') {
        if (en) {
          if (c.last != null && m.ACC.v < pre) m.ACC.v = m.ACC.v + (now - c.last);
          c.last = now;
          if (m.ACC.v >= pre) { m.ACC.v = Math.max(m.ACC.v, 0) >= pre ? pre : m.ACC.v; m.DN.v = true; } else m.DN.v = false;
          m.EN.v = true; m.TT.v = !m.DN.v;
        } else if (kind === 'TON') { m.ACC.v = 0; m.DN.v = false; m.EN.v = false; m.TT.v = false; c.last = null; }
        else { m.EN.v = false; m.TT.v = false; c.last = null; }
      } else {
        if (en) { m.EN.v = true; m.DN.v = true; m.ACC.v = 0; m.TT.v = false; c.last = null; }
        else {
          m.EN.v = false;
          if (m.DN.v) { if (c.last != null) m.ACC.v += now - c.last; c.last = now; if (m.ACC.v >= pre) { m.ACC.v = pre; m.DN.v = false; } }
          m.TT.v = m.DN.v;
        }
      }
    }
    scan(dt) {
      this.now += dt; this.loop = 0;
      for (const rg of this.rungs) this.run(rg.elems, true);
    }
  }
  const ldTags = prob => prob.tags.map(t => t.type === 'FBD_TIMER' ? { ...t, type: 'TIMER' } : t).concat(prob.ldTags || []);

  // ---------- test harness ----------
  function simulate(src, prob, test, lang) {
    const prog = lang === 'ld' ? new LadderProgram(src, ldTags(prob)) : new Program(src, prob.tags);
    const outs = prob.tags.filter(t => t.dir === 'out').map(t => t.name);
    const inputs = {}; const cps = []; let t = 0; const dt = test.dt || 100;
    for (const [n, set] of test.steps) {
      Object.assign(inputs, set);
      for (let k = 0; k < n; k++) {
        for (const nm in inputs) prog.write(nm, inputs[nm]);
        t += dt;
        try { prog.scan(dt); } catch (e) { e.at = t; e.partial = cps; e.prog = prog; throw e; }
      }
      const o = {}; outs.forEach(nm => { o[nm] = prog.read(nm); });
      cps.push({ t, set: { ...set }, inputs: JSON.parse(JSON.stringify(inputs)), out: o });
    }
    cps.prog = prog; return cps;
  }
  const close = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1e-3 + 1e-5 * Math.abs(b) : a === b;
  const same = (a, b) => Array.isArray(b) ? a.length === b.length && a.every((x, i) => close(x, b[i])) : close(a, b);

  return { lex, parse, parseLadder, Program, LadderProgram, ldTags, LD, simulate, same, STError, STRUCTS };
})();
if (typeof module !== 'undefined') module.exports = STEngine;

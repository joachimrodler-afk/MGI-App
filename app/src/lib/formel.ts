/**
 * Formel-Engine für die Wettbewerbs-Auswertung.
 *
 * Eigener, kleiner Parser – es wird NIE `eval` oder `new Function` benutzt.
 * Erlaubt sind nur Zahlen, Variablen, die unten aufgeführten Funktionen
 * und Rechenoperatoren. Damit kann eine Formel keinen fremden Code ausführen.
 *
 * Syntax (bewusst an Excel/Google Tabellen angelehnt):
 *   Zahlen:        12   3.5        (Dezimalpunkt!)
 *   Operatoren:    + - * / ^  ( )
 *   Vergleiche:    == != < <= > >=   (Ergebnis 1 = wahr, 0 = falsch)
 *   Logik:         und  oder  nicht    (auch && || !)
 *   Trennzeichen:  ;  oder  ,   zwischen Funktionsargumenten
 *   Funktionen:    siehe FUNKTIONEN unten
 *
 * Listen (z. B. die Noten mehrerer Wertungsrichter) sind erlaubt:
 *   k * durchschnitt(streich(noten))
 * Rechnen mit Listen geht elementweise: noten * 2 -> jede Note mal 2.
 */

export type Wert = number | number[];

export class FormelFehler extends Error {
  constructor(msg: string, public pos?: number) {
    super(pos !== undefined ? `${msg} (bei Zeichen ${pos + 1})` : msg);
    this.name = 'FormelFehler';
  }
}

// ---------------------------------------------------------------- Tokenizer
type Tok =
  | { t: 'zahl'; v: number; p: number }
  | { t: 'name'; v: string; p: number }
  | { t: 'op'; v: string; p: number }
  | { t: 'ende'; p: number };

const OPS = ['==', '!=', '<=', '>=', '&&', '||', '+', '-', '*', '/', '^', '(', ')', '<', '>', ';', ',', '!'];

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new FormelFehler('Ungültige Zahl', i);
      out.push({ t: 'zahl', v: parseFloat(m[0]), p: i });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-zÄÖÜäöüß_]/.test(c)) {
      const m = /^[A-Za-zÄÖÜäöüß_][A-Za-zÄÖÜäöüß_0-9]*/.exec(src.slice(i))!;
      out.push({ t: 'name', v: m[0], p: i });
      i += m[0].length;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new FormelFehler(`Unbekanntes Zeichen „${c}“`, i);
    out.push({ t: 'op', v: op, p: i });
    i += op.length;
  }
  out.push({ t: 'ende', p: src.length });
  return out;
}

// ---------------------------------------------------------------- AST
export type Knoten =
  | { k: 'zahl'; v: number }
  | { k: 'var'; name: string; p: number }
  | { k: 'unaer'; op: string; a: Knoten }
  | { k: 'binaer'; op: string; a: Knoten; b: Knoten; p: number }
  | { k: 'aufruf'; name: string; args: Knoten[]; p: number };

const WORT_OPS = new Map<string, string>([['und', '&&'], ['oder', '||'], ['nicht', '!']]);

class Parser {
  private i = 0;
  constructor(private toks: Tok[]) {}

  private peek() { return this.toks[this.i]; }
  private istOp(v: string) {
    const t = this.peek();
    if (t.t === 'op' && t.v === v) return true;
    if (t.t === 'name' && WORT_OPS.get(t.v.toLowerCase()) === v) return true;
    return false;
  }
  private nimm() { return this.toks[this.i++]; }
  private erwarte(v: string) {
    if (!this.istOp(v)) {
      const t = this.peek();
      throw new FormelFehler(t.t === 'ende' ? `„${v}“ fehlt am Ende` : `„${v}“ erwartet`, t.p);
    }
    this.nimm();
  }

  parse(): Knoten {
    const n = this.oder();
    const t = this.peek();
    if (t.t !== 'ende') throw new FormelFehler('Unerwarteter Rest in der Formel', t.p);
    return n;
  }
  private oder(): Knoten {
    let a = this.und();
    while (this.istOp('||')) { const p = this.nimm().p; a = { k: 'binaer', op: '||', a, b: this.und(), p }; }
    return a;
  }
  private und(): Knoten {
    let a = this.vergleich();
    while (this.istOp('&&')) { const p = this.nimm().p; a = { k: 'binaer', op: '&&', a, b: this.vergleich(), p }; }
    return a;
  }
  private vergleich(): Knoten {
    let a = this.summe();
    for (;;) {
      const op = ['==', '!=', '<=', '>=', '<', '>'].find((o) => this.istOp(o));
      if (!op) return a;
      const p = this.nimm().p;
      a = { k: 'binaer', op, a, b: this.summe(), p };
    }
  }
  private summe(): Knoten {
    let a = this.produkt();
    for (;;) {
      const op = ['+', '-'].find((o) => this.istOp(o));
      if (!op) return a;
      const p = this.nimm().p;
      a = { k: 'binaer', op, a, b: this.produkt(), p };
    }
  }
  private produkt(): Knoten {
    let a = this.unaer();
    for (;;) {
      const op = ['*', '/'].find((o) => this.istOp(o));
      if (!op) return a;
      const p = this.nimm().p;
      a = { k: 'binaer', op, a, b: this.unaer(), p };
    }
  }
  private unaer(): Knoten {
    if (this.istOp('-')) { this.nimm(); return { k: 'unaer', op: '-', a: this.unaer() }; }
    if (this.istOp('+')) { this.nimm(); return this.unaer(); }
    if (this.istOp('!')) { this.nimm(); return { k: 'unaer', op: '!', a: this.unaer() }; }
    return this.potenz();
  }
  private potenz(): Knoten {
    const a = this.primaer();
    if (this.istOp('^')) {
      const p = this.nimm().p;
      return { k: 'binaer', op: '^', a, b: this.unaer(), p }; // rechtsassoziativ
    }
    return a;
  }
  private primaer(): Knoten {
    const t = this.nimm();
    if (t.t === 'zahl') return { k: 'zahl', v: t.v };
    if (t.t === 'op' && t.v === '(') {
      const n = this.oder();
      this.erwarte(')');
      return n;
    }
    if (t.t === 'name') {
      if (WORT_OPS.has(t.v.toLowerCase())) throw new FormelFehler(`„${t.v}“ steht an falscher Stelle`, t.p);
      if (this.istOp('(')) {
        this.nimm();
        const args: Knoten[] = [];
        if (!this.istOp(')')) {
          for (;;) {
            args.push(this.oder());
            if (this.istOp(';') || this.istOp(',')) { this.nimm(); continue; }
            break;
          }
        }
        this.erwarte(')');
        return { k: 'aufruf', name: t.v.toLowerCase(), args, p: t.p };
      }
      return { k: 'var', name: t.v, p: t.p };
    }
    if (t.t === 'ende') throw new FormelFehler('Formel ist unvollständig', t.p);
    throw new FormelFehler(`Unerwartetes „${(t as { v: string }).v}“`, t.p);
  }
}

// ---------------------------------------------------------------- Funktionen
function flach(args: Wert[]): number[] {
  const out: number[] = [];
  for (const a of args) Array.isArray(a) ? out.push(...a) : out.push(a);
  return out;
}
function zahl(w: Wert, fn: string): number {
  if (Array.isArray(w)) throw new FormelFehler(`${fn}() erwartet hier eine einzelne Zahl, keine Liste – z. B. summe(…) verwenden`);
  return w;
}
function runde(x: number, st = 0) {
  const f = 10 ** st;
  return Math.round((x + Number.EPSILON) * f) / f;
}

interface FnDef {
  min: number;
  max: number;
  hilfe: string;
  fn: (a: Wert[]) => Wert;
}

export const FUNKTIONEN: Record<string, FnDef> = {
  summe: { min: 1, max: 99, hilfe: 'summe(liste) – Summe aller Werte', fn: (a) => flach(a).reduce((s, x) => s + x, 0) },
  durchschnitt: {
    min: 1, max: 99, hilfe: 'durchschnitt(liste) – Mittelwert',
    fn: (a) => { const f = flach(a); return f.length ? f.reduce((s, x) => s + x, 0) / f.length : 0; },
  },
  anzahl: { min: 1, max: 99, hilfe: 'anzahl(liste) – Anzahl der Werte', fn: (a) => flach(a).length },
  min: { min: 1, max: 99, hilfe: 'min(a; b; …) – kleinster Wert', fn: (a) => { const f = flach(a); return f.length ? Math.min(...f) : 0; } },
  max: { min: 1, max: 99, hilfe: 'max(a; b; …) – größter Wert', fn: (a) => { const f = flach(a); return f.length ? Math.max(...f) : 0; } },
  abs: { min: 1, max: 1, hilfe: 'abs(x) – Betrag', fn: ([x]) => Math.abs(zahl(x, 'abs')) },
  runden: { min: 1, max: 2, hilfe: 'runden(x; stellen) – kaufmännisch runden', fn: ([x, s]) => runde(zahl(x, 'runden'), s === undefined ? 0 : zahl(s, 'runden')) },
  abrunden: { min: 1, max: 1, hilfe: 'abrunden(x)', fn: ([x]) => Math.floor(zahl(x, 'abrunden')) },
  aufrunden: { min: 1, max: 1, hilfe: 'aufrunden(x)', fn: ([x]) => Math.ceil(zahl(x, 'aufrunden')) },
  wurzel: { min: 1, max: 1, hilfe: 'wurzel(x)', fn: ([x]) => Math.sqrt(zahl(x, 'wurzel')) },
  streich: {
    min: 1, max: 2,
    hilfe: 'streich(liste; n) – streicht die n höchsten und n niedrigsten Werte (Standard n = 1)',
    fn: ([l, n]) => {
      const f = flach([l]).slice().sort((x, y) => x - y);
      const k = n === undefined ? 1 : zahl(n, 'streich');
      if (f.length <= 2 * k) return f; // zu wenige Werte – nichts streichen
      return f.slice(k, f.length - k);
    },
  },
  beste: {
    min: 2, max: 2, hilfe: 'beste(liste; n) – die n höchsten Werte',
    fn: ([l, n]) => flach([l]).slice().sort((x, y) => y - x).slice(0, zahl(n, 'beste')),
  },
  // wenn() wird gesondert (verzögert) ausgewertet, siehe unten
  wenn: { min: 3, max: 3, hilfe: 'wenn(bedingung; dann; sonst)', fn: () => 0 },
};

// ---------------------------------------------------------------- Auswertung
function binaer(op: string, a: Wert, b: Wert, p: number): Wert {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) throw new FormelFehler('Listen unterschiedlicher Länge können nicht verrechnet werden', p);
      return a.map((x, i) => binaer(op, x, b[i], p) as number);
    }
    if (Array.isArray(a)) return a.map((x) => binaer(op, x, b, p) as number);
    return (b as number[]).map((y) => binaer(op, a, y, p) as number);
  }
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/':
      if (b === 0) throw new FormelFehler('Division durch 0', p);
      return a / b;
    case '^': return a ** b;
    case '==': return Math.abs(a - b) < 1e-9 ? 1 : 0;
    case '!=': return Math.abs(a - b) >= 1e-9 ? 1 : 0;
    case '<': return a < b ? 1 : 0;
    case '<=': return a <= b ? 1 : 0;
    case '>': return a > b ? 1 : 0;
    case '>=': return a >= b ? 1 : 0;
    case '&&': return a && b ? 1 : 0;
    case '||': return a || b ? 1 : 0;
  }
  throw new FormelFehler(`Unbekannter Operator ${op}`, p);
}

function auswerten(n: Knoten, vars: Record<string, Wert>): Wert {
  switch (n.k) {
    case 'zahl': return n.v;
    case 'var': {
      const key = Object.keys(vars).find((k) => k.toLowerCase() === n.name.toLowerCase());
      if (key === undefined) throw new FormelFehler(`Unbekannte Variable „${n.name}“`, n.p);
      return vars[key];
    }
    case 'unaer': {
      const a = auswerten(n.a, vars);
      if (n.op === '-') return Array.isArray(a) ? a.map((x) => -x) : -a;
      return Array.isArray(a) ? a.map((x) => (x ? 0 : 1)) : a ? 0 : 1;
    }
    case 'binaer': return binaer(n.op, auswerten(n.a, vars), auswerten(n.b, vars), n.p);
    case 'aufruf': {
      const def = Object.hasOwn(FUNKTIONEN, n.name) ? FUNKTIONEN[n.name] : undefined;
      if (!def) throw new FormelFehler(`Unbekannte Funktion „${n.name}“`, n.p);
      if (n.args.length < def.min || n.args.length > def.max)
        throw new FormelFehler(`${n.name}() hat falsche Anzahl Werte – ${def.hilfe}`, n.p);
      if (n.name === 'wenn') {
        const b = zahl(auswerten(n.args[0], vars), 'wenn');
        return auswerten(b ? n.args[1] : n.args[2], vars);
      }
      return def.fn(n.args.map((a) => auswerten(a, vars)));
    }
  }
}

/** Formel einlesen (wirft FormelFehler bei Syntaxfehlern) */
export function parseFormel(src: string): Knoten {
  if (!src.trim()) throw new FormelFehler('Formel ist leer');
  return new Parser(tokenize(src)).parse();
}

/** Alle in der Formel benutzten Variablennamen */
export function variablenIn(n: Knoten, out = new Set<string>()): Set<string> {
  if (n.k === 'var') out.add(n.name);
  if (n.k === 'unaer') variablenIn(n.a, out);
  if (n.k === 'binaer') { variablenIn(n.a, out); variablenIn(n.b, out); }
  if (n.k === 'aufruf') n.args.forEach((a) => variablenIn(a, out));
  return out;
}

/** Formel berechnen. Ergebnis muss eine einzelne Zahl sein. */
export function berechne(src: string | Knoten, vars: Record<string, Wert>): number {
  const ast = typeof src === 'string' ? parseFormel(src) : src;
  const r = auswerten(ast, vars);
  if (Array.isArray(r)) throw new FormelFehler('Ergebnis ist eine Liste – mit summe(…) oder durchschnitt(…) zusammenfassen');
  if (!Number.isFinite(r)) throw new FormelFehler('Ergebnis ist keine gültige Zahl');
  return r;
}

/** Prüft eine Formel gegen erlaubte Variablen. Gibt Fehlertext oder null zurück. */
export function pruefeFormel(src: string, erlaubt: string[]): string | null {
  try {
    const ast = parseFormel(src);
    const low = erlaubt.map((e) => e.toLowerCase());
    for (const v of variablenIn(ast)) {
      if (!low.includes(v.toLowerCase())) return `Unbekannte Variable „${v}“. Verfügbar: ${erlaubt.join(', ') || '–'}`;
    }
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

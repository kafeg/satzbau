// Упражнение «Множественное число» (docs/ex-plural.md): тип формы — окончание и умлаут.
import type { Noun } from '../types.ts'
import type { Exercise } from './index.ts'

export type Ending = 'e' | 'er' | 'en' | 's' | ''
export const ENDINGS: Ending[] = ['e', 'er', 'en', 's', '']
export const LABEL: Record<Ending, string> = { e: '-e', er: '-er', en: '-(e)n', s: '-s', '': '—' }

export type Pl = { uml: boolean; end: Ending }
// форма разобрана: где умлаут (индекс буквы или -1) и сколько букв окончания в конце
export type Parse = Pl & { at: number; tail: number }

const UML: Record<string, string> = { a: 'ä', o: 'ö', u: 'ü', A: 'Ä', O: 'Ö', U: 'Ü' }

// варианты основы с одним умлаутом; au → äu, а u в eu и äu не умлаутируется (Freund → Freunde)
function umlauted(lemma: string): [string, number][] {
  const out: [string, number][] = []
  for (let i = 0; i < lemma.length; i++) {
    const u = UML[lemma[i]!]
    if (!u || (lemma[i] === 'u' && /[aeä]/i.test(lemma[i - 1] ?? ''))) continue
    out.push([lemma.slice(0, i) + u + lemma.slice(i + 1), i])
  }
  return out
}

export function canUmlaut(lemma: string): boolean {
  return umlauted(lemma).length > 0
}

// восемь готовых типов — варианты ответа; с умлаутом бывают только -e, -er и без окончания
export const TYPES: Pl[] = [
  { uml: false, end: 'e' }, { uml: true, end: 'e' }, { uml: false, end: 'er' }, { uml: true, end: 'er' },
  { uml: false, end: 'en' }, { uml: false, end: 's' }, { uml: false, end: '' }, { uml: true, end: '' },
]

// тип коротко, как на кнопке и в правилах (tools/hints.py): «-e», «¨-e», «-(e)n», «—», «¨»
export function typeLabel(p: Pl): string {
  return p.uml && p.end === '' ? '¨' : `${p.uml ? '¨' : ''}${LABEL[p.end]}`
}

// типы для слова: умлаутные — только если в слове есть a, o, u
export function typesFor(lemma: string): Pl[] {
  return canUmlaut(lemma) ? TYPES : TYPES.filter((t) => !t.uml)
}

// окончание формы после основы: -(e)n включает -n и -nen (Lehrerin → Lehrerinnen),
// -e — и с удвоением s (Bus → Busse, Ergebnis → Ergebnisse)
function ending(stem: string, form: string): [Ending, number] | null {
  if (!form.startsWith(stem)) return null
  const t = form.slice(stem.length)
  if (t === '') return ['', 0]
  if (t === 'e' || (t === 'se' && stem.endsWith('s'))) return ['e', t.length]
  if (t === 'er') return ['er', 2]
  if (t === 'n' || t === 'en' || (t === 'nen' && stem.endsWith('in'))) return ['en', t.length]
  if (t === 's') return ['s', 1]
  return null
}

export function parse(lemma: string, form: string): Parse | null {
  const plain = ending(lemma, form)
  if (plain) return { uml: false, end: plain[0], at: -1, tail: plain[1] }
  for (const [stem, at] of umlauted(lemma)) {
    const e = ending(stem, form)
    // с умлаутом бывают только -e, -er и без окончания
    if (e && (e[0] === 'e' || e[0] === 'er' || e[0] === '')) return { uml: true, end: e[0], at, tail: e[1] }
  }
  return null
}

export function right(w: Noun, a: Pl): boolean {
  return w.plural.some((f) => {
    const p = parse(w.lemma, f)
    return p !== null && p.end === a.end && p.uml === a.uml
  })
}

export const plural: Exercise<Pl> = {
  id: 'plural',
  title: 'Множественное число',
  after: 'gender',
  // форма вне пяти типов (Museum → Museen) не спрашивается: кнопки — правила, а не слова
  fits: (w) => w.number === 'sg' && w.gender.length > 0 && w.plural.length > 0 && !('plural' in w.skip) && parse(w.lemma, w.plural[0]!) !== null,
  check: right,
  key: (a) => `${a.uml ? 'uml+' : ''}${a.end || '0'}`,
  hows: ['word'],
  field: 'plural',
}

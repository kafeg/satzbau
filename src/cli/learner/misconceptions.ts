// Типовые заблуждения русскоговорящего. Неверную форму не придумываем руками, а собираем
// тем же генератором, подменив ученику «знание»: род, вспомогательный, формы глагола, падеж.

import type { Word } from '../../core/bundle.ts'
import { generate } from '../../core/generate.ts'
import type { Entry, Gender, Item, Noun, Template, Verb } from '../../core/types.ts'

export interface Misconception {
  id: string
  what: string
  /** форма, которую даст ученик с этим заблуждением; null — к заданию не относится */
  form: (item: Item, t: Template, w: Word, all: Word[]) => string | null
}

function regen(t: Template, w: Word, all: Word[], slot?: Partial<Template['slot']>, entry?: Partial<Entry>) {
  try {
    const t2 = slot ? { ...t, slot: { ...t.slot, ...slot } } : t
    const w2 = entry ? ({ ...w, entry: { ...w.entry, ...entry } } as Word) : w
    return generate(t2, w2, all).answer
  } catch {
    return null
  }
}

/** Род по русскому переводу: так угадывает тот, кто рода не знает. */
export function ruGender(ru: string | undefined): Gender | null {
  const head = ru?.split(/[;,(]/)[0]?.trim().split(/\s+/).pop()?.toLowerCase()
  if (!head) return null
  if (/[ая]$/.test(head)) return 'f'
  if (/[оеё]$/.test(head)) return 'n'
  if (/ь$/.test(head)) return head.length % 2 ? 'f' : 'm'
  return 'm'
}

const PREFIX = /^(be|ver|er|ge|zer|ent|emp|miss|über|unter|hinter|wider)/

/** Глагол, спрягаемый как слабый: fährt → fahrt, ging → gehte, gegangen → gegeht. */
export function weakForms(v: Verb): Partial<Verb> | null {
  if (v.p3.includes(' ') || !/e?n$/.test(v.w)) return null
  const stem = v.w.replace(/e?n$/, '')
  // беглая -e- как в morph.ts: arbeitet, atmet, öffnet, zeichnet
  const e = /(t|d|chn|ffn|gn|tm|dm)$/.test(stem) ? 'e' : ''
  return {
    p3: `${stem}${e}t`,
    pt: `${stem}${e}te`,
    pp: PREFIX.test(v.w) ? `${stem}${e}t` : `ge${stem}${e}t`,
    imp: [stem],
  }
}

const MODAL_T = new Set(['kann', 'muss', 'darf', 'will', 'soll', 'mag'])

export const MISCONCEPTIONS: Misconception[] = [
  {
    id: 'gender-ru',
    what: 'род по русскому переводу',
    form: (item, t, w, all) => {
      if (w.pos !== 'n') return null
      const g = ruGender((w.entry as Noun).ru)
      if (!g || !(w.entry as Noun).g || t.slot.paradigm === 'noun_plural') return null
      return regen(t, w, all, undefined, { g } as Partial<Noun>)
    },
  },
  {
    id: 'akk-as-nom',
    what: 'винительный как именительный',
    form: (item, t, w, all) =>
      t.slot.case === 'akk' ? regen(t, w, all, { case: 'nom' }) : null,
  },
  {
    id: 'gen-des',
    what: 'в родительном всегда des, как у мужского рода',
    form: (item, t) => (t.slot.case === 'gen' && t.slot.paradigm === 'def_article' ? 'des' : null),
  },
  {
    id: 'plural-en',
    what: 'множественное через -en',
    form: (item, t, w) =>
      t.slot.paradigm === 'noun_plural' ? `${w.w}${w.w.endsWith('e') ? 'n' : 'en'}` : null,
  },
  {
    id: 'adj-e',
    what: 'окончание прилагательного всегда -e',
    form: (item, t) => (t.slot.paradigm === 'adj_ending' ? 'e' : null),
  },
  {
    id: 'strong-weak',
    what: 'сильный глагол как слабый',
    form: (item, t, w, all) => {
      if (w.pos !== 'v' || !['verb_present', 'verb_past', 'participle', 'imperative'].includes(t.slot.paradigm))
        return null
      const v = w.entry as Verb
      const weak = weakForms(v)
      // у слабого глагола «спрягать как слабый» — не заблуждение, а верный ответ
      if (!weak || (weak.p3 === v.p3 && weak.pt === v.pt && weak.pp === v.pp)) return null
      return regen(t, w, all, undefined, weak)
    },
  },
  {
    id: 'modal-t',
    what: '-t у модальных в 1 и 3 л. ед. ч.',
    form: (item, t) => (t.slot.paradigm === 'modal_present' && MODAL_T.has(item.answer) ? `${item.answer}t` : null),
  },
  {
    id: 'n-decl-none',
    what: 'слабые существительные без -n',
    form: (item, t, w, all) =>
      t.slot.paradigm === 'noun_case' && (w.entry as Noun).nd
        ? regen(t, w, all, undefined, { nd: undefined } as Partial<Noun>)
        : null,
  },
]

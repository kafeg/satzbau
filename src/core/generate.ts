// Генератор: шаблон × слово → задание. Задания не хранятся (docs/architecture.md).

import {
  adjEnding,
  defArticle,
  indefArticle,
  inventory,
  keinArticle,
  merged,
  possessive,
} from './paradigms.ts'
import { adjStem, nounForm, particle, present } from './morph.ts'
import type { Word } from './bundle.ts'
import type { Adj, Case, Gender, Item, Need, Noun, Num, Slot, Template, Verb } from './types.ts'

const LEVELS = { A1: 1, A2: 2, B1: 3 } as const
const CASES: Case[] = ['nom', 'akk', 'dat', 'gen']
const CASE_RU: Record<Case, string> = {
  nom: 'именительный',
  akk: 'винительный',
  dat: 'дательный',
  gen: 'родительный',
}
const GENDER_RU: Record<Gender, string> = { m: 'мужской', f: 'женский', n: 'средний' }

/** Признаки записи, по которым шаблон может отказаться от слова (`not` в `need`). */
const FLAGS: Record<string, (e: Noun & Verb & Adj) => boolean> = {
  pl_only: (e) => !!e.pl_only,
  plu: (e) => !!e.plu,
  npl: (e) => !!e.npl,
  nd: (e) => !!e.nd,
  // отделяемый глагол: приставка уедет в конец фразы, и рамка с хвостом сломается
  sep: (e) => !!e.p3?.includes(' '),
  aux_s: (e) => e.aux === 's',
  // только с sich: «Er bewirbt oft» — не немецкий язык
  reflexive: (e) => !!e.refl,
  adjdecl: (e) => !!e.adjdecl,
  mass: (e) => !!e.mass,
  aux_hs: (e) => e.aux === 'hs',
}

/**
 * Подходит ли слово шаблону. Условия — закрытый список, а не язык запросов.
 * `tags` — ЛЮБОЙ из перечисленных: слово помечено `document` или `thing`, но не обоими.
 */
export function fits(need: Need, w: Word): boolean {
  const e = w.entry as Noun & Verb & Adj
  if (need.pos && need.pos !== w.pos) return false
  if (need.theme && need.theme !== w.theme) return false
  if (need.tags && !need.tags.some((t) => w.tags?.includes(t))) return false
  if (need.g && !(e.g && need.g.includes(e.g))) return false
  if (need.lv_max && LEVELS[w.lv] > LEVELS[need.lv_max]) return false
  // has — и поле записи, и признак: `has: [sep]` это «отделяемый», а не «есть поле sep»
  if (need.has?.some((k) => (FLAGS[k] ? !FLAGS[k](e) : !(k in e)))) return false
  for (const f of need.not ?? []) {
    const flag = FLAGS[f]
    if (flag ? flag(e) : w.tags?.includes(f)) return false
  }
  return true
}

function genderOf(slot: Slot, w: Word, w2?: Word | null): Gender {
  if (slot.gender && slot.gender !== 'from_word' && slot.gender !== 'from_fill2') {
    return slot.gender
  }
  // прилагательное согласуется с существительным, а оно во втором слоте
  const from = slot.gender === 'from_fill2' ? w2 : w
  const g = from ? (from.entry as Noun).g : undefined
  if (!g) throw new Error(`${w.w}: у слова нет рода, шаблон его требовать не должен`)
  return g
}

/** Форма в пропуске для заданного падежа. null — такого сочетания в парадигме нет. */
function slotForm(slot: Slot, w: Word, c: Case, w2?: Word | null): string | null {
  const num: Num = slot.num ?? 'sg'
  if (slot.gender === 'from_fill2' && !w2) return null
  switch (slot.paradigm) {
    case 'def_article':
      return defArticle(c, genderOf(slot, w, w2), num)
    case 'indef_article':
      return num === 'pl' ? null : indefArticle(c, genderOf(slot, w, w2))
    case 'possessive':
      return possessive(c, genderOf(slot, w, w2), num)
    case 'kein_article':
      return keinArticle(c, genderOf(slot, w, w2), num)
    // формы самого слова: вариантов у них нет, это всегда ввод
    case 'noun_plural':
      return nounForm(w.entry as Noun, c, 'pl')
    case 'participle':
      return (w.entry as Verb).pp
    case 'verb_present':
      return present(w.entry as Verb, slot.person ?? '3sg')
    // спрягаемая часть отделяемого глагола: приставка уезжает в конец фразы
    case 'verb_stem':
      return present(w.entry as Verb, slot.person ?? '3sg').split(' ')[0] ?? null
    case 'merged_prep_article':
      return merged(slot.prep as string, c, genderOf(slot, w))
    case 'adj_ending':
      return adjEnding(slot.decl ?? 'weak', c, genderOf(slot, w, w2), num)
    case 'aux_present': {
      const v = w.entry as Verb
      if (v.aux === 'hs') return null
      return inventory('aux_present', { person: slot.person ?? '3sg' })[v.aux === 'h' ? 0 : 1] ?? null
    }
    default:
      throw new Error(`неизвестная парадигма: ${slot.paradigm}`)
  }
}

/** Детерминированный порядок вариантов: одно и то же задание всегда выглядит одинаково. */
function shuffle<T>(xs: T[], seed: string): T[] {
  let h = 2166136261
  for (const ch of seed) h = (Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0)
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    h = (Math.imul(h, 48271) + 11) >>> 0
    const j = h % (i + 1)
    ;[out[i], out[j]] = [out[j] as T, out[i] as T]
  }
  return out
}

/**
 * Варианты ответа — из инвентаря форм парадигмы, а не «то же слово в других падежах»:
 * иначе у женского рода набор вырождается в два дубля и два верных ответа. Формы,
 * которые были бы верны для этого же слова в других падежах, идут первыми: именно они
 * и есть настоящая ошибка, а не случайная буква.
 */
function buildOptions(t: Template, w: Word, answer: string, w2?: Word | null): string[] {
  const count = t.options?.count ?? 4
  const near = CASES.filter((c) => c !== t.slot.case)
    .map((c) => slotForm(t.slot, w, c, w2))
    .filter((f): f is string => !!f && f !== answer)
  const all = inventory(t.options?.paradigm ?? t.slot.paradigm, {
    prep: t.options?.prep ?? t.slot.prep,
    person: t.slot.person,
  })
  const rest = all.filter((f) => f !== answer && !near.includes(f))
  const picked = [answer, ...new Set([...near, ...rest])].slice(0, count)
  return shuffle(picked, t.id + w.w)
}

function nounIn(w: Word, slot: Slot): string {
  const form = nounForm(w.entry as Noun, slot.case ?? 'nom', slot.num ?? 'sg')
  if (!form) throw new Error(`${w.w}: нет формы для ${slot.case} ${slot.num ?? 'sg'}`)
  return form
}

/** Слово в том виде, в каком оно стоит во фразе шаблона. */
function wordIn(w: Word, slot: Slot): string {
  if (w.pos === 'n') return nounIn(w, slot)
  if (w.pos === 'a') return adjStem(w.entry as Adj)
  return (w.entry as Verb).w
}

/**
 * Второе слово ВЫВОДИТСЯ из пары «шаблон + слово», а не выбирается случайно: иначе
 * задание перестало бы восстанавливаться из журнала, где хранится именно пара.
 * Слово той же темы в приоритете — тогда фраза остаётся про то, что человек выбрал.
 */
export function second(t: Template, w: Word, all: Word[]): Word | null {
  if (!t.fill2) return null
  const fits2 = all.filter((x) => x.w !== w.w && fits(t.fill2!.need, x))
  if (!fits2.length) return null
  const mine = fits2.filter((x) => x.theme === w.theme)
  const pool = mine.length ? mine : fits2
  let h = 2166136261
  for (const ch of t.id + w.w) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return pool[h % pool.length] as Word
}

export function generate(t: Template, w: Word, all: Word[] = []): Item {
  const w2 = second(t, w, all)
  const answer = slotForm(t.slot, w, t.slot.case ?? 'nom', w2)
  if (answer === null) throw new Error(`${t.id} × ${w.w}: форма в пропуске не существует`)
  const g = w.pos === 'n' || t.slot.gender === 'from_fill2' ? genderOf(t.slot, w, w2) : null
  const word = wordIn(w, t.slot)
  const pp = w.pos === 'v' ? (w.entry as Verb).pp : ''
  const part = w.pos === 'v' ? (particle(w.entry as Verb) ?? '') : ''
  const g2 = w2?.pos === 'n' ? (w2.entry as Noun).g : undefined
  const case2 = t.fill2?.case ?? 'akk'
  const num2 = t.fill2?.num ?? 'sg'
  const word2 = w2 ? wordIn(w2, { paradigm: '', case: case2, num: num2 }) : ''
  const art2 = g2 ? defArticle(case2, g2, num2) : ''
  const ein2 = g2 && num2 !== 'pl' ? indefArticle(case2, g2) : ''
  const plain = g ? defArticle(t.slot.case ?? 'nom', g, t.slot.num ?? 'sg') : ''
  const ein = g && t.slot.num !== 'pl' ? indefArticle(t.slot.case ?? 'nom', g) : ''
  const article =
    g && t.slot.decl
      ? t.slot.decl === 'mixed'
        ? ein
        : t.slot.decl === 'weak'
          ? plain
          : ''
      : plain
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
  // {art} и {ein} — артикль, согласованный с родом слова и падежом слота. Без них артикль
  // приходится писать в рамку буквально, и шаблон вынужден фиксировать род условием.
  const fill = (s: string, slotText: string) =>
    s.replace('{slot}', slotText)
      .replace('{Slot}', cap(slotText))
      .replace('{art}', plain)
      .replace('{Art}', cap(plain))
      .replace('{ein}', ein)
      .replace('{Ein}', cap(ein))
      .replace('{w2}', word2)
      .replace('{art2}', art2)
      .replace('{Art2}', cap(art2))
      .replace('{ein2}', ein2)
      .replace('{Ein2}', cap(ein2))
      .replace('{w}', word)
      .replace('{W}', word.charAt(0).toUpperCase() + word.slice(1))
      .replace('{pp}', pp)
      .replace('{particle}', part)
  return {
    templateId: t.id,
    rule: t.rule,
    level: t.level,
    kind: t.kind,
    text: fill(t.frame, t.kind === 'input' ? '___' : '___'),
    full: fill(t.frame, answer),
    answer,
    options: t.kind === 'choice' ? buildOptions(t, w, answer, w2) : undefined,
    word: w.w,
    ...(w2 ? { word2: w2.w } : {}),
    pos: w.pos,
    theme: w.theme,
    ru: (w.entry as Noun).ru,
    why: t.why,
    ctx: {
      w: w.w,
      w2: w2?.w ?? '',
      particle: part,
      answer,
      pp,
      prep: t.slot.prep ?? t.options?.prep ?? '',
      case_ru: CASE_RU[t.slot.case ?? 'nom'],
      question: t.slot.case === 'akk' ? 'wohin?' : 'wo?',
      gender_ru: g ? GENDER_RU[g] : '',
      nom_article: g ? defArticle('nom', g, t.slot.num ?? 'sg') : '',
      plain_article: plain,
      article,
      ru: (w.entry as Noun).ru ?? '',
    },
  }
}

/** Все слова, которые шаблон может взять. */
export function fillingFor(t: Template, all: Word[]): Word[] {
  return all.filter(
    (w) =>
      fits(t.need, w) &&
      slotForm(t.slot, w, t.slot.case ?? 'nom', second(t, w, all)) !== null &&
      (!t.fill2 || second(t, w, all) !== null),
  )
}

/** Все задания шаблона. Их столько, сколько подходящих слов. */
export function itemsFor(t: Template, all: Word[]): Item[] {
  return fillingFor(t, all).map((w) => generate(t, w, all))
}

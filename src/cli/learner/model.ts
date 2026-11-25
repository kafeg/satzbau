// Модель ученика: навыки с забыванием и решение «верно или нет». LLM здесь нет.
// ⚠ Кривая забывания нарочно не та, что у FSRS: если ученик забывает ровно так, как ждёт
// планировщик, приложение по построению выглядит идеальным.

import type { Word } from '../../core/bundle.ts'
import type { Adj, Item, Noun, Template, Verb } from '../../core/types.ts'
import { MISCONCEPTIONS, weakForms } from './misconceptions.ts'
import type { Persona } from './personas.ts'

export const DAY = 86_400_000

export function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let x = Math.imul(s ^ (s >>> 15), 1 | s)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

export interface Skill {
  /** стабильность, дни */
  s: number
  /** последняя встреча, мс */
  last: number
}
export type Mind = Map<string, Skill>

export function recall(mind: Mind, key: string, now: number): number {
  const k = mind.get(key)
  if (!k || k.s <= 0) return 0
  return Math.exp(-Math.max(0, now - k.last) / DAY / k.s)
}

/**
 * Какие навыки СЛОВА нужны парадигме, кроме самого правила. `irregular` — только если форму
 * нельзя вывести правилом (сильный глагол, n-склонение, неправильная степень).
 * Ключи — все парадигмы шаблонов: это проверяет тест.
 */
export const WORD_SKILLS: Record<string, ('gender' | 'form' | 'irregular')[]> = {
  def_article: ['gender'],
  indef_article: ['gender'],
  kein_article: ['gender'],
  possessive: ['gender'],
  adj_ending: ['gender'],
  merged_prep_article: ['gender'],
  pronoun: ['gender'],
  noun_plural: ['form'],
  participle: ['form'],
  verb_past: ['form'],
  aux_present: ['form'],
  verb_prep: ['form'],
  verb_present: ['irregular'],
  imperative: ['irregular'],
  noun_case: ['irregular'],
  adj_comparative: ['irregular'],
  adj_superlative: ['irregular'],
  adj_predicative: [],
  verb_stem: [],
  modal_present: [],
  nicht: [],
  reflexive_pronoun: [],
  werden_present: [],
  wuerde: [],
}

export function irregular(w: Word): boolean {
  if (w.pos === 'n') return (w.entry as Noun).nd === 1
  if (w.pos === 'a') return Boolean((w.entry as Adj).cmp || (w.entry as Adj).sup)
  const v = w.entry as Verb
  const weak = weakForms(v)
  return weak ? weak.p3 !== v.p3 || weak.pt !== v.pt : !v.pt.split(' ')[0]?.endsWith('te')
}

export interface Lookup {
  word: (lemma: string) => Word | undefined
  template: (id: string) => Template
  lex: Set<string>
}

/** Навыки, без которых задание не решить. Лексическое правило (род) — только навык слова. */
export function needs(item: Item, look: Lookup): string[] {
  const t = look.template(item.templateId)
  const lex = look.lex.has(item.rule)
  const out = lex ? [] : [`rule:${item.rule}`]
  const w = look.word(item.word)
  const w2 = item.word2 ? look.word(item.word2) : undefined
  const noun = w?.pos === 'n' ? w : w2?.pos === 'n' ? w2 : undefined
  for (const k of lex ? (['gender'] as const) : (WORD_SKILLS[t.slot.paradigm] ?? [])) {
    // бейдж над фразой называет род: знать его не нужно (src/CLAUDE.md, «бейдж рода»)
    if (k === 'gender' && noun && (noun.entry as Noun).g && !item.ctx.badge) out.push(`gender:${noun.w}`)
    if (k === 'form' && w) out.push(`form:${w.w}`)
    if (k === 'irregular' && w && irregular(w)) out.push(`form:${w.w}`)
  }
  return [...new Set(out)]
}

export interface Learner {
  persona: Persona
  mind: Mind
  /** сила заблуждений сейчас */
  mis: Map<string, number>
  rnd: () => number
}

export function learner(p: Persona, seed: number, start: number, words: Word[], ruleLevel: Map<string, string>): Learner {
  const mind: Mind = new Map()
  const b = p.before
  if (b) {
    const last = start - b.ago * DAY
    for (const [rule, lv] of ruleLevel)
      if (b.levels.includes(lv as never) && !b.gaps.includes(rule)) mind.set(`rule:${rule}`, { s: b.s, last })
    for (const w of words) {
      if (!b.levels.includes(w.lv)) continue
      if (w.pos === 'n' && (w.entry as Noun).g) mind.set(`gender:${w.w}`, { s: b.s, last })
      mind.set(`form:${w.w}`, { s: b.s, last })
    }
  }
  return { persona: p, mind, mis: new Map(Object.entries(p.mis)), rnd: rng(seed) }
}

export interface Outcome {
  ok: 0 | 1
  given: string
  hint: boolean
  /** откуда ответ: знал, заблуждение, наугад */
  cause: 'know' | 'mis' | 'guess'
  mis?: string
  /** засчитан верным, но не по знанию */
  lucky: boolean
  /** вероятность знать задание в момент ответа */
  k: number
}

export function answer(l: Learner, item: Item, keys: string[], look: Lookup, all: Word[], now: number): Outcome {
  const p = l.persona
  const rec = (key: string) => recall(l.mind, key, now)
  let k = keys.reduce((x, key) => x * rec(key), 1)
  const hint = k < p.hint.below && l.rnd() < p.hint.p
  if (hint) k = keys.filter((x) => !x.startsWith('rule:')).reduce((x, key) => x * rec(key), 1)
  const accepted = [item.answer, ...(item.answers ?? [])].map((a) => a.toLowerCase())
  const done = (given: string, cause: Outcome['cause'], mis?: string): Outcome => {
    const ok = accepted.includes(given.toLowerCase()) ? 1 : 0
    return { ok, given, hint, cause, mis, lucky: ok === 1 && cause !== 'know', k }
  }
  if (l.rnd() < k) return done(item.answer, 'know')

  const t = look.template(item.templateId)
  const w = look.word(item.word)
  if (w) {
    let best: { id: string; form: string; m: number } | null = null
    for (const m of MISCONCEPTIONS) {
      const strength = l.mis.get(m.id) ?? 0
      if (strength < 0.05 || (best && best.m >= strength)) continue
      const form = m.form(item, t, w, all)
      if (!form || (item.kind === 'choice' && !item.options?.includes(form))) continue
      best = { id: m.id, form, m: strength }
    }
    if (best && l.rnd() < best.m) return done(best.form, 'mis', best.id)
  }
  if (item.kind === 'choice' && item.options?.length)
    return done(item.options[Math.floor(l.rnd() * item.options.length)] as string, 'guess')
  // не знает — пишет словарную форму
  return done(item.word.toLowerCase(), 'guess')
}

/** После ответа приложение всегда показывает верный: ученик чему-то учится в любом случае. */
export function learn(l: Learner, keys: string[], o: Outcome, now: number): void {
  const p = l.persona
  for (const key of keys) {
    const sk = l.mind.get(key)
    const s = sk?.s ?? 0
    let next: number
    if (o.hint && key.startsWith('rule:')) next = Math.max(s, p.s0)
    else if (o.cause === 'know' && o.ok) next = s * (1 + p.a * (1 - recall(l.mind, key, now)))
    else if (!o.ok) next = Math.max(s * p.b, p.s0)
    else next = Math.max(s, p.s0)
    l.mind.set(key, { s: next, last: now })
  }
  if (o.cause === 'mis' && !o.ok && o.mis) l.mis.set(o.mis, (l.mis.get(o.mis) ?? 0) * p.c)
}

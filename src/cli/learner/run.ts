// Прогон персоны по дням через НАСТОЯЩУЮ очередь и повторы приложения.

import { getBundle, getWords, type Word } from '../../core/bundle.ts'
import type { Item, Level, Template } from '../../core/types.ts'
import { newSession, rules, type RuleInfo } from '../../app/session.ts'
import { dueCount, replay, stateOf, wordKey, type Cards, type State } from '../../app/srs.ts'
import type { Answer } from '../../app/store.ts'
import { answer, DAY, learn, learner, needs, recall, rng, type Learner, type Lookup, type Outcome } from './model.ts'
import type { Persona } from './personas.ts'

/** Понедельник, 08:00 UTC: от этой точки считаются дни прогона. */
export const START = Date.UTC(2026, 0, 5, 8)

export interface Rec extends Outcome {
  day: number
  t: number
  item: Item
  keys: string[]
}

export interface DaySnap {
  day: number
  /** сколько ученик видит утром, открыв приложение */
  dueRules: number
  dueWords: number
  sessions: number
  answers: number
  /** правила, встреченные впервые */
  fresh: string[]
  /** состояния правил в приложении на конец дня */
  states: Record<State, number>
  /** правила в состоянии «держится» */
  solid: string[]
  /** «держится», а истинное знание < 0,7: правила и слова */
  falseSolid: { rules: string[]; words: number; solidWords: number }
  /** «пора», а истинное знание ≥ 0,9 */
  needless: { rules: string[]; words: number }
}

export interface Run {
  persona: Persona
  seed: number
  days: number
  answers: Answer[]
  recs: Rec[]
  snaps: DaySnap[]
  /** правила уровня, у которых есть задания */
  levelRules: RuleInfo[]
  /** истинная вспоминаемость навыков на конец контрольных дней */
  truth: Record<number, Record<string, number>>
  learner: Learner
  /** по занятию: какие правила были «пора» на старте и какие попали в занятие */
  sessions: { day: number; due: string[]; shown: string[] }[]
}

const LV: Record<Level, number> = { A1: 1, A2: 2, B1: 3 }
export const CHECKPOINTS = [1, 7, 21, 42]

export function lookup(): Lookup {
  const b = getBundle()
  const words = new Map<string, Word>()
  for (const w of getWords()) if (!words.has(w.w)) words.set(w.w, w)
  const tpl = new Map(b.templates.map((t) => [t.id, t]))
  return {
    word: (w) => words.get(w),
    template: (id) => tpl.get(id) as Template,
    lex: new Set(Object.entries(b.explain).filter(([, e]) => e.lex).map(([r]) => r)),
  }
}

function ruleLevels(): Map<string, string> {
  const out = new Map<string, string>()
  for (const t of getBundle().templates) {
    const got = out.get(t.rule) as Level | undefined
    if (!got || LV[t.level] < LV[got]) out.set(t.rule, t.level)
  }
  return out
}

/** Истинное знание правила: правило × среднее по встреченным словам. */
function truthOf(l: Learner, recs: Rec[], now: number) {
  const words = new Map<string, Map<string, string[]>>()
  const byWord = new Map<string, Set<string>>()
  for (const r of recs) {
    const ks = r.keys.filter((k) => !k.startsWith('rule:'))
    const m = words.get(r.item.rule) ?? new Map<string, string[]>()
    m.set(r.item.word, ks)
    words.set(r.item.rule, m)
    const set = byWord.get(r.item.word) ?? new Set<string>()
    for (const k of ks) set.add(k)
    byWord.set(r.item.word, set)
  }
  const R = (k: string) => recall(l.mind, k, now)
  const rule = (id: string, lex: boolean) => {
    const ws = [...(words.get(id)?.values() ?? [])].map((ks) => ks.reduce((x, k) => x * R(k), 1))
    const mean = ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : 1
    return (lex ? 1 : R(`rule:${id}`)) * mean
  }
  const word = (w: string) => {
    const ks = byWord.get(w)
    return ks?.size ? [...ks].reduce((x, k) => x * R(k), 1) : null
  }
  return { rule, word }
}

export function run(persona: Persona, days: number, seed: number): Run {
  const look = lookup()
  const all = getWords()
  const levels = ruleLevels()
  const l = learner(persona, seed, START, all, levels)
  const plan = rng(seed ^ 0x9e3779b9)
  const answers: Answer[] = []
  const recs: Rec[] = []
  const snaps: DaySnap[] = []
  const truth: Run['truth'] = {}
  const met = new Set<string>()
  const sessions: Run['sessions'] = []
  const levelRules = rules({ level: persona.level }).filter((r) => r.count > 0)
  let skipWeek = false

  for (let day = 0; day < days; day++) {
    const morning = START + day * DAY
    const weekday = day % 7
    if (weekday === 0) skipWeek = plan() < (persona.skipWeek ?? 0)
    let cards: Cards = replay(answers)
    const snap: DaySnap = {
      day: day + 1,
      dueRules: dueCount(cards, 'r:', morning),
      dueWords: dueCount(cards, 'w:', morning),
      sessions: 0,
      answers: 0,
      fresh: [],
      states: { new: 0, due: 0, learning: 0, solid: 0 },
      solid: [],
      falseSolid: { rules: [], words: 0, solidWords: 0 },
      needless: { rules: [], words: 0 },
    }
    const studies = !skipWeek && plan() < (persona.week[weekday] ?? 0)
    const [lo, hi] = persona.sessions
    const n = studies ? lo + Math.floor(plan() * (hi - lo + 1)) : 0
    const theme = persona.themes.length ? persona.themes[Math.floor(day / 7) % persona.themes.length] : undefined
    for (let s = 0; s < n; s++) {
      let t = morning + s * 10 * 3_600_000 + Math.floor(plan() * 3_600_000)
      const items = newSession({ level: persona.level, theme, cards, seed: seed * 1000 + day * 10 + s, now: t })
      const stop = plan() < persona.quit ? Math.floor(plan() * items.length) : items.length
      sessions.push({
        day: day + 1,
        due: rules({ level: persona.level, cards, now: t })
          .filter((r) => r.count > 0 && r.state === 'due')
          .map((r) => r.rule),
        shown: [...new Set(items.slice(0, stop).map((i) => i.rule))],
      })
      for (const item of items.slice(0, stop)) {
        const [p0, p1] = persona.pause
        t += Math.round((p0 + plan() * (p1 - p0)) * 1000)
        const keys = needs(item, look)
        const o = answer(l, item, keys, look, all, t)
        learn(l, keys, o, t)
        answers.push({
          t,
          tpl: item.templateId,
          word: item.word,
          rule: item.rule,
          ok: o.ok,
          given: o.given,
          ...(o.hint ? { hint: 1 as const } : {}),
        })
        recs.push({ ...o, day: day + 1, t, item, keys })
        if (!met.has(item.rule)) {
          met.add(item.rule)
          snap.fresh.push(item.rule)
        }
        snap.answers++
      }
      snap.sessions++
      cards = replay(answers)
    }

    const evening = morning + 15 * 3_600_000
    const tr = truthOf(l, recs, evening)
    for (const r of rules({ level: persona.level, cards, now: evening })) {
      if (r.count === 0) continue
      snap.states[r.state]++
      if (r.state === 'solid') snap.solid.push(r.rule)
      const k = tr.rule(r.rule, r.lex)
      if (r.state === 'solid' && k < 0.7) snap.falseSolid.rules.push(r.rule)
      if (r.state === 'due' && k >= 0.9) snap.needless.rules.push(r.rule)
    }
    for (const key of cards.keys()) {
      if (!key.startsWith('w:')) continue
      const k = tr.word(key.slice(2))
      if (k === null) continue
      const st = stateOf(cards, wordKey(key.slice(2)), evening)
      if (st === 'solid') {
        snap.falseSolid.solidWords++
        if (k < 0.7) snap.falseSolid.words++
      }
      if (st === 'due' && k >= 0.9) snap.needless.words++
    }
    if (CHECKPOINTS.includes(day + 1)) {
      truth[day + 1] = Object.fromEntries(
        [...l.mind.keys()].sort().map((k) => [k, Math.round(recall(l.mind, k, evening) * 1000) / 1000]),
      )
    }
    snaps.push(snap)
  }
  return { persona, seed, days, answers, recs, snaps, levelRules, truth, learner: l, sessions }
}

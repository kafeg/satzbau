// Очередь заданий. Выбор ЧТО тренировать — здесь: правило и тема.
// На Э5 сюда придут повторы по FSRS, и смешанная очередь станет «повторением ошибок».

import { getBundle, getWords } from '../core/bundle.ts'
import { fillingFor, itemsFor } from '../core/generate.ts'
import type { Item, Level } from '../core/types.ts'

export const SIZE = 12

export interface Pick {
  /** id правила; без него — все правила вперемешку */
  rule?: string
  /** лексическая тема: она даёт слова, а не задания */
  theme?: string
  /** потолок уровня: A2 значит «A1 и A2». Фильтрует и слова, и правила */
  level?: Level
  size?: number
  seed?: number
}

export interface RuleInfo {
  rule: string
  name: string
  group: string
  title: string
  level: Level
  count: number
}

/** Порядок блоков на главной. Внутри блока — порядок написания шаблонов. */
export const GROUPS = ['падеж', 'артикль', 'существительное', 'прилагательное', 'глагол']

const LEVELS = { A1: 1, A2: 2, B1: 3 } as const

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 48271) + 11) >>> 0
    return s / 4294967296
  }
}

function templatesOf(p: Pick) {
  return getBundle().templates.filter(
    (t) => (!p.rule || t.rule === p.rule) && (!p.level || LEVELS[t.level] <= LEVELS[p.level]),
  )
}

// ⚠ Уровень слова фильтруется здесь и больше нигде: без этого правило A1 спокойно
// подсовывает слово B1, и шапка «A1» врёт.
function wordsOf(p: Pick) {
  return getWords().filter(
    (w) => (!p.theme || w.theme === p.theme) && (!p.level || LEVELS[w.lv] <= LEVELS[p.level]),
  )
}

/** Сколько заданий вообще есть под такой выбор. Считаем по наполнению, не собирая задания. */
export function countFor(p: Pick): number {
  const words = wordsOf(p)
  return templatesOf(p).reduce((n, t) => n + fillingFor(t, words).length, 0)
}

/**
 * Правила для главной: заголовок из объяснения, уровень — самый ранний из шаблонов.
 * Порядок: уровень, затем порядок появления в templates.yaml. ⚠ Это порядок написания,
 * а не порядок обучения: настоящий требует графа предпосылок, которого ещё нет.
 */
export function rules(p: Pick = {}): RuleInfo[] {
  const bundle = getBundle()
  const out = new Map<string, RuleInfo & { at: number }>()
  const words = wordsOf(p)
  templatesOf({ level: p.level }).forEach((t, at) => {
    const got = out.get(t.rule)
    const level = got && LEVELS[got.level] < LEVELS[t.level] ? got.level : t.level
    const e = bundle.explain[t.rule]
    out.set(t.rule, {
      rule: t.rule,
      name: e?.name ?? t.rule,
      group: e?.group ?? 'падеж',
      title: e?.title ?? t.rule,
      level,
      count: (got?.count ?? 0) + fillingFor(t, words).length,
      at: got?.at ?? at,
    })
  })
  return [...out.values()].sort((a, b) => LEVELS[a.level] - LEVELS[b.level] || a.at - b.at)
}

export function newSession(p: Pick = {}): Item[] {
  const next = rng(p.seed ?? Date.now())
  const words = wordsOf(p)
  const byTemplate = templatesOf(p).map((t) => {
    const b = itemsFor(t, words)
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      ;[b[i], b[j]] = [b[j] as Item, b[i] as Item]
    }
    return b
  })
  const out: Item[] = []
  const seen = new Set<string>()
  let pos = 0
  // по кругу шаблонам: иначе сессия правила выйдет из одного шаблона, а тем — из одной темы
  while (out.length < (p.size ?? SIZE) && byTemplate.some((b) => b.length)) {
    const b = byTemplate[pos++ % byTemplate.length] as Item[]
    const i = b.pop()
    if (!i || seen.has(i.word)) continue
    seen.add(i.word)
    out.push(i)
  }
  return out
}

// Очередь заданий. Выбор ЧТО тренировать — здесь: правило и тема.
// На Э5 сюда придут повторы по FSRS, и смешанная очередь станет «повторением ошибок».

import { getBundle, getWords } from '../core/bundle.ts'
import { due, ruleKey, wordKey, type Cards } from './srs.ts'
import { fillingFor, itemsFor } from '../core/generate.ts'
import type { Item, Level } from '../core/types.ts'

export const SIZE = 12

/** «1 задание, 2 задания, 5 заданий» — иначе цифры в интерфейсе читаются как опечатка. */
export function plural(n: number, forms: [string, string, string]): string {
  const ten = n % 100
  if (ten > 10 && ten < 20) return `${n} ${forms[2]}`
  const one = n % 10
  if (one === 1) return `${n} ${forms[0]}`
  if (one >= 2 && one <= 4) return `${n} ${forms[1]}`
  return `${n} ${forms[2]}`
}

export const tasks = (n: number) => plural(n, ['задание', 'задания', 'заданий'])

export interface Pick {
  /** состояние повторов: с ним очередь ставит вперёд то, чему пора */
  cards?: Cards
  /** id правила; без него — все правила вперемешку */
  rule?: string
  /** лексическая тема: она даёт слова, а не задания */
  theme?: string
  /** потолок уровня: A2 значит «A1 и A2». Фильтрует и слова, и правила */
  level?: Level
  /** конкретные слова: карточки новых слов отправляют тренировать именно их */
  only?: string[]
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
  /** слов правила, которые уже встречались в заданиях — для полосы прогресса */
  seen: number
  /** всего слов, на которых правило собирается */
  words: number
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
    (w) =>
      (!p.theme || w.theme === p.theme) &&
      (!p.level || LEVELS[w.lv] <= LEVELS[p.level]) &&
      (!p.only || p.only.includes(w.w)),
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
  const out = new Map<string, RuleInfo & { at: number; set: Set<string> }>()
  const words = wordsOf(p)
  templatesOf({ level: p.level }).forEach((t, at) => {
    const got = out.get(t.rule)
    const level = got && LEVELS[got.level] < LEVELS[t.level] ? got.level : t.level
    const e = bundle.explain[t.rule]
    const fill = fillingFor(t, words)
    const set = got?.set ?? new Set<string>()
    for (const w of fill) set.add(w.w)
    out.set(t.rule, {
      rule: t.rule,
      name: e?.name ?? t.rule,
      group: e?.group ?? 'падеж',
      title: e?.title ?? t.rule,
      level,
      count: (got?.count ?? 0) + fill.length,
      words: set.size,
      seen: p.cards ? [...set].filter((w) => p.cards?.has(wordKey(w))).length : 0,
      at: got?.at ?? at,
      set,
    })
  })
  return [...out.values()].sort((a, b) => LEVELS[a.level] - LEVELS[b.level] || a.at - b.at)
}

export function newSession(p: Pick = {}): Item[] {
  const next = rng(p.seed ?? Date.now())
  const words = wordsOf({ level: p.level, only: p.only })
  const shuffle = (b: Item[]) => {
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      ;[b[i], b[j]] = [b[j] as Item, b[i] as Item]
    }
    return b
  }
  // ⚠ Тема — мягкий приоритет, а не фильтр. Жёсткий фильтр гасит правила, у которых слов
  // этой темы нет вовсе: «wo?» живёт только на комнатах, «mein» — только на частях тела.
  // Поэтому у каждого шаблона две стопки: слова темы и все остальные.
  const buckets = templatesOf(p).map((t) => {
    const all = itemsFor(t, words)
    return {
      mine: shuffle(p.theme ? all.filter((i) => i.theme === p.theme) : all),
      rest: shuffle(p.theme ? all.filter((i) => i.theme !== p.theme) : []),
    }
  })

  // Порядок внутри стопки: сперва то, чему пора повторяться, потом новое, потом
  // выученное. Правило важнее слова — расписание строится по нему (docs/architecture.md).
  const rank = (i: Item) =>
    (p.cards ? (due(p.cards, ruleKey(i.rule)) ? 0 : 2) + (due(p.cards, wordKey(i.word)) ? 0 : 1) : 0)
  for (const b of buckets) {
    // сортируем по убыванию: берём с хвоста
    b.mine.sort((x, y) => rank(y) - rank(x))
    b.rest.sort((x, y) => rank(y) - rank(x))
  }

  const out: Item[] = []
  const seen = new Set<string>()
  const size = p.size ?? SIZE
  // сперва по кругу шаблонам разбираем слова темы, и только потом добираем остальными:
  // иначе шаблон без слов темы съедает место, которое причиталось теме
  for (const key of ['mine', 'rest'] as const) {
    let pos = 0
    let empty = 0
    while (out.length < size && empty < buckets.length) {
      const b = buckets[pos++ % buckets.length] as { mine: Item[]; rest: Item[] }
      const i = b[key].pop()
      if (!i) {
        empty++
        continue
      }
      empty = 0
      if (seen.has(i.word)) continue
      seen.add(i.word)
      out.push(i)
    }
  }
  return out
}

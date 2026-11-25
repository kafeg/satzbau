// Очередь заданий. Выбор ЧТО тренировать — здесь: правило и тема.
// На Э5 сюда придут повторы по FSRS, и смешанная очередь станет «повторением ошибок».

import { getBundle, getWords } from '../core/bundle.ts'
import { ruleKey, stateOf, wordKey, type Cards, type State } from './srs.ts'
import { fillingFor, itemsFor } from '../core/generate.ts'
import type { Bundle, Item, Level } from '../core/types.ts'

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
  /** лексическое правило: расписание держат карточки слов, а не карточка правила */
  lex: boolean
  /** не начато, пора, в работе, держится — из карточки FSRS, а не из доли слов */
  state: State
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
/**
 * Слова под выбор. ⚠ Единственное место, где фильтруется уровень: экраны обязаны
 * спрашивать здесь, иначе счётчик считает по одному набору, а показывает другой —
 * «0 из 90» на теме, где слов уровня сорок, до 90 не доходило никогда.
 */
export function wordsOf(p: Pick) {
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
 * Глубина правила в графе предпосылок: 0 — точка входа, дальше на единицу больше
 * самой глубокой предпосылки. Это и есть порядок обучения внутри группы.
 */
function depthOf(rule: string, explain: Bundle['explain'], seen = new Set<string>()): number {
  const after = explain[rule]?.after ?? []
  if (!after.length || seen.has(rule)) return 0
  seen.add(rule)
  return 1 + Math.max(...after.map((a) => depthOf(a, explain, seen)))
}

// ⚠ rules() обходит все шаблоны и всё наполнение. Цена растёт с лексиконом, поэтому
// числа здесь не пишем: мерить `fillingFor` по всем шаблонам, сейчас это десятки
// миллисекунд на ноутбуке и втрое больше на телефоне. Экраны зовут её по многу раз
// (свод, каждая тема, выбор нового правила), поэтому результат запоминается.
// Ключ верхнего уровня — объект карточек: после ответа журнал проигрывается заново
// и Map всегда новый, так что устареть ответ не может. Цена: «пора» внутри одного
// открытого экрана не пересчитывается, но интервалы FSRS меряются днями, а любой
// ответ кэш и так сбрасывает.
const CACHE = new WeakMap<object, Map<string, RuleInfo[]>>()

/**
 * Правила для главной: заголовок из объяснения, уровень — самый ранний из шаблонов.
 * Порядок: уровень, затем глубина в графе предпосылок (`after` в explain.yaml),
 * и только потом порядок появления в templates.yaml.
 */
export function rules(p: Pick = {}): RuleInfo[] {
  const bundle = getBundle()
  const key = `${p.level ?? ''}|${p.theme ?? ''}|${p.only?.join(',') ?? ''}`
  let box = CACHE.get(p.cards ?? bundle)
  if (!box) CACHE.set(p.cards ?? bundle, (box = new Map()))
  const hit = box.get(key)
  if (hit) return hit
  type Acc = Omit<RuleInfo, 'state'> & { at: number; set: Set<string> }
  const out = new Map<string, Acc>()
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
      lex: e?.lex === true,
      at: got?.at ?? at,
      set,
    })
  })
  const depth = new Map([...out.keys()].map((r) => [r, depthOf(r, bundle.explain)]))
  const out2 = [...out.values()]
    .sort(
      (a, b) =>
        LEVELS[a.level] - LEVELS[b.level] ||
        (depth.get(a.rule) ?? 0) - (depth.get(b.rule) ?? 0) ||
        a.at - b.at,
    )
    .map(({ at: _at, set, ...r }) => ({ ...r, state: ruleState(r, set, p.cards) }))
  box.set(key, out2)
  return out2
}

/**
 * Состояние правила. У обычного его держит карточка правила. У лексического (`lex`
 * в explain.yaml) — карточки СЛОВ: «der, die или das» не выучивается как правило,
 * род либо знаешь у слова, либо нет, и правил таких одно на весь лексикон.
 * Карточка правила у него значит только «встречалось».
 */
function ruleState(r: { rule: string; lex: boolean }, set: Set<string>, cards?: Cards): State {
  if (!cards) return 'new'
  const met = stateOf(cards, ruleKey(r.rule))
  if (!r.lex || met === 'new') return met
  const words = [...set].map((w) => stateOf(cards, wordKey(w)))
  if (words.includes('due')) return 'due'
  return words.every((x) => x === 'solid') ? 'solid' : 'learning'
}

/**
 * Какое новое правило разумно дать следующим: первое по графу предпосылок, у которого
 * все предпосылки уже встречались. Нужно двум местам — подписи кнопки «Заниматься»
 * и самой очереди, поэтому считается здесь, а не в экране.
 * ⚠ Тема на выбор не влияет: порядок обучения важнее, чем совпадение с лексикой темы,
 * а слова другой темы очередь всё равно доберёт.
 */
export function nextNew(p: Pick = {}): RuleInfo | null {
  const explain = getBundle().explain
  const fresh = rules({ level: p.level, cards: p.cards }).filter(
    (r) => r.count > 0 && r.state === 'new',
  )
  const met = (r: string) => p.cards?.has(ruleKey(r)) === true
  return fresh.find((r) => (explain[r.rule]?.after ?? []).every(met)) ?? fresh[0] ?? null
}

/** Порядок разбора: сперва то, чему пора, потом новое, потом в работе, последним выученное. */
const RANK: Record<State, number> = { due: 0, new: 1, learning: 2, solid: 3 }

export function newSession(p: Pick = {}): Item[] {
  const next = rng(p.seed ?? Date.now())
  const words = wordsOf({ level: p.level, only: p.only })
  const shuffle = <T,>(b: T[]) => {
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      ;[b[i], b[j]] = [b[j] as T, b[i] as T]
    }
    return b
  }
  // ⚠ Тема — мягкий приоритет, а не фильтр. Жёсткий фильтр гасит правила, у которых слов
  // этой темы нет вовсе: «wo?» живёт только на комнатах, «mein» — только на частях тела.
  // Поэтому у каждого шаблона две стопки: слова темы и все остальные.
  // ⚠ Порядок стопок перемешивается, а не берётся из файла. Обход идёт по кругу и
  // забирает по одному заданию, поэтому сессия из двенадцати заданий состояла из ПЕРВЫХ
  // двенадцати шаблонов всегда: восемь правил из сорока двух, остальное недостижимо.

  // ⚠ Одно новое правило за сессию. Иначе «Заниматься» с пустым журналом даёт двенадцать
  // заданий на двенадцать незнакомых правил, а дальше подмешивает незнакомое к каждому
  // повтору. «Новое» — это НЕТ КАРТОЧКИ ПРАВИЛА, то есть правило не встречалось ни разу;
  // у лексического правила расписание идёт по словам, но «встречалось» — по нему же.
  // Без карточек (тесты, CLI) ограничения нет: новое от знакомого там не отличить.
  const limit = Boolean(p.cards) && !p.rule && !p.only
  const fresh = limit ? nextNew({ level: p.level, cards: p.cards })?.rule : undefined
  const allowed = (rule: string) =>
    !limit || rule === fresh || p.cards?.has(ruleKey(rule)) === true

  const buckets = shuffle(
    templatesOf(p)
      .filter((t) => allowed(t.rule))
      .map((t) => {
        const all = itemsFor(t, words)
        return {
          mine: shuffle(p.theme ? all.filter((i) => i.theme === p.theme) : all),
          rest: shuffle(p.theme ? all.filter((i) => i.theme !== p.theme) : []),
        }
      }),
  )

  // Порядок внутри стопки: сперва то, чему пора повторяться, потом новое, потом
  // выученное. Правило важнее слова — расписание строится по нему (docs/architecture.md).
  // ⚠ «Карточки нет» и «пора повторить» — РАЗНЫЕ состояния. Пока очередь считала «пора»
  // и то, и другое, новое правило и подошедшее по расписанию в ней не различались,
  // и «Повторить ошибки» повторяла не то, что ждёт повтора.
  const lex = new Set(
    Object.entries(getBundle().explain)
      .filter(([, e]) => e.lex)
      .map(([r]) => r),
  )
  const state = (key: string) => (p.cards ? RANK[stateOf(p.cards, key)] : 0)
  const rank = (i: Item) => {
    const word = state(wordKey(i.word))
    return (lex.has(i.rule) ? word : state(ruleKey(i.rule))) * 4 + word
  }
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

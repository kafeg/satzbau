// Очередь заданий. Выбор ЧТО тренировать — здесь: правило и тема.
// На Э5 сюда придут повторы по FSRS, и смешанная очередь станет «повторением ошибок».

import { getBundle, getWords, type Word } from '../core/bundle.ts'
import { dueAt, memoOf, ruleKey, ruleMemo, stateOf, wordKey, type Cards, type RuleMemo, type State } from './srs.ts'
import { fillingFor, generate } from '../core/generate.ts'
import type { Bundle, Item, Level, Template } from '../core/types.ts'

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
  /** момент, на который считается «пора»; без него — сейчас. Нужен симулятору ученика */
  now?: number
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
 * Наполнение шаблона — самое дорогое, что делает приложение: `fits` плюс `second`
 * плюс проверка формы на каждое слово, и так по всем шаблонам. Зависит оно только
 * от бандла и от набора слов, то есть от уровня, темы и `only`, а от карточек — нет.
 * Поэтому живёт ОТДЕЛЬНО от кэша `rules()`, который сбрасывается после каждого ответа:
 * иначе каждый ответ заново стоил четверти секунды на ноутбуке и около секунды
 * на телефоне.
 *
 * ⚠ `only` не кэшируем: такие наборы одноразовые (карточки новых слов), и ключи
 * от них копились бы без счёта.
 */
const FILLS = new WeakMap<object, Map<string, Word[]>>()

function fillsOf(t: Template, p: Pick, words: Word[]): Word[] {
  if (p.only) return fillingFor(t, words)
  const bundle = getBundle()
  let box = FILLS.get(bundle)
  if (!box) FILLS.set(bundle, (box = new Map()))
  const key = `${p.level ?? ''}|${p.theme ?? ''}|${t.id}`
  let fill = box.get(key)
  if (!fill) box.set(key, (fill = fillingFor(t, words)))
  return fill
}

/**
 * Правила для главной: заголовок из объяснения, уровень — самый ранний из шаблонов.
 * Порядок: уровень, затем глубина в графе предпосылок (`after` в explain.yaml),
 * и только потом порядок появления в templates.yaml.
 */
export function rules(p: Pick = {}): RuleInfo[] {
  const bundle = getBundle()
  const key = `${p.level ?? ''}|${p.theme ?? ''}|${p.only?.join(',') ?? ''}|${p.now ?? ''}`
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
    const fill = fillsOf(t, p, words)
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
    .map(({ at: _at, set, ...r }) => ({ ...r, state: ruleState(r, set, p.cards, p.now) }))
  box.set(key, out2)
  return out2
}

/**
 * Состояние правила. У обычного его держит карточка правила. У лексического (`lex`
 * в explain.yaml) — карточки СЛОВ: «der, die или das» не выучивается как правило,
 * род либо знаешь у слова, либо нет, и правил таких одно на весь лексикон.
 * Карточка правила у него значит только «встречалось».
 */
function ruleState(
  r: { rule: string; lex: boolean },
  set: Set<string>,
  cards?: Cards,
  now?: number,
): State {
  if (!cards) return 'new'
  const met = stateOf(cards, ruleKey(r.rule), now)
  // ⚠ «Держится» на одной форме ответа — не знание: perfekt-aux «держался» десять дней
  // на одних haben, и «всегда haben» отвечал верно. Нужны две разные верные формы,
  // если правило их вообще даёт (docs/queue.md, п. 5)
  if (!r.lex && met === 'solid' && (ruleMemo(cards, r.rule)?.forms.length ?? 0) < variety(r.rule))
    return 'learning'
  if (!r.lex || met === 'new') return met
  const words = [...set].map((w) => stateOf(cards, wordKey(w), now))
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
  return newRules(p, 1)[0] ?? null
}

/** Несколько новых подряд: каждое следующее считает предыдущие уже встреченными. */
function newRules(p: Pick, k: number): RuleInfo[] {
  const explain = getBundle().explain
  const fresh = rules({ level: p.level, cards: p.cards, now: p.now }).filter(
    (r) => r.count > 0 && r.state === 'new',
  )
  const met = new Set([...(p.cards?.keys() ?? [])].filter((x) => x.startsWith('r:')).map((x) => x.slice(2)))
  const out: RuleInfo[] = []
  while (out.length < k) {
    const left = fresh.filter((r) => !out.includes(r))
    const pick = left.find((r) => (explain[r.rule]?.after ?? []).every((a) => met.has(a))) ?? left[0]
    if (!pick) break
    out.push(pick)
    met.add(pick.rule)
  }
  return out
}

/** Заданий на новое правило в занятии. */
export const NEW_ITEMS = 3
/** Сколько мест должно остаться после «пора», чтобы открыть новое: три задания и запас. */
export const NEW_ROOM = 4
/** Новых за занятие, если последнее открытое сдано с первого раза. */
export const NEW_MAX = 3

/**
 * Сколько новых правил можно открыть. Одно, пока последнее открытое не сдано чисто —
 * первые три ответа верны и без подсказки. Сдано — до трёх: знакомое A1 вернувшийся
 * проходит по три задания на правило, а не по одному правилу в день (docs/queue.md, п. 3).
 * «Последнее открытое» — всё, что открыто в пределах двенадцати часов от самого свежего.
 */
function newAllowed(cards?: Cards): number {
  if (!cards) return 1
  const memo = [...memoOf(cards)]
  if (!memo.length) return 1
  const last = Math.max(...memo.map(([, m]) => m.firstAt))
  const recent = memo.filter(([, m]) => last - m.firstAt < 12 * 3_600_000)
  // ⚠ Три верных подряд на кнопках бывают и наугад, а после первого ответа правило
  // уже показано. Поэтому «сдано» — ещё и на двух разных формах, если правило их даёт:
  // угадать der и потом dem труднее, чем трижды der
  const passed = ([rule, m]: [string, RuleMemo]) =>
    m.firstN === 3 && m.clean && m.forms.length >= variety(rule)
  return recent.every(passed) ? NEW_MAX : 1
}

/**
 * Что пойдёт в «Заниматься»: правила «пора» и новые. Нужно и очереди, и главной —
 * подпись кнопки обязана обещать ровно то, что получится.
 */
export function sessionPlan(p: Pick = {}): { due: RuleInfo[]; fresh: RuleInfo[] } {
  const size = p.size ?? SIZE
  const all = rules({ level: p.level, cards: p.cards, now: p.now }).filter((r) => r.count > 0)
  const at = (r: RuleInfo) => (p.cards ? (dueAt(p.cards, ruleKey(r.rule)) ?? 0) : 0)
  const due = all.filter((r) => r.state === 'due').sort((a, b) => at(a) - at(b))
  const room = size - Math.min(due.length, size)
  const k = room >= NEW_ROOM ? Math.min(newAllowed(p.cards), Math.floor((room - 1) / NEW_ITEMS)) : 0
  return { due, fresh: newRules(p, k) }
}

/**
 * Сколько разных ответов бывает у правила, до двух. Считается один раз на бандл и только
 * для правил, дошедших до «держится»: у большинства различие видно на первых заданиях.
 */
const VARIETY = new WeakMap<object, Map<string, number>>()

function variety(rule: string): number {
  const bundle = getBundle()
  let box = VARIETY.get(bundle)
  if (!box) VARIETY.set(bundle, (box = new Map()))
  const hit = box.get(rule)
  if (hit !== undefined) return hit
  const words = getWords()
  const seen = new Set<string>()
  for (const t of bundle.templates) {
    if (t.rule !== rule) continue
    for (const w of fillsOf(t, {}, words)) {
      seen.add(generate(t, w, words).answer.toLowerCase())
      if (seen.size >= 2) break
    }
    if (seen.size >= 2) break
  }
  box.set(rule, seen.size)
  return seen.size
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

  // «Заниматься» с карточками собирается по слотам: пора → новое → в работе.
  // Дрилл правила, новые слова темы и вызовы без карточек (тесты, CLI) — обходом
  // стопок ниже: там правило одно или новое от знакомого не отличить.
  if (p.cards && !p.rule && !p.only) return mainSession(p, next, words)

  // ⚠ В стопках лежат СЛОВА, а не собранные задания. Раньше здесь собирались все
  // двадцать пять тысяч заданий, чтобы выбрать из них двенадцать: четверть секунды
  // на ноутбуке и около секунды на телефоне — ровно по нажатию «Заниматься».
  // Для порядка в очереди хватает пары (шаблон, слово): и тема, и состояние карточек
  // берутся из них же. Собираем только те двенадцать, что поедут человеку.
  const buckets = shuffle(
    templatesOf(p)
      .map((t) => {
        const fill = fillsOf(t, { level: p.level, only: p.only }, words)
        return {
          t,
          mine: shuffle(p.theme ? fill.filter((w) => w.theme === p.theme) : fill),
          rest: shuffle(p.theme ? fill.filter((w) => w.theme !== p.theme) : []),
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
  const state = (key: string) => (p.cards ? RANK[stateOf(p.cards, key, p.now)] : 0)
  for (const b of buckets) {
    const rule = lex.has(b.t.rule) ? null : state(ruleKey(b.t.rule))
    const rank = (w: Word) => {
      const word = state(wordKey(w.w))
      return (rule ?? word) * 4 + word
    }
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
      const b = buckets[pos++ % buckets.length] as (typeof buckets)[number]
      const w = b[key].pop()
      if (!w) {
        empty++
        continue
      }
      empty = 0
      if (seen.has(w.w)) continue
      seen.add(w.w)
      out.push(generate(b.t, w, words))
    }
  }
  return out
}

/**
 * «Заниматься»: занятие собирается по слотам — пора, новое, в работе (docs/queue.md, п. 1).
 *
 * ⚠ Раньше здесь был обход стопок по кругу: в стопке одно правило, и «пора» влияла только
 * на порядок слов ВНУТРИ стопки, а не на то, чьи стопки дадут задания. Правило в «пора»
 * не попадало в занятие семнадцать раз подряд. Теперь правила выбираются явно, а слово
 * выбирается внутри правила: тема, затем слово в «пора», затем слабое.
 */
function mainSession(p: Pick, next: () => number, words: Word[]): Item[] {
  const cards = p.cards as Cards
  const size = p.size ?? SIZE
  const plan = sessionPlan(p)
  const all = rules({ level: p.level, cards, now: p.now }).filter((r) => r.count > 0)
  const stab = (r: RuleInfo) => cards.get(ruleKey(r.rule))?.stability ?? 0
  const by = (st: State) => all.filter((r) => r.state === st).sort((a, b) => stab(a) - stab(b))

  const tpls = new Map<string, Template[]>()
  const order = templatesOf({ level: p.level })
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[order[i], order[j]] = [order[j] as Template, order[i] as Template]
  }
  for (const t of order) {
    tpls.set(t.rule, [...(tpls.get(t.rule) ?? []), t])
  }
  const turn = new Map<string, number>()
  const seen = new Set<string>()
  const out: Item[] = []
  const wordRank = (w: Word) =>
    (p.theme && w.theme !== p.theme ? 8 : 0) + RANK[stateOf(cards, wordKey(w.w), p.now)] * 2

  // Слово внутри правила: лучшие по рангу, а среди них — то, чей ответ ещё ни разу
  // не дан верно (п. 5): после трёх haben должен прийти sein.
  const take = (rule: string): boolean => {
    const ts = tpls.get(rule) ?? []
    const forms = ruleMemo(cards, rule)?.forms ?? []
    for (let i = 0; i < ts.length; i++) {
      const n = turn.get(rule) ?? 0
      turn.set(rule, n + 1)
      const t = ts[n % ts.length] as Template
      const fill = fillsOf(t, { level: p.level }, words).filter((w) => !seen.has(w.w))
      if (!fill.length) continue
      const best = fill
        .map((w) => ({ w, r: wordRank(w) + next() }))
        .sort((a, b) => a.r - b.r)
        .slice(0, 6)
        .map((x) => generate(t, x.w, words))
      const item = best.find((x) => !forms.includes(x.answer.toLowerCase())) ?? (best[0] as Item)
      seen.add(item.word)
      out.push(item)
      return true
    }
    return false
  }

  for (const r of plan.due) if (out.length < size) take(r.rule)
  for (const r of plan.fresh) for (let i = 0; i < NEW_ITEMS && out.length < size; i++) take(r.rule)
  const rest = [...by('learning'), ...plan.due, ...plan.fresh, ...by('solid')]
  while (out.length < size) {
    let any = false
    for (const r of rest) if (out.length < size && take(r.rule)) any = true
    if (!any) break
  }
  return out
}

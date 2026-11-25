// Повторы на ts-fsrs. Две карточки на ответ: правило (расписание строится по ней)
// и слово (подбор наполнения). Состояние НИГДЕ не хранится — оно проигрывается
// из журнала при загрузке, поэтому разойтись с журналом не может.

import { DefaultScheduler, Rating, type Grade } from 'ts-fsrs'
import type { Answer } from './store.ts'

type Scheduler = Awaited<ReturnType<typeof DefaultScheduler>>
/**
 * ⚠ В ts-fsrs 6.0 типы входа и выхода планировщика не сходятся: `review` требует поле
 * `stabilityFast`, а типы `newCard` и `review().card` его не объявляют, хотя в самих
 * объектах оно есть. Храним выходной тип плюс это поле и приводим результаты к нему.
 */
export type Card = ReturnType<Scheduler['review']>['card'] & { stabilityFast: number }

export const ruleKey = (rule: string) => `r:${rule}`
export const wordKey = (word: string) => `w:${word}`

let scheduler: Scheduler | null = null

export async function init(): Promise<void> {
  scheduler ??= await DefaultScheduler()
}

function engine(): Scheduler {
  if (!scheduler) throw new Error('повторы не загружены')
  return scheduler
}

/**
 * Оценки. Easy нет: мы не измеряем скорость ответа и не будем делать вид, что измеряем.
 * Подсказка до ответа — это Again для правила (человек его не знал) и Hard для слова
 * (слово могло быть ни при чём).
 */
function grades(a: Answer): { rule: Grade; word: Grade } {
  if (!a.ok) return { rule: Rating.Again, word: Rating.Again }
  if (a.hint) return { rule: Rating.Again, word: Rating.Hard }
  return { rule: Rating.Good, word: Rating.Good }
}

export type Cards = Map<string, Card>

/** Один ответ поверх уже проигранных карточек. Меняет переданный Map на месте. */
function apply(cards: Cards, a: Answer): void {
  const s = engine()
  const now = new Date(a.t)
  const g = grades(a)
  for (const [key, grade] of [
    [ruleKey(a.rule), g.rule],
    [wordKey(a.word), g.word],
  ] as [string, Grade][]) {
    // cardId планировщик генерирует случайным; подменяем своим ключом, иначе два
    // проигрывания одного журнала дают разные объекты и состояние нечем сравнить
    const card = cards.get(key) ?? ({ ...s.newCard({ now }), cardId: key } as Card)
    cards.set(key, s.review({ card, grade, now }).card as Card)
  }
}

/** Проигрывает журнал с начала. Нужен при загрузке и при замене журнала импортом. */
export function replay(answers: Answer[]): Cards {
  const cards: Cards = new Map()
  for (const a of answers) apply(cards, a)
  return cards
}

/**
 * Карточки после ОДНОГО нового ответа, без проигрывания журнала заново.
 *
 * ⚠ Журнал растёт всю жизнь профиля, а ответ даётся на каждом задании: полный
 * проигрыш на шеститысячном журнале стоил 115 мс на ноутбуке и около полусекунды
 * на телефоне — пауза между нажатием и разбором, которая растёт и никогда не падает.
 * Результат тот же, пока ответ приходит последним по времени, а другого в приложении
 * не бывает: `t` ставится в момент ответа. Тест сверяет с полным проигрышем.
 */
export function applyAnswer(cards: Cards, a: Answer): Cards {
  const next: Cards = new Map(cards)
  apply(next, a)
  return next
}

export function due(cards: Cards, key: string, now = Date.now()): boolean {
  const c = cards.get(key)
  return !c || new Date(c.dueAt).getTime() <= now
}

/** Когда следующий повтор; null — карточки ещё нет. */
export function dueAt(cards: Cards, key: string): number | null {
  const c = cards.get(key)
  return c ? new Date(c.dueAt).getTime() : null
}

/** Сколько карточек ждёт повтора прямо сейчас. */
export function dueCount(cards: Cards, prefix: 'r:' | 'w:', now = Date.now()): number {
  let n = 0
  for (const [key, c] of cards) {
    if (key.startsWith(prefix) && new Date(c.dueAt).getTime() <= now) n++
  }
  return n
}

/**
 * Состояние единицы обучения — считается из карточки, нигде не хранится.
 * «Нет карточки» и «пора» — разные состояния: первое значит «не встречалось».
 */
export type State = 'new' | 'due' | 'learning' | 'solid'

/** Порог «держится». ⚠ Начальное число: поправлять по журналу, а не по ощущению. */
export const SOLID_DAYS = 21

export function stateOf(cards: Cards, key: string, now = Date.now()): State {
  const c = cards.get(key)
  if (!c) return 'new'
  if (new Date(c.dueAt).getTime() <= now) return 'due'
  return c.stability >= SOLID_DAYS ? 'solid' : 'learning'
}

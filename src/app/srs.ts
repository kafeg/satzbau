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

/** Проигрывает журнал с начала. Дёшево: один ответ — это два review. */
export function replay(answers: Answer[]): Cards {
  const s = engine()
  const cards: Cards = new Map()
  for (const a of answers) {
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
  return cards
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

/** ⚠ После JSON даты приезжают строками, а планировщик требует настоящие Date. */
export function revive(card: Card): Card {
  return {
    ...card,
    dueAt: new Date(card.dueAt),
    lastReviewAt: card.lastReviewAt ? new Date(card.lastReviewAt) : null,
  } as Card
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

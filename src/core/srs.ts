// Повторы (docs/app.md, «Повторы»): журнал проигрывается в карточки FSRS, состояние не хранится.
// FSRS-6 без коротких шагов: ошибка возвращается завтра. Короткий шаг — повтор в конце урока.
import { DefaultScheduler, Rating } from 'ts-fsrs'
import type { Answer } from './types.ts'

const make = () => DefaultScheduler({ version: 'FSRS-6', enableShortTerm: false })
type Scheduler = Awaited<ReturnType<typeof make>>
type Card = ReturnType<Scheduler['newCard']>

export const LEARNED_DAYS = 21
const DAY = 86_400_000

export type Memory = {
  cards: Map<string, Card>
  // сколько карточек упражнения впервые отвечено в этот день: `${день} ${упражнение}`
  started: Map<string, number>
}

export const cardKey = (ex: string, word: string) => `${ex} ${word}`

// местная дата: лимит новых и «пора» считаются по календарным дням человека
export function day(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysBetween(from: number, to: number): number {
  const a = new Date(from)
  const b = new Date(to)
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY)
}

let scheduler: Scheduler | null = null

export async function init(): Promise<void> {
  scheduler ??= await make()
}

function engine(): Scheduler {
  if (!scheduler) throw new Error('повторы не загружены: сначала init()')
  return scheduler
}

export function empty(): Memory {
  return { cards: new Map(), started: new Map() }
}

function put(m: Memory, a: Answer): void {
  const s = engine()
  const key = cardKey(a.ex, a.word)
  const now = new Date(a.t)
  let card = m.cards.get(key)
  if (!card) {
    const k = `${day(a.t)} ${a.ex}`
    m.started.set(k, (m.started.get(k) ?? 0) + 1)
    // свой cardId вместо случайного: два проигрывания журнала дают одно и то же
    card = { ...s.newCard({ now }), cardId: key }
  }
  m.cards.set(key, s.review({ card, grade: a.ok ? Rating.Good : Rating.Again, now }).card)
}

export function replay(answers: Answer[]): Memory {
  const m = empty()
  for (const a of [...answers].sort((x, y) => x.t - y.t)) put(m, a)
  return m
}

// Один новый ответ поверх: копия, а не правка на месте — старое состояние держит React.
export function apply(m: Memory, a: Answer): Memory {
  const next = { cards: new Map(m.cards), started: new Map(m.started) }
  put(next, a)
  return next
}

export function seen(m: Memory, ex: string, word: string): boolean {
  return m.cards.has(cardKey(ex, word))
}

// через сколько календарных дней повтор; null — карточку ещё не спрашивали
export function dueIn(m: Memory, ex: string, word: string, now: number): number | null {
  const c = m.cards.get(cardKey(ex, word))
  return c ? daysBetween(now, new Date(c.dueAt).getTime()) : null
}

// сколько раз карточку уже спрашивали: по нему подача повтора идёт по кругу
export function reps(m: Memory, ex: string, word: string): number {
  return m.cards.get(cardKey(ex, word))?.reps ?? 0
}

export function isDue(m: Memory, ex: string, word: string, now: number): boolean {
  const d = dueIn(m, ex, word, now)
  return d !== null && d <= 0
}

export function startedToday(m: Memory, ex: string, now: number): number {
  return m.started.get(`${day(now)} ${ex}`) ?? 0
}

// новых сегодня по всем упражнениям: лимит новых общий, иначе он растёт с каждым упражнением
export function startedTodayAll(m: Memory, now: number): number {
  const d = `${day(now)} `
  let n = 0
  for (const [k, v] of m.started) if (k.startsWith(d)) n += v
  return n
}

export function learned(m: Memory, ex: string, word: string): boolean {
  const c = m.cards.get(cardKey(ex, word))
  if (!c?.lastReviewAt) return false
  return new Date(c.dueAt).getTime() - new Date(c.lastReviewAt).getTime() >= LEARNED_DAYS * DAY
}

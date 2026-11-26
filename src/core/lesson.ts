// Сборка урока (docs/app.md, «Урок»): сначала пора повторить, потом новые по порядку пула.
import type { AnyExercise } from './exercises/index.ts'
import { type Memory, dueIn, learned, reps, seen, startedTodayAll } from './srs.ts'
import type { How, Noun } from './types.ts'

export const SIZE = 10
// новых в день на все упражнения вместе (как «новых карточек в день» у Anki)
export const NEW_PER_DAY = 20

export type Card = { ex: AnyExercise; word: Noun; fresh: boolean }
// шаг урока: подача и её карточки — у sort их несколько, у остальных одна
export type Step = { how: How; cards: Card[]; retry: boolean }
// раскладка собирается, когда в уроке столько повторов упражнения с подачей sort
export const SORT = 6

export type Overview = {
  due: Card[]
  fresh: Card[]
  // сколько новых ещё можно сегодня — на все упражнения вместе
  left: number
  words: { learned: number; learning: number; untouched: number }
}

export function overview(pool: Noun[], exs: AnyExercise[], m: Memory, now: number): Overview {
  const due: [number, Card][] = []
  const fresh: Card[] = []
  const words = { learned: 0, learning: 0, untouched: 0 }
  for (const word of pool) {
    const mine = exs.filter((ex) => ex.fits(word))
    if (mine.length === 0) continue
    const asked = mine.filter((ex) => seen(m, ex.id, word.id))
    if (asked.length === 0) words.untouched++
    else if (asked.length === mine.length && mine.every((ex) => learned(m, ex.id, word.id))) words.learned++
    else words.learning++
    for (const ex of mine) {
      const d = dueIn(m, ex.id, word.id, now)
      if (d === null) {
        if (!ex.after || seen(m, ex.after, word.id)) fresh.push({ ex, word, fresh: true })
      } else if (d <= 0) due.push([d, { ex, word, fresh: false }])
    }
  }
  due.sort((a, b) => a[0] - b[0])
  const left = Math.max(0, NEW_PER_DAY - startedTodayAll(m, now))
  return { due: due.map(([, c]) => c), fresh, left, words }
}

// Сколько новых войдёт в уроки сегодня: общий лимит на все упражнения.
export function freshToday(o: Overview): number {
  return Math.min(o.fresh.length, o.left)
}

// extra > 0 — «ещё N новых» сверх дневного лимита, когда повторять нечего.
export function build(o: Overview, rnd: () => number = Math.random, extra = 0, size = SIZE): Card[] {
  const out: Card[] = []
  const used = new Set<string>()
  const take = (c: Card) => {
    if (out.length >= size || used.has(c.word.id)) return false
    used.add(c.word.id)
    out.push(c)
    return true
  }
  for (const c of o.due) take(c)
  let left = o.left
  let more = extra
  for (const c of o.fresh) {
    if (out.length >= size) break
    if (left > 0) {
      if (take(c)) left--
    } else if (more > 0 && take(c)) more--
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

// Подачи урока (docs/app.md, «Подача»): новые — основной; SORT и больше повторов упражнения с sort —
// SORT из них одной раскладкой; у остальных повторов основная — каждый третий, в другие разы — другие
// подачи, доступные карточке, по кругу. can — есть ли для неё данные (фраза для phrase).
export function steps(cards: Card[], m: Memory, can: (how: How, c: Card) => boolean): Step[] {
  const sorts = new Map<AnyExercise, Step>()
  for (const ex of new Set(cards.map((c) => c.ex))) {
    const due = cards.filter((c) => c.ex === ex && !c.fresh)
    if (ex.hows.includes('sort') && due.length >= SORT) sorts.set(ex, { how: 'sort', cards: due.slice(0, SORT), retry: false })
  }
  const out: Step[] = []
  for (const c of cards) {
    const sort = sorts.get(c.ex)
    if (sort?.cards.includes(c)) {
      if (sort.cards[0] === c) out.push(sort)
      continue
    }
    const [main] = c.ex.hows
    const others = c.fresh ? [] : c.ex.hows.filter((h) => h !== main && h !== 'sort' && can(h, c))
    const r = reps(m, c.ex.id, c.word.id)
    out.push({ how: others.length === 0 || r % 3 === 0 ? main! : others[r % others.length]!, cards: [c], retry: false })
  }
  return out
}

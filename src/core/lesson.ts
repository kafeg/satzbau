// Сборка урока (docs/app.md, «Урок»): сначала пора повторить, потом новые по порядку пула.
import type { AnyExercise } from './exercises/index.ts'
import { type Memory, dueIn, learned, seen, startedTodayAll } from './srs.ts'
import type { Noun } from './types.ts'

export const SIZE = 10
// новых в день на все упражнения вместе (как «новых карточек в день» у Anki)
export const NEW_PER_DAY = 20

export type Card = { ex: AnyExercise; word: Noun; fresh: boolean }

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

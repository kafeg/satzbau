// Сборка урока (docs/app.md, «Урок»): сначала пора повторить, потом новые по порядку пула.
import type { AnyExercise } from './exercises/index.ts'
import { type Memory, dueIn, learned, seen, startedToday } from './srs.ts'
import type { Noun } from './types.ts'

export const SIZE = 10
export const NEW_PER_DAY = 20

export type Card = { ex: AnyExercise; word: Noun; fresh: boolean }

export type Overview = {
  due: Card[]
  fresh: Card[]
  // сколько новых ещё можно сегодня по каждому упражнению
  left: Map<string, number>
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
  const left = new Map(exs.map((ex) => [ex.id, Math.max(0, NEW_PER_DAY - startedToday(m, ex.id, now))]))
  return { due: due.map(([, c]) => c), fresh, left, words }
}

// Сколько новых войдёт в уроки сегодня: по лимиту каждого упражнения.
export function freshToday(o: Overview): number {
  const n = new Map<string, number>()
  for (const c of o.fresh) n.set(c.ex.id, (n.get(c.ex.id) ?? 0) + 1)
  let total = 0
  for (const [id, k] of n) total += Math.min(k, o.left.get(id) ?? 0)
  return total
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
  const left = new Map(o.left)
  let more = extra
  for (const c of o.fresh) {
    if (out.length >= size) break
    const l = left.get(c.ex.id) ?? 0
    if (l > 0) {
      if (take(c)) left.set(c.ex.id, l - 1)
    } else if (more > 0 && take(c)) more--
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

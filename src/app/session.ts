// Очередь заданий. На Э4 это заглушка: берём задания по кругу правилам, слова не повторяем.
// На Э5 её место займут повторы по FSRS — тогда очередь будет приходить из журнала ответов.

import { getBundle, getWords } from '../core/bundle.ts'
import { itemsFor } from '../core/generate.ts'
import type { Item } from '../core/types.ts'

export const SIZE = 12

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 48271) + 11) >>> 0
    return s / 4294967296
  }
}

export function newSession(size = SIZE, seed = Date.now()): Item[] {
  const next = rng(seed)
  const byRule = new Map<string, Item[]>()
  for (const t of getBundle().templates) {
    for (const i of itemsFor(t, getWords())) {
      const list = byRule.get(i.rule)
      if (list) list.push(i)
      else byRule.set(i.rule, [i])
    }
  }
  const buckets = [...byRule.values()].map((b) => {
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      ;[b[i], b[j]] = [b[j] as Item, b[i] as Item]
    }
    return b
  })
  const out: Item[] = []
  const seen = new Set<string>()
  let pos = 0
  while (out.length < size && buckets.some((b) => b.length)) {
    const b = buckets[pos++ % buckets.length] as Item[]
    const i = b.pop()
    if (!i || seen.has(i.word)) continue
    seen.add(i.word)
    out.push(i)
  }
  return out
}

// Данные приезжают отдельными файлами и кэшируются service worker'ом.
// Ядро получает их через setBundle и не знает, откуда они взялись.

import { setBundle } from '../core/bundle.ts'
import type { Bundle } from '../core/types.ts'

const FILES = ['nouns', 'verbs', 'adjs', 'themes', 'templates', 'explain', 'meta'] as const

async function one(name: string): Promise<unknown> {
  const r = await fetch(`${import.meta.env.BASE_URL}content/build/${name}.json`)
  if (!r.ok) throw new Error(`${name}.json: ${r.status}`)
  return r.json()
}

export interface Sentence {
  i: number
  de: string
  ru: string
  l: string[]
}

let sentences: Promise<Map<string, Sentence[]>> | null = null

/**
 * Примеры грузятся отдельно и только для экрана новых слов.
 *
 * ⚠ Это не мелкая оптимизация, а главное решение о весе: примеры — ДВЕ ТРЕТИ всех данных
 * (на тридцати одной теме 204 КиБ gzip из 302), и на старте их нет. Холодный старт грузит
 * около сотни КиБ. Числа здесь не фиксируем, их печатает `tools/build_data.py`.
 */
export function loadSentences(): Promise<Map<string, Sentence[]>> {
  sentences ??= one('sentences').then((xs) => {
    const by = new Map<string, Sentence[]>()
    for (const s of xs as Sentence[]) {
      for (const lemma of s.l) {
        const got = by.get(lemma)
        if (got) got.push(s)
        else by.set(lemma, [s])
      }
    }
    return by
  })
  return sentences
}

let started: Promise<void> | null = null

export function loadBundle(): Promise<void> {
  started ??= (async () => {
    const [nouns, verbs, adjs, themes, templates, explain, meta] = await Promise.all(
      FILES.map(one),
    )
    setBundle({ nouns, verbs, adjs, themes, templates, explain, meta } as Bundle)
  })()
  return started
}

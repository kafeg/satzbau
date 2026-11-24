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

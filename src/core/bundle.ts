// Текущий бандл данных. Ядро не знает, откуда он взялся: в тестах и CLI его ставит
// `data.ts` статическими импортами, в приложении — загрузка по сети (docs/architecture.md).

import type { Bundle, Entry, Pos, ThemeWord } from './types.ts'

/** Слово темы плюс его запись в лексиконе: генератору нужны обе половины. */
export interface Word extends ThemeWord {
  theme: string
  entry: Entry
}

let current: Bundle | null = null
let currentWords: Word[] = []
let byLemma = new Map<string, Entry>()

export function setBundle(b: Bundle): void {
  current = b
  byLemma = new Map()
  for (const e of [...b.nouns, ...b.verbs, ...b.adjs]) byLemma.set(e.w, e)
  currentWords = Object.entries(b.themes).flatMap(([theme, t]) =>
    t.words
      .filter((w) => byLemma.has(w.w))
      .map((w) => ({ ...w, theme, entry: byLemma.get(w.w) as Entry })),
  )
}

export function getBundle(): Bundle {
  if (!current) throw new Error('бандл данных не загружен')
  return current
}

export function getWords(): Word[] {
  return currentWords
}

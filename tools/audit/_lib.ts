// Общее для скриптов аудита: эталон UniMorph и ровная выборка заданий.

import { readFileSync } from 'node:fs'

export type Forms = Record<string, Record<string, string[]>>

/** Эталон из `data/audit/unimorph.json`. Нет файла — внятный отказ, а не стек. */
export function unimorph(): Forms {
  const path = new URL('../../data/audit/unimorph.json', import.meta.url)
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Forms
  } catch {
    console.error('нет эталона: сперва .venv/bin/python -I tools/audit/unimorph.py')
    process.exit(2)
  }
}

/** Ровная выборка по списку: не первые N, а каждый k-й. */
export function spread<T>(xs: T[], n: number): T[] {
  const step = Math.max(1, Math.floor(xs.length / n))
  const out: T[] = []
  for (let i = 0; i < xs.length && out.length < n; i += step) out.push(xs[i] as T)
  return out
}

export const head = (title: string) => console.log(`\n### ${title}`)

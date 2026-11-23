// Разбор ошибки: один текст на правило, подстановки из задания.
// Текст живёт в content/manual/explain.yaml, здесь только сборка.

import { bundle } from './data.ts'
import type { Item } from './types.ts'

export interface Explained {
  title: string
  short: string
  ru_contrast: string
  steps: string[]
  more?: string
}

const PLACEHOLDER = /\{(\w+)\}/g

/** Подставляет {ключ} из ctx. Неизвестный ключ — ошибка: текст не должен молча терять смысл. */
export function fill(text: string, ctx: Record<string, string>): string {
  return text.replace(PLACEHOLDER, (_, key: string) => {
    const v = ctx[key]
    if (v === undefined || v === '') throw new Error(`объяснение: нет подстановки {${key}}`)
    return v
  })
}

export function explainItem(item: Item): Explained {
  const e = bundle.explain[item.why]
  if (!e) throw new Error(`${item.templateId}: нет объяснения ${item.why}`)
  return {
    title: fill(e.title, item.ctx),
    short: fill(e.short, item.ctx),
    ru_contrast: fill(e.ru_contrast, item.ctx),
    steps: e.steps.map((s) => fill(s, item.ctx)),
    more: e.more ? fill(e.more, item.ctx) : undefined,
  }
}

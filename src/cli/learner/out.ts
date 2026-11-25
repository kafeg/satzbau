// Выгрузка прогона: журнал для импорта, контрольные дни, ошибки с разбором, правда о знании.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { explainItem } from '../../core/explain.ts'
import { formMatches } from '../../core/paradigms.ts'
import type { Answer } from '../../app/store.ts'
import type { Dump } from '../../app/transfer.ts'
import { DAY, type Lookup } from './model.ts'
import { markdown, metrics } from './metrics.ts'
import { CHECKPOINTS, START, type Run } from './run.ts'

export const dump = (answers: Answer[], saved: number): Dump => ({
  format: 1,
  app: 'satzbau',
  saved: new Date(saved).toISOString(),
  answers,
})

/**
 * Журнал контрольного дня: обрезан концом дня N и сдвинут на целые дни так, что день N —
 * вчера. Приложение считает «пора» от настоящих часов, и все ответы для него в прошлом.
 */
export function dayDump(answers: Answer[], day: number, today: number): Dump {
  const end = START + day * DAY
  const midnight = (t: number) => t - (t % DAY)
  const shift = midnight(today) - DAY - midnight(START + (day - 1) * DAY)
  const cut = answers.filter((a) => a.t < end).map((a) => ({ ...a, t: a.t + shift }))
  return dump(cut, today)
}

export function errorLines(r: Run, look: Lookup): string[] {
  return r.recs
    .filter((x) => !x.ok)
    .map((x) => {
      const t = look.template(x.item.templateId)
      let explain: unknown = null
      let matches: unknown = null
      try {
        explain = explainItem(x.item)
      } catch (e) {
        explain = { error: String(e) }
      }
      try {
        matches = formMatches(t.slot.paradigm, x.given, { decl: t.slot.decl, prep: t.slot.prep })
      } catch {
        matches = null
      }
      return JSON.stringify({
        day: x.day,
        tpl: x.item.templateId,
        rule: x.item.rule,
        kind: x.item.kind,
        word: x.item.word,
        full: x.item.full,
        text: x.item.text,
        given: x.given,
        answer: x.item.answer,
        cause: x.cause,
        mis: x.mis ?? null,
        hint: x.hint,
        explain,
        matches,
      })
    })
}

export function write(r: Run, look: Lookup, dir: string, today: number): ReturnType<typeof metrics> {
  mkdirSync(dir, { recursive: true })
  const last = r.answers[r.answers.length - 1]?.t ?? START
  const m = metrics(r)
  writeFileSync(join(dir, 'journal.json'), JSON.stringify(dump(r.answers, last)))
  for (const d of CHECKPOINTS.filter((d) => d <= r.days))
    writeFileSync(join(dir, `day-${d}.json`), JSON.stringify(dayDump(r.answers, d, today)))
  writeFileSync(join(dir, 'metrics.json'), JSON.stringify(m, null, 1))
  writeFileSync(join(dir, 'metrics.md'), markdown(m, r))
  writeFileSync(join(dir, 'errors.jsonl'), errorLines(r, look).join('\n') + '\n')
  writeFileSync(join(dir, 'truth.json'), JSON.stringify(r.truth))
  return m
}

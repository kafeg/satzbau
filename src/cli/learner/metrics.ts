// Числа прогона. Считает код: агент их читает, но не выводит сам.

import { getBundle } from '../../core/bundle.ts'
import { CHECKPOINTS, type Run } from './run.ts'
import { DAY } from './model.ts'

export interface Metrics {
  persona: string
  seed: number
  days: number
  answers: number
  accuracy: number
  /** доля засчитанных ответов, которые верны не по знанию */
  lucky: number
  causes: Record<string, number>
  checkpoints: {
    day: number
    dueRules: number
    dueWords: number
    states: Record<string, number>
    falseSolidRules: string[]
    falseSolidWords: string
    needlessRules: string[]
    /** доля правил уровня, встреченных к этому дню */
    access: string
  }[]
  weeks: {
    week: number
    days: number
    answers: number
    accuracy: number
    lucky: number
    /** слов, встреченных за неделю 3+ раза, из всех слов недели */
    repeats: string
    /** ошибок из-за заблуждения, за которыми в 7 дней последовала такая же */
    errorRepeat: string
  }[]
  rules: {
    rule: string
    answers: number
    accuracy: number
    lucky: number
    firstSolid: number | null
    /** «держится» к концу, а заданий было только с кнопками */
    choiceOnly: boolean
  }[]
  misconceptions: { id: string; start: number; end: number; errors: number }[]
  /** занятий подряд правило было «пора» на старте и не попало в занятие: максимум по правилу */
  dueWait: { rule: string; sessions: number }[]
  /** ложное «держится» за ВСЕ дни, а не только контрольные: правило → сколько дней */
  falseSolidDays: { rule: string; days: number }[]
  /** встречено правил к концу по уровням: «A1 16/19» */
  accessByLevel: string
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0)

export function metrics(r: Run): Metrics {
  const recs = r.recs
  const ok = recs.filter((x) => x.ok)
  const causes: Record<string, number> = {}
  for (const x of recs) causes[`${x.cause}${x.ok ? '+' : '-'}`] = (causes[`${x.cause}${x.ok ? '+' : '-'}`] ?? 0) + 1

  const errors = recs.filter((x) => !x.ok)
  const repeated = new Set(
    errors.filter((e) => e.mis && errors.some((f) => f.mis === e.mis && f.t > e.t && f.t - e.t <= 7 * DAY)),
  )

  const met = new Set<string>()
  const checkpoints = []
  for (const s of r.snaps) {
    for (const f of s.fresh) met.add(f)
    if (!CHECKPOINTS.includes(s.day)) continue
    checkpoints.push({
      day: s.day,
      dueRules: s.dueRules,
      dueWords: s.dueWords,
      states: s.states,
      falseSolidRules: s.falseSolid.rules,
      falseSolidWords: `${s.falseSolid.words} из ${s.falseSolid.solidWords}`,
      needlessRules: s.needless.rules,
      access: `${r.levelRules.filter((x) => met.has(x.rule)).length} из ${r.levelRules.length}`,
    })
  }

  const weeks = []
  for (let w = 0; w * 7 < r.days; w++) {
    const inWeek = recs.filter((x) => x.day > w * 7 && x.day <= (w + 1) * 7)
    const seen = new Map<string, number>()
    for (const x of inWeek) seen.set(x.item.word, (seen.get(x.item.word) ?? 0) + 1)
    const wErr = inWeek.filter((x) => !x.ok && x.mis)
    weeks.push({
      week: w + 1,
      days: new Set(inWeek.map((x) => x.day)).size,
      answers: inWeek.length,
      accuracy: pct(inWeek.filter((x) => x.ok).length, inWeek.length),
      lucky: pct(inWeek.filter((x) => x.lucky).length, inWeek.filter((x) => x.ok).length),
      repeats: `${[...seen.values()].filter((n) => n >= 3).length} из ${seen.size}`,
      errorRepeat: `${wErr.filter((e) => repeated.has(e)).length} из ${wErr.length}`,
    })
  }

  const last = r.snaps[r.snaps.length - 1]
  const byRule = new Map<string, typeof recs>()
  for (const x of recs) byRule.set(x.item.rule, [...(byRule.get(x.item.rule) ?? []), x])
  const rules = [...byRule].map(([rule, xs]) => ({
    rule,
    answers: xs.length,
    accuracy: pct(xs.filter((x) => x.ok).length, xs.length),
    lucky: pct(xs.filter((x) => x.lucky).length, xs.filter((x) => x.ok).length),
    firstSolid: r.snaps.find((s) => s.solid.includes(rule))?.day ?? null,
    choiceOnly: Boolean(last?.solid.includes(rule)) && xs.every((x) => x.item.kind === 'choice'),
  }))
  const explain = getBundle().explain
  rules.sort((a, b) => (explain[a.rule]?.name ?? a.rule).localeCompare(explain[b.rule]?.name ?? b.rule))

  const misconceptions = Object.entries(r.persona.mis).map(([id, start]) => ({
    id,
    start,
    end: Math.round((r.learner.mis.get(id) ?? 0) * 100) / 100,
    errors: errors.filter((e) => e.mis === id).length,
  }))

  const wait = new Map<string, number>()
  const run = new Map<string, number>()
  for (const s of r.sessions) {
    for (const rule of s.due) {
      const n = s.shown.includes(rule) ? 0 : (run.get(rule) ?? 0) + 1
      run.set(rule, n)
      wait.set(rule, Math.max(wait.get(rule) ?? 0, n))
    }
    for (const rule of [...run.keys()]) if (!s.due.includes(rule)) run.delete(rule)
  }
  const dueWait = [...wait]
    .filter(([, n]) => n > 0)
    .map(([rule, sessions]) => ({ rule, sessions }))
    .sort((a, b) => b.sessions - a.sessions)

  const fsd = new Map<string, number>()
  for (const s of r.snaps) for (const rule of s.falseSolid.rules) fsd.set(rule, (fsd.get(rule) ?? 0) + 1)
  const falseSolidDays = [...fsd].map(([rule, days]) => ({ rule, days })).sort((a, b) => b.days - a.days)

  const byLv = new Map<string, [number, number]>()
  for (const x of r.levelRules) {
    const [m, n] = byLv.get(x.level) ?? [0, 0]
    byLv.set(x.level, [m + (met.has(x.rule) ? 1 : 0), n + 1])
  }
  const accessByLevel = [...byLv].map(([lv, [m, n]]) => `${lv} ${m}/${n}`).join(', ')

  return {
    dueWait,
    falseSolidDays,
    accessByLevel,
    persona: r.persona.id,
    seed: r.seed,
    days: r.days,
    answers: recs.length,
    accuracy: pct(ok.length, recs.length),
    lucky: pct(ok.filter((x) => x.lucky).length, ok.length),
    causes,
    checkpoints,
    weeks,
    rules,
    misconceptions,
  }
}

const row = (xs: (string | number)[]) => `| ${xs.join(' | ')} |`

export function markdown(m: Metrics, r: Run): string {
  const out = [
    `# Прогон ${m.persona}, ${m.days} дн., seed ${m.seed}`,
    '',
    `Ответов ${m.answers}, верных ${m.accuracy}%, из верных не по знанию ${m.lucky}%.`,
    `Откуда ответы (+ засчитан, − нет): ${Object.entries(m.causes).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `Встречено правил к концу: ${m.accessByLevel}.`,
    `«Пора», но не в занятии, занятий подряд: ${m.dueWait.slice(0, 5).map((x) => `${x.rule} ${x.sessions}`).join(', ') || '—'}.`,
    `Ложное «держится» за все дни (правило — дней): ${m.falseSolidDays.map((x) => `${x.rule} ${x.days}`).join(', ') || '—'}.`,
    '',
    '## Контрольные дни',
    '',
    row(['день', 'пора утром: правила / слова', 'не начато · пора · в работе · держится', 'ложное «держится»: правила', 'ложное «держится»: слова', 'зря «пора»', 'встречено правил']),
    row(['---', '---', '---', '---', '---', '---', '---']),
    ...m.checkpoints.map((c) =>
      row([
        c.day,
        `${c.dueRules} / ${c.dueWords}`,
        `${c.states.new} · ${c.states.due} · ${c.states.learning} · ${c.states.solid}`,
        c.falseSolidRules.join(', ') || '—',
        c.falseSolidWords,
        c.needlessRules.join(', ') || '—',
        c.access,
      ]),
    ),
    '',
    '## Недели',
    '',
    row(['неделя', 'дней', 'ответов', 'верных %', 'не по знанию %', 'слов 3+ раза', 'ошибка заблуждения повторилась за 7 дн.']),
    row(['---', '---', '---', '---', '---', '---', '---']),
    ...m.weeks.map((w) => row([w.week, w.days, w.answers, w.accuracy, w.lucky, w.repeats, w.errorRepeat])),
    '',
    '## По дням',
    '',
    row(['день', 'занятий', 'ответов', 'пора утром: правила / слова', 'новые правила']),
    row(['---', '---', '---', '---', '---']),
    ...r.snaps.map((s) => row([s.day, s.sessions, s.answers, `${s.dueRules} / ${s.dueWords}`, s.fresh.join(', ') || '—'])),
    '',
    '## Правила',
    '',
    row(['правило', 'ответов', 'верных %', 'не по знанию %', '«держится» с дня', 'только кнопки']),
    row(['---', '---', '---', '---', '---', '---']),
    ...m.rules.map((x) => row([x.rule, x.answers, x.accuracy, x.lucky, x.firstSolid ?? '—', x.choiceOnly ? 'да' : ''])),
    '',
    '## Заблуждения',
    '',
    row(['заблуждение', 'сила в начале', 'в конце', 'ошибок из-за него']),
    row(['---', '---', '---', '---']),
    ...m.misconceptions.map((x) => row([x.id, x.start, x.end, x.errors])),
    '',
  ]
  return out.join('\n')
}

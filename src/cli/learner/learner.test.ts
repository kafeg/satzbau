// Симулятор ученика: заблуждения дают ожидаемые формы, прогон детерминирован,
// выгрузка контрольного дня читается приложением и даёт то же «пора».
import { beforeAll, describe, expect, it } from 'vitest'
import { bundle, words } from '../../core/data.ts'
import { generate } from '../../core/generate.ts'
import { dueCount, init, replay } from '../../app/srs.ts'
import { parse } from '../../app/transfer.ts'
import { DAY, WORD_SKILLS } from './model.ts'
import { MISCONCEPTIONS, ruGender } from './misconceptions.ts'
import { dayDump } from './out.ts'
import { PERSONAS } from './personas.ts'
import { lookup, run, START } from './run.ts'

beforeAll(init)

const tpl = (id: string) => {
  const t = bundle.templates.find((x) => x.id === id)
  if (!t) throw new Error(`нет шаблона ${id}`)
  return t
}
const word = (w: string) => {
  const x = words.find((y) => y.w === w)
  if (!x) throw new Error(`нет слова ${w}`)
  return x
}
const mis = (id: string, t: string, w: string) => {
  const m = MISCONCEPTIONS.find((x) => x.id === id)!
  const item = generate(tpl(t), word(w), words)
  return m.form(item, tpl(t), word(w), words)
}

describe('симулятор ученика', () => {
  it('таблица навыков покрывает все парадигмы шаблонов', () => {
    const missing = [...new Set(bundle.templates.map((t) => t.slot.paradigm))].filter((p) => !(p in WORD_SKILLS))
    expect(missing).toEqual([])
  })

  it('персоны ссылаются только на существующие заблуждения', () => {
    const ids = new Set(MISCONCEPTIONS.map((m) => m.id))
    for (const p of PERSONAS) expect(Object.keys(p.mis).filter((k) => !ids.has(k))).toEqual([])
  })

  it('род по русскому переводу', () => {
    expect(ruGender('дорога, путь')).toBe('f')
    expect(ruGender('окно')).toBe('n')
    expect(ruGender('стол')).toBe('m')
  })

  it('каждое заблуждение даёт свою неверную форму', () => {
    expect(mis('gender-ru', 'nom-subjekt-hier', 'Weg')).toBe('die')
    expect(mis('akk-as-nom', 'adj-akk-ding', 'Weg')).toBe('e')
    expect(mis('wechsel-dat', 'wechsel-wohin-auf', 'Tisch')).toBe('dem')
    expect(mis('gen-des', 'genitiv-besitz', 'Fahrer')).toBe('des')
    expect(mis('perfekt-haben', 'perfekt-aux-solo', 'gehen')).toBe('habe')
    expect(mis('plural-en', 'plural-kaufen', 'Koffer')).toBe('Kofferen')
    expect(mis('adj-e', 'adj-akk-ding', 'Weg')).toBe('e')
    expect(mis('strong-weak', 'praesens-du', 'fahren')).toBe('fahrst')
    expect(mis('strong-weak', 'praeteritum-frueher', 'gehen')).toBe('gehte')
    expect(mis('strong-weak', 'partizip-gestern', 'halten')).toBe('gehaltet')
    expect(mis('n-decl-none', 'n-dekl-akk', 'Nachbar')).toBe('Nachbar')
  })

  it('заблуждение молчит там, где оно ни при чём', () => {
    expect(mis('perfekt-haben', 'praesens-du', 'fahren')).toBeNull()
    expect(mis('strong-weak', 'praesens-du', 'wohnen')).toBe('wohnst')
  })

  it('прогон детерминирован по seed', () => {
    const p = PERSONAS.find((x) => x.id === 'a1-new')!
    const a = JSON.stringify(run(p, 10, 3).answers)
    expect(JSON.stringify(run(p, 10, 3).answers)).toBe(a)
    expect(JSON.stringify(run(p, 10, 4).answers)).not.toBe(a)
  })

  it('контрольный день читается переносом и даёт то же «пора»', () => {
    const p = PERSONAS.find((x) => x.id === 'a1-new')!
    const r = run(p, 7, 5)
    const today = Date.UTC(2026, 10, 25, 13, 7)
    const d = dayDump(r.answers, 7, today)
    const got = parse(JSON.stringify(d))
    const shift = (got[0]?.t ?? 0) - (r.answers[0]?.t ?? 0)
    expect(shift % DAY).toBe(0)
    expect(Math.max(...got.map((a) => a.t))).toBeLessThan(today)
    const at = START + 8 * DAY
    const orig = replay(r.answers.filter((a) => a.t < START + 7 * DAY))
    const moved = replay(got)
    expect(dueCount(moved, 'r:', at + shift)).toBe(dueCount(orig, 'r:', at))
    expect(dueCount(moved, 'w:', at + shift)).toBe(dueCount(orig, 'w:', at))
  })

  it('выгрузке хватает справочников: каждое слово и шаблон журнала находятся', () => {
    const look = lookup()
    const r = run(PERSONAS.find((x) => x.id === 'lazy')!, 7, 1)
    for (const a of r.answers) {
      expect(look.word(a.word)).toBeDefined()
      expect(look.template(a.tpl)).toBeDefined()
    }
  })
})

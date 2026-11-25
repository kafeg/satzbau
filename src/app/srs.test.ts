import { beforeAll, describe, expect, it } from 'vitest'
import { applyAnswer, due, dueAt, dueCount, init, replay, ruleKey, wordKey } from './srs.ts'
import type { Answer } from './store.ts'
import { parse } from './transfer.ts'

const T0 = Date.UTC(2026, 10, 24, 10, 0, 0)
const a = (p: Partial<Answer> & Pick<Answer, 'ok'>): Answer => ({
  t: T0,
  tpl: 'prep-dat-mit',
  word: 'Zug',
  rule: 'prep-dativ',
  given: 'der',
  ...p,
})

beforeAll(init)

describe('повторы', () => {
  it('один ответ заводит две карточки: правило и слово', () => {
    const cards = replay([a({ ok: 1 })])
    expect([...cards.keys()].sort()).toEqual(['r:prep-dativ', 'w:Zug'])
  })

  it('ошибка возвращает правило скоро, верный ответ — не скоро', () => {
    const bad = dueAt(replay([a({ ok: 0 })]), ruleKey('prep-dativ')) as number
    const good = dueAt(replay([a({ ok: 1 })]), ruleKey('prep-dativ')) as number
    expect(bad - T0).toBeLessThan(10 * 60 * 1000)
    expect(good).toBeGreaterThan(bad)
  })

  it('подсказка до ответа считается незнанием правила, но не слова', () => {
    const hinted = replay([a({ ok: 1, hint: 1 })])
    const plain = replay([a({ ok: 1 })])
    expect(dueAt(hinted, ruleKey('prep-dativ'))).toBeLessThan(
      dueAt(plain, ruleKey('prep-dativ')) as number,
    )
    expect(dueAt(hinted, wordKey('Zug'))).toBeGreaterThan(
      dueAt(replay([a({ ok: 0 })]), wordKey('Zug')) as number,
    )
  })

  it('карточки, которой нет, пора всегда: новое идёт вперёд', () => {
    expect(due(new Map(), 'r:что-угодно')).toBe(true)
  })

  it('считаем только то, чему пора', () => {
    const cards = replay([a({ ok: 0 })])
    expect(dueCount(cards, 'r:', T0)).toBe(0)
    expect(dueCount(cards, 'r:', T0 + 3600_000)).toBe(1)
  })

  it('журнал проигрывается одинаково, сколько ни проигрывай', () => {
    const log = [a({ ok: 0 }), a({ ok: 1, t: T0 + 60_000 }), a({ ok: 1, t: T0 + 120_000 })]
    expect(JSON.stringify([...replay(log)])).toBe(JSON.stringify([...replay(log)]))
  })

  // ⚠ На этом стоит вся экономия: ответ в дрилле больше не проигрывает журнал заново.
  // Разойтись с полным проигрышем нельзя — состояние повторов нигде не хранится,
  // и после перезагрузки человек получил бы другое расписание, чем видел вчера.
  it('ответ поверх карточек даёт то же, что полный проигрыш', () => {
    const log = [
      a({ ok: 0 }),
      a({ ok: 1, t: T0 + 60_000, word: 'Bus' }),
      a({ ok: 1, t: T0 + 120_000, hint: 1 }),
      a({ ok: 0, t: T0 + 200_000, rule: 'genus' }),
      a({ ok: 1, t: T0 + 300_000, word: 'Bus' }),
    ]
    let cards = replay([])
    for (const x of log) cards = applyAnswer(cards, x)
    expect(JSON.stringify([...cards])).toBe(JSON.stringify([...replay(log)]))
  })
})

describe('перенос прогресса', () => {
  it('разбирает свой файл и чинит порядок', () => {
    const dump = {
      format: 1,
      app: 'satzbau',
      saved: '2026-11-24',
      answers: [a({ ok: 1, t: T0 + 5 }), a({ ok: 0 })],
    }
    const got = parse(JSON.stringify(dump)).answers
    expect(got.map((x) => x.t)).toEqual([T0, T0 + 5])
  })

  it('чужой файл отвергается с человеческим текстом', () => {
    expect(() => parse('не json')).toThrow(/не разбирается/)
    expect(() => parse('{"app":"anki"}')).toThrow(/не файл satzbau/)
    expect(() => parse('{"app":"satzbau","format":99,"answers":[]}')).toThrow(/формат файла 99/)
  })
})

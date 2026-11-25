// Перенос прогресса файлом — единственная страховка от вытеснения хранилища на iOS.
// Поэтому разбор файла проверяется на мусор, а не только на «наш формат».
import { describe, expect, it } from 'vitest'
import { parse } from './transfer.ts'

const dump = (answers: unknown[]) =>
  JSON.stringify({ format: 1, app: 'satzbau', saved: '2026-01-01T00:00:00.000Z', answers })

const good = {
  t: 1700000000000,
  tpl: 'prep-dat-mit',
  word: 'Zug',
  rule: 'prep-dativ',
  ok: 1,
  given: 'dem',
}

describe('разбор файла прогресса', () => {
  it('берёт целую запись', () => {
    expect(parse(dump([good]))).toEqual([good])
  })

  // ⚠ Без этих проверок запись без `rule` заводила карточку `r:undefined`, а без `ok`
  // любой ответ считался ошибкой: журнал тихо превращался в мусор, неотличимый от своего.
  it('выбрасывает записи без полей, от которых зависит пересчёт', () => {
    const { rule: _r, ...noRule } = good
    const { ok: _o, ...noOk } = good
    const broken = [noRule, noOk, { ...good, ok: 2 }, { ...good, t: NaN }, { ...good, given: 7 }]
    expect(parse(dump([...broken, good]))).toEqual([good])
  })

  it('сортирует по времени: журнал проигрывается по порядку', () => {
    const late = { ...good, t: good.t + 1000 }
    expect(parse(dump([late, good])).map((a) => a.t)).toEqual([good.t, late.t])
  })

  it('отказывается от чужого файла понятным текстом', () => {
    expect(() => parse('не json')).toThrow(/не разбирается/)
    expect(() => parse(JSON.stringify({ app: 'anki', answers: [] }))).toThrow(/не файл satzbau/)
    expect(() => parse(JSON.stringify({ app: 'satzbau', format: 99, answers: [good] }))).toThrow(
      /формат файла 99/,
    )
    expect(() => parse(dump([{ t: 1 }]))).toThrow(/нет ответов/)
  })
})

// Ввод засчитывается по одному правилу в дрилле и в симуляторе. Проверяем то,
// на чём человек теряет верный ответ: клавиатуру без умляутов и лишний пробел.
import { describe, expect, it } from 'vitest'
import { accepts, normalize } from './check.ts'
import { bundle, words } from './data.ts'
import { itemsFor } from './generate.ts'
import type { Item } from './types.ts'

const item = (answer: string, answers?: string[]) =>
  ({ answer, ...(answers ? { answers } : {}) }) as Item

describe('что принимает ввод', () => {
  it('регистр не важен: пропуск в начале фразы пишут с заглавной', () => {
    expect(accepts(item('dem'), 'Dem')).toBe(true)
  })

  it('умляуты диграфами: на телефоне без немецкой раскладки «ä» набрать нечем', () => {
    expect(accepts(item('fährst'), 'faehrst')).toBe(true)
    expect(accepts(item('größer'), 'groesser')).toBe(true)
    expect(accepts(item('heißt'), 'heisst')).toBe(true)
  })

  it('но диграф не делает верной другую форму', () => {
    expect(accepts(item('Mütter'), 'Mutter')).toBe(false)
    expect(accepts(item('größer'), 'grosser')).toBe(false)
  })

  it('пробелы по краям и двойные внутри не ошибка: ответ бывает из двух слов', () => {
    expect(accepts(item('am schnellsten'), ' am  schnellsten ')).toBe(true)
    expect(accepts(item('dem'), 'dem ')).toBe(true)
  })

  it('остальные верные формы принимаются так же', () => {
    expect(accepts(item('hol', ['hole']), 'Hole')).toBe(true)
  })

  it('пустой ввод не ответ', () => {
    expect(accepts(item('dem'), '')).toBe(false)
    expect(accepts(item('dem'), '   ')).toBe(false)
  })
})

// ⚠ Нормализация опасна ровно одним: она может сравнять ответ с дистрактором,
// и тогда задание засчитает неверный выбор. Проверяется на всех заданиях, а не
// на примерах: добавится парадигма с умляутом в инвентаре — тест это поймает.
describe('нормализация не склеивает разные формы', () => {
  it('ни один дистрактор не становится верным ответом', () => {
    const bad: string[] = []
    for (const t of bundle.templates)
      for (const i of itemsFor(t, words))
        for (const o of i.options ?? [])
          if (o !== i.answer && !(i.answers ?? []).includes(o) && accepts(i, o))
            bad.push(`${t.id}/${i.word}: ${i.answer} ≡ ${o}`)
    expect(bad).toEqual([])
  })

  it('словарная форма слова не сравнивается с ответом', () => {
    const bad: string[] = []
    for (const t of bundle.templates)
      for (const i of itemsFor(t, words))
        if (i.ctx.w && i.ctx.w !== i.answer && normalize(i.ctx.w) === normalize(i.answer))
          bad.push(`${t.id}/${i.word}: ${i.ctx.w} ≡ ${i.answer}`)
    expect(bad).toEqual([])
  })
})

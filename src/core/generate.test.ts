import { describe, expect, it } from 'vitest'
import { bundle, words } from './data.ts'
import { explainItem } from './explain.ts'
import { fillingFor, generate, itemsFor } from './generate.ts'
import { adjEndingMatches, inventory } from './paradigms.ts'

// Главный тест этапа: прогнать ВСЕ шаблоны на ВСЕХ подходящих словах. Проверять
// задания в рантайме у человека поздно — ошибка должна падать здесь.
const all = bundle.templates.flatMap((t) => itemsFor(t, words))

describe(`инвариант генератора: ${all.length} заданий`, () => {
  it('каждый шаблон собирает хоть одно задание', () => {
    const empty = bundle.templates.filter((t) => fillingFor(t, words).length === 0)
    expect(empty.map((t) => t.id)).toEqual([])
  })

  it('верный вариант ровно один', () => {
    const bad = all
      .filter((i) => i.options)
      .filter((i) => i.options!.filter((o) => o === i.answer).length !== 1)
      .map((i) => `${i.templateId} × ${i.word}: ${i.options!.join('/')} при ответе ${i.answer}`)
    expect(bad).toEqual([])
  })

  it('все варианты различны', () => {
    const bad = all
      .filter((i) => i.options && new Set(i.options).size !== i.options.length)
      .map((i) => `${i.templateId} × ${i.word}: ${i.options!.join('/')}`)
    expect(bad).toEqual([])
  })

  it('вариантов столько, сколько просит шаблон', () => {
    const bad = all
      .filter((i) => i.kind === 'choice')
      .filter((i) => {
        const t = bundle.templates.find((x) => x.id === i.templateId)!
        return i.options!.length !== (t.options?.count ?? 4)
      })
      .map((i) => `${i.templateId} × ${i.word}: вариантов ${i.options!.length}`)
    expect(bad).toEqual([])
  })

  it('в тексте задания нет незаполненных подстановок', () => {
    const bad = all.filter((i) => /\{\w+\}/.test(i.text) || /\{\w+\}/.test(i.full))
    expect(bad.map((i) => `${i.templateId} × ${i.word}: ${i.text}`)).toEqual([])
  })

  it('пропуск в тексте есть, а в собранной фразе его нет', () => {
    expect(all.every((i) => i.text.includes('___'))).toBe(true)
    expect(all.every((i) => !i.full.includes('___'))).toBe(true)
  })

  it('объяснение собирается для каждого задания', () => {
    const bad: string[] = []
    for (const i of all) {
      try {
        const e = explainItem(i)
        if (!e.steps.length) bad.push(`${i.templateId} × ${i.word}: шаги пустые`)
      } catch (err) {
        bad.push(`${i.templateId} × ${i.word}: ${(err as Error).message}`)
      }
    }
    expect(bad).toEqual([])
  })

  // Баланс ответов нужен на уровне ПРАВИЛА, а не шаблона: повтор идёт по правилу,
  // задания из его шаблонов перемешиваются. Если же на всё правило один ответ,
  // человек отвечает не читая задание — так было у слияний, пока не появился wohin.
  // Ввод (kind: input) сюда не входит: «в Dativ окончание всегда -en» — это и есть
  // правило, и постоянный ответ у него законный.
  it('внутри правила с выбором встречаются разные ответы', () => {
    const byRule = new Map<string, Set<string>>()
    for (const i of all) {
      if (i.kind !== 'choice') continue
      if (!byRule.has(i.rule)) byRule.set(i.rule, new Set())
      byRule.get(i.rule)!.add(i.answer)
    }
    const bad = [...byRule]
      .filter(([, s]) => s.size < 2)
      .map(([r, s]) => `${r}: ответ всегда ${[...s][0]}`)
    expect(bad).toEqual([])
  })
})

describe('парадигмы', () => {
  it('инвентарь определённого артикля — шесть различных форм', () => {
    expect(inventory('def_article').sort()).toEqual(['das', 'dem', 'den', 'der', 'des', 'die'])
  })

  it('инвентарь слияний с in включает несклеенные формы', () => {
    expect(inventory('merged_prep_article', { prep: 'in' }).sort()).toEqual([
      'im',
      'in das',
      'in dem',
      'ins',
    ])
  })

  it('вспомогательных в первом лице ровно два', () => {
    expect(inventory('aux_present', { person: '1sg' })).toEqual(['habe', 'bin'])
  })

  it('обратный разбор: kleine — это Nom/Akk женского в слабом склонении', () => {
    const first = adjEndingMatches('e')[0]!
    expect(first).toEqual({ decl: 'weak', case: 'nom', gender: 'f' })
    expect(adjEndingMatches('em')).toEqual([
      { decl: 'strong', case: 'dat', gender: 'm' },
      { decl: 'strong', case: 'dat', gender: 'n' },
    ])
  })
})

describe('конкретные задания', () => {
  const item = (tid: string, lemma: string) => {
    const t = bundle.templates.find((x) => x.id === tid)!
    const w = words.find((x) => x.w === lemma)!
    return generate(t, w)
  }

  it('mit + Dativ у мужского рода', () => {
    const i = item('prep-dat-mit', 'Zug')
    expect(i.full).toBe('Ich fahre mit dem Zug.')
    expect(i.answer).toBe('dem')
    expect(i.options).toContain('der')
  })

  it('окончание прилагательного вводится, а не выбирается', () => {
    const i = item('adj-dat-en-klein', 'Küche')
    expect(i.full).toBe('Wir wohnen in einer kleinen Küche.')
    expect(i.answer).toBe('en')
    expect(i.options).toBeUndefined()
  })

  it('разбор ошибки подставляет род и артикль', () => {
    const e = explainItem(item('prep-dat-mit', 'Bahn'))
    expect(e.steps.join(' ')).toContain('женский')
    expect(e.steps.join(' ')).toContain('die')
  })
})

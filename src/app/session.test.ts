// Слой приложения: выбор того, ЧТО тренировать. Ядро проверяется отдельно.
import { beforeAll, describe, expect, it } from 'vitest'
import { bundle, words } from '../core/data.ts'
import { fillingFor, generate } from '../core/generate.ts'
import { countFor, newSession, nextNew, rules } from './session.ts'
import { init, replay, type Cards } from './srs.ts'
import type { Answer } from './store.ts'

beforeAll(init)

/** Журнал из одного верного ответа на каждое названное правило: они «встречались». */
const met = (...rules: string[]): Cards =>
  replay(
    rules.map(
      (rule, i): Answer => ({
        t: Date.now() - (rules.length - i) * 60000,
        tpl: bundle.templates.find((t) => t.rule === rule)!.id,
        word: 'Zug',
        rule,
        ok: 1,
        given: '-',
      }),
    ),
  )

const LV = { A1: 1, A2: 2, B1: 3 } as const
const level = (w: string) => words.find((x) => x.w === w)?.lv

describe('очередь заданий', () => {
  it('сессия правила содержит только его задания', () => {
    const items = newSession({ rule: 'prep-dativ', seed: 1 })
    expect(items.length).toBeGreaterThan(0)
    expect([...new Set(items.map((i) => i.rule))]).toEqual(['prep-dativ'])
  })

  it('сессия темы берёт прежде всего её слова', () => {
    const items = newSession({ theme: 'health', seed: 2 })
    expect(items.length).toBeGreaterThan(0)
    expect(items.filter((i) => i.theme === 'health').length).toBe(items.length)
  })

  // ⚠ Тема — приоритет, а не фильтр: у «wo?» нет ни одного слова Еды, но правило
  // не должно гаснуть — очередь добирает лексику из других тем.
  it('правило без слов темы всё равно собирается', () => {
    expect(countFor({ rule: 'wechsel-wo', theme: 'food' })).toBe(0)
    const items = newSession({ rule: 'wechsel-wo', theme: 'food', seed: 6 })
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.rule === 'wechsel-wo')).toBe(true)
  })

  // ⚠ Обход стопок идёт по кругу и берёт по одному заданию, поэтому при порядке
  // шаблонов «как в файле» сессия из двенадцати заданий состояла из ПЕРВЫХ двенадцати
  // шаблонов всегда: восемь правил из сорока двух, остальное было недостижимо.
  // ⚠ Порядок правил был порядком написания шаблонов, а не порядком обучения:
  // «Genitiv принадлежности» мог стоять рядом с «Präsens: er» без всякого намёка,
  // что раньше. Теперь его задаёт граф предпосылок (`after` в explain.yaml).
  it('правило стоит после своих предпосылок', () => {
    const all = rules()
    const at = new Map(all.map((r, i) => [r.rule, i]))
    const bad: string[] = []
    for (const r of all) {
      for (const a of bundle.explain[r.rule]?.after ?? []) {
        if ((at.get(a) ?? -1) > (at.get(r.rule) ?? 0)) bad.push(`${r.rule} раньше ${a}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('вперемешку достаёт все правила, а не первые по файлу', () => {
    // одна длинная сессия вместо полусотни коротких: обход тот же, а времени втрое меньше
    const seen = new Set(newSession({ seed: 3, size: 400 }).map((i) => i.rule))
    expect(seen.size).toBe(new Set(bundle.templates.map((t) => t.rule)).size)
  })

  // ⚠ Без ограничения двенадцать заданий давали двенадцать незнакомых правил:
  // «Заниматься» у человека с пустым журналом превращалось в экскурсию по грамматике.
  it('в сессии не больше одного незнакомого правила', () => {
    const cards = met('nominativ-subjekt', 'prep-dativ')
    const items = newSession({ cards, size: 40, seed: 11 })
    const fresh = [...new Set(items.map((i) => i.rule))].filter(
      (r) => !cards.has(`r:${r}`),
    )
    expect(items.length).toBeGreaterThan(10)
    expect(fresh.length).toBeLessThanOrEqual(1)
  })

  // Порядок обучения задаёт граф: правило с неначатой предпосылкой новым не берётся.
  it('новое правило берётся по графу предпосылок', () => {
    const first = nextNew({ cards: new Map() })
    expect(first).not.toBeNull()
    expect(bundle.explain[first!.rule]?.after ?? []).toEqual([])
    const next = nextNew({ cards: met(first!.rule) })
    expect(next?.rule).not.toBe(first!.rule)
    for (const a of bundle.explain[next!.rule]?.after ?? []) {
      expect(a).toBe(first!.rule)
    }
  })

  // ⚠ Род либо знаешь у слова, либо нет: карточка правила «der, die или das» ничего
  // не планирует, и состояние у такого правила считается по карточкам СЛОВ.
  it('лексическое правило отмечено и живёт по словам', () => {
    const lex = rules().filter((r) => r.lex).map((r) => r.rule)
    expect(lex).toEqual(['genus'])
    expect(rules({ cards: new Map() }).find((r) => r.rule === 'genus')?.state).toBe('new')
  })

  it('слова темы идут раньше остальных', () => {
    const items = newSession({ theme: 'food', size: 30, seed: 8 })
    const mine = items.filter((i) => i.theme === 'food').length
    const first = items.slice(0, mine).every((i) => i.theme === 'food')
    expect(mine).toBeGreaterThan(5)
    expect(first).toBe(true)
  })

  it('уровень — потолок: A1 не пускает слова и правила выше', () => {
    const items = newSession({ level: 'A1', size: 40, seed: 3 })
    expect(items.length).toBeGreaterThan(0)
    for (const i of items) {
      expect(LV[i.level]).toBeLessThanOrEqual(1)
      expect(LV[level(i.word) ?? 'B1']).toBeLessThanOrEqual(1)
    }
    expect(countFor({ level: 'A1' })).toBeLessThan(countFor({}))
  })

  it('слово в сессии не повторяется', () => {
    const items = newSession({ seed: 4 })
    expect(new Set(items.map((i) => i.word)).size).toBe(items.length)
  })

  it('сессия не длиннее запрошенного', () => {
    expect(newSession({ size: 5, seed: 5 }).length).toBe(5)
  })

  it('у каждого правила на главной есть имя и наполнение', () => {
    const list = rules()
    expect(list.length).toBe(new Set(bundle.templates.map((t) => t.rule)).size)
    for (const r of list) {
      expect(r.title).not.toMatch(/[{}]/)
      expect(r.count).toBeGreaterThan(0)
    }
  })

  it('правила идут по возрастанию уровня', () => {
    const got = rules().map((r) => LV[r.level])
    expect(got).toEqual([...got].sort((a, b) => a - b))
  })
})

// На Э5 журнал будет хранить пару (шаблон, слово), а экран ошибок — пересобирать
// задание из неё. Это работает только пока генератор детерминирован.
describe('задание восстанавливается из пары шаблон + слово', () => {
  it('повторная сборка даёт то же самое, включая порядок вариантов', () => {
    const bad: string[] = []
    for (const t of bundle.templates) {
      for (const w of fillingFor(t, words)) {
        const a = generate(t, w, words)
        const b = generate(t, w, words)
        if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(`${t.id} × ${w.w}`)
      }
    }
    expect(bad).toEqual([])
  })
})

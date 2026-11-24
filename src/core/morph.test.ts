import { describe, expect, it } from 'vitest'
import genitive_fixture from './__fixtures__/genitive.json' with { type: 'json' }
import imperative_fixture from './__fixtures__/imperative.json' with { type: 'json' }
import present_fixture from './__fixtures__/present.json' with { type: 'json' }
import { bundle } from './data.ts'
import {
  adjForm,
  comparative,
  imperative,
  imperativeForms,
  nounForm,
  particle,
  perfekt,
  present,
  superlative,
} from './morph.ts'
import type { Person } from './types.ts'

const PERSONS: Person[] = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl']
const fixture = present_fixture as Record<string, Partial<Record<Person, string>>>

// Расхождения, где прав НАШ вывод, а не UniMorph. Каждое с причиной: молчаливого
// списка исключений быть не должно, а устаревшую запись ловит отдельная проверка.
const KNOWN: Record<string, string> = {
  fragen: 'frägst/frägt — устаревший вариант с перегласовкой, стандарт fragst/fragt',
  wachsen: 'в UniMorph слабый омоним wachsen «натирать воском», у нас сильный «расти»',
  backen: 'bäckt — старая сильная форма, современный стандарт backt',
  durchsetzen: 'в UniMorph неотделяемый durchsetzen «пронизывать», у нас отделяемый «добиваться»',
  unterschreiben: 'в UniMorph отделяемый вариант, стандарт неотделяемый: ich unterschreibe',
  dauern: 'глаголы на -eln/-ern: UniMorph даёт усечённое dauer, стандарт dauere',
  behandeln: 'то же: behandel против behandele',
  verhandeln: 'то же',
  entwickeln: 'то же',
  wickeln: 'то же',
  basteln: 'то же',
  füttern: 'то же: fütter против füttere',
  fördern: 'то же',
  verlängern: 'то же: verlänger против verlängere',
}

describe('спряжение против UniMorph', () => {
  // Правило выводит формы из p3 и инфинитива. Проверять его на глаз нельзя,
  // поэтому сверяемся с источником по всем глаголам лексикона.
  const bad: string[] = []
  const diverged = new Set<string>()
  for (const v of bundle.verbs) {
    const want = fixture[v.w]
    if (!want) continue
    for (const p of PERSONS) {
      const expected = want[p]
      if (!expected) continue
      const got = present(v, p)
      if (got === expected) continue
      diverged.add(v.w)
      if (!(v.w in KNOWN)) bad.push(`${v.w} ${p}: ${got} ≠ ${expected}`)
    }
  }
  it('все формы совпадают, кроме известных расхождений', () => {
    expect(bad).toEqual([])
  })

  it('в списке исключений нет устаревших записей', () => {
    expect(Object.keys(KNOWN).filter((w) => !diverged.has(w))).toEqual([])
  })
})

describe('разбор ошибки совпадает с заданием', () => {
  // ⚠ Текст объяснения один на правило, а правило охватывает разные ветки:
  // «глагол движения» стояло в шагах жёстко и врало на 73 заданиях из 85.
  it('превосходная степень причастий идёт без -e-', () => {
    const adj = (w: string) => bundle.adjs.find((a) => a.w === w)!
    expect(superlative(adj('ansteckend'))).toBe('am ansteckendsten')
    expect(superlative(adj('anstrengend'))).toBe('am anstrengendsten')
    expect(superlative(adj('alt'))).toBe('am ältesten')
    expect(superlative(adj('früh'))).toBe('am frühesten')
  })
})

describe('императив против UniMorph', () => {
  // Тот же приём, что и со спряжением: вывод проверяется источником, а не на глаз.
  // У одного глагола бывает несколько принятых форм, поэтому эталон — список.
  const imp = imperative_fixture as Record<string, string[]>
  const bad: string[] = []
  let checked = 0
  for (const v of bundle.verbs) {
    const want = imp[v.w]
    if (!want) continue
    checked++
    const part = particle(v)
    // ⚠ Проверяется КАЖДАЯ форма, которую приложение примет: лишняя означала бы,
    // что засчитывается неверный ответ, а недостающая — что верный считается ошибкой
    for (const base of imperativeForms(v)) {
      const got = part ? `${base} ${part}` : base
      if (!want.includes(got)) bad.push(`${v.w}: ${got} ∉ ${want.join(' / ')}`)
    }
  }
  it('все принимаемые формы есть в числе верных', () => {
    expect(bad).toEqual([])
    expect(checked).toBeGreaterThan(100)
  })

  // ⚠ У buchen приняты «buch» и «buche», у sitzen только «sitz»: правилом это
  // не выводится, список приходит из источника. Первой идёт форма для показа.
  it('принимаются все формы источника, первой — словарная', () => {
    const forms = (w: string) => imperativeForms(bundle.verbs.find((v) => v.w === w)!)
    expect(forms('basteln')).toHaveLength(3)
    expect(forms('basteln')[0]).toBe('bastle')
    expect(forms('buchen')).toContain('buche')
    expect(forms('buchen')[0]).toBe('buch')
    expect(forms('sitzen')).toEqual(['sitz'])
    expect(forms('essen')).toEqual(['iss'])
  })

  // перегласовка в императив не идёт, смена e→i идёт — это и есть всё правило
  it('перегласовка уходит, смена гласной остаётся', () => {
    const imperativeOf = (w: string) => imperative(bundle.verbs.find((v) => v.w === w)!)
    expect(imperativeOf('fahren')).toBe('fahr')
    expect(imperativeOf('essen')).toBe('iss')
    expect(imperativeOf('lesen')).toBe('lies')
    expect(imperativeOf('halten')).toBe('halte')
    expect(imperativeOf('öffnen')).toBe('öffne')
  })
})

describe('родительный против UniMorph', () => {
  // Правило короткое, но ошибается тихо: «das Auto der Bedienungs» доехало до живого
  // сайта. Поэтому сверяемся по всем словам лексикона, какие есть в источнике.
  const gen = genitive_fixture as Record<string, string[]>
  const KNOWN_GEN: Record<string, string> = {
    Post: 'в UniMorph мужской омоним der Post «пост, должность», у нас die Post «почта»',
  }
  const bad: string[] = []
  const diverged = new Set<string>()
  let checked = 0
  for (const n of bundle.nouns) {
    const want = gen[n.w]
    if (!want || n.pl_only) continue
    const got = nounForm(n, 'gen')
    if (!got) continue
    checked++
    if (want.includes(got)) continue
    diverged.add(n.w)
    if (!(n.w in KNOWN_GEN)) bad.push(`${n.w}: ${got} ∉ ${want.join(' / ')}`)
  }
  it('все формы входят в число принятых', () => {
    expect(bad).toEqual([])
    expect(checked).toBeGreaterThan(300)
  })

  it('в списке исключений нет устаревших записей', () => {
    expect(Object.keys(KNOWN_GEN).filter((w) => !diverged.has(w))).toEqual([])
  })

  // ⚠ Женский род в родительном не меняется — это и давало «der Bedienungs»
  it('женский род окончания не получает', () => {
    const noun = (w: string) => bundle.nouns.find((n) => n.w === w)!
    expect(nounForm(noun('Bedienung'), 'gen')).toBe('Bedienung')
    expect(nounForm(noun('Reise'), 'gen')).toBe('Reise')
    expect(nounForm(noun('Kind'), 'gen')).toBe('Kindes')
    expect(nounForm(noun('Fahrer'), 'gen')).toBe('Fahrers')
  })
})

describe('трудные слова', () => {
  const noun = (w: string) => bundle.nouns.find((n) => n.w === w)!
  const adj = (w: string) => bundle.adjs.find((a) => a.w === w)!

  it('Automat — n-Deklination во всех падежах кроме именительного', () => {
    const a = noun('Automat')
    expect(nounForm(a, 'nom')).toBe('Automat')
    expect(nounForm(a, 'akk')).toBe('Automaten')
    expect(nounForm(a, 'dat')).toBe('Automaten')
    expect(nounForm(a, 'gen')).toBe('Automaten')
  })

  it('Eltern — только множественное, единственного нет', () => {
    const e = noun('Eltern')
    expect(nounForm(e, 'nom')).toBeNull()
    expect(nounForm(e, 'nom', 'pl')).toBe('Eltern')
    expect(nounForm(e, 'dat', 'pl')).toBe('Eltern')
  })

  it('дательный множественного всегда на -n', () => {
    expect(nounForm(noun('Zug'), 'dat', 'pl')).toBe('Zügen')
    expect(nounForm(noun('Auto'), 'dat', 'pl')).toBe('Autos')
    expect(nounForm(noun('Haus'), 'dat', 'pl')).toBe('Häusern')
  })

  it('hoch и dunkel меняют основу перед окончанием', () => {
    expect(adjForm(adj('dunkel'), 'weak', 'nom', 'f')).toBe('dunkle')
    expect(adjForm(adj('teuer'), 'mixed', 'nom', 'm')).toBe('teurer')
  })

  it('степени сравнения: неправильные из данных, правильные по правилу', () => {
    expect(comparative(adj('alt'))).toBe('älter')
    expect(superlative(adj('alt'))).toBe('am ältesten')
    expect(comparative(adj('klein'))).toBe('kleiner')
    expect(superlative(adj('klein'))).toBe('am kleinsten')
    expect(superlative(adj('laut'))).toBe('am lautesten')
    // сравнительная выбрасывает -e-, превосходная нет
    expect(comparative(adj('teuer'))).toBe('teurer')
    expect(superlative(adj('teuer'))).toBe('am teuersten')
    expect(comparative(adj('dunkel'))).toBe('dunkler')
    expect(superlative(adj('dunkel'))).toBe('am dunkelsten')
    expect(superlative(adj('früh'))).toBe('am frühesten')
    expect(superlative(adj('pünktlich'))).toBe('am pünktlichsten')
  })

  it('Perfekt берёт вспомогательный из записи', () => {
    const fahren = bundle.verbs.find((v) => v.w === 'fahren')!
    const wohnen = bundle.verbs.find((v) => v.w === 'wohnen')!
    expect(perfekt(fahren, '1sg')).toBe('bin gefahren')
    expect(perfekt(wohnen, '1sg')).toBe('habe gewohnt')
  })
})

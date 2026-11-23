import { describe, expect, it } from 'vitest'
import present_fixture from './__fixtures__/present.json' with { type: 'json' }
import { bundle } from './data.ts'
import { adjForm, comparative, nounForm, perfekt, present, superlative } from './morph.ts'
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
  })

  it('Perfekt берёт вспомогательный из записи', () => {
    const fahren = bundle.verbs.find((v) => v.w === 'fahren')!
    const wohnen = bundle.verbs.find((v) => v.w === 'wohnen')!
    expect(perfekt(fahren, '1sg')).toBe('bin gefahren')
    expect(perfekt(wohnen, '1sg')).toBe('habe gewohnt')
  })
})

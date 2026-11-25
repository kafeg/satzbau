import { describe, expect, it } from 'vitest'
import declension_fixture from './__fixtures__/declension.json' with { type: 'json' }
import degrees_fixture from './__fixtures__/degrees.json' with { type: 'json' }
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
import type { Case, Num, Person } from './types.ts'

const PERSONS: Person[] = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl']
const fixture = present_fixture as Record<string, Partial<Record<Person, string[]>>>

// Расхождения, где прав НАШ вывод, а не UniMorph. Каждое с причиной: молчаливого
// списка исключений быть не должно, а устаревшую запись ловит отдельная проверка.
/**
 * ⚠ Здесь было четырнадцать записей, и тринадцать из них оказались не расхождениями,
 * а артефактом эталона: он хранил ОДНУ форму там, где UniMorph даёт несколько
 * («fragst» и «frägst», «dauere» и «dauer»), и наш верный вывод не совпадал
 * со случайно сохранившейся. Эталон стал списком — исключения исчезли сами.
 * Осталось одно, и там ошибается источник.
 */
const KNOWN: Record<string, string> = {
  abdichten:
    'UniMorph даёт «dichtst/dichtt» — у основы на -cht беглая -e обязательна: du dichtest, er dichtet',
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
      // ⚠ Эталон — список: у глаголов на -eln/-ern источник даёт и «angel», и «angele»,
      // и «angle». Пока в эталоне лежала одна форма, девять верных выводов висели
      // в списке известных расхождений как ошибки.
      const expected = want[p]
      if (!expected?.length) continue
      const got = present(v, p)
      if (expected.includes(got)) continue
      diverged.add(v.w)
      if (!(v.w in KNOWN)) bad.push(`${v.w} ${p}: ${got} ∉ ${expected.join(' / ')}`)
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

  // ⚠ Правило «после шипящих -esten» верно для hübsch, но не для -isch:
  // восьмая тема дала первое несравнимое-не-абсолютное прилагательное на -isch.
  it('прилагательные на -isch не получают -e- в превосходной', () => {
    const adj = (w: string) => bundle.adjs.find((a) => a.w === w)!
    expect(superlative(adj('stürmisch'))).toBe('am stürmischsten')
    expect(superlative(adj('regnerisch'))).toBe('am regnerischsten')
    expect(superlative(adj('heiß'))).toBe('am heißesten')
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
    // ⚠ Все остальные — спор -es против -s у многосложных. Источник держится книжного
    // варианта, разговорная норма давно -s. Правило «односложное → -es» пробовали:
    // оно чинит Monat и Alarm, но ломает заимствования (Teames, Fanes, Cafées),
    // потому что односложность немецкого слова по гласным не считается. Нужен СПИСОК
    // в данных, а не правило, — пока держим -s и записываем расхождения здесь.
    Bescheid: 'приняты обе: des Bescheids и des Bescheides',
    Zuschlag: 'приняты обе: des Zuschlags и des Zuschlages',
    Facharzt: 'приняты обе: des Facharzts и des Facharztes',
    Hautarzt: 'то же',
    Osterei: 'приняты обе: des Ostereis и des Ostereies',
    // источник даёт несклоняемую форму там, где склонение обычное
    Kilo: 'UniMorph даёт несклоняемое des Kilo, разговорное des Kilos тоже принято',
    Silvester: 'название праздника, в UniMorph без окончания; des Silvesters встречается',
    Aufenthaltstitel: 'в UniMorph без окончания, но Titel склоняется: des Aufenthaltstitels',
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

  /**
   * ⚠ Находка жила латентно: шаблонов на дательный множественного не было, и правило
   * «-n всему, что не на n/s» никого не трогало. Как только рамка появилась, в приложение
   * уехали «Mit guten Visan» и «Mit guten Skin». Тест стоит, чтобы латентной она больше
   * не была: заимствованные множественные на гласную -n не берут, немецкие на -e берут.
   */
  it('дательный множественного: заимствованные на гласную не получают -n', () => {
    const noun = (w: string) => bundle.nouns.find((n) => n.w === w)!
    for (const w of ['Visum', 'Ski', 'Kilo', 'Praktikum']) {
      expect(nounForm(noun(w), 'dat', 'pl')).toBe(noun(w).pl)
    }
    expect(nounForm(noun('Tag'), 'dat', 'pl')).toBe('Tagen')
    expect(nounForm(noun('Kind'), 'dat', 'pl')).toBe('Kindern')
    expect(nounForm(noun('Auto'), 'dat', 'pl')).toBe('Autos')
    expect(nounForm(noun('Frau'), 'dat', 'pl')).toBe('Frauen')
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

/**
 * Склонение существительных против UniMorph — тот же приём, что и со спряжением.
 *
 * ⚠ Дательный ЕДИНСТВЕННОГО сюда не входит, и это не недосмотр: UniMorph даёт
 * архаичное Dativ-e («dem Manne», «dem Hause»), 465 расхождений из 533, и прав
 * наш вывод, а не источник. Остальные семь клеток сверяемы.
 */
describe('склонение против UniMorph', () => {
  const decl = declension_fixture as Record<string, Record<string, string[]>>
  const CELLS: [string, Case, Num][] = [
    ['nom_sg', 'nom', 'sg'],
    ['akk_sg', 'akk', 'sg'],
    ['gen_sg', 'gen', 'sg'],
    ['nom_pl', 'nom', 'pl'],
    ['akk_pl', 'akk', 'pl'],
    ['gen_pl', 'gen', 'pl'],
    ['dat_pl', 'dat', 'pl'],
  ]
  const KNOWN_DECL: Record<string, string> = {
    // прав наш вывод: у источника книжный или областной вариант
    Klima: 'UniMorph даёт учёное Klimata, обиходное множественное — Klimas',
    Stau: 'UniMorph даёт Staue, норма — Staus',
    Rettungswagen: 'Rettungswägen — южнонемецкое, стандарт без перегласовки',
    Zahnpasta: 'UniMorph даёт Zahnpastaen, норма — Zahnpasten',
    Fazit: 'приняты обе: Fazits и Fazite',
    Paketbote: 'n-Deklination: den Paketboten, UniMorph даёт винительный без -n',
    // спор -es против -s, см. KNOWN_GEN выше: источник держится книжного варианта
    Bescheid: 'приняты обе: des Bescheids и des Bescheides',
    Zuschlag: 'то же',
    Facharzt: 'то же',
    Hautarzt: 'то же',
    Osterei: 'то же',
    Kilo: 'UniMorph даёт несклоняемое, разговорные Kilos приняты',
    Aufenthaltstitel: 'в UniMorph без окончания, но Titel склоняется',
    Post: 'в UniMorph мужской омоним der Post «должность», у нас die Post «почта»',
  }
  const bad: string[] = []
  const diverged = new Set<string>()
  let checked = 0
  for (const n of bundle.nouns) {
    const want = decl[n.w]
    if (!want) continue
    for (const [cell, kase, num] of CELLS) {
      const forms = want[cell]
      if (!forms?.length) continue
      const got = nounForm(n, kase, num)
      if (got === null) continue
      checked++
      if (forms.includes(got)) continue
      diverged.add(n.w)
      if (!(n.w in KNOWN_DECL)) bad.push(`${n.w} ${cell}: ${got} ∉ ${forms.join(' / ')}`)
    }
  }
  it('формы совпадают, кроме известных расхождений', () => {
    expect(bad).toEqual([])
    expect(checked).toBeGreaterThan(5000)
  })

  it('в списке исключений нет устаревших записей', () => {
    expect(Object.keys(KNOWN_DECL).filter((w) => !diverged.has(w))).toEqual([])
  })
})

/** Степени сравнения против UniMorph. В SPRL источник уже даёт форму с «am». */
describe('степени сравнения против UniMorph', () => {
  const deg = degrees_fixture as Record<string, Record<string, string[]>>
  /**
   * ⚠ Все расхождения одного вида: причастия на -ert/-egt/-etet. Duden допускает оба
   * варианта («am begeistertsten» и «am begeistertesten»), источник держится краткого.
   * Это спор по норме, а не ошибка вывода, поэтому в коде ничего не меняем.
   */
  const KNOWN_DEG: Record<string, string> = {
    begeistert: 'причастие на -ert: приняты обе формы',
    verärgert: 'то же',
    verzweifelt: 'то же',
    gepflegt: 'то же, причастие на -egt',
    ungepflegt: 'то же',
    berechtigt: 'то же',
    unberechtigt: 'то же',
    veraltet: 'то же, причастие на -etet',
  }
  const bad: string[] = []
  const diverged = new Set<string>()
  let checked = 0
  for (const a of bundle.adjs) {
    const want = deg[a.w]
    if (!want) continue
    for (const [cell, got] of [
      ['cmpr', comparative(a)],
      ['sprl', superlative(a)],
    ] as [string, string][]) {
      const forms = want[cell]
      if (!forms?.length) continue
      checked++
      if (forms.includes(got)) continue
      diverged.add(a.w)
      if (!(a.w in KNOWN_DEG)) bad.push(`${a.w} ${cell}: ${got} ∉ ${forms.join(' / ')}`)
    }
  }
  it('формы совпадают, кроме известных расхождений', () => {
    expect(bad).toEqual([])
    expect(checked).toBeGreaterThan(300)
  })

  it('в списке исключений нет устаревших записей', () => {
    expect(Object.keys(KNOWN_DEG).filter((w) => !diverged.has(w))).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { bundle, words } from './data.ts'
import { explainItem } from './explain.ts'
import { fillingFor, generate, itemsFor, second } from './generate.ts'
import {
  adjEndingMatches,
  formMatches,
  GOV_PREPS,
  govexParts,
  govOf,
  inventory,
  possessive,
} from './paradigms.ts'

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

  // ⚠ Бейдж над фразой («die Auskunft») называет род, а значит и ответ, когда ответ —
  // это артикль в именительном. Так жило правило «Nominativ: подлежащее»: угадать можно
  // было, не читая фразу. Проверка структурная, чтобы следующий такой шаблон поймался сам.
  it('подсказка над фразой не называет ответ', () => {
    const bad = all
      .filter((i) => i.ctx.badge && i.ctx.badge.toLowerCase() === i.answer.toLowerCase())
      .map((i) => `${i.templateId} × ${i.word}: ${i.ctx.badge} при ответе ${i.answer}`)
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

// ⚠ Шаблон, у которого ответ один на всё наполнение, ничему не учит: со второго
// задания его дают не читая фразу. Таких было девятнадцать, и нашлись они только
// разбором соседних приложений. Проверка постоянная, чтобы класс не вернулся молча.
describe('ответ зависит от слова', () => {
  // Исключения — там, где постоянный ответ и ЕСТЬ правило. Каждое с причиной.
  const KNOWN: Record<string, string> = {
    'merge-wo-in': 'пара im/ins и есть правило: человек читает вопрос, а не слово',
    'merge-wohin-in': 'то же',
    'nicht-kein-mit': 'выбор виден только из пары шаблонов: с артиклем всегда nicht',
    'passiv-das': 'подлежащее «Das» единственного числа, отсюда всегда wird',
    'adj-nom-ding': 'после der окончание -e во всех трёх родах — это и есть правило',
    'adj-plural-die': 'во множественном после артикля всегда -en',
    'adj-dat-en-neu': 'в Dativ окончание -en во всех родах',
    'adj-dat-en-klein': 'то же',
    'perfekt-aux-action': 'работы по дому все переходные, отсюда habe. Перекос лексикона',
    'verb-prep-ding': 'одно слово в наполнении: hängen',
    // рамки, добавленные НАРОЧНО как вторая половина факта: каждая внутри себя
    // постоянна, а правило целиком благодаря им перестало быть константой
    'adj-nom-plural': 'во множественном после артикля всегда -en — это и есть контраст к -e',
    'adj-plural-ohne': 'без артикля во множественном всегда -e — контраст к -en',
    'passiv-plural': 'подлежащее во множественном, отсюда всегда werden — контраст к wird',
  }
  const share = (t: (typeof bundle.templates)[number]) => {
    const its = itemsFor(t, words)
    if (!its.length) return 0
    const freq = new Map<string, number>()
    for (const i of its) freq.set(i.answer, (freq.get(i.answer) ?? 0) + 1)
    return Math.max(...freq.values()) / its.length
  }
  // ввод проверяется тоже: постоянный ответ бесполезен и там
  const constant = bundle.templates.filter((t) => share(t) > 0.95)

  it('ответ не бывает одним на весь шаблон, кроме объяснённых случаев', () => {
    expect(constant.filter((t) => !(t.id in KNOWN)).map((t) => t.id)).toEqual([])
  })

  it('в списке исключений нет устаревших записей', () => {
    const ids = new Set(constant.map((t) => t.id))
    expect(Object.keys(KNOWN).filter((id) => !ids.has(id))).toEqual([])
  })

  // ⚠ Главная проверка — не по шаблону, а по ПРАВИЛУ. Шаблон вправе иметь один ответ,
  // если правило в целом заставляет выбирать: «Das wird …» против «Die Sachen werden …»
  // — внутри каждой рамки ответ постоянный, а правило работает. А вот правило
  // с единственным ответом на всё наполнение не тренирует ничего, сколько бы заданий
  // оно ни давало: единица повтора — правило, и именно его человек «знает».
  describe('по правилу', () => {
    const RULE_KNOWN: Record<string, string> = {
      'adj-dat-en': 'в Dativ слабое окончание -en во всех родах и числах — факт и есть урок',
    }
    const byRule = new Map<string, Map<string, number>>()
    for (const t of bundle.templates) {
      const freq = byRule.get(t.rule) ?? new Map<string, number>()
      for (const i of itemsFor(t, words)) freq.set(i.answer, (freq.get(i.answer) ?? 0) + 1)
      byRule.set(t.rule, freq)
    }
    const constant = [...byRule.entries()]
      .filter(([, freq]) => {
        const n = [...freq.values()].reduce((a, b) => a + b, 0)
        return n > 0 && Math.max(...freq.values()) / n > 0.95
      })
      .map(([rule]) => rule)

    it('у правила ответ не бывает одним на всё наполнение', () => {
      expect(constant.filter((r) => !(r in RULE_KNOWN))).toEqual([])
    })

    it('в списке исключений нет устаревших записей', () => {
      expect(Object.keys(RULE_KNOWN).filter((r) => !constant.includes(r))).toEqual([])
    })
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

  it('ein-слова склоняются по одной таблице', () => {
    expect(inventory('kein_article').sort()).toEqual([
      'kein',
      'keine',
      'keinem',
      'keinen',
      'keiner',
      'keines',
    ])
    expect(possessive('dat', 'f')).toBe('meiner')
    expect(possessive('nom', 'm')).toBe('mein')
    expect(formMatches('possessive', 'meine')).toEqual([
      { case: 'nom', gender: 'f' },
      { case: 'nom', gender: 'pl' },
      { case: 'akk', gender: 'f' },
      { case: 'akk', gender: 'pl' },
    ])
  })

  it('обратный разбор артикля: den — Akkusativ мужского или Dativ множественного', () => {
    expect(formMatches('def_article', 'den')).toEqual([
      { case: 'akk', gender: 'm' },
      { case: 'dat', gender: 'pl' },
    ])
    expect(formMatches('merged_prep_article', 'im', { prep: 'in' })).toEqual([
      { case: 'dat', gender: 'm' },
      { case: 'dat', gender: 'n' },
    ])
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

describe('второе слово', () => {
  const adj = bundle.templates.find((t) => t.id === 'adj-nom-ding')!

  it('выводится из пары, а не выбирается случайно', () => {
    const w = fillingFor(adj, words)[0]!
    expect(second(adj, w, words)?.w).toBe(second(adj, w, words)?.w)
    expect(generate(adj, w, words).word2).toBeTruthy()
  })

  it('окончание согласуется с первым словом, а второе даёт лексику', () => {
    const w = words.find((x) => x.w === 'Straße')!
    const i = generate(adj, w, words)
    expect(i.answer).toBe('e')
    expect(i.full).toMatch(/^Wo ist die \w+e Straße\?$/)
  })

  it('без списка слов задание с fill2 не собирается молча', () => {
    const w = fillingFor(adj, words)[0]!
    expect(generate(adj, w, []).full).not.toContain('{w2}')
  })
})

describe('конкретные задания', () => {
  const item = (tid: string, lemma: string) => {
    const t = bundle.templates.find((x) => x.id === tid)!
    const w = words.find((x) => x.w === lemma)!
    return generate(t, w, words)
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

  it('управление: в пропуске предлог, дополнение приходит из записи', () => {
    const i = item('verb-prep-ich', 'warten')
    expect(i.full).toBe('Ich warte auf den Zug.')
    expect(i.answer).toBe('auf')
    expect(i.options).toHaveLength(4)
    // дистракторы — предлоги из закрытого списка управления, а не падежи
    for (const o of i.options!) expect(GOV_PREPS as readonly string[]).toContain(o)
  })

  // одна рамка на все формы глагола: пустые подстановки склеиваются, поэтому
  // отделяемый, возвратный и глагол с прямым дополнением обходятся без своих шаблонов
  it('одна рамка управления собирает приставку, sich и прямое дополнение', () => {
    expect(item('verb-prep-ich', 'einsteigen').full).toBe('Ich steige in den Zug ein.')
    expect(item('verb-prep-ich', 'überweisen').full).toBe('Ich überweise das Geld auf das Konto.')
    expect(item('verb-prep-ich', 'einreichen').full).toBe(
      'Ich reiche den Antrag bei der Firma ein.',
    )
    expect(item('verb-prep-zwei-a', 'bewerben').full).toBe('Ich bewerbe mich bei der Firma.')
  })

  // у n-склонения винительный отличается, и подлежащее съезжало в него вслед за слотом
  it('подлежащее стоит в именительном, даже когда пропуск в винительном', () => {
    expect(item('pronomen-akk-suchen', 'Automat').full).toBe(
      'Der Automat ist weg — ich suche ihn.',
    )
  })

  // ⚠ «Ich helfe den Kollegen» — тоже немецкий: у n-склонения форма слова одна
  // на единственное и множественное, а число рамка не задаёт. Такой дистрактор
  // был вторым верным ответом, и человек получал «неверно» за верный выбор.
  it('вариант, с которым фраза тоже верна, в задание не попадает', () => {
    expect(item('dativ-objekt-helfen', 'Kollege').options).not.toContain('den')
    expect(item('genitiv-besitz', 'Kollege').options).not.toContain('der')
    expect(item('possessiv-dat-mit', 'Nachbar').options).not.toContain('meinen')
  })

  it('подлежащее-не-человек получает свою рамку', () => {
    expect(item('verb-prep-ding', 'hängen').full).toBe('Das hängt an der Wand.')
  })

  // у двух предлогов верный ответ один: его задаёт дополнение из примера
  it('два предлога — два шаблона, и второй предлог всегда среди вариантов', () => {
    const a = item('verb-prep-zwei-a', 'fahren')
    const b = item('verb-prep-zwei-b', 'fahren')
    expect([a.full, a.answer]).toEqual(['Ich fahre mit dem Bus.', 'mit'])
    expect([b.full, b.answer]).toEqual(['Ich fahre nach Berlin.', 'nach'])
    expect(a.options).toContain('nach')
    expect(b.options).toContain('mit')
    expect(explainItem(b).steps.join(' ')).toContain('mit и nach')
  })

  // падеж в связке задаёт управление, а не шаблон: у слота verb_prep падежа нет вовсе,
  // и без этого разбор говорил бы «именительный» на «warten auf + Akkusativ»
  it('падеж в разборе берётся из управления, а не из шаблона', () => {
    expect(explainItem(item('verb-prep-ich', 'warten')).steps.join(' ')).toContain('винительный')
    expect(explainItem(item('verb-prep-ich', 'arbeiten')).steps.join(' ')).toContain('дательный')
  })

  it('пример управления делится по предлогу самого глагола', () => {
    expect(govexParts(['auf A'], 'das Geld auf das Konto')).toEqual({
      pre: 'das Geld',
      prep: 'auf',
      obj: 'das Konto',
      case: 'akk',
    })
    // «nach» предлог управления только у fahren: у warten его в управлении нет
    expect(govexParts(['auf A'], 'nach Berlin')).toBeNull()
  })

  it('запись управления разбирается в предлог и падеж', () => {
    expect(govOf('auf A')).toEqual({ prep: 'auf', case: 'akk' })
    expect(govOf('bei D')).toEqual({ prep: 'bei', case: 'dat' })
    // «D» без предлога — это Dativ-объект, а не предложное управление
    expect(govOf('D')).toBeNull()
  })
})

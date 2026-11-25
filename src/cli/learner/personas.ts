// Персоны симулятора. Числа — гипотеза о живом ученике: сверять с настоящим журналом
// (docs/learner-sim.md, §7), а не подбирать под желаемый результат.

import type { Level } from '../../core/types.ts'

export interface Persona {
  id: string
  /** потолок уровня в настройках приложения */
  level: Level
  /** текущая тема, меняется раз в неделю по кругу */
  themes: string[]
  /** вероятность занятия по дням недели, пн…вс */
  week: number[]
  /** вероятность пропустить неделю целиком */
  skipWeek?: number
  /** занятий в учебный день: от и до */
  sessions: [number, number]
  /** доля занятий, брошенных на середине */
  quit: number
  /** пауза между ответами, секунды */
  pause: [number, number]
  /** рост стабильности после верного ответа: S·(1 + a·(1 − R)) */
  a: number
  /** падение стабильности после ошибки: max(S·b, s0) */
  b: number
  /** стабильность после первой встречи, дни */
  s0: number
  /** ослабление заблуждения после ошибки из-за него */
  c: number
  /** подсказку открывает, когда знание ниже порога, с такой вероятностью */
  hint: { below: number; p: number }
  /** сила заблуждений, 0…1 */
  mis: Record<string, number>
  /** что ученик знал до приложения */
  before?: { levels: Level[]; s: number; ago: number; gaps: string[] }
}

const ALL = (m: number): Record<string, number> => ({
  'gender-ru': m,
  'akk-as-nom': m,
  'wechsel-dat': m,
  'gen-des': m,
  'perfekt-haben': m,
  'plural-en': m,
  'adj-e': m,
  'strong-weak': m,
  'modal-t': m,
  'n-decl-none': m,
})

export const PERSONAS: Persona[] = [
  {
    id: 'a1-new',
    level: 'A1',
    themes: ['transport', 'home', 'food', 'work', 'health', 'city'],
    week: [0.9, 0.9, 0.9, 0.9, 0.9, 0.7, 0.6],
    sessions: [1, 2],
    quit: 0.05,
    pause: [15, 40],
    a: 2,
    b: 0.6,
    s0: 1,
    c: 0.7,
    hint: { below: 0.3, p: 0.3 },
    mis: ALL(0.8),
  },
  {
    id: 'a2-back',
    level: 'A2',
    themes: ['people', 'leisure', 'travel', 'money', 'feelings', 'media'],
    week: [0.8, 0.7, 0.8, 0.7, 0.7, 0.4, 0.3],
    sessions: [1, 1],
    quit: 0.05,
    pause: [12, 30],
    a: 2.5,
    b: 0.7,
    s0: 2,
    c: 0.6,
    hint: { below: 0.2, p: 0.2 },
    mis: { ...ALL(0.2), 'gender-ru': 0.5, 'strong-weak': 0.5 },
    before: {
      levels: ['A1', 'A2'],
      s: 180,
      ago: 120,
      gaps: ['wechsel-wohin', 'adj-dat-en', 'n-deklination', 'dativ-objekt'],
    },
  },
  {
    id: 'lazy',
    level: 'A1',
    themes: ['food', 'leisure', 'clothes'],
    week: [0.5, 0.3, 0.5, 0.3, 0.4, 0.3, 0.2],
    skipWeek: 0.25,
    sessions: [1, 1],
    quit: 0.25,
    pause: [15, 50],
    a: 1.5,
    b: 0.5,
    s0: 0.7,
    c: 0.8,
    hint: { below: 0.3, p: 0.1 },
    mis: ALL(0.8),
  },
]

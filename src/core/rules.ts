// Сила правила по его доле на всём словаре (docs/rules.md): уровень не пишется руками, а считается.
export const LEVELS = ['правило', 'чаще всего', 'часто', 'редко'] as const
export type Level = (typeof LEVELS)[number]

export function level(share: number): Level {
  if (share >= 0.95) return 'правило'
  if (share >= 0.8) return 'чаще всего'
  if (share >= 0.6) return 'часто'
  return 'редко'
}

// 0.874 → «87%», 0.996 → «99.6%»: десятые — только когда целые прячут разницу с 100%
export function percent(share: number): string {
  const p = share * 100
  return p >= 99 && p < 100 ? `${p.toFixed(1)}%` : `${Math.floor(p)}%`
}

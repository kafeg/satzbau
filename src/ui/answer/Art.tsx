// Метка артикля цветом рода: der синий, die красный, das зелёный, множественное жёлтое (docs/ex-gender.md).
import { ARTICLE, type Gender } from '../../core/types.ts'

export type Tone = Gender | 'pl'

export function Art({ g, text }: { g: Tone; text?: string }) {
  return <span className={`art g-${g}`}>{text ?? (g === 'pl' ? 'die' : ARTICLE[g])}</span>
}

// Фраза с пропуском (подача «во фразе»): слово подчёркнуто; после ответа в пропуске ответ цветом, в углу — «послушать» всю фразу.
import { around } from '../../core/text.ts'
import type { Cloze } from '../../core/types.ts'
import { Art, type Tone } from './Art.tsx'
import { Say } from './Say.tsx'

export function PhrasePrompt({ cloze, art }: { cloze: Cloze; art: Tone | null }) {
  const [a, gap, rest] = around(cloze.de, cloze.gap.text, cloze.gap.nth)
  // слово ищем после пропуска: его номер среди одинаковых токенов считался от начала фразы
  let before = 0
  while (around(a, cloze.word.text, before)[1]) before++
  const [b, w, c] = around(rest, cloze.word.text, cloze.word.nth - before)
  return (
    <>
      <div className="art-line" />
      <div className="phrase">
        {a}
        {/* до ответа в пропуске нет артикля даже в разметке: его прочли бы экранный диктор и копирование */}
        {art ? <Art g={art} text={gap} /> : <span className="gap" aria-label="пропуск">{'\u00a0'.repeat(4)}</span>}
        {b}
        <u>{w}</u>
        {c}
      </div>
      <div className="ru small">{cloze.tr}</div>
      {/* в углу карточки: появившись после ответа, кнопка не сдвигает фразу */}
      {art && <Say text={cloze.de} />}
    </>
  )
}

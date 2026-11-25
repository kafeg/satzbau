// Онбординг: один экран и один вопрос. Уровень решает, какие слова и правила вообще
// покажутся, поэтому спросить его один раз дешевле, чем потом объяснять, откуда B1.

import type { Level } from '../core/types.ts'

export function Start({ onPick }: { onPick: (l?: Level) => void }) {
  return (
    <main className="home start">
      <h1>satzbau</h1>
      <p className="lead">
        Тренажёр немецкой грамматики с объяснениями через русские падежи. Работает
        без сети, прогресс остаётся на устройстве.
      </p>
      <h2 className="section">
        <span>С чего начнём</span>
      </h2>
      <div className="groups">
        {(
          [
            ['A1', 'A1', 'самое начало: артикли, предлоги, Perfekt'],
            ['A2', 'A1 и A2', 'плюс Wechselpräpositionen, слияния, прилагательные'],
            [undefined, 'всё подряд', 'ещё и B1: Genitiv, редкие слова'],
          ] as [Level | undefined, string, string][]
        ).map(([key, title, note]) => (
          <button key={title} className="rule" onClick={() => onPick(key)}>
            <span className="rule-title">{title}</span>
            <span className="rule-sub">{note}</span>
          </button>
        ))}
      </div>
      <p className="note small">
        Уровень можно поменять в любой момент — в настройках, шестерёнкой на главной.
      </p>
    </main>
  )
}

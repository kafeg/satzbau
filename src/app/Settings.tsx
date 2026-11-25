// Настройки: голос, данные, сброс прогресса. Всё, что можно потерять, спрашивает дважды.

import { useEffect, useState } from 'react'
import { getBundle } from '../core/bundle.ts'
import type { Level } from '../core/types.ts'
import { plural } from './session.ts'
import { germanVoice, germanVoices, onVoices, pickVoice, speak } from './speech.ts'
import type { Answer } from './store.ts'

// ⚠ Треугольник здесь означал «нажми — услышишь», но выглядел как индикатор
// выпадающего списка: тот же глиф, что у групп правил, в другом значении.
function Speaker() {
  return (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 6h2L8.5 3.2v9.6L5.5 10h-2z" />
      <path d="M10.6 5.6a3.4 3.4 0 0 1 0 4.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

// Уровень — потолок профиля: он меняется раз в месяцы, а чипами занимал первую строку
// главной каждый день. Поэтому он здесь, а не там.
const LEVELS: [Level | undefined, string, string][] = [
  ['A1', 'A1', 'артикли, предлоги, Perfekt'],
  ['A2', 'A1 и A2', 'плюс Wechselpräpositionen, слияния, прилагательные'],
  [undefined, 'всё подряд', 'ещё и B1: Genitiv, редкие слова'],
]

export function Settings({
  answers,
  level,
  onLevel,
  onReset,
}: {
  answers: Answer[]
  level?: Level
  onLevel: (l?: Level) => void
  onReset: () => Promise<void>
}) {
  const [, bump] = useState(0)
  const [sure, setSure] = useState(false)
  useEffect(() => onVoices(() => bump((n) => n + 1)), [])

  const voices = germanVoices()
  const current = germanVoice()
  const meta = getBundle().meta

  return (
    <main className="home">
      <h1>Настройки</h1>

      <h2 className="section">
        <span>Уровень</span>
        <span>потолок слов и правил</span>
      </h2>
      <ul className="group">
        {LEVELS.map(([key, title, note]) => (
          <li key={title}>
            <button className="grule" onClick={() => onLevel(key)}>
              <span className="rname">
                {title}
                <span className="rtheme">{note}</span>
              </span>
              {level === key && <span className="rpick">✓</span>}
            </button>
          </li>
        ))}
      </ul>

      <h2 className="section">
        <span>Озвучка</span>
        <span>{plural(voices.length, ['голос', 'голоса', 'голосов'])}</span>
      </h2>
      {voices.length === 0 ? (
        <p className="note small">
          Немецкого голоса в системе нет, поэтому кнопка озвучки в заданиях не показывается.
          На iPhone голоса ставятся в настройках системы, в разделе универсального доступа.
        </p>
      ) : (
        <>
          <ul className="group voices">
            {voices.map((v) => (
              <li key={v.name}>
                <button
                  className="grule"
                  onClick={() => {
                    pickVoice(v.name)
                    bump((n) => n + 1)
                    speak('Ich fahre mit dem Zug.')
                  }}
                >
                  <span className="rname">
                    {v.name}
                    <span className="rtheme mono">{v.lang}</span>
                  </span>
                  {current?.name === v.name && <span className="rpick">✓</span>}
                  <Speaker />
                </button>
              </li>
            ))}
          </ul>
          <p className="note small">Нажатие выбирает голос и сразу его проигрывает.</p>
        </>
      )}

      <h2 className="section">
        <span>Данные</span>
      </h2>
      <p className="panel note small">
        Версия {meta.version}, собраны {meta.built}. Слов{' '}
        {meta.counts['nouns.json']! + meta.counts['verbs.json']! + meta.counts['adjs.json']!},
        шаблонов {meta.counts['templates.json']}, правил {meta.counts['explain.json']}.
        Данные обновляются вместе с приложением: достаточно открыть его при сети.
      </p>

      <h2 className="section">
        <span>Прогресс</span>
        <span>{plural(answers.length, ['ответ', 'ответа', 'ответов'])}</span>
      </h2>
      <div className="panel stack">
        <p className="note small">
          ⚠ Сброс удаляет журнал ответов без возврата. Выгрузите его в разделе «Прогресс»,
          если хотите сохранить.
        </p>
        <div className="row-buttons">
          {sure ? (
            <>
              <button
                className="primary danger"
                onClick={() => {
                  void onReset().then(() => setSure(false))
                }}
              >
                Да, удалить всё
              </button>
              <button className="ghost" onClick={() => setSure(false)}>
                отмена
              </button>
            </>
          ) : (
            <button className="ghost" disabled={!answers.length} onClick={() => setSure(true)}>
              сбросить прогресс
            </button>
          )}
        </div>
      </div>
    </main>
  )
}

// Настройки: голос, данные, сброс прогресса. Всё, что можно потерять, спрашивает дважды.

import { useEffect, useState } from 'react'
import { getBundle } from '../core/bundle.ts'
import { go } from './route.ts'
import { plural } from './session.ts'
import { germanVoice, germanVoices, onVoices, pickVoice, speak } from './speech.ts'
import type { Answer } from './store.ts'

export function Settings({
  answers,
  onReset,
}: {
  answers: Answer[]
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
      <button className="back wide-back" onClick={() => go({ screen: 'home' })}>
        ← главная
      </button>
      <h1>Настройки</h1>

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
                  <span className="rlv">{current?.name === v.name ? '✓' : '▸'}</span>
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
      <p className="note small">
        ⚠ Сброс удаляет журнал ответов без возврата. Выгрузите его на экране «мои ошибки»,
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
    </main>
  )
}

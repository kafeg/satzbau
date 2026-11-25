// Нижняя панель разделов. Экранов стало больше, чем помещается в список ссылок
// на главной: настройки, таблицы и ошибки были страницами-сиротами, попасть в них
// можно было только с главной и только назад. На дрилле панели нет — там одно дело.

import { go, type Route } from './route.ts'

type Screen = Route['screen']

const ICON: Record<string, string> = {
  home: 'M9 6.5 17 12l-8 5.5z',
  themes: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  grammar: 'M5 7h14M5 12h14M5 17h9',
  progress: 'M6.5 18.5v-6M12 18.5V6.5M17.5 18.5v-9',
}

const TABS: { screen: Screen; label: string; fill?: boolean }[] = [
  { screen: 'home', label: 'Занятие', fill: true },
  { screen: 'themes', label: 'Темы' },
  { screen: 'grammar', label: 'Грамматика' },
  { screen: 'progress', label: 'Прогресс' },
]

/** Экран темы и слова открываются из «Тем», таблицы — из «Грамматики»: подсвечиваем раздел. */
const OWNER: Partial<Record<Screen, Screen>> = {
  theme: 'themes',
  words: 'themes',
  tables: 'grammar',
}

export function Tabs({ screen }: { screen: Screen }) {
  const active = OWNER[screen] ?? screen
  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <button
          key={t.screen}
          className={`tab${active === t.screen ? ' on' : ''}`}
          aria-current={active === t.screen ? 'page' : undefined}
          onClick={() => go({ screen: t.screen })}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d={ICON[t.screen]}
              fill={t.fill ? 'currentColor' : 'none'}
              stroke={t.fill ? 'none' : 'currentColor'}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          {t.label}
        </button>
      ))}
    </nav>
  )
}

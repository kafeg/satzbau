// Маршрут в хэше: Pages не умеет отдавать index.html на произвольный путь.
//   #/                      главная: «Заниматься» и текущая тема
//   #/themes                раздел: темы
//   #/grammar               раздел: грамматика и таблицы
//   #/progress              раздел: прогресс, ошибки, перенос
//   #/t/<тема>              экран темы
//   #/w/<тема>              новые слова темы
//   #/drill                 всё вперемешку
//   #/drill/<правило>       одно правило
//   #/drill/-/<тема>        одна тема
//   #/drill/<правило>/<тема>  правило на лексике темы

import { useEffect, useState } from 'react'

export interface Route {
  screen:
    | 'home'
    | 'themes'
    | 'grammar'
    | 'progress'
    | 'theme'
    | 'words'
    | 'drill'
    | 'tables'
    | 'settings'
  rule?: string
  theme?: string
}

const part = (x?: string) => (x && x !== '-' ? decodeURIComponent(x) : undefined)

export function parse(hash: string): Route {
  const [head, a, b] = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (head === 'drill') return { screen: 'drill', rule: part(a), theme: part(b) }
  if (head === 't' && a) return { screen: 'theme', theme: decodeURIComponent(a) }
  if (head === 'w' && a) return { screen: 'words', theme: decodeURIComponent(a) }
  // #/mistakes — прежний адрес раздела: установленная PWA могла запомнить его в хэше
  if (head === 'progress' || head === 'mistakes') return { screen: 'progress' }
  if (head === 'themes') return { screen: 'themes' }
  if (head === 'grammar') return { screen: 'grammar' }
  if (head === 'tables') return { screen: 'tables' }
  if (head === 'settings') return { screen: 'settings' }
  return { screen: 'home' }
}

export function href(route: Route): string {
  if (route.screen === 'home') return '#/'
  if (route.screen === 'progress') return '#/progress'
  if (route.screen === 'themes') return '#/themes'
  if (route.screen === 'grammar') return '#/grammar'
  if (route.screen === 'tables') return '#/tables'
  if (route.screen === 'settings') return '#/settings'
  if (route.screen === 'words') return `#/w/${encodeURIComponent(route.theme as string)}`
  if (route.screen === 'theme') return `#/t/${encodeURIComponent(route.theme as string)}`
  const rule = route.rule ? encodeURIComponent(route.rule) : '-'
  return route.theme
    ? `#/drill/${rule}/${encodeURIComponent(route.theme)}`
    : `#/drill/${route.rule ? rule : ''}`.replace(/\/$/, '')
}

export function go(route: Route): void {
  location.hash = href(route)
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash))
  useEffect(() => {
    const on = () => setRoute(parse(location.hash))
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return route
}

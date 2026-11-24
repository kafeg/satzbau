// Маршрут в хэше: Pages не умеет отдавать index.html на произвольный путь.
//   #/                      главная
//   #/t/<тема>              экран темы
//   #/drill                 всё вперемешку
//   #/drill/<правило>       одно правило
//   #/drill/-/<тема>        одна тема
//   #/drill/<правило>/<тема>  правило на лексике темы

import { useEffect, useState } from 'react'

export interface Route {
  screen: 'home' | 'theme' | 'drill'
  rule?: string
  theme?: string
}

const part = (x?: string) => (x && x !== '-' ? decodeURIComponent(x) : undefined)

export function parse(hash: string): Route {
  const [head, a, b] = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (head === 'drill') return { screen: 'drill', rule: part(a), theme: part(b) }
  if (head === 't' && a) return { screen: 'theme', theme: decodeURIComponent(a) }
  return { screen: 'home' }
}

export function href(route: Route): string {
  if (route.screen === 'home') return '#/'
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

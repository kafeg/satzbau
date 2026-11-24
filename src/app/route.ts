// Маршрут в хэше: Pages не умеет отдавать index.html на произвольный путь.
//   #/            главная
//   #/drill       всё вперемешку
//   #/drill/<rule>  одно правило

import { useEffect, useState } from 'react'

export interface Route {
  screen: 'home' | 'drill'
  rule?: string
}

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] !== 'drill') return { screen: 'home' }
  return { screen: 'drill', rule: parts[1] ? decodeURIComponent(parts[1]) : undefined }
}

export function go(route: Route): void {
  location.hash = route.screen === 'home'
    ? '#/'
    : `#/drill${route.rule ? `/${encodeURIComponent(route.rule)}` : ''}`
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

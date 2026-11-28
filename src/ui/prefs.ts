// Выбор пользователя и мелкие флаги в localStorage (`satzbau.*`) — удобство, а не прогресс: не запомнилось — по умолчанию.
export function saved(key: string): string | null {
  try {
    return localStorage.getItem(`satzbau.${key}`)
  } catch {
    return null
  }
}

export function save(key: string, v: string) {
  try {
    localStorage.setItem(`satzbau.${key}`, v)
  } catch {
    // просто не запомнится
  }
}

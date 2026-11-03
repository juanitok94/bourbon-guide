// localStorage that never throws. Private modes, blocked site data and SSR all fall back to "nothing stored".
// Use only for per-viewer conveniences (a remembered filter); the page must work without it.
export function safeGet(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSet(key: string, value: string | null): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

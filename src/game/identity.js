const KEY = 'spotted.identity'

export function getIdentity() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setIdentity({ username, birthYear, playerId }) {
  const id = { username, birthYear: birthYear || null, playerId: playerId || null }
  try {
    localStorage.setItem(KEY, JSON.stringify(id))
  } catch {
    /* storage unavailable */
  }
  return id
}

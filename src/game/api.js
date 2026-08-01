async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`api ${path} ${res.status}`)
  return res.json()
}

export async function upsertPlayer(username, birthYear) {
  const p = await post('/api/players', { username, birth_year: birthYear })
  return { username: p.username, birthYear: p.birth_year, playerId: p.id }
}

export async function submitSession({ playerId, score, wave, kills, durationS }) {
  return post('/api/sessions', {
    player_id: playerId,
    score,
    wave,
    kills,
    duration_s: durationS
  })
}

export async function fetchLeaderboard(limit = 5) {
  const res = await fetch(`/api/leaderboard?limit=${limit}`)
  if (!res.ok) throw new Error(`api leaderboard ${res.status}`)
  return res.json()
}

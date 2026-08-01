import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

function validateUsername(u) {
  return typeof u === 'string' && u.trim().length >= 2 && u.trim().length <= 24
}
function validateYear(y) {
  if (y === undefined || y === null || y === '') return null
  const n = Number(y)
  if (!Number.isInteger(n) || n < 1900 || n > new Date().getFullYear()) return null
  return n
}

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const username = body?.username?.trim()
  if (!validateUsername(username)) {
    return NextResponse.json({ error: 'username must be 2-24 characters' }, { status: 400 })
  }
  const birthYear = validateYear(body?.birth_year)
  try {
    const { rows } = await query(
      `INSERT INTO players (username, birth_year, last_seen)
       VALUES ($1, $2, now())
       ON CONFLICT (username) DO UPDATE SET
         birth_year = COALESCE(EXCLUDED.birth_year, players.birth_year),
         last_seen = now()
       RETURNING id, username, birth_year`,
      [username, birthYear]
    )
    return NextResponse.json(rows[0])
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

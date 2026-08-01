import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const { player_id, score, wave, kills, duration_s } = body || {}
  if (!Number.isInteger(player_id) || !Number.isInteger(score)) {
    return NextResponse.json({ error: 'player_id and score are required' }, { status: 400 })
  }
  try {
    const { rows } = await query(
      `INSERT INTO sessions (player_id, score, wave, kills, duration_s)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [player_id, Math.max(0, score), Math.max(0, wave | 0), Math.max(0, kills | 0), Math.max(0, duration_s | 0)]
    )
    return NextResponse.json(rows[0])
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

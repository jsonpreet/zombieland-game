import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req, { params }) {
  const { username } = await params
  try {
    const { rows } = await query(
      `SELECT s.score, s.wave, s.kills, s.duration_s, s.created_at
       FROM sessions s
       JOIN players p ON p.id = s.player_id
       WHERE p.username = $1
       ORDER BY s.created_at DESC
       LIMIT 100`,
      [username]
    )
    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

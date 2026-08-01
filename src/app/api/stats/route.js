import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  try {
    const { rows } = await query(
      `SELECT
        (SELECT COUNT(*) FROM players) AS total_players,
        (SELECT COUNT(*) FROM players WHERE last_seen > now() - interval '3 minutes') AS online_players,
        (SELECT COUNT(*) FROM sessions) AS total_sessions,
        (SELECT COALESCE(SUM(kills), 0) FROM sessions) AS total_kills,
        (SELECT COALESCE(SUM(score), 0) FROM sessions) AS total_score`
    )
    return NextResponse.json(rows[0])
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

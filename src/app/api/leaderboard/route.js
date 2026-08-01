import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req) {
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 10))
  try {
    const { rows } = await query(
      `SELECT p.username, p.birth_year,
              MAX(s.score) AS best,
              MAX(s.wave) AS best_wave,
              COUNT(s.id) AS runs
       FROM players p
       LEFT JOIN sessions s ON s.player_id = p.id
       GROUP BY p.id, p.username, p.birth_year
       HAVING COUNT(s.id) > 0
       ORDER BY best DESC
       LIMIT $1`,
      [limit]
    )
    const year = new Date().getFullYear()
    return NextResponse.json(rows.map((r) => ({ ...r, age: r.birth_year ? year - r.birth_year : null })))
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

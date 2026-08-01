import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const { player_id } = body || {}
  if (!Number.isInteger(player_id)) {
    return NextResponse.json({ error: 'player_id required' }, { status: 400 })
  }
  try {
    await query('UPDATE players SET last_seen = now() WHERE id = $1', [player_id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export async function GET() {
  try {
    await getPool().query('SELECT 1')
    return NextResponse.json({ ok: true, db: 'connected' })
  } catch (err) {
    return NextResponse.json({ ok: false, db: 'unreachable', error: err.message }, { status: 503 })
  }
}

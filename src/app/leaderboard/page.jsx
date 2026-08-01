'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useHeartbeat } from '../../hooks/useHeartbeat.js'

function timeAgo(iso) {
  if (!iso) return '-'
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState(null)
  useHeartbeat()

  useEffect(() => {
    let live = true
    const load = () => {
      fetch('/api/leaderboard?limit=50')
        .then((r) => r.json())
        .then((d) => live && Array.isArray(d) && setRows(d))
        .catch(() => {})
      fetch('/api/stats')
        .then((r) => r.json())
        .then((d) => live && setStats(d))
        .catch(() => {})
    }
    load()
    const t = setInterval(load, 20000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [])

  return (
    <div className="lb-page">
      <div className="lb-head">
        <div className="lb-kicker">ZOMBIE DEEP CITY</div>
        <div className="lb-title">SURVIVOR BOARD</div>
        <div className="lb-sub">every run is recorded. seven nights to freedom.</div>
      </div>

      <div className="lb-stats">
        <div className="lb-stat">
          <div className="lb-num">{stats ? stats.total_players.toLocaleString() : '-'}</div>
          <div className="lb-label">TOTAL SURVIVORS</div>
        </div>
        <div className="lb-stat">
          <div className="lb-num">{stats ? stats.online_players : '-'}</div>
          <div className="lb-label">ONLINE NOW</div>
        </div>
        <div className="lb-stat">
          <div className="lb-num">{stats ? stats.total_sessions.toLocaleString() : '-'}</div>
          <div className="lb-label">RUNS</div>
        </div>
        <div className="lb-stat">
          <div className="lb-num">{stats ? stats.total_kills.toLocaleString() : '-'}</div>
          <div className="lb-label">DEAD KILLED</div>
        </div>
      </div>

      <div className="lb-table-wrap">
        <table className="lb-table">
          <thead>
            <tr>
              <th className="lb-r">#</th>
              <th>SURVIVOR</th>
              <th>AGE</th>
              <th>BEST SCORE</th>
              <th>NIGHT</th>
              <th>KILLS</th>
              <th>RUNS</th>
              <th className="lb-r">LAST RUN</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.username} className={r.online ? 'lb-live' : ''}>
                <td className="lb-r">{String(i + 1).padStart(2, '0')}</td>
                <td>
                  <span className="lb-name">
                    {r.online && <span className="lb-dot" title="online" />}
                    {r.username}
                  </span>
                </td>
                <td>{r.age ? `${r.age}` : '-'}</td>
                <td className="lb-score">{r.best.toLocaleString()}</td>
                <td>{r.best_wave}</td>
                <td>{Number(r.kills).toLocaleString()}</td>
                <td>{r.runs}</td>
                <td className="lb-last">{timeAgo(r.last_played)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !stats && <div className="lb-empty">loading...</div>}
        {rows.length === 0 && stats && <div className="lb-empty">no runs yet. be the first survivor.</div>}
      </div>

      <Link href="/" className="lb-back">
        BACK TO THE GAME
      </Link>
    </div>
  )
}

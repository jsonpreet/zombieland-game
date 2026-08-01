'use client'
import { useEffect, useState } from 'react'
import { useStore } from '../game/store.js'
import { store } from '../game/store.js'
import { game } from '../game/engine.js'
import { getIdentity, setIdentity } from '../game/identity.js'
import { upsertPlayer, fetchLeaderboard } from '../game/api.js'

const INTRO = [
  'the outbreak hit at midnight.',
  'the streets of the city belong to the dead now.',
  'you were lucky. you are still breathing.',
  'hold the doors, loot what you can, survive the nights.'
]

export function StartScreen() {
  const s = useStore()
  const saved = getIdentity()
  const [name, setName] = useState(saved?.username || '')
  const [year, setYear] = useState(saved?.birthYear ? String(saved.birthYear) : '')
  const [busy, setBusy] = useState(false)
  const [board, setBoard] = useState([])

  useEffect(() => {
    let live = true
    fetchLeaderboard(5)
      .then((rows) => live && setBoard(rows))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const valid = name.trim().length >= 2

  function deploy() {
    if (!valid || busy) return
    setBusy(true)
    const username = name.trim()
    const birthYear = year.trim() ? Number(year.trim()) : null
    setIdentity({ username, birthYear, playerId: saved?.playerId || null })
    upsertPlayer(username, birthYear)
      .then((p) => setIdentity({ username, birthYear: p.birthYear, playerId: p.playerId }))
      .catch(() => {})
      .finally(() => {
        setBusy(false)
        game.startGame()
      })
  }

  return (
    <div className="overlay">
      <div className="start">
        <div className="start-title">SPOTTED</div>
        <div className="start-tag">the dead remember you</div>

        <div className="start-intro">
          {INTRO.map((line, i) => (
            <div key={i} className="start-intro-line" style={{ animationDelay: `${0.4 + i * 1.1}s` }}>
              {line}
            </div>
          ))}
        </div>

        <div className="start-controls">
          <div className="start-col">
            <div><span className="kc">WASD</span> move</div>
            <div><span className="kc">SHIFT</span> sprint</div>
            <div><span className="kc">LMB</span> fire</div>
            <div><span className="kc">RMB</span> melee</div>
            <div><span className="kc">T</span> place turret</div>
          </div>
          <div className="start-col">
            <div><span className="kc">R</span> reload</div>
            <div><span className="kc">1-4</span> weapon</div>
            <div><span className="kc">5-8</span> eat / heal</div>
            <div><span className="kc">E</span> search loot</div>
            <div><span className="kc">ESC</span> pause</div>
          </div>
        </div>

        <div className="start-form">
          <label className="start-field">
            <span className="start-field-label">SURVIVOR NAME</span>
            <input
              className="start-input"
              value={name}
              maxLength={24}
              autoComplete="off"
              spellCheck={false}
              placeholder="call sign"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && deploy()}
            />
          </label>
          <label className="start-field">
            <span className="start-field-label">YEAR OF BIRTH</span>
            <input
              className="start-input"
              type="number"
              value={year}
              min={1900}
              max={new Date().getFullYear()}
              placeholder="1998"
              onChange={(e) => setYear(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && deploy()}
            />
          </label>
        </div>

        <div className="start-line">
          one city. five zones: residential, factory, railway, airport, jungle. zombies break doors down.
        </div>

        {s.highScore > 0 && <div className="start-high">HIGH SCORE {s.highScore.toLocaleString()}</div>}

        <button className={`btn btn-primary btn-lg${valid ? '' : ' btn-disabled'}`} onClick={deploy} disabled={!valid || busy}>
          {busy ? 'REGISTERING...' : 'DEPLOY'}
        </button>
        <div className="start-press">or press ENTER</div>

        {board.length > 0 && (
          <div className="start-lb">
            <div className="start-lb-head">TOP SURVIVORS</div>
            {board.map((r, i) => (
              <div key={r.username} className="start-lb-row">
                <span className="start-lb-rank">{String(i + 1).padStart(2, '0')}</span>
                <span className="start-lb-name">{r.username}</span>
                <span className="start-lb-meta">{r.age ? `${r.age}y` : ''} · night {r.best_wave}</span>
                <span className="start-lb-score">{r.best.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useStore, store } from '../game/store.js'
import { fetchLeaderboard, fetchStats } from '../game/api.js'

const ITEM_ROW = [
  ['can', 'CAN'],
  ['ration', 'RATION'],
  ['medkit', 'MEDKIT'],
  ['stim', 'STIM']
]

export function HUD() {
  const s = useStore()
  const hpPct = (s.health / s.maxHealth) * 100
  const lowHp = s.health <= 30
  const [lb, setLb] = useState([])
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let alive = true
    const load = () => {
      fetchLeaderboard(5)
        .then((d) => {
          if (alive) setLb(d)
        })
        .catch(() => {})
      fetchStats()
        .then((d) => {
          if (alive) setStats(d)
        })
        .catch(() => {})
    }
    load()
    const t = setInterval(load, 20000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  return (
    <div className="hud">
      <div className="hud-tl">
        <div className="hud-row">
          <span className="hud-key">NIGHT</span>
          <span className="hud-val">{s.wave}</span>
          <span className="hud-sep">/</span>
          <span className="hud-key">DAY</span>
          <span className="hud-val">{s.day}</span>
        </div>
        <div className="hud-row hud-dim">ZOMBIES LEFT {s.zombiesLeft}</div>
        {s.turretInv > 0 && (
          <div className="hud-row hud-dim">
            TURRETS {s.turretInv} <span className="hud-hint">[T] PLACE</span>
          </div>
        )}
        {s.powerups.double > 0 && (
          <div className="hud-row hud-amber">DOUBLE DAMAGE {Math.ceil(s.powerups.double)}s</div>
        )}
        {s.powerups.speed > 0 && (
          <div className="hud-row hud-blue">SPEED {Math.ceil(s.powerups.speed)}s</div>
        )}
      </div>

      <div className="hud-tr">
        <div className="hud-row">
          <span className="hud-key">SCORE</span>
          <span className="hud-val">{s.score.toLocaleString()}</span>
        </div>
        <div className="hud-row">
          <span className="hud-key">SCRAP</span>
          <span className="hud-val hud-amber">{s.scrap}</span>
        </div>
        <div className="hud-row">
          <span className="hud-key">KILLS</span>
          <span className="hud-val">{s.kills}</span>
        </div>
      </div>

      <div className="hud-tc">
        <span className="hud-key hud-amber">{s.zone}</span>
        <span className="hud-sep">·</span>
        <span className="hud-key">{s.muted ? 'SOUND OFF [M]' : 'SOUND ON [M]'}</span>
        <span className="hud-sep">·</span>
        <span className="hud-key">[I] BAG</span>
        <span className="hud-sep">·</span>
        <span className="hud-key">ESC PAUSE</span>
      </div>

      <div className="hud-bl">
        <div className="hud-hp-row">
          <div className={`hud-bar ${lowHp ? 'hud-bar-low' : ''}`}>
            <div className="hud-bar-fill" style={{ width: `${hpPct}%` }} />
          </div>
          <span className={`hud-hpnum ${lowHp ? 'hud-hpnum-low' : ''}`}>{s.health}</span>
          {s.shield > 0 && <span className="hud-shield">SHLD {s.shield}</span>}
        </div>
        <div className="hud-weapons">
          <span className="hud-wep-label">WHEEL</span>
          {s.owned.map((w) => (
            <span key={w} className={`hud-wep ${w === s.weaponId ? 'hud-wep-on' : ''}`}>
              {w === 'shotgun' ? 'SG' : w === 'pistol' ? 'P' : w.toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      <div className="hud-br">
        <div className="hud-ammo">
          <span className={`hud-mag ${s.reloading ? 'hud-mag-reloading' : s.mag === 0 ? 'hud-mag-empty' : ''}`}>
            {s.mag}
          </span>
          <span className="hud-reserve">/ {s.reserve}</span>
        </div>
        <div className="hud-weapon-name">{s.weaponName}</div>
        {s.reloading && (
          <div className="hud-reload">
            <div className="hud-reload-fill" style={{ width: `${s.reloadProgress * 100}%` }} />
          </div>
        )}
      </div>

      <div className="hud-bc">
        {s.nearLoot && (
          <div className="hud-prompt">
            <span className="hud-prompt-key">E</span> SEARCH
          </div>
        )}
        <div className="hud-inv">
          {ITEM_ROW.map(([id, name], i) => (
            <div key={id} className={`hud-item ${s.inv[id] > 0 ? 'hud-item-on' : ''}`}>
              <span className="hud-item-key">{i + 1}</span>
              <span className="hud-item-name">{name}</span>
              <span className="hud-item-count">{s.inv[id]}</span>
            </div>
          ))}
        </div>
      </div>

      {(s.phase === 'playing' || s.phase === 'day') && (
        <div className="hud-lb">
          <div className="hud-lb-head">TOP SURVIVORS</div>
          <div className="hud-lb-live">
            {stats ? `${stats.total_players} SURVIVORS` : '-- SURVIVORS'}
            <span className="hud-sep">·</span>
            {stats ? `${stats.online_players} ONLINE` : '-- ONLINE'}
          </div>
          {lb.length === 0 && <div className="hud-lb-row hud-lb-empty">no runs yet</div>}
          {lb.map((r, i) => (
            <div className="hud-lb-row" key={r.username}>
              <span className="hud-lb-rank">{i + 1}</span>
              {r.online && <span className="hud-lb-dot" />}
              <span className="hud-lb-name">{r.username}</span>
              <span className="hud-lb-night">N{r.best_wave}</span>
              <span className="hud-lb-score">{r.best.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

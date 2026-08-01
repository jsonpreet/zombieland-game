'use client'
import { useStore, store } from '../game/store.js'
import { game } from '../game/engine.js'
import { MODULES, CRAFTS } from '../game/constants.js'

export function ShopScreen() {
  const s = useStore()

  return (
    <div className="overlay">
      <div className="shop">
        <div className="shop-head">
          <div>
            <div className="shop-kicker">DAWN</div>
            <div className="shop-title">WORKSHOP</div>
          </div>
          <div className="shop-head-right">
            <div className="shop-stat">
              <span className="hud-key">SCRAP</span>
              <span className="shop-scrap">{s.scrap}</span>
            </div>
            <div className="shop-stat">
              <span className="hud-key">KILLS</span>
              <span>{s.kills}</span>
            </div>
          </div>
        </div>

        <div className="shop-cols">
          <div className="shop-col">
            <div className="shop-col-title">MODULES</div>
            {MODULES.map((m) => {
              const current = game.player.mods[m.id]
              const cost = m.base + m.step * current
              const maxed = current >= m.max
              const afford = s.scrap >= cost
              return (
                <div key={m.id} className="shop-row">
                  <div className="shop-row-info">
                    <div className="shop-row-name">
                      {m.name} <span className="shop-lvl">{current}/{m.max}</span>
                    </div>
                    <div className="shop-row-desc">{m.desc}</div>
                  </div>
                  <button
                    className="btn btn-sm"
                    disabled={maxed || !afford}
                    onClick={() => game.buyModule(m.id)}
                  >
                    {maxed ? 'MAX' : cost}
                  </button>
                </div>
              )
            })}
          </div>

          <div className="shop-col">
            <div className="shop-col-title">CRAFT</div>
            {CRAFTS.map((c) => {
              const owned = s.owned.includes(c.id)
              const afford = s.scrap >= c.cost
              return (
                <div key={c.id} className="shop-row">
                  <div className="shop-row-info">
                    <div className="shop-row-name">{c.name}</div>
                    <div className="shop-row-desc">{c.desc}</div>
                  </div>
                  <button
                    className="btn btn-sm"
                    disabled={owned || !afford}
                    onClick={() => game.buyCraft(c.id)}
                  >
                    {owned ? 'OWNED' : c.cost}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="shop-foot">
          <span className="shop-tip">crafted turrets deploy with [T] during the night</span>
          <button className="btn btn-primary btn-lg" onClick={() => game.startNight()}>
            NIGHT {s.wave + 1}
          </button>
        </div>
      </div>
    </div>
  )
}

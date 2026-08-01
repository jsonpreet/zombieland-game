'use client'
import { useStore } from '../game/store.js'
import { game } from '../game/engine.js'
import { WEAPONS, ORDER } from '../game/weapons.js'
import { ITEMS, ITEM_ORDER, MODULES } from '../game/constants.js'

const CONTROLS = [
  ['W A S D', 'MOVE'],
  ['MOUSE', 'AIM · LEFT FIRE · RIGHT MELEE'],
  ['SCROLL', 'SWITCH WEAPON'],
  ['1 2 3 4', 'CAN / RATION / MEDKIT / STIM'],
  ['E', 'SEARCH LOOT'],
  ['T', 'PLACE SENTRY'],
  ['R', 'RELOAD'],
  ['I', 'BAG'],
  ['M', 'SOUND'],
  ['ESC', 'PAUSE']
]

const SUPPLY_NOTE = {
  can: 'HEALS 15 HP',
  ration: 'HEALS 30 HP',
  medkit: 'HEALS 50 HP',
  stim: 'HEALS 12 HP + 5S SPEED'
}

export function InventoryScreen() {
  const s = useStore()

  return (
    <div className="overlay">
      <div className="inv">
        <div className="shop-head">
          <div>
            <div className="shop-kicker">FIELD MANUAL</div>
            <div className="shop-title">BAG</div>
          </div>
          <div className="shop-head-right">
            <div className="shop-stat">
              <span className="hud-key">SCRAP</span>
              <span className="shop-scrap">{s.scrap}</span>
            </div>
            <div className="shop-stat">
              <span className="hud-key">SCORE</span>
              <span>{s.score.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="shop-cols">
          <div className="shop-col">
            <div className="shop-col-title">WEAPONS</div>
            {ORDER.map((id) => {
              const w = WEAPONS[id]
              const owned = s.owned.includes(id)
              const am = s.mags[id]
              const current = s.weaponId === id
              return (
                <div key={id} className={`shop-row ${!owned ? 'shop-row-locked' : ''}`}>
                  <div className="shop-row-info">
                    <div className="shop-row-name">
                      {w.name} {current && <span className="shop-lvl">EQUIPPED</span>}
                    </div>
                    <div className="shop-row-desc">
                      {owned && am
                        ? `DMG ${w.dmg} · ROF ${w.rof} · MAG ${am.m}/${am.r}${w.pellets > 1 ? ` · ${w.pellets} PELLETS` : ''}${w.pierce > 0 ? ` · PIERCE ${w.pierce}` : ''}${s.ext?.[id] ? ' · EXTENDED' : ''}`
                        : 'NOT CRAFTED'}
                    </div>
                  </div>
                  <button
                    className="btn btn-sm"
                    disabled={!owned || current}
                    onClick={() => game.switchWeapon(ORDER.indexOf(id))}
                  >
                    {owned ? 'EQUIP' : '--'}
                  </button>
                </div>
              )
            })}

            <div className="shop-col-title inv-sub">MODULES</div>
            {MODULES.map((m) => (
              <div key={m.id} className="shop-row">
                <div className="shop-row-info">
                  <div className="shop-row-name">
                    {m.name} <span className="shop-lvl">{s.mods[m.id]}/{m.max}</span>
                  </div>
                  <div className="shop-row-desc">{m.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="shop-col">
            <div className="shop-col-title">SUPPLIES</div>
            {ITEM_ORDER.map((id) => {
              const it = ITEMS[id]
              const count = s.inv[id]
              const fullHp = s.health >= s.maxHealth && !it.speed
              return (
                <div key={id} className="shop-row">
                  <div className="shop-row-info">
                    <div className="shop-row-name">{it.name}</div>
                    <div className="shop-row-desc">{SUPPLY_NOTE[id]}</div>
                  </div>
                  <button
                    className="btn btn-sm"
                    disabled={count <= 0 || fullHp}
                    onClick={() => game.useItem(id)}
                  >
                    {count <= 0 ? 'EMPTY' : fullHp ? 'FULL' : `USE ×${count}`}
                  </button>
                </div>
              )
            })}

            <div className="shop-col-title inv-sub">SURVIVOR</div>
            <div className="shop-row">
              <div className="shop-row-info">
                <div className="shop-row-name">CONDITION</div>
                <div className="shop-row-desc">
                  HP {s.health}/{s.maxHealth}
                  {s.shield > 0 ? ` · SHIELD ${s.shield}` : ''}
                  {s.armor > 0 ? ` · ARMOR ${s.armor}` : ''} · KILLS {s.kills}
                </div>
              </div>
            </div>
            <div className="shop-row">
              <div className="shop-row-info">
                <div className="shop-row-name">RUN</div>
                <div className="shop-row-desc">
                  NIGHT {s.wave} · DAY {s.day} · TURRETS {s.turretInv} · BEST {s.highScore.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="shop-col-title inv-sub">CONTROLS</div>
            {CONTROLS.map(([k, v]) => (
              <div key={k} className="inv-control">
                <span className="inv-control-key">{k}</span>
                <span className="inv-control-what">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="shop-foot">
          <span className="shop-tip">scrap feeds the workshop · doors break when infested houses empty out</span>
          <button className="btn btn-primary btn-lg" onClick={() => game.toggleInventory()}>
            CLOSE [ESC]
          </button>
        </div>
      </div>
    </div>
  )
}

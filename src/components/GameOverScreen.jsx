'use client'
import { useStore, store } from '../game/store.js'
import { game } from '../game/engine.js'

export function GameOverScreen() {
  const s = useStore()
  const st = s.stats

  return (
    <div className="overlay">
      <div className="gameover">
        <div className="gameover-title">YOU DIED</div>
        <div className="gameover-sub">the dead remember you now</div>

        {s.newRecord && <div className="gameover-record">NEW RECORD</div>}

        <div className="gameover-stats">
          <div className="gameover-stat">
            <div className="gameover-num">{st.wave}</div>
            <div className="gameover-label">NIGHT</div>
          </div>
          <div className="gameover-stat">
            <div className="gameover-num">{st.kills}</div>
            <div className="gameover-label">KILLS</div>
          </div>
          <div className="gameover-stat">
            <div className="gameover-num">{st.score.toLocaleString()}</div>
            <div className="gameover-label">SCORE</div>
          </div>
          <div className="gameover-stat">
            <div className="gameover-num">{s.highScore.toLocaleString()}</div>
            <div className="gameover-label">HIGH</div>
          </div>
        </div>

        <button className="btn btn-primary btn-lg" onClick={() => game.startGame()}>
          RE-DEPLOY
        </button>
        <button className="btn-link" onClick={() => game.quitToMenu()}>
          MAIN MENU
        </button>
        <div className="start-press">or press ENTER</div>
      </div>
    </div>
  )
}

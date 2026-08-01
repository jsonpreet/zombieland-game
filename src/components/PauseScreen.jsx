'use client'
import { useStore, store } from '../game/store.js'
import { game } from '../game/engine.js'

export function PauseScreen() {
  const s = useStore()

  return (
    <div className="overlay overlay-soft">
      <div className="pause">
        <div className="pause-title">PAUSED</div>
        <button className="btn btn-primary btn-lg" onClick={() => game.togglePause()}>
          RESUME
        </button>
        <button className="btn" onClick={() => game.toggleMute()}>
          {s.muted ? 'SOUND OFF' : 'SOUND ON'}
        </button>
        <button className="btn-link" onClick={() => game.quitToMenu()}>
          ABANDON RUN
        </button>
      </div>
    </div>
  )
}

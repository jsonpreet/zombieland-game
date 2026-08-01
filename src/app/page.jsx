'use client'

import { useEffect, useRef } from 'react'
import { useStore, store } from '../game/store.js'
import { Game } from '../game/engine.js'
import { HUD } from '../components/HUD.jsx'
import { StartScreen } from '../components/StartScreen.jsx'
import { ShopScreen } from '../components/ShopScreen.jsx'
import { GameOverScreen } from '../components/GameOverScreen.jsx'
import { PauseScreen } from '../components/PauseScreen.jsx'
import { InventoryScreen } from '../components/InventoryScreen.jsx'
import { WinScreen } from '../components/WinScreen.jsx'
import { useHeartbeat } from '../hooks/useHeartbeat.js'

export default function Page() {
  const canvasRef = useRef(null)
  useHeartbeat()

  useEffect(() => {
    const g = new Game(canvasRef.current)
    if (document.fonts && document.fonts.load) {
      document.fonts.load('700 20px "Chakra Petch"')
    }
    return () => g.destroy()
  }, [])

  const s = useStore()
  const playing = s.phase === 'playing' || s.phase === 'day'

  return (
    <div className={`app ${playing ? 'app-playing' : ''}`}>
      <canvas ref={canvasRef} />
      <div className="grain" />
      {playing && <HUD />}
      {s.phase === 'menu' && <StartScreen />}
      {s.phase === 'day' && <ShopScreen />}
      {s.phase === 'over' && <GameOverScreen />}
      {s.phase === 'win' && <WinScreen />}
      {s.inventoryOpen && <InventoryScreen />}
      {s.paused && s.phase !== 'menu' && s.phase !== 'over' && s.phase !== 'win' && <PauseScreen />}
    </div>
  )
}

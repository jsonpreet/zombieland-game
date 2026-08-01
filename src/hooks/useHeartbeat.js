'use client'

import { useEffect } from 'react'
import { getIdentity } from '../game/identity.js'

export function useHeartbeat(intervalMs = 30000) {
  useEffect(() => {
    const id = getIdentity()
    if (!id?.playerId) return
    const ping = () => {
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: id.playerId })
      }).catch(() => {})
    }
    ping()
    const t = setInterval(ping, intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
}

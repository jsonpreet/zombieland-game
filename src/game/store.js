import { useSyncExternalStore } from 'react'

const listeners = new Set()

let state = {
  phase: 'menu',
  paused: false,
  inventoryOpen: false,
  health: 100,
  maxHealth: 100,
  shield: 0,
  weaponId: 'pistol',
  weaponName: 'PISTOL',
  mag: 12,
  reserve: 72,
  magSize: 12,
  reloading: false,
  reloadProgress: 0,
  owned: ['pistol'],
  mags: {},
  mods: { dmg: 0, rof: 0, hp: 0, spd: 0, reload: 0 },
  scrap: 0,
  score: 0,
  wave: 0,
  day: 0,
  zombiesLeft: 0,
  kills: 0,
  muted: false,
  turretInv: 0,
  placeMode: false,
  powerups: { double: 0, speed: 0, shieldT: 0 },
  inv: { can: 0, ration: 0, medkit: 0, stim: 0 },
  nearLoot: false,
  highScore: 0,
  stats: { wave: 0, kills: 0, score: 0 },
  newRecord: false
}

if (typeof window !== 'undefined') {
  state.highScore = Number(window.localStorage.getItem('spotted.high') || 0)
}

export const store = {
  subscribe(cb) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },
  getSnapshot() {
    return state
  },
  emit(patch) {
    state = { ...state, ...patch }
    listeners.forEach((cb) => cb())
  }
}

export function useStore() {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

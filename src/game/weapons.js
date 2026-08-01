export const WEAPONS = {
  pistol: { id: 'pistol', name: 'PISTOL', dmg: 12, pellets: 1, rof: 3.6, mag: 12, reserve: 72, reload: 1.0, spread: 0.03, bspeed: 950, pierce: 0, auto: false },
  smg: { id: 'smg', name: 'SMG', dmg: 8, pellets: 1, rof: 9.5, mag: 30, reserve: 120, reload: 1.35, spread: 0.07, bspeed: 900, pierce: 0, auto: true },
  shotgun: { id: 'shotgun', name: 'SHOTGUN', dmg: 9, pellets: 6, rof: 1.35, mag: 6, reserve: 24, reload: 1.9, spread: 0.2, bspeed: 820, pierce: 0, auto: false },
  rifle: { id: 'rifle', name: 'RIFLE', dmg: 26, pellets: 1, rof: 2.3, mag: 16, reserve: 48, reload: 1.25, spread: 0.004, bspeed: 1200, pierce: 2, auto: false },
  lmg: { id: 'lmg', name: 'LMG', dmg: 13, pellets: 1, rof: 7.5, mag: 60, reserve: 180, reload: 2.2, spread: 0.09, bspeed: 1000, pierce: 1, auto: true }
}

export const getWeapon = (id) => WEAPONS[id]

export const ORDER = ['pistol', 'smg', 'shotgun', 'rifle', 'lmg']

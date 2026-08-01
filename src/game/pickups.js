import { TAU, clamp, rand, randRange } from './utils.js'
import { getWeapon } from './weapons.js'
import { ITEMS } from './constants.js'

export function makePickup(type, x, y, val = 1) {
  return {
    type, x, y,
    val,
    r: type === 'scrap' ? 9 : 13,
    seed: rand(1000),
    magnet: false,
    t: 0
  }
}

export function updatePickups(game, dt) {
  const p = game.player
  const list = game.pickups
  for (let i = list.length - 1; i >= 0; i--) {
    const pk = list[i]
    pk.t += dt
    if (pk.type === 'item' && (p.inv[pk.val] || 0) >= 9) continue
    const dx = p.x - pk.x
    const dy = p.y - pk.y
    const d2 = dx * dx + dy * dy
    if (d2 < 130 * 130) {
      pk.magnet = true
    }
    if (pk.magnet) {
      const m = Math.sqrt(d2) || 1
      const pull = 420 * dt
      pk.x += (dx / m) * pull
      pk.y += (dy / m) * pull
      if (d2 < 30 * 30) {
        collectPickup(game, pk)
        list.splice(i, 1)
        continue
      }
    }
    if (!pk.magnet && pk.type === 'scrap' && d2 < 34 * 34) {
      collectPickup(game, pk)
      list.splice(i, 1)
    }
  }
}

function collectPickup(game, pk) {
  const p = game.player
  switch (pk.type) {
    case 'scrap':
      game.scrap += pk.val
      game.texts.add(pk.x, pk.y - 12, `+${pk.val}`, '#b98a4a', 13)
      game.audio.scrap()
      break
    case 'item': {
      p.inv[pk.val]++
      game.texts.add(pk.x, pk.y - 12, `+${ITEMS[pk.val].name}`, '#c9c4b2', 15)
      game.audio.pickup()
      break
    }
    case 'medkit':
      p.hp = clamp(p.hp + 35, 0, p.maxHp)
      game.texts.add(pk.x, pk.y - 12, '+35 HP', '#8fae5e', 15)
      game.audio.pickup()
      break
    case 'ammo': {
      const w = getWeapon(p.weaponId)
      const am = p.mags[p.weaponId] || { m: w.mag, r: w.reserve }
      const max = w.mag * 5
      am.r = clamp(am.r + 25, 0, max)
      game.texts.add(pk.x, pk.y - 12, '+AMMO', '#c9c4b2', 15)
      game.audio.pickup()
      break
    }
    case 'armor':
      p.armor = Math.min(p.armor + 1, 3)
      game.texts.add(pk.x, pk.y - 12, '+ARMOR', '#8fa0b0', 15)
      game.audio.pickup()
      break
    case 'mag': {
      const w = getWeapon(p.weaponId)
      const am = p.mags[p.weaponId] || { m: w.mag, r: w.reserve }
      if (!p.ext[p.weaponId]) {
        p.ext[p.weaponId] = true
        am.r = Math.min(am.r + Math.ceil(w.reserve * 0.5), w.reserve * 4)
        am.m = Math.min(am.m + Math.ceil(w.mag * 0.5), w.mag * 2)
        game.texts.add(pk.x, pk.y - 12, `+MAG EXT ${w.name}`, '#d9a23f', 15)
      } else {
        am.r = Math.min(am.r + 20, w.reserve * 4)
        game.texts.add(pk.x, pk.y - 12, '+AMMO', '#c9c4b2', 15)
      }
      game.audio.pickup()
      break
    }
    case 'double':
      game.powerupT.double = 10
      game.texts.add(pk.x, pk.y - 12, 'DOUBLE DAMAGE', '#d99a4a', 15)
      game.audio.pickup()
      break
    case 'speed':
      game.powerupT.speed = 8
      game.texts.add(pk.x, pk.y - 12, 'SPEED', '#9ab8c9', 15)
      game.audio.pickup()
      break
    case 'shield':
      p.shield = clamp(p.shield + 50, 0, 100)
      game.texts.add(pk.x, pk.y - 12, '+SHIELD', '#6d8aa0', 15)
      game.audio.pickup()
      break
  }
  game.emitHud()
}

export function drawPickups(ctx, game) {
  const t = performance.now() / 1000
  for (const pk of game.pickups) {
    const bob = Math.sin(t * 3 + pk.seed) * 3
    const y = pk.y + bob
    ctx.globalAlpha = 0.35
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.ellipse(pk.x, pk.y + pk.r * 0.55, pk.r * 0.9, pk.r * 0.35, 0, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 1
    if (pk.type === 'item') {
      const colors = {
        can: ['#c9a45c', '#8a6a2e'],
        ration: ['#8fae5e', '#5c7138'],
        medkit: ['#e8e4d6', '#b04a30'],
        stim: ['#d97b3f', '#8a3f1c']
      }
      const [c1, c2] = colors[pk.val]
      ctx.fillStyle = c2
      ctx.beginPath()
      ctx.ellipse(pk.x, y - 6, 9, 3.5, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = c1
      ctx.fillRect(pk.x - 9, y - 5.5, 18, 11.5)
      ctx.strokeStyle = 'rgba(20,20,14,0.7)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(pk.x - 9, y - 5.5, 18, 11.5)
      ctx.fillStyle = c2
      ctx.fillRect(pk.x - 9, y - 1, 18, 4)
      if (pk.val === 'medkit') {
        ctx.fillStyle = '#b04a30'
        ctx.fillRect(pk.x - 1.5, y - 4, 3, 8)
        ctx.fillRect(pk.x - 4, y - 1.5, 8, 3)
      }
    } else if (pk.type === 'scrap') {
      ctx.fillStyle = '#c08838'
      ctx.beginPath()
      ctx.moveTo(pk.x, y - 9)
      ctx.lineTo(pk.x + 7, y)
      ctx.lineTo(pk.x, y + 9)
      ctx.lineTo(pk.x - 7, y)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#7a5220'
      ctx.beginPath()
      ctx.moveTo(pk.x, y - 5)
      ctx.lineTo(pk.x + 4, y)
      ctx.lineTo(pk.x, y + 5)
      ctx.lineTo(pk.x - 4, y)
      ctx.closePath()
      ctx.fill()
    } else {
      const g = ctx.createRadialGradient(pk.x - 3, y - 4, 2, pk.x, y, pk.r)
      const c = {
        medkit: '#e8e4d6',
        ammo: '#c9b45c',
        double: '#d97b3f',
        speed: '#8fb3c9',
        shield: '#7d9bb3',
        armor: '#9aa8b5',
        mag: '#b58a4a'
      }
      g.addColorStop(0, '#f5f2e8')
      g.addColorStop(1, c[pk.type])
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(pk.x, y, pk.r, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = 'rgba(20,20,14,0.6)'
      ctx.lineWidth = 2
      ctx.stroke()
      if (pk.type === 'medkit') {
        ctx.fillStyle = '#8f2f22'
        ctx.fillRect(pk.x - 2, y - 6, 4, 12)
        ctx.fillRect(pk.x - 6, y - 2, 12, 4)
      } else if (pk.type === 'ammo') {
        ctx.fillStyle = '#6d5a22'
        ctx.fillRect(pk.x - 5, y - 3, 10, 6)
        ctx.fillRect(pk.x - 5, y + 1, 3, 4)
        ctx.fillRect(pk.x + 2, y + 1, 3, 4)
      } else if (pk.type === 'double') {
        ctx.fillStyle = '#7a3414'
        ctx.beginPath()
        ctx.moveTo(pk.x + 2, y - 7)
        ctx.lineTo(pk.x - 5, y + 2)
        ctx.lineTo(pk.x - 1, y + 2)
        ctx.lineTo(pk.x - 2, y + 7)
        ctx.lineTo(pk.x + 5, y - 2)
        ctx.lineTo(pk.x + 1, y - 2)
        ctx.closePath()
        ctx.fill()
      } else if (pk.type === 'speed') {
        ctx.strokeStyle = '#4a6b80'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(pk.x - 5, y + 4)
        ctx.lineTo(pk.x - 2, y - 4)
        ctx.lineTo(pk.x + 3, y - 4)
        ctx.lineTo(pk.x + 5, y + 4)
        ctx.stroke()
      } else if (pk.type === 'shield') {
        ctx.strokeStyle = '#3d5568'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(pk.x, y - 6)
        ctx.lineTo(pk.x + 6, y - 3)
        ctx.lineTo(pk.x + 5, y + 3)
        ctx.lineTo(pk.x, y + 6)
        ctx.lineTo(pk.x - 5, y + 3)
        ctx.lineTo(pk.x - 6, y - 3)
        ctx.closePath()
        ctx.stroke()
      } else if (pk.type === 'armor') {
        ctx.fillStyle = '#5c6b78'
        ctx.beginPath()
        ctx.moveTo(pk.x, y - 6)
        ctx.lineTo(pk.x + 5, y - 2)
        ctx.lineTo(pk.x + 4, y + 4)
        ctx.lineTo(pk.x, y + 7)
        ctx.lineTo(pk.x - 4, y + 4)
        ctx.lineTo(pk.x - 5, y - 2)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#aeb9c2'
        ctx.fillRect(pk.x - 1.5, y - 4, 3, 8)
      } else if (pk.type === 'mag') {
        ctx.fillStyle = '#6d5a22'
        ctx.fillRect(pk.x - 5, y - 3, 10, 6)
        ctx.fillStyle = '#8f7a3c'
        ctx.fillRect(pk.x - 5, y - 5, 10, 2)
        ctx.fillRect(pk.x - 5, y + 1, 3, 4)
        ctx.fillRect(pk.x + 2, y + 1, 3, 4)
        ctx.fillRect(pk.x - 1.5, y - 3, 3, 8)
      }
    }
  }
}

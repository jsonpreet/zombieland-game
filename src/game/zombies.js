import { TAU, clamp, rand, randRange, angDiff, dist, collideRect } from './utils.js'
import { WORLD } from './constants.js'

export const ZTYPES = {
  walker: { r: 16, hp: 42, speed: 62, dmg: 9, score: 10, scrapMin: 1, scrapMax: 2, boss: false },
  runner: { r: 13, hp: 24, speed: 158, dmg: 7, score: 15, scrapMin: 1, scrapMax: 1, boss: false },
  brute: { r: 27, hp: 210, speed: 46, dmg: 22, score: 50, scrapMin: 6, scrapMax: 10, boss: false },
  boss: { r: 46, hp: 1500, speed: 54, dmg: 30, score: 500, scrapMin: 50, scrapMax: 70, boss: true }
}

const SKIN = {
  walker: { body: '#74804f', bodyD: '#5a633c', head: '#85915c', arm: '#6d7850', eye: '#1b1c12' },
  runner: { body: '#85806a', bodyD: '#6a654f', head: '#94907c', arm: '#7d7863', eye: '#22220f' },
  brute: { body: '#4c5236', bodyD: '#3a3f28', head: '#565c3e', arm: '#454a30', eye: '#d9a23f' },
  boss: { body: '#44492f', bodyD: '#34381f', head: '#4b5134', arm: '#3e4329', eye: '#e0a63c' }
}

export function spawnZombie(type, x, y, wave, game) {
  const t = ZTYPES[type]
  const scale = 1 + (wave - 1) * 0.13
  const speedMul = 1 + Math.min((wave - 1) * 0.02, 0.35)
  const z = {
    type,
    x, y,
    r: t.r,
    hp: t.hp * scale,
    maxHp: t.hp * scale,
    speed: t.speed * speedMul * randRange(0.92, 1.08),
    dmg: t.dmg * (1 + wave * 0.06),
    score: t.score,
    scrapMin: t.scrapMin,
    scrapMax: t.scrapMax,
    boss: t.boss,
    angle: randRange(0, TAU),
    seed: rand(1000),
    atkCd: randRange(0.2, 0.8),
    flash: 0,
    kbx: 0,
    kby: 0,
    wanderA: randRange(0, TAU),
    wanderT: 0,
    bob: randRange(0, TAU)
  }
  if (t.boss) {
    z.hp = 1500 + wave * 220
    z.maxHp = z.hp
    z.dmg = 30 + wave * 2.5
    z.score = 500 + wave * 50
  }
  return z
}

export function updateZombie(z, dt, game) {
  z.flash = Math.max(0, z.flash - dt * 5)
  z.kbx *= 1 - dt * 6
  z.kby *= 1 - dt * 6
  z.atkCd -= dt

  let tx, ty
  let targetTurret = null
  if (game.phase === 'menu') {
    z.wanderT -= dt
    if (z.wanderT <= 0) {
      z.wanderT = randRange(2, 5)
      z.wanderA = randRange(0, TAU)
    }
    tx = z.x + Math.cos(z.wanderA) * 200
    ty = z.y + Math.sin(z.wanderA) * 200
  } else {
    for (const tu of game.turrets) {
      const dTu = dist(z.x, z.y, tu.x, tu.y)
      if (dTu < 95) {
        const dP = dist(z.x, z.y, game.player.x, game.player.y)
        if (dTu < dP * 1.2) {
          targetTurret = tu
          break
        }
      }
    }
    const target = targetTurret || game.player
    if (!targetTurret && z.home && !(game.player.x > z.home.x && game.player.x < z.home.x + z.home.w && game.player.y > z.home.y && game.player.y < z.home.y + z.home.h)) {
      if (!z._wander) z._wander = randRange(0, TAU)
      z.wanderT -= dt
      if (z.wanderT <= 0) {
        z.wanderT = randRange(2, 4)
        z._wander = randRange(0, TAU)
      }
      tx = clamp(z.x + Math.cos(z._wander) * 140, z.home.x + 34, z.home.x + z.home.w - 34)
      ty = clamp(z.y + Math.sin(z._wander) * 140, z.home.y + 34, z.home.y + z.home.h - 34)
    } else {
      tx = target.x
      ty = target.y
    }

    if (targetTurret) {
      const dTu = dist(z.x, z.y, targetTurret.x, targetTurret.y)
      if (dTu < z.r + 34) {
        if (z.atkCd <= 0) {
          z.atkCd = 1.1
          targetTurret.hp -= z.dmg
          targetTurret.flash = 1
          game.audio.zombieHit()
          if (targetTurret.hp <= 0) game.destroyTurret(targetTurret)
        }
      }
    } else {
      const dP = dist(z.x, z.y, game.player.x, game.player.y)
      if (dP < z.r + game.player.r + 4 && game.isLOS(z.x, z.y, game.player.x, game.player.y)) {
        if (z.atkCd <= 0) {
          z.atkCd = 1
          game.damagePlayer(z.dmg, z)
        }
      }
    }
  }

  const da = angDiff(Math.atan2(ty - z.y, tx - z.x) - z.angle)
  z.angle += clamp(da, -dt * 5, dt * 5)

  if (targetTurret) {
    const dTu = dist(z.x, z.y, targetTurret.x, targetTurret.y)
    if (dTu > z.r + 30) {
      z.x += Math.cos(z.angle) * z.speed * dt
      z.y += Math.sin(z.angle) * z.speed * dt
    }
  } else {
    z.x += (Math.cos(z.angle) * z.speed + z.kbx) * dt
    z.y += (Math.sin(z.angle) * z.speed + z.kby) * dt
  }

  for (const o of game.zombies) {
    if (o === z) continue
    const dx = z.x - o.x
    const dy = z.y - o.y
    const min = z.r + o.r - 2
    const d2 = dx * dx + dy * dy
    if (d2 > 0.01 && d2 < min * min) {
      const d = Math.sqrt(d2)
      const push = (min - d) * 0.5
      z.x += (dx / d) * push
      z.y += (dy / d) * push
    }
  }

  let pnx = 0
  let pny = 0
  let hasN = false
  for (const o of game.obstacles) {
    if (o.kind === 'rect') {
      if (z.boss) continue
      const push = collideRect(z, o)
      if (push) {
        z.x += push[0]
        z.y += push[1]
        const m = Math.hypot(push[0], push[1]) || 1
        pnx = push[0] / m
        pny = push[1] / m
        hasN = true
      }
    } else {
      const dx = z.x - o.x
      const dy = z.y - o.y
      const min = z.r + o.r
      const d2 = dx * dx + dy * dy
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 1
        z.x = o.x + (dx / d) * min
        z.y = o.y + (dy / d) * min
        const m = Math.hypot(dx, dy) || 1
        pnx = dx / m
        pny = dy / m
        hasN = true
      }
    }
  }
  if (hasN) {
    const c = Math.cos(z.angle + Math.PI / 2)
    const s = Math.sin(z.angle + Math.PI / 2)
    const cross = pnx * s - pny * c
    z.angle += (cross >= 0 ? 1 : -1) * dt * 2.8
  }

  for (const b of game.buildings) {
    const pIn = game.player.x > b.x && game.player.x < b.x + b.w && game.player.y > b.y && game.player.y < b.y + b.h
    const inside = z.x > b.x && z.x < b.x + b.w && z.y > b.y && z.y < b.y + b.h
    const allowed = z.boss || b.doorBroken || z.home === b
    if (inside && !allowed) {
      const outA = b.doorSide === 0 ? -Math.PI / 2 : b.doorSide === 2 ? Math.PI / 2 : b.doorSide === 1 ? 0 : Math.PI
      z.x = b.doorX + Math.cos(outA) * (24 + z.r)
      z.y = b.doorY + Math.sin(outA) * (24 + z.r)
    }
    if (!allowed && pIn && !z.boss) {
      const doorD = dist(z.x, z.y, b.doorX, b.doorY)
      if (doorD < 130) {
        if (z.atkCd <= 0) {
          z.atkCd = 1.15
          b.doorHp -= 10
          game.particles.debris(b.doorX + (b.doorSide === 1 ? 8 : b.doorSide === 3 ? -8 : 0), b.doorY + (b.doorSide === 0 ? 8 : b.doorSide === 2 ? -8 : 0), 3, '#4a3420')
          game.audio.doorBang()
          if (b.doorHp <= 0) {
            b.doorHp = 0
            b.doorBroken = true
            game.particles.debris(b.doorX, b.doorY, 10, '#4a3420')
            game.audio.doorBreak()
          }
        }
      }
    }
  }

  z.x = clamp(z.x, 40, WORLD - 40)
  z.y = clamp(z.y, 40, WORLD - 40)
  z.bob += dt * 7
}

export function drawZombie(ctx, z, t) {
  const skin = SKIN[z.type]
  const sway = Math.sin(z.bob) * 1.5
  ctx.save()
  ctx.translate(z.x, z.y)

  ctx.globalAlpha = 0.3
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(0, z.r * 0.62, z.r * 1.15, z.r * 0.42, 0, 0, TAU)
  ctx.fill()
  ctx.globalAlpha = 1

  const lunge = clamp(Math.sin(z.bob * 0.9), 0, 0.6)
  ctx.rotate(z.angle)

  const w = z.r * 0.62
  ctx.lineCap = 'round'
  ctx.lineWidth = z.r * 0.5
  ctx.strokeStyle = skin.arm
  const armLen = z.r * 1.5 + lunge * 4
  ctx.beginPath()
  ctx.moveTo(z.r * 0.3, -w)
  ctx.lineTo(armLen, -w - lunge * 3)
  ctx.moveTo(z.r * 0.3, w)
  ctx.lineTo(armLen, w + lunge * 3)
  ctx.stroke()
  ctx.fillStyle = skin.body
  ctx.fillRect(-z.r * 0.5, -w, z.r * 1.1, w * 2)
  ctx.fillStyle = skin.bodyD
  ctx.fillRect(-z.r * 0.5, w * 0.35, z.r * 1.1, w * 0.7)

  const hb = Math.sin(z.bob) * 1.6
  const hr = z.r * 0.58
  ctx.fillStyle = skin.head
  ctx.beginPath()
  ctx.arc(z.r * 0.42, -hb, hr, 0, TAU)
  ctx.fill()
  ctx.fillStyle = skin.bodyD
  ctx.beginPath()
  ctx.arc(z.r * 0.52, -hb + hr * 0.3, hr * 0.8, 0, TAU)
  ctx.fill()
  ctx.fillStyle = skin.eye
  ctx.beginPath()
  ctx.arc(z.r * 0.75, -hb - hr * 0.25, z.r * 0.09, 0, TAU)
  ctx.arc(z.r * 0.9, -hb + hr * 0.15, z.r * 0.09, 0, TAU)
  ctx.fill()

  if (z.type === 'brute' || z.type === 'boss') {
    ctx.fillStyle = 'rgba(30,30,18,0.35)'
    ctx.beginPath()
    ctx.arc(-z.r * 0.25, -hb - hr * 0.3, hr * 0.55, 0, TAU)
    ctx.fill()
  }

  ctx.rotate(-z.angle)
  ctx.restore()

  if (z.flash > 0) {
    ctx.globalAlpha = z.flash * 0.6
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(z.x, z.y, z.r, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  if (z.boss) {
    ctx.globalAlpha = 0.55
    ctx.fillStyle = '#0d0e0a'
    ctx.fillRect(z.x - 52, z.y - z.r - 26, 104, 8)
    ctx.globalAlpha = 1
    ctx.fillStyle = '#a63a24'
    ctx.fillRect(z.x - 52, z.y - z.r - 26, (104 * z.hp) / z.maxHp, 8)
    ctx.globalAlpha = 1
  }
}

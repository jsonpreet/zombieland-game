import { rand, randRange } from './utils.js'

export class Particles {
  constructor() {
    this.list = []
  }

  blood(x, y, ang, n, speed = 1) {
    for (let i = 0; i < n; i++) {
      const a = ang + randRange(-0.9, 0.9)
      const s = randRange(70, 260) * speed
      const life = randRange(0.3, 0.7)
      this.list.push({
        type: 'blood',
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life, max: life,
        size: randRange(2, 4.5)
      })
    }
  }

  smoke(x, y, ang, n) {
    for (let i = 0; i < n; i++) {
      const a = ang + randRange(-0.5, 0.5)
      const s = randRange(40, 120)
      const life = randRange(0.15, 0.35)
      this.list.push({
        type: 'smoke',
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life, max: life,
        size: randRange(3, 6)
      })
    }
  }

  flash(x, y, ang) {
    const life = 0.06
    this.list.push({
      type: 'flash',
      x: x + Math.cos(ang) * 6,
      y: y + Math.sin(ang) * 6,
      vx: 0, vy: 0,
      life, max: life,
      size: randRange(16, 24),
      ang
    })
  }

  debris(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = randRange(0, Math.PI * 2)
      const s = randRange(60, 220)
      const life = randRange(0.3, 0.8)
      this.list.push({
        type: 'debris',
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life, max: life,
        size: randRange(2, 5),
        color,
        vr: randRange(-8, 8),
        rot: randRange(0, Math.PI * 2)
      })
    }
  }

  update(dt) {
    const l = this.list
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i]
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 1 - dt * 3
      p.vy *= 1 - dt * 3
      if (p.type === 'debris') p.rot += p.vr * dt
      p.life -= dt
      if (p.life <= 0) l.splice(i, 1)
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const t = p.life / p.max
      if (p.type === 'blood') {
        ctx.globalAlpha = t * 0.85
        ctx.fillStyle = '#6e1c12'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (0.6 + t * 0.4), 0, Math.PI * 2)
        ctx.fill()
      } else if (p.type === 'smoke') {
        ctx.globalAlpha = t * 0.3
        ctx.fillStyle = '#3a3a36'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size + (1 - t) * 5, 0, Math.PI * 2)
        ctx.fill()
      } else if (p.type === 'flash') {
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = t
        const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.size)
        g.addColorStop(0, 'rgba(255,214,150,0.9)')
        g.addColorStop(1, 'rgba(255,180,80,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalCompositeOperation = 'source-over'
      } else if (p.type === 'debris') {
        ctx.globalAlpha = t
        ctx.fillStyle = p.color
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }
    }
    ctx.globalAlpha = 1
  }
}

export class Texts {
  constructor() {
    this.list = []
  }

  add(x, y, str, color = '#c9c4b2', size = 14) {
    this.list.push({ x, y, str, color, size, life: 1.1, max: 1.1 })
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i]
      t.y -= 34 * dt
      t.life -= dt
      if (t.life <= 0) this.list.splice(i, 1)
    }
  }

  draw(ctx) {
    ctx.textAlign = 'center'
    for (const t of this.list) {
      ctx.globalAlpha = Math.min(1, t.life / 0.4)
      ctx.font = `600 ${t.size}px "Chakra Petch", sans-serif`
      ctx.fillStyle = t.color
      ctx.fillText(t.str, t.x, t.y)
    }
    ctx.globalAlpha = 1
  }
}

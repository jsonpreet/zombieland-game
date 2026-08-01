export const TAU = Math.PI * 2

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

export const lerp = (a, b, t) => a + (b - a) * t

export const rand = (a = 1) => Math.random() * a

export const randRange = (a, b) => a + Math.random() * (b - a)

export const randInt = (a, b) => Math.floor(randRange(a, b + 1))

export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by))

export const norm = (x, y) => {
  const m = Math.hypot(x, y) || 1
  return [x / m, y / m]
}

export const angDiff = (a) => {
  let d = a % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

export function collideRect(entity, o) {
  const c = Math.cos(o.rot)
  const s = Math.sin(o.rot)
  const dx = entity.x - o.x
  const dy = entity.y - o.y
  const lx = dx * c + dy * s
  const ly = -dx * s + dy * c
  const hw = o.w / 2
  const hh = o.h / 2
  const nx = clamp(lx, -hw, hw)
  const ny = clamp(ly, -hh, hh)
  let ddx = lx - nx
  let ddy = ly - ny
  const d2 = ddx * ddx + ddy * ddy
  if (d2 >= entity.r * entity.r) return null
  if (d2 < 1e-6) {
    const ox = hw - Math.abs(lx)
    const oy = hh - Math.abs(ly)
    if (ox < oy) {
      ddx = lx < 0 ? -ox : ox
      ddy = 0
    } else {
      ddx = 0
      ddy = ly < 0 ? -oy : oy
    }
  }
  const d = Math.sqrt(ddx * ddx + ddy * ddy) || 1
  const ux = ddx / d
  const uy = ddy / d
  const wx = ux * c - uy * s
  const wy = ux * s + uy * c
  return [wx * (entity.r - d), wy * (entity.r - d)]
}

export function pointInObstacle(x, y, o) {
  if (o.r) return dist2(x, y, o.x, o.y) < o.r * o.r
  const c = Math.cos(o.rot)
  const s = Math.sin(o.rot)
  const dx = x - o.x
  const dy = y - o.y
  const lx = dx * c + dy * s
  const ly = -dx * s + dy * c
  return Math.abs(lx) <= o.w / 2 && Math.abs(ly) <= o.h / 2
}

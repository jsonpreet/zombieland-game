import { clamp, lerp, rand, randRange, randInt, TAU, norm, dist, collideRect, pointInObstacle } from './utils.js'
import { WORLD, CENTER, CORE, CORE_END, ZONES, AVENUE_X, AVENUE_Y, ROAD_W, RES_STREETS, PLAYER, MELEE, TURRET, NIGHT, DOOR, DOOR_HP, DOOR_HIT, INFESTED_CHANCE, MODULES, CRAFTS, ITEMS, ITEM_ORDER, LOOT } from './constants.js'
import { Input } from './input.js'
import { AudioSys } from './audio.js'
import { spawnZombie, updateZombie, drawZombie } from './zombies.js'
import { Particles, Texts } from './particles.js'
import { makePickup, updatePickups, drawPickups } from './pickups.js'
import { getWeapon, ORDER } from './weapons.js'
import { store } from './store.js'
import { getIdentity } from './identity.js'
import { submitSession, upsertPlayer } from './api.js'

export let game = null

const T = 12
const CONTAINER_KINDS = ['crate', 'crate', 'crate', 'cabinet', 'cabinet', 'fridge']
const CAR_COLORS = ['#8a4a35', '#5d6a4c', '#4f5a68', '#6b6a60', '#75583a']
const TRAIN_COLOR = '#5a3326'
const POLE_COLORS = ['#39403a', '#333a34']

export class Game {
  constructor(canvas) {
    game = this
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.input = new Input(canvas)
    this.audio = new AudioSys()
    this.particles = new Particles()
    this.texts = new Texts()
    this.bullets = []
    this.zombies = []
    this.pickups = []
    this.turrets = []
    this.obstacles = []
    this.buildings = []
    this.containers = []
    this.cars = []
    this.streetLights = []
    this.ground = null
    this.vignette = null
    this.camera = { x: CENTER, y: CENTER }
    this.mouseWorld = { x: CENTER, y: CENTER }
    this.viewW = window.innerWidth
    this.viewH = window.innerHeight
    this.phase = 'menu'
    this.paused = false
    this.inventoryOpen = false
    this.placeMode = false
    this.shake = 0
    this.flash = 0
    this.hudTimer = 0
    this.elapsed = 0
    this.wave = 0
    this.day = 0
    this.toSpawn = 0
    this.spawnT = 0
    this.scrap = 0
    this.score = 0
    this.kills = 0
    this.banner = null
    this.bannerQ = []
    this.darkness = 0.2
    this.powerupT = { double: 0, speed: 0 }
    this.turretInv = 0
    this.highScore = store.getSnapshot().highScore
    this.near = null
    this.player = this.makePlayer()
    this.menuZombies = []
    this.initWorld()
    this.resize()
    this.bindEvents()
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
    this.emitHud()
  }

  makePlayer() {
    return {
      x: CENTER,
      y: CENTER,
      r: PLAYER.R,
      hp: 100,
      maxHp: 100,
      shield: 0,
      aim: 0,
      fireCd: 0,
      meleeCd: 0,
      recoil: 0,
      walk: 0,
      sprinting: false,
      mods: { dmg: 0, rof: 0, hp: 0, spd: 0, reload: 0 },
      owned: ['pistol'],
      weaponIdx: 0,
      weaponId: 'pistol',
      mags: { pistol: { m: 12, r: 72 } },
      reloading: false,
      reloadT: 0,
      reloadTotal: 0,
      inv: { can: 0, ration: 0, medkit: 0, stim: 0 }
    }
  }

  resetPlayer() {
    this.player = this.makePlayer()
  }

  get dmgMul() {
    return 1 + this.player.mods.dmg * 0.15
  }
  get fireMul() {
    return 1 + this.player.mods.rof * 0.1
  }
  get speedMul() {
    return 1 + this.player.mods.spd * 0.06
  }
  get reloadMul() {
    return 1 - this.player.mods.reload * 0.12
  }

  getAmmo(id) {
    const w = getWeapon(id)
    if (!this.player.mags[id]) this.player.mags[id] = { m: w.mag, r: w.reserve }
    return this.player.mags[id]
  }

  rrect(g, x, y, w, h, r) {
    g.beginPath()
    g.moveTo(x + r, y)
    g.arcTo(x + w, y, x + w, y + h, r)
    g.arcTo(x + w, y + h, x, y + h, r)
    g.arcTo(x, y + h, x, y, r)
    g.arcTo(x, y, x + w, y, r)
    g.closePath()
  }

  pointInBuilding(x, y) {
    for (const b of this.buildings) {
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true
    }
    return false
  }

  rectsNear(x, y, w, h, ox, oy, ow, oh, pad) {
    return x - pad < ox + ow + pad && x + w + pad > ox - pad && y - pad < oy + oh + pad && y + h + pad > oy - pad
  }

  pointFree(x, y) {
    if (this.pointInBuilding(x, y)) return false
    for (const o of this.obstacles) {
      if (o.kind === 'rect') {
        const c = Math.cos(o.rot)
        const s = Math.sin(o.rot)
        const dx = x - o.x
        const dy = y - o.y
        const lx = dx * c + dy * s
        const ly = -dx * s + dy * c
        if (Math.abs(lx) < o.w / 2 + 46 && Math.abs(ly) < o.h / 2 + 46) return false
      } else if (dist(x, y, o.x, o.y) < o.r + 46) {
        return false
      }
    }
    return true
  }

  isLOS(ax, ay, bx, by) {
    for (let i = 1; i < 8; i++) {
      const t = i / 8
      const x = ax + (bx - ax) * t
      const y = ay + (by - ay) * t
      for (const o of this.obstacles) {
        if (o.kind === 'rect' && !o.car && pointInObstacle(x, y, o)) return false
      }
    }
    return true
  }

  initWorld() {
    this.ground = document.createElement('canvas')
    this.ground.width = WORLD
    this.ground.height = WORLD
    this.genWorld()
  }

  genWorld() {
    const g = this.ground.getContext('2d')

    this.buildings = []
    this.obstacles = []
    this.containers = []
    this.cars = []
    this.streetLights = []

    const RING = 500
    const RING_END = 7500
    this.railRects = [
      { x: 2500, y: 4000, w: 96, h: WORLD },
      { x: RING, y: 4000, w: 96, h: RING_END - RING },
      { x: RING_END, y: 4000, w: 96, h: RING_END - RING },
      { x: 4000, y: RING, w: RING_END - RING, h: 96 },
      { x: 4000, y: RING_END, w: RING_END - RING, h: 96 },
      { x: RING, y: RING, w: 180, h: 180 },
      { x: RING_END, y: RING, w: 180, h: 180 },
      { x: RING, y: RING_END, w: 180, h: 180 },
      { x: RING_END, y: RING_END, w: 180, h: 180 }
    ]

    this.paintGround(g)
    this.paintZones(g)
    this.paintRoads(g)
    this.genBuildings(g)
    this.genStreetLights(g)
    this.genContainers(g)
    this.genOutdoorCrates(g)
    this.genCars(g)
    this.genTrees(g)

    this.obstacles = this.obstacles.filter((o) => o.kind === 'circle' || o.kind === 'rect')
    let placed = 0
    let guard = 0
    while (placed < 34 && guard < 900) {
      guard++
      const x = randRange(CORE + 120, CORE_END - 120)
      const y = randRange(CORE + 120, CORE_END - 120)
      if (dist(x, y, CENTER, CENTER) < 420) continue
      if (this.pointInBuilding(x, y)) continue
      if (this.nearRoad(x, y, 1, 1, 60) || this.nearRail(x, y, 1, 1, 60)) continue
      let bad = false
      for (const b of this.buildings) {
        if (this.rectsNear(x, y, 1, 1, b.x - 40, b.y - 40, b.w + 80, b.h + 80, 30)) {
          bad = true
          break
        }
      }
      if (bad) continue
      for (const o of this.obstacles) {
        if (o.kind === 'rect') {
          const c = Math.cos(o.rot)
          const s = Math.sin(o.rot)
          const dx = x - o.x
          const dy = y - o.y
          const lx = dx * c + dy * s
          const ly = -dx * s + dy * c
          if (Math.abs(lx) < o.w / 2 + 80 && Math.abs(ly) < o.h / 2 + 80) {
            bad = true
            break
          }
        } else if (dist(x, y, o.x, o.y) < o.r + 90) {
          bad = true
          break
        }
      }
      if (bad) continue
      const kind = randInt(0, 3)
      const r = kind === 0 ? randRange(26, 40) : kind === 1 ? randRange(22, 34) : kind === 2 ? randRange(20, 26) : randRange(30, 44)
      this.obstacles.push({ kind, x, y, r })
      placed++
      this.drawObstacle(g, kind, x, y, r)
    }

    g.strokeStyle = 'rgba(90,60,34,0.35)'
    g.lineWidth = 10
    g.strokeRect(34, 34, WORLD - 68, WORLD - 68)
  }

  paintGround(g) {
    g.fillStyle = '#191c14'
    g.fillRect(0, 0, WORLD, WORLD)
    for (let i = 0; i < 16000; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.045)'
      const s = randRange(1, 3)
      g.fillRect(randRange(0, WORLD), randRange(0, WORLD), s, s)
    }
    g.strokeStyle = 'rgba(38,44,30,0.7)'
    g.lineWidth = 1
    for (let i = 0; i < 3200; i++) {
      const x = randRange(0, WORLD)
      const y = randRange(0, WORLD)
      const a = randRange(0, TAU)
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 5)
      g.stroke()
    }
    for (let i = 0; i < 160; i++) {
      const x = randRange(0, WORLD)
      const y = randRange(0, WORLD)
      const r = randRange(30, 110)
      g.fillStyle = 'rgba(0,0,0,0.05)'
      g.beginPath()
      g.ellipse(x, y, r, r * 0.7, randRange(0, TAU), 0, TAU)
      g.fill()
    }
  }

  paintZones(g) {
    g.fillStyle = 'rgba(15,24,13,0.5)'
    g.fillRect(0, 0, CORE, WORLD)
    g.fillRect(CORE_END, 0, CORE, WORLD)
    g.fillRect(CORE, 0, WORLD - CORE * 2, CORE)
    g.fillRect(CORE, CORE_END, WORLD - CORE * 2, CORE)
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() < 0.5 ? randRange(0, CORE) + (Math.random() < 0.5 ? 0 : CORE_END) : randRange(CORE, CORE_END)
      const y = Math.random() < 0.5 ? randRange(0, CORE) + (Math.random() < 0.5 ? 0 : CORE_END) : randRange(CORE, CORE_END)
      g.fillStyle = Math.random() < 0.5 ? 'rgba(46,58,36,0.5)' : 'rgba(0,0,0,0.3)'
      const s = randRange(1, 3)
      g.fillRect(x, y, s, s)
    }
    g.fillStyle = 'rgba(46,54,34,0.16)'
    g.fillRect(ZONES.residential.x, ZONES.residential.y, ZONES.residential.w, ZONES.residential.h)
    g.fillStyle = 'rgba(36,36,30,0.3)'
    g.fillRect(ZONES.factory.x, ZONES.factory.y, ZONES.factory.w, ZONES.factory.h)
    g.fillStyle = 'rgba(40,36,28,0.2)'
    g.fillRect(ZONES.railway.x, ZONES.railway.y, ZONES.railway.w, ZONES.railway.h)
    g.fillStyle = 'rgba(30,32,27,0.32)'
    g.fillRect(ZONES.airport.x, ZONES.airport.y, ZONES.airport.w, ZONES.airport.h)
    g.fillStyle = 'rgba(44,50,36,0.25)'
    g.beginPath()
    g.arc(CENTER, CENTER, 440, 0, TAU)
    g.fill()
    g.strokeStyle = 'rgba(90,70,40,0.25)'
    g.lineWidth = 2
    g.beginPath()
    g.arc(CENTER, CENTER, 300, 0, TAU)
    g.stroke()

    g.strokeStyle = 'rgba(0,0,0,0.3)'
    g.lineWidth = 6
    for (let i = 0; i < 26; i++) {
      const a = randRange(0, TAU)
      const r = randRange(140, 260)
      g.beginPath()
      g.moveTo(CENTER + Math.cos(a) * r, CENTER + Math.sin(a) * r)
      g.lineTo(CENTER + Math.cos(a) * (r + 60), CENTER + Math.sin(a) * (r + 60))
      g.stroke()
    }

    g.fillStyle = 'rgba(0,0,0,0.18)'
    for (let i = 0; i < 40; i++) {
      g.beginPath()
      g.ellipse(randRange(ZONES.factory.x, ZONES.factory.x + ZONES.factory.w), randRange(ZONES.factory.y + 400, ZONES.factory.y + ZONES.factory.h), randRange(40, 110), randRange(20, 50), randRange(0, TAU), 0, TAU)
      g.fill()
    }
  }

  paintRoads(g) {
    const road = (x1, y1, x2, y2, center) => {
      g.strokeStyle = '#1a1d16'
      g.lineWidth = ROAD_W
      g.lineCap = 'square'
      g.beginPath()
      g.moveTo(x1, y1)
      g.lineTo(x2, y2)
      g.stroke()
      g.strokeStyle = 'rgba(255,255,255,0.05)'
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(x1, y1)
      g.lineTo(x2, y2)
      g.stroke()
      if (center) {
        g.strokeStyle = 'rgba(214,178,120,0.3)'
        g.lineWidth = 3
        g.setLineDash([16, 30])
        g.beginPath()
        g.moveTo(x1, y1)
        g.lineTo(x2, y2)
        g.stroke()
        g.setLineDash([])
      }
    }
    for (const ax of AVENUE_X) road(ax, CORE - 20, ax, CORE_END + 20, true)
    for (const ay of AVENUE_Y) road(CORE - 20, ay, CORE_END + 20, ay, true)
    for (const sx of RES_STREETS) road(sx, ZONES.residential.y + 40, sx, ZONES.residential.y + ZONES.residential.h - 40, false)
    for (const sy of RES_STREETS) road(ZONES.residential.x + 40, sy, ZONES.residential.x + ZONES.residential.w - 40, sy, false)
    g.strokeStyle = '#1a1d16'
    g.lineWidth = 60
    g.beginPath()
    g.arc(CENTER, CENTER, 440, 0, TAU)
    g.stroke()
    g.strokeStyle = 'rgba(214,178,120,0.28)'
    g.lineWidth = 3
    g.setLineDash([16, 30])
    g.beginPath()
    g.arc(CENTER, CENTER, 440, 0, TAU)
    g.stroke()
    g.setLineDash([])

    const apron = ZONES.airport
    g.fillStyle = 'rgba(34,36,30,0.85)'
    g.fillRect(4100, 4700, 2800, 150)
    g.strokeStyle = 'rgba(255,255,255,0.1)'
    g.lineWidth = 3
    g.setLineDash([26, 40])
    g.beginPath()
    g.moveTo(4100, 4775)
    g.lineTo(6900, 4775)
    g.stroke()
    g.setLineDash([])
    g.fillStyle = 'rgba(255,255,255,0.08)'
    for (let x = 4110; x < 6900; x += 60) {
      g.fillRect(x, 4700, 30, 150)
    }
    g.fillStyle = 'rgba(30,32,27,0.6)'
    g.fillRect(4100, 4900, 2800, 1600)
    g.fillStyle = 'rgba(255,255,255,0.03)'
    for (let i = 0; i < 500; i++) {
      g.fillRect(randRange(4110, 6980), randRange(4910, 6480), randRange(2, 5), randRange(2, 5))
    }

    const track = (cx, cy, len, horiz) => {
      g.fillStyle = 'rgba(26,22,16,0.9)'
      g.fillRect(cx - (horiz ? len / 2 : 48), cy - (horiz ? 48 : len / 2), horiz ? len : 96, horiz ? 96 : len)
      g.fillStyle = '#2c241a'
      for (let i = 0; i < len; i += 15) {
        g.fillRect(horiz ? cx - len / 2 + i : cx - 22, horiz ? cy - 22 : cy - len / 2 + i, 44, 8)
      }
      g.fillStyle = '#56564f'
      if (horiz) {
        g.fillRect(cx - len / 2, cy - 22, len, 4)
        g.fillRect(cx - len / 2, cy + 18, len, 4)
      } else {
        g.fillRect(cx - 24, cy - len / 2, 4, len)
        g.fillRect(cx + 20, cy - len / 2, 4, len)
      }
    }

    const tx = 2500
    const RING = 500
    const RING_END = 7500
    const SPAN = RING_END - RING
    track(tx, 4000, WORLD, false)
    track(RING, 4000, SPAN, false)
    track(RING_END, 4000, SPAN, false)
    track(4000, RING, SPAN, true)
    track(4000, RING_END, SPAN, true)
    const corners = [
      [RING, RING, 0, Math.PI / 2],
      [RING_END, RING, Math.PI / 2, Math.PI],
      [RING, RING_END, Math.PI, Math.PI * 1.5],
      [RING_END, RING_END, Math.PI * 1.5, Math.PI * 2]
    ]
    for (const [cx, cy, a0, a1] of corners) {
      g.fillStyle = 'rgba(26,22,16,0.9)'
      g.strokeStyle = 'rgba(26,22,16,0.9)'
      g.lineCap = 'square'
      g.lineWidth = 96
      g.beginPath()
      g.arc(cx, cy, 90, a0, a1)
      g.stroke()
      g.strokeStyle = '#56564f'
      g.lineWidth = 4
      g.beginPath()
      g.arc(cx, cy, 68, a0, a1)
      g.stroke()
      g.beginPath()
      g.arc(cx, cy, 112, a0, a1)
      g.stroke()
    }

    g.fillStyle = 'rgba(44,47,42,0.9)'
    g.fillRect(2300, 5380, 400, 100)
    g.fillStyle = 'rgba(255,255,255,0.06)'
    g.fillRect(2300, 5380, 400, 5)
  }

  nearRail(x, y, w, h, pad) {
    for (const r of this.railRects) {
      if (this.rectsNear(x, y, w, h, r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, pad)) return true
    }
    return false
  }

  nearRail(x, y, w, h, pad) {
    for (const r of this.railRects) {
      if (this.rectsNear(x, y, w, h, r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, pad)) return true
    }
    return false
  }

  nearRoad(x, y, w, h, pad) {
    const strip = (rx, ry, rw, rh) => this.rectsNear(x, y, w, h, rx, ry, rw, rh, pad)
    for (const ax of AVENUE_X) if (strip(ax - ROAD_W / 2, CORE - 20, ROAD_W, CORE_END - CORE + 40)) return true
    for (const ay of AVENUE_Y) if (strip(CORE - 20, ay - ROAD_W / 2, CORE_END - CORE + 40, ROAD_W)) return true
    for (const sx of RES_STREETS) if (strip(sx - 42, ZONES.residential.y, 84, ZONES.residential.h)) return true
    for (const sy of RES_STREETS) if (strip(ZONES.residential.x, sy - 42, ZONES.residential.w, 84)) return true
    return false
  }

  makeBuilding(g, x, y, w, h, style) {
    const b = { x, y, w, h, style, walls: [], infested: Math.random() < INFESTED_CHANCE, doorHp: DOOR_HP, doorBroken: false, doorSide: 0, doorD: 0, doorX: 0, doorY: 0 }
    this.buildings.push(b)
    const mk = (wx, wy, ww, wh) => {
      const r = { kind: 'rect', x: wx, y: wy, w: ww, h: wh, rot: 0 }
      this.obstacles.push(r)
      b.walls.push(r)
    }
    const side = randInt(0, 3)
    const len = side % 2 === 0 ? w : h
    const doorD = randRange(50, len - 50)
    b.doorSide = side
    b.doorD = doorD
    b.doorX = side === 0 ? x + doorD : side === 2 ? x + doorD : side === 1 ? x + w + T / 2 : x - T / 2
    b.doorY = side === 1 ? y + doorD : side === 3 ? y + doorD : side === 0 ? y - T / 2 : y + h + T / 2
    const cx = x + w / 2
    const cy = y + h / 2
    const gap = DOOR / 2
    const horiz = (yl) => mk(cx, yl, w + T, T)
    const vert = (xl) => mk(xl, cy, T, h + T)
    const segH = (yl) => {
      mk(x + (doorD - gap) / 2, yl, doorD - gap + T, T)
      mk(x + doorD + gap + (w - doorD - gap) / 2, yl, w - doorD - gap + T, T)
    }
    const segV = (xl) => {
      mk(xl, y + (doorD - gap) / 2, T, doorD - gap + T)
      mk(xl, y + doorD + gap + (h - doorD - gap) / 2, T, h - doorD - gap + T)
    }
    if (side === 0) segH(y - T / 2)
    else horiz(y - T / 2)
    if (side === 2) segH(y + h + T / 2)
    else horiz(y + h + T / 2)
    if (side === 1) segV(x + w + T / 2)
    else vert(x + w + T / 2)
    if (side === 3) segV(x - T / 2)
    else vert(x - T / 2)

    this.drawBuilding(g, b)
    return b
  }

  genBuildings(g) {
    this.makeBuilding(g, 2060, 5340, 260, 180, 'station')
    this.makeBuilding(g, 4700, 5800, 310, 230, 'hangar')
    this.makeBuilding(g, 6280, 5860, 280, 210, 'hangar')

    const layouts = [
      { zone: 'residential', n: 22, style: 'house', w: [150, 200], h: [130, 175] },
      { zone: 'residential', n: 3, style: 'block', w: [230, 310], h: [190, 250] },
      { zone: 'factory', n: 8, style: 'shed', w: [240, 340], h: [200, 280] },
      { zone: 'factory', n: 2, style: 'office', w: [280, 360], h: [220, 300] },
      { zone: 'railway', n: 4, style: 'house', w: [150, 180], h: [130, 160], eastOnly: true },
      { zone: 'airport', n: 4, style: 'shed', w: [170, 220], h: [140, 180], southOnly: true }
    ]
    for (const L of layouts) {
      const z = ZONES[L.zone]
      let placed = 0
      let guard = 0
      while (placed < L.n && guard < 3000) {
        guard++
        const w = randInt(L.w[0], L.w[1])
        const h = randInt(L.h[0], L.h[1])
        let x = randRange(z.x + 110, z.x + z.w - 110 - w)
        let y = randRange(z.y + 110, z.y + z.h - 110 - h)
        if (L.eastOnly) x = randRange(2700, z.x + z.w - 110 - w)
        if (L.southOnly) y = randRange(5100, z.y + z.h - 110 - h)
      if (dist(x + w / 2, y + h / 2, CENTER, CENTER) < 440) continue
      if (this.nearRoad(x, y, w, h, 8) || this.nearRail(x, y, w, h, 8)) continue
      let bad = false
        for (const b of this.buildings) {
          if (this.rectsNear(x, y, w, h, b.x, b.y, b.w, b.h, 130)) {
            bad = true
            break
          }
        }
        if (bad) continue
        this.makeBuilding(g, x, y, w, h, L.style)
        placed++
      }
    }
  }

  drawBuilding(g, b) {
    const bccx = b.x + b.w / 2
    const bccy = b.y + b.h / 2
    const fill = b.style === 'shed' ? '#23261d' : b.style === 'hangar' ? '#272a24' : b.style === 'block' ? '#252a20' : b.style === 'office' ? '#20242a' : '#262a20'
    g.fillStyle = fill
    g.fillRect(b.x, b.y, b.w, b.h)
    g.fillStyle = 'rgba(255,255,255,0.02)'
    for (let i = 0; i < 8; i++) {
      g.fillRect(b.x + randRange(8, b.w - 24), b.y + randRange(8, b.h - 24), randRange(10, 26), randRange(6, 14))
    }
    if (b.style === 'shed') {
      g.strokeStyle = 'rgba(0,0,0,0.18)'
      g.lineWidth = 2
      for (let sx = b.x + 14; sx < b.x + b.w; sx += 22) {
        g.beginPath()
        g.moveTo(sx, b.y + 4)
        g.lineTo(sx, b.y + b.h - 4)
        g.stroke()
      }
      g.fillStyle = 'rgba(200,210,190,0.05)'
      g.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.18, b.w * 0.6, b.h * 0.14)
    } else if (b.style === 'hangar') {
      g.strokeStyle = 'rgba(0,0,0,0.2)'
      g.lineWidth = 4
      for (let i = 0; i < 5; i++) {
        const rx = b.x + (i + 0.5) * (b.w / 5)
        g.beginPath()
        g.arc(rx, bccy, b.h * 0.5, 0, Math.PI)
        g.stroke()
      }
      g.fillStyle = 'rgba(190,196,180,0.07)'
      g.fillRect(b.x + 10, b.y + b.h - 22, b.w - 20, 12)
    } else if (b.style === 'station') {
      g.fillStyle = 'rgba(190,196,180,0.09)'
      g.fillRect(b.x, b.y + b.h - 16, b.w, 8)
      g.fillStyle = 'rgba(200,160,90,0.2)'
      g.fillRect(b.x + b.w * 0.32, b.y + 10, b.w * 0.36, 16)
    } else if (b.style === 'block') {
      g.fillStyle = 'rgba(200,210,190,0.09)'
      for (let wy = b.y + 26; wy < b.y + b.h - 20; wy += 34) {
        for (let wx = b.x + 26; wx < b.x + b.w - 22; wx += 34) {
          g.fillRect(wx, wy, 16, 20)
        }
      }
      g.fillStyle = 'rgba(190,120,60,0.4)'
      for (let wx = b.x + 26; wx < b.x + b.w - 22; wx += 34) {
        if (Math.random() < 0.2) {
          const row = b.y + 26 + randInt(0, Math.max(0, Math.floor((b.h - 46) / 34))) * 34
          g.fillRect(wx, row, 16, 20)
        }
      }
    } else if (b.style === 'office') {
      g.strokeStyle = 'rgba(140,170,190,0.16)'
      g.lineWidth = 2
      for (let wx = b.x + 24; wx < b.x + b.w; wx += 30) {
        g.beginPath()
        g.moveTo(wx, b.y + 6)
        g.lineTo(wx, b.y + b.h - 6)
        g.stroke()
      }
      for (let wy = b.y + 24; wy < b.y + b.h; wy += 30) {
        g.beginPath()
        g.moveTo(b.x + 6, wy)
        g.lineTo(b.x + b.w - 6, wy)
        g.stroke()
      }
      g.fillStyle = 'rgba(140,170,190,0.08)'
      g.fillRect(b.x + b.w * 0.28, b.y + b.h - 26, b.w * 0.44, 12)
    }
    g.fillStyle = 'rgba(0,0,0,0.1)'
    for (let i = 0; i < 4; i++) {
      const sx = b.x + randRange(10, b.w - 20)
      const sy = b.y + randRange(10, b.h - 20)
      g.beginPath()
      g.ellipse(sx, sy, randRange(12, 26), randRange(8, 18), randRange(0, TAU), 0, TAU)
      g.fill()
    }
    const gap = DOOR / 2
    let dx, dy, dw, dh
    if (b.doorSide === 0 || b.doorSide === 2) {
      const yc = b.doorSide === 0 ? b.y - 6 : b.y + b.h + 6
      dx = b.x + b.doorD - gap
      dy = yc - 6
      dw = DOOR
      dh = 12
    } else {
      const xc = b.doorSide === 1 ? b.x + b.w + 6 : b.x - 6
      dx = xc - 6
      dy = b.y + b.doorD - gap
      dw = 12
      dh = DOOR
    }
    g.fillStyle = '#3a3d32'
    g.fillRect(dx, dy, dw, dh)
    g.fillStyle = 'rgba(0,0,0,0.4)'
    g.fillRect(dx, dy, dw, 3)
    for (const wl of b.walls) {
      g.fillStyle = b.style === 'shed' ? '#41443a' : '#4a4d42'
      g.fillRect(wl.x - wl.w / 2, wl.y - wl.h / 2, wl.w, wl.h)
      g.fillStyle = 'rgba(255,255,255,0.09)'
      g.fillRect(wl.x - wl.w / 2, wl.y - wl.h / 2, wl.w, 3)
      g.fillStyle = 'rgba(0,0,0,0.45)'
      g.fillRect(wl.x - wl.w / 2, wl.y + wl.h / 2 - 2.5, wl.w, 2.5)
    }
  }

  genStreetLights(g) {
    this.streetLights = []
    const pole = (x, y) => {
      if (this.pointInBuilding(x, y)) return
      for (const b of this.buildings) {
        if (this.rectsNear(x, y, 1, 1, b.x, b.y, b.w, b.h, 16)) return
      }
      this.streetLights.push({ x, y, seed: rand(1000) })
      const c = POLE_COLORS[randInt(0, POLE_COLORS.length - 1)]
      g.fillStyle = 'rgba(0,0,0,0.35)'
      g.beginPath()
      g.ellipse(x + 2, y + 14, 8, 4, 0, 0, TAU)
      g.fill()
      g.fillStyle = c
      g.fillRect(x - 2.5, y - 22, 5, 38)
      g.fillStyle = '#3d443c'
      g.fillRect(x - 9, y - 26, 18, 6)
      g.fillStyle = '#e8b04a'
      g.beginPath()
      g.arc(x, y - 28, 3, 0, TAU)
      g.fill()
      const lg = g.createRadialGradient(x, y - 28, 3, x, y - 28, 52)
      lg.addColorStop(0, 'rgba(255,196,110,0.16)')
      lg.addColorStop(1, 'rgba(255,196,110,0)')
      g.fillStyle = lg
      g.fillRect(x - 52, y - 80, 104, 104)
    }
    let k = 0
    for (const ax of AVENUE_X) {
      for (let y = 1280; y <= 6720; y += 440) {
        pole(ax + (k % 2 ? 64 : -64), y)
        k++
      }
    }
    for (const ay of AVENUE_Y) {
      for (let x = 1280; x <= 6720; x += 440) {
        pole(x, ay + (k % 2 ? 64 : -64))
        k++
      }
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU
      pole(CENTER + Math.cos(a) * 540, CENTER + Math.sin(a) * 540)
    }
  }

  genTrees(g) {
    let placed = 0
    let guard = 0
    while (placed < 500 && guard < 3400) {
      guard++
      let x = 0
      let y = 0
      if (Math.random() < 0.5) {
        x = randRange(60, CORE - 40) + (Math.random() < 0.5 ? 0 : CORE_END + 40)
        y = randRange(60, WORLD - 60)
      } else {
        x = randRange(60, WORLD - 60)
        y = randRange(60, CORE - 40) + (Math.random() < 0.5 ? 0 : CORE_END + 40)
      }
      const r = randRange(22, 38)
      if (dist(x, y, CENTER, CENTER) < 520) continue
      if (this.nearRail(x, y, 1, 1, 60)) continue
      let bad = false
      for (const o of this.obstacles) {
        if (o.kind === 'circle' && dist(x, y, o.x, o.y) < r + o.r + 26) {
          bad = true
          break
        }
        if (o.kind === 'rect') {
          const c = Math.cos(o.rot)
          const s = Math.sin(o.rot)
          const dx = x - o.x
          const dy = y - o.y
          const lx = dx * c + dy * s
          const ly = -dx * s + dy * c
          if (Math.abs(lx) < o.w / 2 + r + 30 && Math.abs(ly) < o.h / 2 + r + 30) {
            bad = true
            break
          }
        }
      }
      if (bad) continue
      this.obstacles.push({ kind: 'circle', x, y, r, tree: true })
      placed++
      this.drawObstacle(g, 4, x, y, r)
    }
  }

  genOutdoorCrates(g) {
    const place = (x, y, r) => {
      if (this.pointInBuilding(x, y)) return
      if (this.nearRail(x, y, 1, 1, 60)) return
      for (const o of this.obstacles) {
        if (dist(x, y, o.x, o.y) < r + 40) return
      }
      this.containers.push({ kind: 'crate', x, y, r, looted: false, rare: false })
      this.obstacles.push({ kind: 'circle', x, y, r })
      this.drawCrate(g, x, y, r)
    }
    for (let i = 0; i < 14; i++) {
      place(randRange(ZONES.factory.x + 100, ZONES.factory.x + ZONES.factory.w - 100), randRange(ZONES.factory.y + 320, ZONES.factory.y + ZONES.factory.h - 100), 20)
    }
    for (let i = 0; i < 6; i++) {
      place(randRange(2600, 3800), randRange(4300, 6800), 20)
    }
    for (let i = 0; i < 5; i++) {
      place(randRange(4200, 6800), randRange(4950, 6600), 20)
    }
  }

  drawCrate(g, x, y, r) {
    g.fillStyle = 'rgba(0,0,0,0.32)'
    g.beginPath()
    g.ellipse(x + 2, y + r * 0.75, r, r * 0.4, 0, 0, TAU)
    g.fill()
    g.fillStyle = '#5a4a32'
    g.fillRect(x - r, y - r * 0.8, r * 2, r * 1.6)
    g.strokeStyle = '#3d3322'
    g.lineWidth = 2
    g.strokeRect(x - r, y - r * 0.8, r * 2, r * 1.6)
    g.fillStyle = '#46392a'
    g.fillRect(x - r, y - 2, r * 2, 4)
  }

  genContainers() {
    for (const b of this.buildings) {
      const n = b.infested ? randInt(4, 6) : randInt(2, 3)
      for (let i = 0; i < n; i++) {
        let cx = 0
        let cy = 0
        let ok = false
        for (let t = 0; t < 20 && !ok; t++) {
          cx = randRange(b.x + 36, b.x + b.w - 36)
          cy = randRange(b.y + 36, b.y + b.h - 36)
          ok = dist(cx, cy, b.doorX, b.doorY) > 75
          for (const c of this.containers) {
            if (dist(cx, cy, c.x, c.y) < 75) {
              ok = false
              break
            }
          }
        }
        if (!ok) continue
        const kind = CONTAINER_KINDS[randInt(0, CONTAINER_KINDS.length - 1)]
        const r = kind === 'crate' ? 20 : kind === 'cabinet' ? 18 : 19
        this.containers.push({ kind, x: cx, y: cy, r, looted: false, rare: b.infested })
        this.obstacles.push({ kind: 'circle', x: cx, y: cy, r })
      }
    }
  }

  genCars(g) {
    const addCar = (x, y, rot, kind, color) => {
      const hw = kind === 'car' ? 47 : kind === 'bus' ? 96 : kind === 'truck' ? 86 : kind === 'train' ? 100 : 115
      const hh = kind === 'car' ? 23 : kind === 'bus' ? 26 : kind === 'truck' ? 30 : kind === 'train' ? 22 : 30
      let bad = false
      for (let i = 0; i < 4; i++) {
        const lx = (i % 2 ? 1 : -1) * (hw + 80)
        const ly = (i < 2 ? 1 : -1) * (hh + 80)
        const wx = x + lx * Math.cos(rot) - ly * Math.sin(rot)
        const wy = y + lx * Math.sin(rot) + ly * Math.cos(rot)
        if (this.pointInBuilding(wx, wy)) {
          bad = true
          break
        }
        for (const o of this.obstacles) {
          if (o.kind === 'circle' && dist(wx, wy, o.x, o.y) < o.r + 60) {
            bad = true
            break
          }
        }
        for (const c of this.cars) {
          if (dist(wx, wy, c.x, c.y) < 150) {
            bad = true
            break
          }
        }
        if (bad) break
      }
      if (bad) return false
      const trunkX = x - hh * Math.sin(rot)
      const trunkY = y + hh * Math.cos(rot)
      const car = {
        kind,
        x, y, rot,
        w: hw * 2, h: hh * 2,
        color: color || CAR_COLORS[randInt(0, CAR_COLORS.length - 1)],
        trunkX, trunkY,
        looted: false
      }
      this.cars.push(car)
      this.obstacles.push({ kind: 'rect', x, y, w: hw * 2, h: hh * 2, rot, car: true })
      this.drawCar(g, car)
      return true
    }
    addCar(2500, 900, Math.PI / 2, 'train')
    addCar(2500, 4550, Math.PI / 2, 'train')
    addCar(2500, 5300, Math.PI / 2, 'train')
    addCar(2500, 6250, Math.PI / 2, 'train')
    addCar(2500, 6750, Math.PI / 2, 'train')
    addCar(2500, 7200, Math.PI / 2, 'train')
    addCar(500, 4000, Math.PI / 2, 'train')
    addCar(4000, 500, 0, 'train')
    addCar(5150, 5150, 0, 'plane')
    addCar(6400, 5250, 0.06, 'plane')
    const spawnIn = (z, n, rotR = () => randRange(0, TAU)) => {
      let placed = 0
      let guard = 0
      while (placed < n && guard < 600) {
        guard++
        const x = randRange(z.x + 130, z.x + z.w - 130)
        const y = randRange(z.y + 130, z.y + z.h - 130)
        if (dist(x, y, CENTER, CENTER) < 470) continue
        if (this.nearRoad(x, y, 1, 1, 30) || this.nearRail(x, y, 1, 1, 30)) continue
        if (addCar(x, y, rotR(), 'car')) placed++
      }
    }
    spawnIn(ZONES.residential, 24)
    spawnIn(ZONES.factory, 8)
    spawnIn(ZONES.railway, 4)
    spawnIn(ZONES.airport, 6)

    const roadCar = (x, y, rot) => {
      if (addCar(x, y, rot, 'car')) return
    }
    for (let i = 0; i < 6; i++) {
      roadCar(2000 + (i % 2 ? 58 : -58), randRange(2400, 6600), Math.PI / 2)
      roadCar(6000 + (i % 2 ? 58 : -58), randRange(2400, 6600), Math.PI / 2)
      roadCar(randRange(2400, 6600), 2000 + (i % 2 ? 58 : -58), 0)
      roadCar(randRange(2400, 6600), 6000 + (i % 2 ? 58 : -58), 0)
    }
    for (let i = 0; i < 4; i++) {
      addCar(2000 + (i % 2 ? 58 : -58), randRange(2600, 6600), Math.PI / 2, 'bus')
      addCar(6000 + (i % 2 ? 58 : -58), randRange(2600, 6600), Math.PI / 2, 'truck')
    }
  }

  drawCar(g, car) {
    g.save()
    g.translate(car.x, car.y)
    g.rotate(car.rot)
    const hw = car.w / 2
    const hh = car.h / 2
    g.fillStyle = 'rgba(0,0,0,0.35)'
    g.beginPath()
    g.ellipse(2, hh + 2, hw + 5, hh + 5, 0, 0, TAU)
    g.fill()
    if (car.kind === 'train') {
      g.fillStyle = '#101109'
      g.fillRect(-hw + 14, -hh + 8, hw * 2 - 28, 6)
      g.fillRect(-hw + 14, hh - 14, hw * 2 - 28, 6)
      g.fillStyle = car.color
      this.rrect(g, -hw, -hh, hw * 2, hh * 2, 4)
      g.fill()
      g.strokeStyle = 'rgba(0,0,0,0.5)'
      g.lineWidth = 2
      g.stroke()
      g.strokeStyle = 'rgba(0,0,0,0.3)'
      g.lineWidth = 3
      for (let x = -hw + 20; x < hw - 14; x += 26) {
        g.beginPath()
        g.moveTo(x, -hh + 4)
        g.lineTo(x, hh - 4)
        g.stroke()
      }
      g.fillStyle = '#8a3a2c'
      g.fillRect(-hw + 4, -hh * 0.4, 12, hh * 0.8)
      g.fillRect(hw - 16, -hh * 0.4, 12, hh * 0.8)
      g.fillStyle = '#2c2e26'
      g.fillRect(-14, hh - 10, 8, 10)
      g.fillRect(6, hh - 10, 8, 10)
      g.fillStyle = 'rgba(0,0,0,0.4)'
      g.fillRect(-hw - 4, -3, 8, 6)
      g.fillRect(hw - 4, -3, 8, 6)
    } else if (car.kind === 'plane') {
      g.fillStyle = '#8b8b82'
      g.beginPath()
      g.ellipse(0, 0, hw, hh, 0, 0, TAU)
      g.fill()
      g.fillStyle = '#5d5d55'
      g.beginPath()
      g.ellipse(-hw * 0.72, 0, hw * 0.28, hh * 0.8, 0, 0, TAU)
      g.fill()
      g.fillStyle = '#4a4a44'
      g.fillRect(-18, -hh - 16, 36, hh * 2 + 32)
      g.fillStyle = '#7a7a72'
      g.beginPath()
      g.moveTo(hw * 0.45, -6)
      g.lineTo(hw - 14, -hh * 0.9)
      g.lineTo(hw - 6, 6)
      g.lineTo(hw * 0.45, 6)
      g.fill()
      g.fillStyle = 'rgba(40,44,50,0.9)'
      for (let i = 0; i < 7; i++) {
        g.beginPath()
        g.arc(-hw * 0.15 + i * 14, -3, 2.4, 0, TAU)
        g.fill()
      }
      g.fillStyle = 'rgba(0,0,0,0.45)'
      g.fillRect(-hw + 6, -2, hw * 0.4, 4)
    } else if (car.kind === 'bus') {
      g.fillStyle = car.color
      this.rrect(g, -hw, -hh, hw * 2, hh * 2, 5)
      g.fill()
      g.strokeStyle = 'rgba(0,0,0,0.45)'
      g.lineWidth = 2
      g.stroke()
      g.fillStyle = 'rgba(210,220,210,0.16)'
      for (let wx = -hw + 18; wx < hw - 24; wx += 26) {
        g.fillRect(wx, -hh + 8, 16, hh * 2 - 16)
      }
      g.fillStyle = '#26281f'
      g.fillRect(-hw + 2, -hh, 10, hh * 2)
      g.fillStyle = 'rgba(190,196,180,0.25)'
      g.fillRect(hw - 16, -9, 14, 18)
      g.fillStyle = 'rgba(0,0,0,0.4)'
      g.fillRect(-hw + 2, -3, 8, 6)
    } else if (car.kind === 'truck') {
      g.fillStyle = '#26281f'
      this.rrect(g, -hw + 8, -hh + 2, hw - 6, hh * 2 - 4, 3)
      g.fill()
      g.fillStyle = car.color
      g.fillRect(-hw, -hh + 2, 28, hh * 2 - 4)
      g.fillStyle = 'rgba(200,210,190,0.22)'
      g.fillRect(-hw + 5, -hh + 7, 10, 9)
      g.fillRect(-hw + 5, -hh + 21, 10, 9)
      g.fillStyle = 'rgba(0,0,0,0.4)'
      g.fillRect(-hw + 14, -hh, 9, 5)
    } else {
      g.fillStyle = '#15160f'
      for (const [wx, wy] of [
        [-hw + 13, -hh + 9],
        [hw - 13, -hh + 9],
        [-hw + 13, hh - 9],
        [hw - 13, hh - 9]
      ]) {
        g.beginPath()
        g.arc(wx, wy, 7, 0, TAU)
        g.fill()
      }
      g.fillStyle = car.color
      this.rrect(g, -hw, -hh, hw * 2, hh * 2, 9)
      g.fill()
      g.strokeStyle = 'rgba(0,0,0,0.45)'
      g.lineWidth = 2
      g.stroke()
      g.fillStyle = '#262b30'
      g.fillRect(-hw + 10, -hh + 7, hw * 2 - 20, 8)
      g.fillRect(-hw + 10, hh - 15, hw * 2 - 20, 8)
      g.fillStyle = 'rgba(12,14,11,0.8)'
      g.fillRect(-hw + 10, -hh + 15, hw * 2 - 20, hh * 2 - 30)
      g.strokeStyle = 'rgba(0,0,0,0.5)'
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(-hw + 10, hh - 17)
      g.lineTo(hw - 10, hh - 17)
      g.stroke()
      g.fillStyle = '#d9c08a'
      g.fillRect(-hw + 9, -hh + 3, 8, 4)
      g.fillRect(hw - 17, -hh + 3, 8, 4)
      const hg = g.createRadialGradient(-hw + 13, -hh + 5, 2, -hw + 13, -hh + 5, 26)
      hg.addColorStop(0, 'rgba(255,214,140,0.3)')
      hg.addColorStop(1, 'rgba(255,214,140,0)')
      g.fillStyle = hg
      g.fillRect(-hw - 30, -hh - 30, 60, 60)
      const tg = g.createRadialGradient(0, hh - 4, 2, 0, hh - 4, 22)
      tg.addColorStop(0, 'rgba(200,60,40,0.32)')
      tg.addColorStop(1, 'rgba(200,60,40,0)')
      g.fillStyle = tg
      g.fillRect(-30, hh - 34, 60, 60)
      g.fillStyle = 'rgba(40,28,18,0.45)'
      for (let i = 0; i < 5; i++) {
        g.fillRect(randRange(-hw + 8, hw - 16), randRange(-hh + 4, hh - 10), randRange(3, 8), randRange(2, 4))
      }
    }
    g.restore()
  }

  drawObstacle(g, kind, x, y, r) {
    g.save()
    g.translate(x, y)
    g.fillStyle = 'rgba(0,0,0,0.32)'
    g.beginPath()
    g.ellipse(r * 0.2, r * 0.75, r * 1.15, r * 0.5, 0, 0, TAU)
    g.fill()
    if (kind === 0) {
      const a = randRange(0, TAU)
      g.rotate(a)
      g.fillStyle = '#54462f'
      g.fillRect(-r * 0.85, -r * 0.65, r * 1.7, r * 1.3)
      g.strokeStyle = '#3d3322'
      g.lineWidth = 3
      g.strokeRect(-r * 0.85, -r * 0.65, r * 1.7, r * 1.3)
      g.strokeStyle = 'rgba(35,29,19,0.8)'
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(-r * 0.85, -r * 0.15)
      g.lineTo(r * 0.85, -r * 0.15)
      g.moveTo(-r * 0.85, r * 0.35)
      g.lineTo(r * 0.85, r * 0.35)
      g.stroke()
      g.rotate(-a)
    } else if (kind === 1) {
      g.fillStyle = '#5b5850'
      g.beginPath()
      g.ellipse(0, -r * 0.15, r, r * 0.85, 0, 0, TAU)
      g.fill()
      g.fillStyle = '#4a4840'
      g.beginPath()
      g.ellipse(-r * 0.35, r * 0.1, r * 0.6, r * 0.5, 0, 0, TAU)
      g.fill()
      g.strokeStyle = 'rgba(30,30,26,0.5)'
      g.lineWidth = 2
      g.beginPath()
      g.ellipse(0, -r * 0.15, r * 0.55, r * 0.45, 0, 0, TAU)
      g.stroke()
    } else if (kind === 2) {
      g.fillStyle = '#6b4a30'
      g.beginPath()
      g.arc(0, 0, r, 0, TAU)
      g.fill()
      g.strokeStyle = '#523722'
      g.lineWidth = 3
      g.stroke()
      g.fillStyle = '#7d5a3a'
      g.fillRect(-r, -r * 0.6, r * 2, r * 0.42)
      g.strokeStyle = '#3a2817'
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(-r * 0.6, -r * 0.4)
      g.lineTo(-r * 0.6, r * 0.4)
      g.stroke()
    } else {
      g.fillStyle = '#242a1a'
      g.beginPath()
      g.arc(0, 0, r, 0, TAU)
      g.fill()
      g.fillStyle = '#2c3320'
      g.beginPath()
      g.arc(-r * 0.25, -r * 0.25, r * 0.75, 0, TAU)
      g.fill()
      g.fillStyle = 'rgba(0,0,0,0.3)'
      g.beginPath()
      g.arc(0, r * 0.3, r * 0.6, 0, TAU)
      g.fill()
    }
    g.restore()
  }

  decalBlood(x, y, r) {
    const g = this.ground.getContext('2d')
    const n = randInt(3, 6)
    for (let i = 0; i < n; i++) {
      const a = randRange(0, TAU)
      const d = randRange(0, r * 0.8)
      const s = randRange(r * 0.15, r * 0.4)
      g.fillStyle = `rgba(87,20,16,${randRange(0.35, 0.55)})`
      g.beginPath()
      g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, s, 0, TAU)
      g.fill()
    }
    g.fillStyle = 'rgba(87,20,16,0.5)'
    g.beginPath()
    g.ellipse(x, y, r * 0.7, r * 0.5, randRange(0, TAU), 0, TAU)
    g.fill()
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.viewW = window.innerWidth
    this.viewH = window.innerHeight
    this.canvas.width = Math.floor(this.viewW * this.dpr)
    this.canvas.height = Math.floor(this.viewH * this.dpr)
    this.canvas.style.width = `${this.viewW}px`
    this.canvas.style.height = `${this.viewH}px`
    const v = document.createElement('canvas')
    v.width = Math.floor(this.viewW / 2)
    v.height = Math.floor(this.viewH / 2)
    const vc = v.getContext('2d')
    const g = vc.createRadialGradient(v.width / 2, v.height / 2, Math.min(v.width, v.height) * 0.32, v.width / 2, v.height / 2, Math.max(v.width, v.height) * 0.72)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.55)')
    vc.fillStyle = g
    vc.fillRect(0, 0, v.width, v.height)
    this.vignette = v
    const d = document.createElement('canvas')
    d.width = this.viewW
    d.height = this.viewH
    this.darkLayer = d
  }

  bindEvents() {
    this._resize = () => this.resize()
    window.addEventListener('resize', this._resize)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this._resize)
    this.input.destroy()
    this.audio.stopMusic()
    game = null
  }

  loop = (t) => {
    const dt = Math.min((t - this.last) / 1000, 0.05)
    this.last = t
    this.elapsed += dt
    this.update(dt)
    this.render()
    this.raf = requestAnimationFrame(this.loop)
  }

  update(dt) {
    const inp = this.input
    if (this.phase === 'menu') {
      if (inp.press('enter') && getIdentity()) this.startGame()
      this.camera.x = WORLD / 2 + Math.cos(this.elapsed * 0.07) * 340
      this.camera.y = WORLD / 2 + Math.sin(this.elapsed * 0.05) * 340
      for (const z of this.menuZombies) updateZombie(z, dt, this)
      this.menuZombies.forEach((z) => {
        if (z.x < 60 || z.x > WORLD - 60 || z.y < 60 || z.y > WORLD - 60) {
          z.wanderA = Math.atan2(WORLD / 2 - z.y, WORLD / 2 - z.x)
        }
      })
      this.near = null
      this.particles.update(dt)
      this.texts.update(dt)
      this.hudTimer -= dt
      if (this.hudTimer <= 0) {
        this.hudTimer = 0.25
        this.emitHud()
      }
      return
    }

    if (this.phase === 'over') {
      if (inp.press('enter') || inp.press('r')) this.startGame()
      this.particles.update(dt)
      this.texts.update(dt)
      this.emitHud()
      return
    }

    if (this.paused || this.inventoryOpen) {
      inp.wheel = 0
      if (this.inventoryOpen && (inp.press('escape') || inp.press('p') || inp.press('i'))) {
        this.toggleInventory()
      } else if (this.paused && (inp.press('escape') || inp.press('p'))) {
        this.togglePause()
      }
      this.render()
      this.emitHud()
      return
    }

    this.updatePlayer(dt)
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i]
      updateZombie(z, dt, this)
      if (z.hp <= 0) {
        this.zombies.splice(i, 1)
        this.killZombie(z)
      }
    }
    this.updateBullets(dt)
    this.updateTurrets(dt)
    updatePickups(this, dt)
    this.particles.update(dt)
    this.texts.update(dt)

    this.powerupT.double = Math.max(0, this.powerupT.double - dt)
    this.powerupT.speed = Math.max(0, this.powerupT.speed - dt)

    this.flash = Math.max(0, this.flash - dt * 1.6)
    this.shake = Math.max(0, this.shake - dt * 26)

    if (this.phase === 'playing') this.updateWave(dt)

    if (!this.banner && this.bannerQ.length) this.banner = this.bannerQ.shift()

    this.near = this.nearestLoot()
    if (this.input.press('e')) this.trySearch()

    this.camera.x = lerp(this.camera.x, this.player.x + (this.mouseWorld.x - this.player.x) * 0.12, Math.min(1, dt * 8))
    this.camera.y = lerp(this.camera.y, this.player.y + (this.mouseWorld.y - this.player.y) * 0.12, Math.min(1, dt * 8))

    this.hudTimer -= dt
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1
      this.emitHud()
    }
  }

  updatePlayer(dt) {
    const p = this.player
    const inp = this.input
    const [mx, my] = inp.moveVec()

    p.sprinting = inp.down('shift')
    const speed = p.sprinting ? PLAYER.SPEED * PLAYER.SPRINT : PLAYER.SPEED
    const spd = speed * this.speedMul * (this.powerupT.speed > 0 ? 1.3 : 1)
    if (mx !== 0 || my !== 0) {
      p.x += mx * spd * dt
      p.y += my * spd * dt
      p.walk += dt * 9
    }

    for (const o of this.obstacles) {
      if (o.kind === 'rect') {
        const push = collideRect(p, o)
        if (push) {
          p.x += push[0]
          p.y += push[1]
        }
      } else {
        const dx = p.x - o.x
        const dy = p.y - o.y
        const min = p.r + o.r
        const d2 = dx * dx + dy * dy
        if (d2 < min * min) {
          const d = Math.sqrt(d2) || 1
          p.x = o.x + (dx / d) * min
          p.y = o.y + (dy / d) * min
        }
      }
    }
    p.x = clamp(p.x, 40, WORLD - 40)
    p.y = clamp(p.y, 40, WORLD - 40)

    const rect = this.canvas.getBoundingClientRect()
    this.mouseWorld.x = inp.mouse.x - rect.left + (this.camera.x - this.viewW / 2)
    this.mouseWorld.y = inp.mouse.y - rect.top + (this.camera.y - this.viewH / 2)
    p.aim = Math.atan2(this.mouseWorld.y - p.y, this.mouseWorld.x - p.x)
    p.recoil = Math.max(0, p.recoil - dt * 7)
    p.fireCd -= dt
    p.meleeCd -= dt

    if (inp.press('r')) this.startReload()
    if (inp.press('m')) this.toggleMute()
    if (inp.press('escape') || inp.press('p')) this.togglePause()
    if (inp.press('t')) this.togglePlaceMode()
    if (inp.press('i')) this.toggleInventory()
    if (inp.wheel !== 0) {
      this.cycleWeapon(inp.wheel)
      inp.wheel = 0
    }
    const ITEM_KEYS = ['1', '2', '3', '4']
    ITEM_ORDER.forEach((kind, i) => {
      if (inp.press(ITEM_KEYS[i])) this.useItem(kind)
    })

    if (p.reloading) {
      p.reloadT -= dt
      if (p.reloadT <= 0) {
        const w = getWeapon(p.weaponId)
        const am = this.getAmmo(p.weaponId)
        const need = w.mag - am.m
        const take = Math.min(need, am.r)
        am.m += take
        am.r -= take
        p.reloading = false
        this.emitHud()
      }
    } else if (inp.mouse.down) {
      this.fire()
    }

    if (inp.rightPressed) {
      this.meleeSwing()
    }
    inp.rightPressed = false

    if (this.placeMode && inp.mouse.down) this.tryPlaceTurret()
  }

  fire() {
    const p = this.player
    const w = getWeapon(p.weaponId)
    const am = this.getAmmo(p.weaponId)
    if (p.fireCd > 0 || p.reloading) return
    if (am.m <= 0) {
      this.audio.dryfire()
      this.startReload()
      return
    }
    p.fireCd = 1 / (w.rof * this.fireMul)
    p.recoil = 1
    const dmgMul = this.dmgMul * (this.powerupT.double > 0 ? 2 : 1)
    const mx = p.x + Math.cos(p.aim) * (p.r + 16)
    const my = p.y + Math.sin(p.aim) * (p.r + 16)
    for (let i = 0; i < w.pellets; i++) {
      const a = p.aim + randRange(-w.spread, w.spread)
      const [vx, vy] = norm(Math.cos(a), Math.sin(a))
      this.bullets.push({
        x: mx, y: my,
        px: mx, py: my,
        vx: vx * w.bspeed,
        vy: vy * w.bspeed,
        dmg: w.dmg * dmgMul,
        pierce: w.pierce,
        hit: new Set(),
        life: 0.7
      })
    }
    am.m--
    this.particles.smoke(mx, my, p.aim, 1)
    this.particles.flash(mx, my, p.aim)
    this.audio.shot(w.id)
    this.shake = Math.min(16, this.shake + (w.id === 'shotgun' ? 5 : 2))
    if (am.m <= 0) this.startReload()
  }

  startReload() {
    const p = this.player
    if (p.reloading) return
    const w = getWeapon(p.weaponId)
    const am = this.getAmmo(p.weaponId)
    if (am.m >= w.mag || am.r <= 0) return
    p.reloading = true
    p.reloadT = w.reload * this.reloadMul
    p.reloadTotal = p.reloadT
    this.audio.reload()
  }

  switchWeapon(i) {
    const p = this.player
    const target = ORDER[i]
    if (!p.owned.includes(target) || target === p.weaponId) return
    p.weaponId = target
    p.weaponIdx = i
    p.reloading = false
    this.audio.click()
  }

  useItem(kind) {
    const p = this.player
    if (!p.inv[kind]) return
    const it = ITEMS[kind]
    if (it.heal > 0 && p.hp >= p.maxHp && !it.speed) return
    p.inv[kind]--
    if (it.heal > 0) {
      const before = p.hp
      p.hp = clamp(p.hp + it.heal, 0, p.maxHp)
      this.texts.add(p.x, p.y - 26, `+${p.hp - before}`, '#8fae5e', 15)
      this.particles.debris(p.x, p.y - 10, 6, '#7f9b57')
    }
    if (it.speed) this.powerupT.speed = Math.max(this.powerupT.speed, it.speed)
    this.audio.eat()
    this.emitHud()
  }

  meleeSwing() {
    const p = this.player
    if (p.meleeCd > 0) return
    p.meleeCd = MELEE.CD
    let hit = false
    const dmg = MELEE.DMG * this.dmgMul * (this.powerupT.double > 0 ? 2 : 1)
    for (const z of this.zombies) {
      const d = dist(p.x, p.y, z.x, z.y)
      if (d > MELEE.RANGE + z.r) continue
      if (!this.isLOS(p.x, p.y, z.x, z.y)) continue
      let da = Math.atan2(z.y - p.y, z.x - p.x) - p.aim
      while (da > Math.PI) da -= TAU
      while (da < -Math.PI) da += TAU
      if (Math.abs(da) > MELEE.ARC / 2) continue
      z.hp -= dmg
      z.flash = 1
      const [kx, ky] = norm(z.x - p.x, z.y - p.y)
      z.kbx += kx * MELEE.KB
      z.kby += ky * MELEE.KB
      this.particles.blood(z.x, z.y, p.aim, 6)
      hit = true
    }
    if (hit) {
      this.audio.meleeHit()
      this.shake = Math.min(12, this.shake + 4)
    } else {
      this.audio.melee()
    }
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]
      b.life -= dt
      const steps = 3
      for (let s = 0; s < steps; s++) {
        b.px = b.x
        b.py = b.y
        b.x += (b.vx * dt) / steps
        b.y += (b.vy * dt) / steps
        for (const o of this.obstacles) {
          if (pointInObstacle(b.x, b.y, o)) {
            this.particles.debris(b.x, b.y, 4, '#4a4234')
            b.life = 0
            break
          }
        }
        if (b.life <= 0) break
        for (const z of this.zombies) {
          if (b.hit.has(z)) continue
          const d2 = (b.x - z.x) ** 2 + (b.y - z.y) ** 2
          if (d2 < (z.r + 3) ** 2) {
            z.hp -= b.dmg
            z.flash = 1
            const a = Math.atan2(b.vy, b.vx)
            z.kbx += Math.cos(a) * 110
            z.kby += Math.sin(a) * 110
            this.particles.blood(b.x, b.y, a, 5)
            this.audio.zombieHit()
            if (z.hp <= 0) {
              b.hit.add(z)
            }
            if (b.pierce > 0) {
              b.pierce--
              b.hit.add(z)
              b.dmg *= 0.7
            } else {
              b.life = 0
            }
            break
          }
        }
      }
      if (b.life <= 0) this.bullets.splice(i, 1)
    }
  }

  updateTurrets(dt) {
    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const tu = this.turrets[i]
      tu.flash = Math.max(0, (tu.flash || 0) - dt * 4)
      tu.cd -= dt
      let best = null
      let bestD = TURRET.RANGE
      for (const z of this.zombies) {
        const d = dist(tu.x, tu.y, z.x, z.y)
        if (d < bestD) {
          bestD = d
          best = z
        }
      }
      if (best) {
        tu.angle = Math.atan2(best.y - tu.y, best.x - tu.x)
        if (tu.cd <= 0 && tu.ammo > 0) {
          tu.cd = 1 / TURRET.ROF
          tu.ammo--
          const [vx, vy] = norm(Math.cos(tu.angle), Math.sin(tu.angle))
          this.bullets.push({
            x: tu.x + vx * 18,
            y: tu.y + vy * 18,
            px: tu.x, py: tu.y,
            vx: vx * TURRET.BSPEED,
            vy: vy * TURRET.BSPEED,
            dmg: TURRET.DMG,
            pierce: 0,
            hit: new Set(),
            life: 0.6,
            fromTurret: true
          })
          this.audio.turretFire()
        }
      }
    }
  }

  destroyTurret(tu) {
    const i = this.turrets.indexOf(tu)
    if (i >= 0) this.turrets.splice(i, 1)
    this.particles.debris(tu.x, tu.y, 14, '#3d4236')
    this.audio.turretBreak()
    this.decalBlood(tu.x, tu.y, 16)
  }

  updateWave(dt) {
    if (this.toSpawn > 0) {
      this.spawnT -= dt
      if (this.spawnT <= 0) {
        this.spawnT = clamp(1.7 - this.wave * 0.07, 0.55, 1.7)
        const group = 1 + (this.wave >= 4 ? 1 : 0) + (this.wave >= 9 ? 1 : 0)
        for (let i = 0; i < group; i++) {
          if (this.toSpawn <= 0) break
          this.spawnOne()
          this.toSpawn--
        }
      }
    }
    if (this.toSpawn === 0 && this.zombies.filter((z) => !z.home).length === 0) {
      this.daybreak()
    }
  }

  spawnOne() {
    const p = this.player
    const viewR = Math.hypot(this.viewW, this.viewH) / 2
    const minR = Math.max(420, viewR + 140)
    let x = 0
    let y = 0
    for (let i = 0; i < 14; i++) {
      const a = randRange(0, TAU)
      const r = randRange(minR, Math.min(2200, WORLD * 0.4))
      x = clamp(p.x + Math.cos(a) * r, 60, WORLD - 60)
      y = clamp(p.y + Math.sin(a) * r, 60, WORLD - 60)
      if (this.pointFree(x, y)) break
    }
    const w = this.wave
    let type = 'walker'
    const r = Math.random()
    if (w >= 6 && r < 0.12) type = 'brute'
    else if (w >= 4 && r < 0.34) type = 'runner'
    else if (w >= 2 && r < 0.52) type = 'crawler'
    this.zombies.push(spawnZombie(type, x, y, w, this))
    if (Math.random() < 0.3) this.audio.groan()
  }

  waveCount(w) {
    let n = 8 + w * 4
    if (w % 5 === 0) n += 1
    return n
  }

  pushBanner(title, sub, t) {
    if (this.banner) this.bannerQ.push({ title, sub, t: t || 2.2 })
    else this.banner = { title, sub, t: t || 2.2 }
  }

  startNight() {
    this.phase = 'playing'
    this.paused = false
    this.wave++
    this.toSpawn = this.waveCount(this.wave)
    this.spawnT = 1.4
    this.darkness = Math.min(NIGHT.MAX, NIGHT.BASE + this.wave * 0.014)
    this.audio.ensure()
    this.audio.startMusic()
    this.audio.intensity = Math.min(1, 0.4 + this.wave * 0.05)
    if (this.wave % 5 === 0) {
      const p = this.player
      const a = randRange(0, TAU)
      const r = randRange(500, 700)
      const x = clamp(p.x + Math.cos(a) * r, 60, WORLD - 60)
      const y = clamp(p.y + Math.sin(a) * r, 60, WORLD - 60)
      const boss = spawnZombie('boss', x, y, this.wave, this)
      this.zombies.push(boss)
      this.audio.bossRoar()
      this.pushBanner('BOSS', 'something big is coming', 2.4)
    } else {
      this.pushBanner(`NIGHT ${this.wave}`, null, 1.8)
    }
    this.audio.waveStart()
    this.emitHud()
  }

  seedHomes() {
    for (const b of this.buildings) {
      if (!b.infested) continue
      if (this.player.x > b.x && this.player.x < b.x + b.w && this.player.y > b.y && this.player.y < b.y + b.h) continue
      const n = randInt(2, 3)
      for (let i = 0; i < n; i++) {
        let zx = 0
        let zy = 0
        for (let t = 0; t < 12; t++) {
          zx = randRange(b.x + 46, b.x + b.w - 46)
          zy = randRange(b.y + 46, b.y + b.h - 46)
          if (dist(zx, zy, b.doorX, b.doorY) > 80) break
        }
        const roll = Math.random()
        const z = spawnZombie(roll < 0.2 ? 'crawler' : roll < 0.5 ? 'runner' : 'walker', zx, zy, 1, this)
        z.home = b
        this.zombies.push(z)
      }
    }
  }

  daybreak() {
    this.phase = 'day'
    this.day++
    const bonus = this.wave * 100
    this.score += bonus
    for (const b of this.buildings) {
      b.doorHp = DOOR_HP
      b.doorBroken = false
    }
    this.zombies = []
    this.seedHomes()
    this.audio.daybreak()
    this.audio.stopMusic()
    this.placeMode = false
    this.pushBanner('DAWN', `day ${this.day} - doors repaired, spend your scrap`, 2.4)
    this.texts.add(this.player.x, this.player.y - 30, `+${bonus}`, '#c9c4b2', 16)
    this.emitHud()
  }

  damagePlayer(dmg, z) {
    const p = this.player
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, dmg)
      p.shield -= absorbed
      dmg -= absorbed
    }
    if (dmg <= 0) return
    p.hp -= dmg
    this.flash = 0.55
    this.shake = Math.min(16, this.shake + 10)
    this.audio.playerHurt()
    if (p.hp <= 0) this.gameOver()
    this.emitHud()
  }

  killZombie(z) {
    const a = Math.atan2(this.player.y - z.y, this.player.x - z.x)
    this.particles.blood(z.x, z.y, a, z.boss ? 60 : z.type === 'brute' ? 26 : 14)
    this.particles.debris(z.x, z.y, z.boss ? 20 : 5, '#3a3f2c')
    this.decalBlood(z.x, z.y, z.boss ? 70 : 18)
    this.audio.zombieDie()
    this.kills++
    this.score += z.score
    this.texts.add(z.x, z.y - z.r - 10, `+${z.score}`, '#b9b39a', z.boss ? 20 : 13)

    const n = z.boss ? randInt(6, 8) : randInt(z.scrapMin, z.scrapMax)
    for (let i = 0; i < n; i++) {
      this.pickups.push(makePickup('scrap', z.x + randRange(-30, 30), z.y + randRange(-30, 30), 1))
    }
    if (z.boss) {
      this.pickups.push(makePickup('medkit', z.x, z.y - 40))
      this.pickups.push(makePickup('ammo', z.x + 30, z.y - 20))
      this.pickups.push(makePickup('shield', z.x - 30, z.y - 20))
      this.shake = 22
      this.texts.add(z.x, z.y - z.r - 40, 'BOSS DOWN', '#d9a23f', 22)
    }
    if (Math.random() < 0.05) {
      const r2 = Math.random()
      const kind = r2 < 0.5 ? 'can' : r2 < 0.8 ? 'ration' : 'stim'
      this.pickups.push(makePickup('item', z.x + randRange(-40, 40), z.y + randRange(-40, 40), kind))
    }
    if (Math.random() < 0.06) {
      const types = ['medkit', 'medkit', 'ammo', 'ammo', 'double', 'speed', 'shield']
      const t = types[randInt(0, types.length - 1)]
      this.pickups.push(makePickup(t, z.x + randRange(-40, 40), z.y + randRange(-40, 40)))
    }
    this.emitHud()
  }

  nearestLoot() {
    const p = this.player
    let best = null
    let bestD = 70
    for (const c of this.containers) {
      if (c.looted) continue
      const d = dist(p.x, p.y, c.x, c.y)
      if (d < bestD) {
        bestD = d
        best = c
      }
    }
    for (const car of this.cars) {
      if (car.looted) continue
      const d = dist(p.x, p.y, car.trunkX, car.trunkY)
      if (d < 60 && d < bestD) {
        bestD = d
        best = car
      }
    }
    return best
  }

  trySearch() {
    const t = this.near
    if (!t || t.looted) return
    this.searchTarget(t)
  }

  searchTarget(t) {
    t.looted = true
    this.audio.search()
    const table = LOOT[t.kind + (t.rare ? '_rare' : '')] || LOOT[t.kind] || LOOT.crate
    let total = 0
    for (const row of table) total += row[1]
    let roll = Math.random() * total
    let chosen = table[table.length - 1]
    for (const row of table) {
      roll -= row[1]
      if (roll <= 0) {
        chosen = row
        break
      }
    }
    const kind = chosen[0]
    const p = this.player
    let msg = 'EMPTY'
    let col = '#8f8b7a'
    if (kind === 'scrap') {
      const n = randInt(chosen[2] || 3, chosen[3] || 6)
      this.scrap += n
      msg = `+${n} SCRAP`
      col = '#b98a4a'
    } else if (kind === 'ammo') {
      const w = getWeapon(p.weaponId)
      const am = this.getAmmo(p.weaponId)
      am.m = w.mag
      am.r = w.reserve
      p.reloading = false
      msg = '+AMMO'
      col = '#c9c4b2'
    } else if (kind === 'weapon') {
      const found = ORDER.find((id) => id !== 'pistol' && !p.owned.includes(id))
      if (found) {
        p.owned.push(found)
        this.getAmmo(found)
        this.audio.found()
        this.texts.add(t.x, t.y - 24, `FOUND ${getWeapon(found).name}`, '#d9a23f', 17)
        this.emitHud()
        return
      }
      const w2 = getWeapon(p.weaponId)
      const am2 = this.getAmmo(p.weaponId)
      am2.m = w2.mag
      am2.r = w2.reserve
      msg = '+AMMO'
      col = '#c9c4b2'
    } else if (ITEMS[kind]) {
      if (p.inv[kind] >= 9) {
        msg = 'FULL'
        col = '#cf8a3c'
      } else {
        p.inv[kind]++
        msg = `+${ITEMS[kind].name}`
        col = '#c9c4b2'
      }
    }
    if (msg === 'EMPTY') this.audio.empty()
    else this.audio.found()
    this.texts.add(t.x, t.y - 24, msg, col, 14)
    this.emitHud()
  }

  togglePlaceMode() {
    if (this.phase !== 'playing') return
    if (this.turretInv <= 0) {
      this.texts.add(this.player.x, this.player.y - 26, 'NO TURRETS', '#8f8b7a', 13)
      return
    }
    this.placeMode = !this.placeMode
    this.audio.click()
  }

  tryPlaceTurret() {
    const mw = this.mouseWorld
    if (mw.x < 60 || mw.x > WORLD - 60 || mw.y < 60 || mw.y > WORLD - 60) return
    for (const o of this.obstacles) {
      if (o.kind === 'rect') {
        const c = Math.cos(o.rot)
        const s = Math.sin(o.rot)
        const dx = mw.x - o.x
        const dy = mw.y - o.y
        const lx = dx * c + dy * s
        const ly = -dx * s + dy * c
        if (Math.abs(lx) < o.w / 2 + 26 && Math.abs(ly) < o.h / 2 + 26) return
      } else if (dist(mw.x, mw.y, o.x, o.y) < o.r + 26) {
        return
      }
    }
    this.turrets.push({
      x: mw.x,
      y: mw.y,
      hp: TURRET.HP,
      ammo: TURRET.AMMO,
      cd: 0,
      angle: 0,
      flash: 0,
      seed: rand(1000)
    })
    this.turretInv--
    this.placeMode = false
    this.audio.place()
    this.emitHud()
  }

  buyModule(id) {
    if (this.phase !== 'day') return
    const mod = MODULES.find((m) => m.id === id)
    const lvl = this.player.mods[id]
    if (lvl >= mod.max) return
    const cost = mod.base + mod.step * lvl
    if (this.scrap < cost) return
    this.scrap -= cost
    this.player.mods[id] = lvl + 1
    if (id === 'hp') {
      this.player.maxHp += 25
      this.player.hp = Math.min(this.player.hp + 25, this.player.maxHp)
    }
    this.audio.click()
    this.emitHud()
  }

  buyCraft(id) {
    if (this.phase !== 'day') return
    const craft = CRAFTS.find((c) => c.id === id)
    if (this.scrap < craft.cost) return
    if (id === 'smg' || id === 'shotgun' || id === 'rifle' || id === 'lmg') {
      if (this.player.owned.includes(id)) return
      this.player.owned.push(id)
      this.getAmmo(id)
    } else if (id === 'ammo') {
      const w = getWeapon(this.player.weaponId)
      const am = this.getAmmo(this.player.weaponId)
      am.m = w.mag
      am.r = w.reserve
      this.player.reloading = false
    } else if (id === 'medkit') {
      if (this.player.inv.medkit >= 9) return
      this.player.inv.medkit++
    } else if (id === 'turret') {
      if (this.turretInv >= 3) return
      this.turretInv++
    }
    this.scrap -= craft.cost
    this.audio.click()
    this.emitHud()
  }

  startGame() {
    this.input.pressed.clear()
    this.input.keys.clear()
    this.input.wheel = 0
    this.resetPlayer()
    this.zombies = []
    this.bullets = []
    this.pickups = []
    this.turrets = []
    this.wave = 0
    this.day = 0
    this.scrap = 0
    this.score = 0
    this.kills = 0
    this.shake = 0
    this.flash = 0
    this.powerupT = { double: 0, speed: 0 }
    this.turretInv = 0
    this.placeMode = false
    this.paused = false
    this.sessionStart = performance.now()
    this.near = null
    this.genWorld()
    this.seedHomes()
    this.camera.x = this.player.x
    this.camera.y = this.player.y
    this.newRecord = false
    this.audio.ensure()
    this.audio.setMuted(this.audio.muted)
    this.banner = null
    this.bannerQ = [
      { title: 'DAY 1', sub: 'the outbreak hit at midnight. the city is lost.', t: 2.6 },
      { title: 'HOLD THE DOORS', sub: 'zombies can break in. doors reset at dawn.', t: 2.6 },
      { title: 'LOOT WHAT YOU CAN', sub: 'buildings and cars hold supplies. be careful where you search.', t: 2.6 }
    ]
    this.banner = this.bannerQ.shift()
    this.startNight()
  }

  toggleMute() {
    this.audio.ensure()
    this.audio.setMuted(!this.audio.muted)
    this.emitHud()
  }

  togglePause() {
    if (this.phase !== 'playing' && this.phase !== 'day') return
    this.paused = !this.paused
    this.audio.ensure()
    this.emitHud()
  }

  toggleInventory() {
    if (this.phase !== 'playing' && this.phase !== 'day') return
    if (this.placeMode) return
    this.inventoryOpen = !this.inventoryOpen
    if (this.inventoryOpen) this.paused = false
    this.audio.ensure()
    this.emitHud()
  }

  cycleWeapon(dir) {
    const p = this.player
    if (!p || this.phase !== 'playing') return
    const owned = ORDER.filter((id) => p.owned.includes(id))
    if (owned.length < 2) return
    let i = Math.max(0, owned.indexOf(p.weaponId))
    i = (i + Math.sign(dir) + owned.length) % owned.length
    const target = owned[i]
    if (target === p.weaponId) return
    p.weaponId = target
    p.weaponIdx = ORDER.indexOf(target)
    p.reloading = false
    this.audio.click()
    this.emitHud()
  }

  quitToMenu() {
    this.paused = false
    this.phase = 'menu'
    this.audio.stopMusic()
    this.emitHud()
  }

  gameOver() {
    this.phase = 'over'
    this.placeMode = false
    this.audio.gameover()
    this.newRecord = this.score > this.highScore
    if (this.newRecord) {
      this.highScore = this.score
      window.localStorage.setItem('spotted.high', String(this.highScore))
    }
    this.submitRecord()
    this.emitHud()
  }

  submitRecord() {
    const id = getIdentity()
    if (!id || this.score <= 0) return
    const run = {
      score: this.score,
      wave: this.wave,
      kills: this.kills,
      durationS: Math.round((performance.now() - (this.sessionStart || performance.now())) / 1000)
    }
    const submit = (pid) =>
      submitSession({ playerId: pid, ...run }).catch(() => {})
    if (id.playerId) {
      submit(id.playerId)
    } else {
      upsertPlayer(id.username, id.birthYear)
        .then((p) => submit(p.playerId))
        .catch(() => {})
    }
  }

  currentZone() {
    const p = this.player
    if (dist(p.x, p.y, CENTER, CENTER) < 440) return 'PLAZA'
    for (const key of Object.keys(ZONES)) {
      const z = ZONES[key]
      if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) return z.name
    }
    return 'JUNGLE'
  }

  emitHud() {
    const p = this.player
    const am = this.getAmmo(p.weaponId)
    const w = getWeapon(p.weaponId)
    store.emit({
      phase: this.phase,
      paused: this.paused,
      inventoryOpen: this.inventoryOpen,
      health: Math.max(0, Math.ceil(p.hp)),
      maxHealth: p.maxHp,
      shield: Math.ceil(p.shield),
      weaponId: p.weaponId,
      weaponName: w.name,
      mag: am.m,
      reserve: am.r,
      magSize: w.mag,
      reloading: p.reloading,
      reloadProgress: p.reloading ? 1 - p.reloadT / p.reloadTotal : 0,
      owned: [...p.owned],
      mags: Object.fromEntries(ORDER.map((id) => [id, this.getAmmo(id)])),
      mods: { ...p.mods },
      scrap: this.scrap,
      score: this.score,
      wave: this.wave,
      day: this.day,
      zombiesLeft: this.toSpawn + this.zombies.filter((z) => !z.home).length,
      kills: this.kills,
      muted: this.audio.muted,
      turretInv: this.turretInv,
      placeMode: this.placeMode,
      powerups: { ...this.powerupT },
      inv: { ...p.inv },
      nearLoot: !!this.near,
      zone: this.currentZone(),
      stats: { wave: this.wave, kills: this.kills, score: this.score },
      highScore: this.highScore,
      newRecord: this.newRecord
    })
  }

  render() {
    const ctx = this.ctx
    const dpr = this.dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0c0e0a'
    ctx.fillRect(0, 0, this.viewW, this.viewH)

    const shx = this.shake > 0 ? randRange(-this.shake, this.shake) : 0
    const shy = this.shake > 0 ? randRange(-this.shake, this.shake) : 0
    const vx = this.camera.x - this.viewW / 2 + shx
    const vy = this.camera.y - this.viewH / 2 + shy

    ctx.save()
    ctx.translate(-vx, -vy)
    ctx.drawImage(this.ground, 0, 0)
    this.drawDoors(ctx)
    this.drawContainers(ctx)
    drawPickups(ctx, this)
    this.drawTorch(ctx)

    for (const tu of this.turrets) this.drawTurret(ctx, tu)

    const zs = this.phase === 'menu' ? this.menuZombies : this.zombies
    const drawables = zs.map((z) => ({ y: z.y, f: (c) => drawZombie(c, z, this.elapsed) }))
    drawables.push({ y: this.player.y, f: (c) => this.drawPlayer(c) })
    drawables.sort((a, b) => a.y - b.y)
    for (const d of drawables) d.f(ctx)

    this.drawBullets(ctx)
    this.particles.draw(ctx)
    this.texts.draw(ctx)

    if (this.placeMode) this.drawPlaceGhost(ctx)

    ctx.restore()

    this.drawDarkness(ctx)
    ctx.drawImage(this.vignette, 0, 0, this.viewW, this.viewH)
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(140,28,16,${this.flash * 0.4})`
      ctx.fillRect(0, 0, this.viewW, this.viewH)
    }
    if (this.banner) {
      const b = this.banner
      const t = b.t
      b.t -= 1 / 60
      if (t > 0) {
        const a = Math.min(1, t / 0.6)
        ctx.globalAlpha = a
        ctx.textAlign = 'center'
        ctx.font = '700 52px "Chakra Petch", sans-serif'
        ctx.fillStyle = '#e9e5d6'
        ctx.fillText(b.title, this.viewW / 2, this.viewH * 0.3)
        if (b.sub) {
          ctx.font = '500 18px "Chakra Petch", sans-serif'
          ctx.fillStyle = '#cf8a3c'
          ctx.fillText(b.sub, this.viewW / 2, this.viewH * 0.3 + 34)
        }
        ctx.globalAlpha = 1
      } else {
        this.banner = null
      }
    }
    if (this.phase === 'playing' || this.phase === 'day' || this.phase === 'over') this.drawMinimap(ctx)
    if (this.phase === 'playing' && !this.placeMode) this.drawCrosshair(ctx)
  }

  drawDoors(ctx) {
    for (const b of this.buildings) {
      const horiz = b.doorSide === 0 || b.doorSide === 2
      const cx = b.doorX
      const cy = b.doorY
      if (b.doorBroken) {
        ctx.fillStyle = '#0b0c08'
        ctx.fillRect(horiz ? cx - DOOR / 2 : cx - 6, horiz ? cy - 6 : cy - DOOR / 2, horiz ? DOOR : 12, horiz ? 12 : DOOR)
        ctx.strokeStyle = 'rgba(58,52,40,0.9)'
        ctx.lineWidth = 2
        const ex = horiz ? cx - DOOR / 2 : cx
        const ey = horiz ? cy : cy - DOOR / 2
        for (let i = 0; i < 5; i++) {
          ctx.beginPath()
          ctx.moveTo(ex, ey)
          ctx.lineTo(ex + randRange(-14, 14), ey + randRange(-10, 10))
          ctx.stroke()
        }
        continue
      }
      const dmg = 1 - b.doorHp / DOOR_HP
      ctx.fillStyle = '#4a3420'
      ctx.fillRect(horiz ? cx - DOOR / 2 : cx - 6, horiz ? cy - 6 : cy - DOOR / 2, horiz ? DOOR : 12, horiz ? 12 : DOOR)
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      if (horiz) {
        for (let sx = cx - DOOR / 2 + 5; sx < cx + DOOR / 2 - 4; sx += 6) {
          ctx.moveTo(sx, cy - 5)
          ctx.lineTo(sx, cy + 5)
        }
      } else {
        for (let sy = cy - DOOR / 2 + 5; sy < cy + DOOR / 2 - 4; sy += 6) {
          ctx.moveTo(cx - 5, sy)
          ctx.lineTo(cx + 5, sy)
        }
      }
      ctx.stroke()
      if (dmg > 0.5) {
        ctx.fillStyle = 'rgba(20,16,10,0.8)'
        const hx = horiz ? cx + randRange(-14, 14) : cx
        const hy = horiz ? cy : cy + randRange(-14, 14)
        ctx.beginPath()
        ctx.arc(hx, hy, 3, 0, TAU)
        ctx.fill()
      }
    }
  }

  drawTorch(ctx) {
    if (this.phase === 'over') return
    const p = this.player
    const alpha = this.phase === 'playing' ? 0.34 : this.phase === 'menu' ? 0.2 : 0.26
    const g = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, 270)
    g.addColorStop(0, `rgba(255,156,66,${alpha})`)
    g.addColorStop(0.4, `rgba(255,150,58,${alpha * 0.55})`)
    g.addColorStop(1, 'rgba(255,150,58,0)')
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(p.x, p.y, 270, 0, TAU)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }

  drawContainers(ctx) {
    const t = this.elapsed
    for (const c of this.containers) {
      const open = c.looted
      const near = this.near === c
      ctx.save()
      ctx.translate(c.x, c.y)
      ctx.globalAlpha = 0.3
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.ellipse(0, c.r * 0.7, c.r, c.r * 0.4, 0, 0, TAU)
      ctx.fill()
      ctx.globalAlpha = 1
      if (c.kind === 'crate') {
        ctx.fillStyle = open ? '#241d12' : '#5a4a32'
        ctx.fillRect(-c.r, -c.r * 0.8, c.r * 2, c.r * 1.6)
        ctx.strokeStyle = '#3d3322'
        ctx.lineWidth = 2
        ctx.strokeRect(-c.r, -c.r * 0.8, c.r * 2, c.r * 1.6)
        if (open) {
          ctx.strokeStyle = '#6b5a3e'
          ctx.beginPath()
          ctx.moveTo(-c.r * 0.9, -c.r * 0.8)
          ctx.lineTo(-c.r * 0.9, -c.r * 1.4)
          ctx.stroke()
        } else {
          ctx.fillStyle = '#46392a'
          ctx.fillRect(-c.r, -2, c.r * 2, 4)
        }
      } else if (c.kind === 'cabinet') {
        ctx.fillStyle = open ? '#1b1d18' : '#4a4f45'
        ctx.fillRect(-c.r, -c.r * 1.1, c.r * 2, c.r * 2.2)
        ctx.strokeStyle = '#33382f'
        ctx.lineWidth = 2
        ctx.strokeRect(-c.r, -c.r * 1.1, c.r * 2, c.r * 2.2)
        ctx.fillStyle = '#2e332b'
        ctx.fillRect(-4, -c.r * 0.35, 8, 12)
        if (open) {
          ctx.fillStyle = '#5a5f54'
          ctx.fillRect(-c.r, -c.r * 1.1, c.r * 0.7, c.r * 2.2)
        }
      } else {
        ctx.fillStyle = open ? '#16180f' : '#5c5f58'
        ctx.fillRect(-c.r * 0.8, -c.r, c.r * 1.6, c.r * 2)
        ctx.strokeStyle = '#40443d'
        ctx.lineWidth = 2
        ctx.strokeRect(-c.r * 0.8, -c.r, c.r * 1.6, c.r * 2)
        if (open) {
          ctx.fillStyle = '#cfd2c8'
          ctx.fillRect(-c.r * 0.8, -c.r, c.r * 0.75, c.r * 2)
        } else {
          ctx.fillStyle = '#4a4e47'
          ctx.fillRect(-3, -c.r, 6, c.r * 2)
        }
      }
      ctx.restore()
      if (near) {
        ctx.strokeStyle = `rgba(207,138,60,${0.5 + 0.3 * Math.sin(t * 6)})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(c.x, c.y, c.r + 8, 0, TAU)
        ctx.stroke()
      }
    }
    for (const car of this.cars) {
      if (!car.looted) continue
      ctx.save()
      ctx.translate(car.x, car.y)
      ctx.rotate(car.rot)
      ctx.fillStyle = '#171813'
      ctx.fillRect(-13, car.h / 2 - 9, 26, 16)
      ctx.strokeStyle = '#2c2e26'
      ctx.lineWidth = 2
      ctx.strokeRect(-13, car.h / 2 - 9, 26, 16)
      ctx.restore()
    }
  }

  drawPlayer(ctx) {
    const p = this.player
    ctx.save()
    ctx.translate(p.x, p.y)

    const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, 62)
    glow.addColorStop(0, 'rgba(255,176,90,0.24)')
    glow.addColorStop(1, 'rgba(255,176,90,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(0, 0, 62, 0, TAU)
    ctx.fill()

    ctx.globalAlpha = 0.3
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.ellipse(0, p.r * 0.7, p.r * 1.2, p.r * 0.45, 0, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 1

    const move = p.walk
    const l1 = Math.sin(move * 2.4)
    const l2 = Math.cos(move * 2.4)
    ctx.fillStyle = '#23261e'
    ctx.beginPath()
    ctx.ellipse(-p.r * 0.55 + l1 * 2.5, p.r * 0.32 + Math.abs(l1) * 3, p.r * 0.34, p.r * 0.4, 0, 0, TAU)
    ctx.ellipse(p.r * 0.55 + l2 * 2.5, p.r * 0.32 + Math.abs(l2) * 3, p.r * 0.34, p.r * 0.4, 0, 0, TAU)
    ctx.fill()

    ctx.fillStyle = '#5c6f4e'
    ctx.beginPath()
    ctx.ellipse(0, -1, p.r * 1.1, p.r * 0.95, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#4d5e42'
    ctx.beginPath()
    ctx.ellipse(-p.r * 0.8, -p.r * 0.26, p.r * 0.4, p.r * 0.44, 0, 0, TAU)
    ctx.ellipse(p.r * 0.8, -p.r * 0.26, p.r * 0.4, p.r * 0.44, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#3f4234'
    ctx.beginPath()
    ctx.ellipse(0, -p.r * 1.06, p.r * 0.78, p.r * 0.55, 0, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(30,32,24,0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-p.r * 0.4, -p.r * 0.98)
    ctx.lineTo(-p.r * 0.4, p.r * 0.08)
    ctx.moveTo(p.r * 0.4, -p.r * 0.98)
    ctx.lineTo(p.r * 0.4, p.r * 0.08)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(30,34,24,0.5)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, -p.r * 0.7)
    ctx.lineTo(0, p.r * 0.6)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(242,238,214,0.6)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(0, -1, p.r * 1.12, p.r * 0.97, 0, 0, TAU)
    ctx.stroke()

    const recoilX = -Math.cos(p.aim) * p.recoil * 5
    const recoilY = -Math.sin(p.aim) * p.recoil * 5
    ctx.save()
    ctx.rotate(p.aim)
    ctx.translate(recoilX, recoilY)
    ctx.strokeStyle = '#4d5e42'
    ctx.lineWidth = p.r * 0.42
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(p.r * 0.42, -p.r * 0.55)
    ctx.lineTo(p.r * 0.8, -p.r * 0.5)
    ctx.moveTo(p.r * 0.42, p.r * 0.55)
    ctx.lineTo(p.r * 0.8, p.r * 0.5)
    ctx.stroke()
    ctx.fillStyle = '#ecd3ab'
    ctx.beginPath()
    ctx.arc(p.r * 0.84, -p.r * 0.5, p.r * 0.24, 0, TAU)
    ctx.arc(p.r * 0.84, p.r * 0.5, p.r * 0.24, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#1c1f18'
    ctx.fillRect(p.r * 0.7, -3, 26, 6)
    ctx.fillStyle = '#4a3420'
    ctx.fillRect(14 + p.r * 0.7, -2, 8, 4)
    ctx.fillStyle = '#6f7a58'
    ctx.beginPath()
    ctx.arc(20 + p.r * 0.7, 0, 3.4, 0, TAU)
    ctx.fill()
    ctx.restore()

    ctx.fillStyle = '#ecd3ab'
    ctx.beginPath()
    ctx.arc(0, -p.r * 0.55, p.r * 0.56, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#37402c'
    ctx.beginPath()
    ctx.arc(0, -p.r * 0.62, p.r * 0.56, Math.PI * 0.75, Math.PI * 2.25)
    ctx.fill()
    ctx.save()
    ctx.rotate(p.aim)
    ctx.fillStyle = '#37402c'
    ctx.beginPath()
    ctx.ellipse(p.r * 0.44, -p.r * 0.62, p.r * 0.3, p.r * 0.15, 0, 0, TAU)
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = '#1a1710'
    ctx.beginPath()
    ctx.arc(-p.r * 0.16, -p.r * 0.48, 1.9, 0, TAU)
    ctx.arc(p.r * 0.16, -p.r * 0.48, 1.9, 0, TAU)
    ctx.fill()

    const ringA = 0.5 + 0.18 * Math.sin(this.elapsed * 4)
    ctx.strokeStyle = `rgba(255,214,150,${ringA})`
    ctx.lineWidth = 1.6
    ctx.setLineDash([7, 8])
    ctx.beginPath()
    ctx.arc(0, 0, p.r + 9, 0, TAU)
    ctx.stroke()
    ctx.setLineDash([])

    if (p.shield > 0) {
      ctx.strokeStyle = `rgba(125,155,179,${0.5 + 0.15 * Math.sin(this.elapsed * 6)})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, p.r + 7, 0, TAU)
      ctx.stroke()
    }
    if (this.powerupT.double > 0) {
      ctx.strokeStyle = 'rgba(217,123,63,0.55)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.arc(0, 0, p.r + 12, 0, TAU)
      ctx.stroke()
      ctx.setLineDash([])
    }
    ctx.restore()
  }

  drawBullets(ctx) {
    ctx.globalCompositeOperation = 'lighter'
    for (const b of this.bullets) {
      const a = Math.atan2(b.y - b.py, b.x - b.px)
      const len = b.fromTurret ? 8 : 14
      const grad = ctx.createLinearGradient(b.x, b.y, b.x - Math.cos(a) * len, b.y - Math.sin(a) * len)
      grad.addColorStop(0, b.fromTurret ? 'rgba(255,214,150,0.9)' : 'rgba(255,235,190,0.95)')
      grad.addColorStop(1, 'rgba(255,214,150,0)')
      ctx.strokeStyle = grad
      ctx.lineWidth = b.fromTurret ? 2 : 2.5
      ctx.beginPath()
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(b.x - Math.cos(a) * len, b.y - Math.sin(a) * len)
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  drawTurret(ctx, tu) {
    ctx.save()
    ctx.translate(tu.x, tu.y)
    ctx.globalAlpha = 0.3
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.ellipse(2, 8, 18, 7, 0, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = '#2a2e24'
    ctx.beginPath()
    ctx.arc(0, 0, 16, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = '#3d4234'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.rotate(tu.angle)
    ctx.fillStyle = '#22261d'
    ctx.fillRect(2, -4, 20, 8)
    ctx.fillStyle = '#b07a2e'
    ctx.fillRect(18, -2.5, 5, 5)
    ctx.rotate(-tu.angle)
    ctx.fillStyle = '#4a3a20'
    ctx.beginPath()
    ctx.arc(0, 0, 5, 0, TAU)
    ctx.fill()
    ctx.restore()
    if (tu.flash > 0) {
      ctx.globalAlpha = tu.flash * 0.5
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(tu.x, tu.y, 18, 0, TAU)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    if (tu.ammo <= 5) {
      ctx.globalAlpha = 0.6
      ctx.strokeStyle = '#a63a24'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(tu.x, tu.y, 18, 0, TAU)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }

  drawPlaceGhost(ctx) {
    const mw = this.mouseWorld
    let valid = true
    if (mw.x < 60 || mw.x > WORLD - 60 || mw.y < 60 || mw.y > WORLD - 60) valid = false
    for (const o of this.obstacles) {
      if (o.kind === 'rect') {
        const c = Math.cos(o.rot)
        const s = Math.sin(o.rot)
        const dx = mw.x - o.x
        const dy = mw.y - o.y
        const lx = dx * c + dy * s
        const ly = -dx * s + dy * c
        if (Math.abs(lx) < o.w / 2 + 26 && Math.abs(ly) < o.h / 2 + 26) {
          valid = false
          break
        }
      } else if (dist(mw.x, mw.y, o.x, o.y) < o.r + 26) {
        valid = false
        break
      }
    }
    ctx.globalAlpha = 0.12
    ctx.fillStyle = '#8f9a6e'
    ctx.beginPath()
    ctx.arc(mw.x, mw.y, TURRET.RANGE, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = valid ? '#8f9a6e' : '#a63a24'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(mw.x, mw.y, 16, 0, TAU)
    ctx.stroke()
    ctx.fillStyle = valid ? '#6f7a58' : '#7a2c1c'
    ctx.beginPath()
    ctx.arc(mw.x, mw.y, 16, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  drawDarkness(ctx) {
    if (this.phase !== 'playing' && this.phase !== 'day' && this.phase !== 'menu') return
    const dark = this.phase === 'menu' ? 0.13 : this.phase === 'day' ? 0.18 : this.darkness
    if (dark <= 0.04) return
    const dc = this.darkLayer.getContext('2d')
    const w = this.viewW
    const h = this.viewH
    dc.clearRect(0, 0, w, h)
    dc.fillStyle = `rgba(4,5,3,${dark})`
    dc.fillRect(0, 0, w, h)
    const lights = []
    if (this.phase !== 'menu') {
      const px = this.player.x - this.camera.x + w / 2
      const py = this.player.y - this.camera.y + h / 2
      const flick = 1 + Math.sin(this.elapsed * 9) * 0.02
      lights.push({ x: px, y: py, r: NIGHT.LIGHT * flick })
      const p = this.player
      if (p.recoil > 0.5) {
        const mx = p.x + Math.cos(p.aim) * 30 - this.camera.x + w / 2
        const my = p.y + Math.sin(p.aim) * 30 - this.camera.y + h / 2
        lights.push({ x: mx, y: my, r: 130 })
      }
      for (const tu of this.turrets) {
        lights.push({ x: tu.x - this.camera.x + w / 2, y: tu.y - this.camera.y + h / 2, r: 150 })
      }
      const viewL = this.camera.x - w / 2 - 900
      const viewR = this.camera.x + w / 2 + 900
      const viewT = this.camera.y - h / 2 - 900
      const viewB = this.camera.y + h / 2 + 900
      for (const l of this.streetLights) {
        if (l.x < viewL || l.x > viewR || l.y < viewT || l.y > viewB) continue
        lights.push({ x: l.x - this.camera.x + w / 2, y: l.y - this.camera.y + h / 2, r: 150 })
      }
    } else {
      lights.push({ x: w / 2, y: h / 2, r: 430 })
    }
    dc.globalCompositeOperation = 'destination-out'
    for (const l of lights) {
      const g = dc.createRadialGradient(l.x, l.y, 14, l.x, l.y, l.r)
      g.addColorStop(0, 'rgba(0,0,0,1)')
      g.addColorStop(0.5, 'rgba(0,0,0,0.88)')
      g.addColorStop(0.78, 'rgba(0,0,0,0.5)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      dc.fillStyle = g
      dc.beginPath()
      dc.arc(l.x, l.y, l.r, 0, TAU)
      dc.fill()
    }
    if (this.phase !== 'menu') {
      const p = this.player
      const px = p.x - this.camera.x + w / 2
      const py = p.y - this.camera.y + h / 2
      const coneLen = NIGHT.LIGHT + 280
      const half = 0.36
      dc.save()
      dc.beginPath()
      dc.moveTo(px, py)
      dc.arc(px, py, coneLen, p.aim - half, p.aim + half)
      dc.closePath()
      dc.clip()
      const cg = dc.createRadialGradient(px, py, 30, px, py, coneLen)
      cg.addColorStop(0, 'rgba(0,0,0,1)')
      cg.addColorStop(0.55, 'rgba(0,0,0,0.85)')
      cg.addColorStop(1, 'rgba(0,0,0,0)')
      dc.fillStyle = cg
      dc.beginPath()
      dc.arc(px, py, coneLen, 0, TAU)
      dc.fill()
      dc.restore()
    }
    dc.globalCompositeOperation = 'source-over'
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(this.darkLayer, 0, 0, w, h)
  }

  drawCrosshair(ctx) {
    const m = this.input.mouse
    ctx.strokeStyle = '#cf8a3c'
    ctx.lineWidth = 1.6
    const r = 8
    ctx.beginPath()
    ctx.moveTo(m.x - r - 3, m.y)
    ctx.lineTo(m.x - r, m.y)
    ctx.moveTo(m.x + r, m.y)
    ctx.lineTo(m.x + r + 3, m.y)
    ctx.moveTo(m.x, m.y - r - 3)
    ctx.lineTo(m.x, m.y - r)
    ctx.moveTo(m.x, m.y + r)
    ctx.lineTo(m.x, m.y + r + 3)
    ctx.stroke()
    ctx.fillStyle = '#cf8a3c'
    ctx.beginPath()
    ctx.arc(m.x, m.y, 1.4, 0, TAU)
    ctx.fill()
  }

  drawMinimap(ctx) {
    const size = 178
    const pad = 9
    const x0 = this.viewW - size - 22
    const y0 = this.viewH - size - 100
    const sc = (size - pad * 2) / WORLD
    const X = (v) => x0 + pad + v * sc
    const Y = (v) => y0 + pad + v * sc

    ctx.save()
    ctx.fillStyle = 'rgba(14,17,12,0.88)'
    ctx.beginPath()
    this.rrect(ctx, x0 - 2, y0 - 18, size + 4, size + 22, 8)
    ctx.fill()
    ctx.strokeStyle = 'rgba(214,178,120,0.55)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = 'rgba(214,178,120,0.85)'
    ctx.font = '600 9px "Chakra Petch", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('MAP', x0 + 8, y0 - 6)

    ctx.fillStyle = 'rgba(4,5,3,0.9)'
    ctx.beginPath()
    this.rrect(ctx, x0, y0, size, size, 7)
    ctx.fill()
    ctx.strokeStyle = 'rgba(214,178,120,0.4)'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 1.4
    for (const ax of AVENUE_X) {
      ctx.beginPath()
      ctx.moveTo(X(ax), Y(CORE))
      ctx.lineTo(X(ax), Y(CORE_END))
      ctx.stroke()
    }
    for (const ay of AVENUE_Y) {
      ctx.beginPath()
      ctx.moveTo(X(CORE), Y(ay))
      ctx.lineTo(X(CORE_END), Y(ay))
      ctx.stroke()
    }
    for (const sx of RES_STREETS) {
      ctx.beginPath()
      ctx.moveTo(X(sx), Y(1040))
      ctx.lineTo(X(sx), Y(3960))
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(X(1040), Y(sx))
      ctx.lineTo(X(3960), Y(sx))
      ctx.stroke()
    }

    ctx.strokeStyle = 'rgba(214,178,120,0.5)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(X(2500), Y(0))
    ctx.lineTo(X(2500), Y(WORLD))
    ctx.stroke()
    ctx.strokeRect(X(500), Y(500), X(7500) - X(500), Y(7500) - Y(500))

    for (const b of this.buildings) {
      ctx.fillStyle = b.infested ? 'rgba(216,168,84,0.85)' : 'rgba(124,128,112,0.9)'
      ctx.fillRect(X(b.x), Y(b.y), Math.max(1.6, b.w * sc), Math.max(1.6, b.h * sc))
    }

    ctx.fillStyle = 'rgba(224,84,64,0.95)'
    for (const z of this.zombies) {
      ctx.fillRect(X(z.x) - 1, Y(z.y) - 1, 2.2, 2.2)
    }

    const camX = Math.max(0, Math.min(WORLD - this.viewW, this.camera.x - this.viewW / 2))
    const camY = Math.max(0, Math.min(WORLD - this.viewH, this.camera.y - this.viewH / 2))
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.strokeRect(X(camX), Y(camY), Math.min(this.viewW, WORLD) * sc, Math.min(this.viewH, WORLD) * sc)
    ctx.setLineDash([])

    ctx.fillStyle = '#e9e5d6'
    ctx.beginPath()
    ctx.arc(X(this.player.x), Y(this.player.y), 3, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.strokeStyle = '#e9e5d6'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(X(this.player.x), Y(this.player.y))
    ctx.lineTo(X(this.player.x + Math.cos(this.player.aim) * 9), Y(this.player.y + Math.sin(this.player.aim) * 9))
    ctx.stroke()
    ctx.restore()
  }
}

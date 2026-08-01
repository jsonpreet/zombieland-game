export class AudioSys {
  constructor() {
    this.ctx = null
    this.master = null
    this.musicGain = null
    this.muted = false
    this.noiseBuf = null
    this.musicOn = false
    this.intensity = 0.5
    this.step = 0
    this.nextT = 0
    this.timer = null
    this.padNodes = []
    this.bassNotes = [55, 55, 65.4, 55, 43.65, 43.65, 49, 49]
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.85
      this.master.connect(this.ctx.destination)
      this.musicGain = this.ctx.createGain()
      this.musicGain.gain.value = 0.4
      this.musicGain.connect(this.master)
      this.noiseBuf = this.makeNoise()
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }

  setMuted(m) {
    this.muted = m
    if (this.master) this.master.gain.value = m ? 0 : 0.85
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 1
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  noise({ dur = 0.1, freq = 2000, q = 1, gain = 0.4, type = 'bandpass', slideTo = null, delay = 0, dest = null }) {
    if (!this.ctx) return
    const t = this.ctx.currentTime + delay
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const f = this.ctx.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(freq, t)
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 20), t + dur)
    f.Q.value = q
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(f).connect(g).connect(dest || this.master)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  tone({ freq, dur = 0.1, type = 'sine', gain = 0.3, slideTo = null, delay = 0, dest = null, attack = 0.004 }) {
    if (!this.ctx) return
    const t = this.ctx.currentTime + delay
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 15), t + dur)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + attack)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g).connect(dest || this.master)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  shot(w) {
    switch (w) {
      case 'pistol':
        this.noise({ dur: 0.09, freq: 2100, q: 0.8, gain: 0.5 })
        this.tone({ freq: 150, slideTo: 60, dur: 0.1, type: 'sine', gain: 0.5 })
        break
      case 'smg':
        this.noise({ dur: 0.055, freq: 2600, q: 0.7, gain: 0.3 })
        this.tone({ freq: 190, slideTo: 90, dur: 0.06, type: 'sine', gain: 0.3 })
        break
      case 'shotgun':
        this.noise({ dur: 0.24, freq: 1300, q: 0.6, gain: 0.75 })
        this.tone({ freq: 110, slideTo: 40, dur: 0.22, type: 'sine', gain: 0.8 })
        break
      case 'rifle':
        this.noise({ dur: 0.12, freq: 3300, q: 1.4, gain: 0.5 })
        this.tone({ freq: 210, slideTo: 80, dur: 0.11, type: 'sine', gain: 0.45 })
        break
      case 'lmg':
        this.noise({ dur: 0.07, freq: 2900, q: 1.1, gain: 0.34 })
        this.noise({ dur: 0.03, freq: 4200, q: 1.6, gain: 0.14 })
        this.tone({ freq: 205, slideTo: 100, dur: 0.07, type: 'sine', gain: 0.32 })
        break
    }
  }

  dryfire() {
    this.tone({ freq: 900, dur: 0.03, type: 'square', gain: 0.08 })
  }

  reload() {
    this.noise({ dur: 0.04, freq: 1400, q: 2, gain: 0.2 })
    this.noise({ dur: 0.05, freq: 900, q: 2, gain: 0.25, delay: 0.16 })
  }

  zombieHit() {
    this.tone({ freq: 170, slideTo: 90, dur: 0.06, type: 'triangle', gain: 0.3 })
    this.noise({ dur: 0.05, freq: 700, q: 1, gain: 0.2 })
  }

  zombieDie() {
    this.tone({ freq: 130, slideTo: 55, dur: 0.3, type: 'sawtooth', gain: 0.16 })
    this.noise({ dur: 0.16, freq: 600, q: 0.8, gain: 0.3 })
  }

  groan() {
    const f = 65 + Math.random() * 45
    this.tone({ freq: f, slideTo: f * 0.75, dur: 0.7, type: 'sawtooth', gain: 0.05 })
  }

  playerHurt() {
    this.tone({ freq: 220, slideTo: 90, dur: 0.18, type: 'sawtooth', gain: 0.35 })
    this.noise({ dur: 0.12, freq: 400, q: 1, gain: 0.25 })
  }

  pickup() {
    this.tone({ freq: 660, dur: 0.07, gain: 0.2 })
    this.tone({ freq: 880, dur: 0.09, gain: 0.2, delay: 0.07 })
  }

  scrap() {
    this.tone({ freq: 880, dur: 0.05, type: 'square', gain: 0.07 })
  }

  waveStart() {
    for (let i = 0; i < 3; i++) {
      this.tone({ freq: i % 2 ? 520 : 440, dur: 0.14, type: 'square', gain: 0.1, delay: i * 0.18 })
    }
  }

  bossRoar() {
    this.tone({ freq: 58, slideTo: 34, dur: 1.4, type: 'sawtooth', gain: 0.5 })
    this.noise({ dur: 1.2, freq: 300, q: 0.5, gain: 0.4, slideTo: 90 })
  }

  daybreak() {
    ;[523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.35, gain: 0.12, delay: i * 0.12 }))
  }

  win() {
    ;[523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.5, gain: 0.14, delay: i * 0.16 }))
    this.tone({ freq: 262, slideTo: 523, dur: 1.3, type: 'triangle', gain: 0.16, delay: 0.85 })
    this.noise({ dur: 0.6, freq: 900, q: 0.8, gain: 0.06, delay: 1.4, slideTo: 2400 })
  }

  melee() {
    this.noise({ dur: 0.1, freq: 950, q: 1.4, gain: 0.22, slideTo: 300 })
  }

  meleeHit() {
    this.tone({ freq: 140, slideTo: 70, dur: 0.1, type: 'triangle', gain: 0.4 })
    this.noise({ dur: 0.08, freq: 500, q: 1, gain: 0.25 })
  }

  doorBang() {
    this.tone({ freq: 95, slideTo: 55, dur: 0.14, type: 'triangle', gain: 0.5 })
    this.noise({ dur: 0.09, freq: 300, q: 1.2, gain: 0.3 })
  }

  doorBreak() {
    this.tone({ freq: 120, slideTo: 40, dur: 0.28, type: 'sawtooth', gain: 0.4 })
    this.noise({ dur: 0.28, freq: 700, q: 0.6, gain: 0.35, slideTo: 180 })
    this.noise({ dur: 0.14, freq: 1200, q: 1.5, gain: 0.2, delay: 0.06 })
  }

  click() {
    this.tone({ freq: 520, dur: 0.04, type: 'square', gain: 0.08 })
  }

  search() {
    this.noise({ dur: 0.14, freq: 900, q: 0.8, gain: 0.2, slideTo: 1400 })
    this.noise({ dur: 0.1, freq: 700, q: 0.8, gain: 0.15, delay: 0.12, slideTo: 1100 })
  }

  found() {
    this.tone({ freq: 587, dur: 0.09, gain: 0.16 })
    this.tone({ freq: 880, dur: 0.12, gain: 0.16, delay: 0.09 })
  }

  empty() {
    this.tone({ freq: 260, dur: 0.09, type: 'square', gain: 0.08 })
    this.tone({ freq: 180, dur: 0.12, type: 'square', gain: 0.08, delay: 0.1 })
  }

  eat() {
    this.noise({ dur: 0.05, freq: 1600, q: 2.5, gain: 0.25 })
    this.noise({ dur: 0.06, freq: 1200, q: 2.5, gain: 0.2, delay: 0.11 })
    this.noise({ dur: 0.05, freq: 1400, q: 2.5, gain: 0.18, delay: 0.24 })
  }

  place() {
    this.tone({ freq: 200, slideTo: 90, dur: 0.16, type: 'triangle', gain: 0.4 })
    this.noise({ dur: 0.1, freq: 500, q: 1, gain: 0.2 })
  }

  turretFire() {
    this.noise({ dur: 0.045, freq: 2400, q: 1.2, gain: 0.16 })
  }

  turretBreak() {
    this.noise({ dur: 0.2, freq: 1200, q: 0.6, gain: 0.4 })
    this.tone({ freq: 240, slideTo: 60, dur: 0.3, type: 'square', gain: 0.2 })
  }

  gameover() {
    ;[330, 262, 196, 131].forEach((f, i) => this.tone({ freq: f, dur: 0.5, type: 'sawtooth', gain: 0.18, delay: i * 0.28 }))
    this.stopMusic()
  }

  startMusic() {
    this.ensure()
    if (!this.ctx || this.musicOn) return
    this.musicOn = true
    this.intensity = 0.4
    this.step = 0
    this.nextT = this.ctx.currentTime + 0.15
    this.timer = setInterval(() => this.schedule(), 180)

    const padGain = this.ctx.createGain()
    padGain.gain.value = 0.05
    padGain.connect(this.musicGain)
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 260
    filter.connect(padGain)
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 0.12
    const lfoG = this.ctx.createGain()
    lfoG.gain.value = 90
    lfo.connect(lfoG).connect(filter.frequency)
    lfo.start()
    ;[55, 55.4, 82.4].forEach((f) => {
      const o = this.ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.connect(filter)
      o.start()
      this.padNodes.push(o)
    })
    this.padNodes.push(lfo)
    this.padGain = padGain
  }

  schedule() {
    while (this.nextT < this.ctx.currentTime + 0.55) {
      this.playStep(this.step, this.nextT)
      this.step++
      const spb = 60 / (86 + this.intensity * 44) / 2
      this.nextT += spb
    }
  }

  playStep(i, t) {
    const spb = 60 / (86 + this.intensity * 44) / 2
    if (i % 8 === 0) {
      this.kick(t)
    }
    if (i % 16 === 8) {
      this.kick(t)
    }
    if (i % 4 === 2) {
      this.bass(t)
    }
    if (i % 2 === 1 && this.intensity > 0.7) {
      this.noise({ dur: 0.02, freq: 7000, q: 1, gain: 0.04, delay: Math.max(0, t - this.ctx.currentTime), dest: this.musicGain })
    }
  }

  kick(t) {
    const delay = Math.max(0, t - this.ctx.currentTime)
    this.tone({ freq: 75, slideTo: 42, dur: 0.14, type: 'sine', gain: 0.5, delay, dest: this.musicGain })
  }

  bass(t) {
    const delay = Math.max(0, t - this.ctx.currentTime)
    const f = this.bassNotes[Math.floor(this.step / 4) % this.bassNotes.length]
    this.tone({ freq: f, slideTo: f * 0.98, dur: 0.4, type: 'triangle', gain: 0.22, delay, dest: this.musicGain })
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.musicOn = false
    this.padNodes.forEach((n) => {
      try {
        n.stop()
      } catch (e) {}
    })
    this.padNodes = []
    if (this.padGain) {
      this.padGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2)
    }
  }
}

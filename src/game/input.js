export class Input {
  constructor(canvas) {
    this.keys = new Set()
    this.pressed = new Set()
    this.mouse = { x: 0, y: 0, down: false }
    this.right = false
    this.rightPressed = false

    this._kd = (e) => {
      if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault()
      const k = e.key.toLowerCase()
      if (!e.repeat) this.pressed.add(k)
      this.keys.add(k)
    }
    this._ku = (e) => this.keys.delete(e.key.toLowerCase())
    this._mm = (e) => {
      this.mouse.x = e.clientX
      this.mouse.y = e.clientY
    }
    this._md = (e) => {
      if (e.button === 0) this.mouse.down = true
      if (e.button === 2) {
        this.right = true
        this.rightPressed = true
      }
    }
    this._mu = (e) => {
      if (e.button === 0) this.mouse.down = false
      if (e.button === 2) this.right = false
    }
    this._cm = (e) => e.preventDefault()
    this._blur = () => {
      this.keys.clear()
      this.mouse.down = false
      this.right = false
    }

    window.addEventListener('keydown', this._kd)
    window.addEventListener('keyup', this._ku)
    window.addEventListener('mousemove', this._mm)
    window.addEventListener('mousedown', this._md)
    window.addEventListener('mouseup', this._mu)
    window.addEventListener('blur', this._blur)
    canvas.addEventListener('contextmenu', this._cm)
  }

  down(k) {
    return this.keys.has(k)
  }

  press(k) {
    const v = this.pressed.has(k)
    if (v) this.pressed.delete(k)
    return v
  }

  moveVec() {
    let x = 0
    let y = 0
    if (this.down('w') || this.down('arrowup')) y -= 1
    if (this.down('s') || this.down('arrowdown')) y += 1
    if (this.down('a') || this.down('arrowleft')) x -= 1
    if (this.down('d') || this.down('arrowright')) x += 1
    if (x !== 0 && y !== 0) {
      x *= 0.7071
      y *= 0.7071
    }
    return [x, y]
  }

  destroy() {
    window.removeEventListener('keydown', this._kd)
    window.removeEventListener('keyup', this._ku)
    window.removeEventListener('mousemove', this._mm)
    window.removeEventListener('mousedown', this._md)
    window.removeEventListener('mouseup', this._mu)
    window.removeEventListener('blur', this._blur)
  }
}

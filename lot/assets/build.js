// THE X-PLORATOR beacon: street-view motion for lot #323.
// The orbital rings turn around the spire on the world clock (the same for
// every viewer), the docked explorer hovers on its cradle, and a tap or a
// player entering the lot sends a pulse of light through the strips.
const SHIP = { x: 0, y: 5.12, z: 3.95, yaw: 0.32 }

export default function build(b) {
  let pulse = 0
  b.loop((dt, t) => {
    b.node('RingA', { rotation: [0, t * 0.21, 0] })
    b.node('RingB', { rotation: [0, -t * 0.16, 0] })
    b.node('RingC', { rotation: [0, t * 0.27, 0] })
    b.node('Ship', {
      position: [SHIP.x, SHIP.y + Math.sin(t * 1.3) * 0.12, SHIP.z],
      rotation: [Math.sin(t * 0.9) * 0.025, SHIP.yaw + Math.sin(t * 0.37) * 0.06, Math.sin(t * 1.1) * 0.035],
    })
    pulse = Math.max(0, pulse - dt * 0.7)
    b.uniform('pulse', pulse)
  })
  b.on('tap', () => { pulse = 1 })
  b.on('enter', () => { pulse = 1 })
}

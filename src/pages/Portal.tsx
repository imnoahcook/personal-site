import { useCallback, useEffect, useRef } from 'react'
import './Portal.css'

const IMG = '/fp-img'

export default function Portal() {
  const geometryRef = useRef<HTMLDivElement>(null)
  const posRef = useRef({ x: 0, y: 0, z: 0 })
  const rotRef = useRef({ x: 0, y: 0, z: 0 })
  const noclipRef = useRef(false)
  const spookyCatRef = useRef<HTMLDivElement>(null)
  const spookyCatSpriteRef = useRef<HTMLImageElement>(null)
  const touchMoveRef = useRef({ forward: 0, rotate: 0 })
  const touchAnimRef = useRef<number>(0)

  const updateGeometry = useCallback(() => {
    const el = geometryRef.current
    if (!el) return
    const { x, y, z } = posRef.current
    const rot = rotRef.current
    el.style.transformOrigin = `${-x}px ${-y}px ${-z + 800}px`
    el.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateX(${rot.x}deg) rotateY(${rot.y}deg) rotateZ(${rot.z}deg)`
  }, [])

  const movePoint = useCallback(
    (x: number, z: number, distance: number, angleDegrees: number) => {
      const normalizedAngle = ((angleDegrees % 360) + 360) % 360
      const angleRadians = normalizedAngle * (Math.PI / 180)
      return {
        x: x - distance * Math.sin(angleRadians),
        z: z + distance * Math.cos(angleRadians),
      }
    },
    [],
  )

  const inBounds = useCallback((x: number, z: number) => {
    const b = { x: false, z: false }
    if (noclipRef.current) return { x: true, z: true }
    if (
      (x > -2324 && x < 750 && z > -1130 && z < 1946) ||
      (x > -160 && x < 601)
    )
      b.x = true
    if ((z > -1130 && z < 1946) || (z > -2066 && z < -1654)) b.z = true
    return b
  }, [])

  const applyMovement = useCallback(
    (forward: number, rotate: number) => {
      const pos = posRef.current
      const rot = rotRef.current
      rot.y += rotate
      if (forward !== 0) {
        const np = movePoint(pos.x, pos.z, forward, rot.y)
        const bounds = inBounds(np.x, np.z)
        if (bounds.x) pos.x = np.x
        if (bounds.z) pos.z = np.z
      }
      updateGeometry()
    },
    [movePoint, inBounds, updateGeometry],
  )

  const teleport = useCallback(
    (x: number, z: number, rot: number) => {
      posRef.current.x = x
      posRef.current.z = z
      rotRef.current.y = rot
      updateGeometry()
    },
    [updateGeometry],
  )

  // Keyboard controls
  useEffect(() => {
    const rotationSpeed = 5
    const translationSpeed = 30

    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
          applyMovement(0, -rotationSpeed)
          break
        case 'ArrowRight':
        case 'd':
          applyMovement(0, rotationSpeed)
          break
        case 'ArrowUp':
        case 'w':
          applyMovement(translationSpeed, 0)
          break
        case 'ArrowDown':
        case 's':
          applyMovement(-translationSpeed, 0)
          break
        case 'v':
          noclipRef.current = !noclipRef.current
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [applyMovement])

  // Touch controls — continuous movement loop
  useEffect(() => {
    let running = false

    const tick = () => {
      const { forward, rotate } = touchMoveRef.current
      if (forward !== 0 || rotate !== 0) {
        applyMovement(forward, rotate)
      }
      if (running) {
        touchAnimRef.current = requestAnimationFrame(tick)
      }
    }

    running = true
    touchAnimRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(touchAnimRef.current)
    }
  }, [applyMovement])

  // Touch handlers for mobile joysticks
  const leftTouchId = useRef<number | null>(null)
  const rightTouchId = useRef<number | null>(null)
  const leftOrigin = useRef({ x: 0, y: 0 })
  const rightOrigin = useRef({ x: 0, y: 0 })
  const leftStickRef = useRef<HTMLDivElement>(null)
  const rightStickRef = useRef<HTMLDivElement>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const w = window.innerWidth
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      if (t.clientX < w / 2 && leftTouchId.current === null) {
        leftTouchId.current = t.identifier
        leftOrigin.current = { x: t.clientX, y: t.clientY }
      } else if (t.clientX >= w / 2 && rightTouchId.current === null) {
        rightTouchId.current = t.identifier
        rightOrigin.current = { x: t.clientX, y: t.clientY }
      }
    }
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      if (t.identifier === leftTouchId.current) {
        const dy = leftOrigin.current.y - t.clientY
        const clampedForward = Math.max(-1, Math.min(1, dy / 60))
        touchMoveRef.current.forward = clampedForward * 12
        if (leftStickRef.current) {
          const dx = Math.max(
            -30,
            Math.min(30, t.clientX - leftOrigin.current.x),
          )
          const dyVis = Math.max(
            -30,
            Math.min(30, t.clientY - leftOrigin.current.y),
          )
          leftStickRef.current.style.transform = `translate(${dx}px, ${dyVis}px)`
        }
      }
      if (t.identifier === rightTouchId.current) {
        const dx = t.clientX - rightOrigin.current.x
        const clampedRotate = Math.max(-1, Math.min(1, dx / 60))
        touchMoveRef.current.rotate = clampedRotate * 3
        if (rightStickRef.current) {
          const dxVis = Math.max(-30, Math.min(30, dx))
          const dyVis = Math.max(
            -30,
            Math.min(30, t.clientY - rightOrigin.current.y),
          )
          rightStickRef.current.style.transform = `translate(${dxVis}px, ${dyVis}px)`
        }
      }
    }
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      if (t.identifier === leftTouchId.current) {
        leftTouchId.current = null
        touchMoveRef.current.forward = 0
        if (leftStickRef.current) leftStickRef.current.style.transform = ''
      }
      if (t.identifier === rightTouchId.current) {
        rightTouchId.current = null
        touchMoveRef.current.rotate = 0
        if (rightStickRef.current) rightStickRef.current.style.transform = ''
      }
    }
  }, [])

  const showSpookyCat = () => {
    if (spookyCatRef.current) spookyCatRef.current.style.display = 'block'
    if (spookyCatSpriteRef.current)
      spookyCatSpriteRef.current.style.opacity = '1'
  }

  const isMobile = typeof window !== 'undefined' && 'ontouchstart' in window

  return (
    <div
      className="fp-page"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {isMobile ? 'Touch to move' : 'WASD to move, look around the world!'}
      <div id="fp-scene">
        <div id="fp-geometry" ref={geometryRef}>
          <div className="fp-floor" />

          {/* Room 1 */}
          <div
            className="fp-room"
            style={{ transform: 'translate3d(0, -200px, 0)' }}
          >
            <div
              className="fp-wall fp-front"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <a
                href="/"
                style={{
                  color: '#91ebff',
                  fontFamily: 'Courier New, monospace',
                  fontSize: 20,
                  textAlign: 'center',
                  textDecoration: 'none',
                }}
              >
                <img width="200" src={`${IMG}/spr/computer.gif`} alt="home" />
                <br />
                home page
              </a>
            </div>
            <div className="fp-wall fp-back" />
            <div className="fp-wall fp-left" />
            <div className="fp-wall fp-right" />
          </div>

          {/* Room 2 */}
          <div
            className="fp-room"
            style={{ transform: 'translate3d(-800px, -200px, 0)' }}
          >
            <div className="fp-wall fp-front" />
            <div className="fp-wall fp-back" />
            <div className="fp-wall fp-left" />
            <div className="fp-wall fp-right" />
          </div>

          {/* Building 1 */}
          <div
            className="fp-room"
            style={{
              transform:
                'translateY(-800px) translateX(-2300px) translateZ(2000px) scale3D(1.6, 2, 1.6)',
            }}
          >
            <div className="fp-building fp-front" />
            <div className="fp-building fp-back" />
            <div className="fp-building fp-left" />
            <div className="fp-building fp-right" />
          </div>

          {/* Building 2 */}
          <div
            className="fp-room"
            style={{
              transform:
                'translateY(-800px) translateX(3500px) translateZ(300px) scale3D(1.6, 2, 1.6)',
            }}
          >
            <div
              className="fp-building fp-front"
              style={{ background: `url('${IMG}/spr/BUILD011.png')` }}
            />
            <div
              className="fp-building fp-back"
              style={{ background: `url('${IMG}/spr/BUILD011.png')` }}
            />
            <div
              className="fp-building fp-left"
              style={{ background: `url('${IMG}/spr/BUILD011.png')` }}
            />
            <div
              className="fp-building fp-right"
              style={{ background: `url('${IMG}/spr/BUILD011.png')` }}
            />
          </div>

          {/* Building 3 */}
          <div
            className="fp-room"
            style={{
              transform:
                'translateY(-600px) translateX(4300px) translateZ(-1000px) scale3D(1.6, 2, 1.6)',
            }}
          >
            <div
              className="fp-building fp-front"
              style={{ background: `url('${IMG}/spr/BUILD011.png')` }}
            />
            <div
              className="fp-building fp-back"
              style={{ background: `url('${IMG}/spr/BUILD011.png')` }}
            />
            <div
              className="fp-building fp-left"
              style={{ background: `url('${IMG}/spr/BUILD011.png')` }}
            />
            <div
              className="fp-building fp-right"
              style={{ background: `url('${IMG}/spr/BUILD011.png')` }}
            />
          </div>

          {/* Trees */}
          <div
            className="fp-tree1"
            style={{ transform: 'translate3d(-300px, -150px, 200px)' }}
          />
          <div
            className="fp-tree1"
            style={{ transform: 'translate3d(700px, -150px, 400px)' }}
          />

          <div className="fp-group">
            <div
              className="fp-tree2"
              style={{ transform: 'translate3d(-400px, -500px, -1900px)' }}
            />
            <div
              className="fp-tree2"
              style={{ transform: 'translate3d(-500px, -400px, -1400px)' }}
            />
            <div
              className="fp-tree2"
              style={{ transform: 'translate3d(-700px, -450px, -1700px)' }}
            />
          </div>

          <div
            className="fp-group"
            style={{ transform: 'translate3d(1000px, -100px, -300px)' }}
          >
            <div
              className="fp-tree2"
              style={{ transform: 'translate3d(-400px, -500px, -1900px)' }}
            />
            <div
              className="fp-tree2"
              style={{ transform: 'translate3d(-500px, -400px, -1400px)' }}
            />
            <div
              className="fp-tree2"
              style={{ transform: 'translate3d(-700px, -450px, -1700px)' }}
            />
          </div>

          {/* Rainbow */}
          <div
            className="fp-emptyplane"
            style={{
              transform:
                'scale3D(7, 7, 7) translateY(80px) translateX(-20px) translateZ(-400px)',
            }}
          >
            <img width="200px" src={`${IMG}/spr/rainbow.gif`} alt="" />
          </div>

          {/* Roof */}
          <div
            className="fp-wallLong"
            style={{
              background: `url('${IMG}/spr/ROOF_03B.GIF')`,
              transform: 'translate3d(-800px, -540px, 2140px) rotateX(-45deg)',
            }}
          />

          {/* Cottage */}
          <div className="fp-group">
            <div
              className="fp-wallMedium"
              style={{
                background: `url('${IMG}/spr/PINEFLOR.JPG')`,
                transform:
                  'translate3d(-800px, -540px, 2540px) rotateX(-45deg)',
              }}
            />
            <div
              className="fp-wallMedium"
              style={{
                background: `url('${IMG}/spr/PINEFLOR.JPG')`,
                transform: 'translate3d(-800px, -540px, 2800px) rotateX(45deg)',
              }}
            />
            <div
              className="fp-wallMedium"
              style={{ transform: 'translate3d(-800px, -200px, 2400px)' }}
            >
              <img
                style={{ paddingTop: 70, paddingLeft: 170 }}
                width="200px"
                src={`${IMG}/rainwindow.gif`}
                alt=""
              />
              <img
                style={{ paddingTop: 70, paddingLeft: 170 }}
                width="200px"
                src={`${IMG}/rainwindow.gif`}
                alt=""
              />
            </div>
            <div
              className="fp-wallMedium"
              style={{ transform: 'translate3d(-800px, -200px, 2940px)' }}
            >
              <img
                style={{ paddingTop: 70, paddingLeft: 170 }}
                width="200px"
                src={`${IMG}/rainwindow.gif`}
                alt=""
              />
              <img
                style={{ paddingTop: 70, paddingLeft: 170 }}
                width="200px"
                src={`${IMG}/rainwindow.gif`}
                alt=""
              />
            </div>
            <div
              className="fp-wallMedium"
              style={{
                background: `url('${IMG}/spr/PLANK01.png')`,
                height: 800,
                transform: 'translate3d(-800px, -200px, 2800px) rotateX(90deg)',
              }}
            />
            <div
              className="fp-wallMedium"
              style={{
                height: 800,
                transform: 'translate3d(-300px, -500px, 2800px) rotateY(90deg)',
              }}
            >
              <img
                className="fp-clickable"
                style={{ paddingTop: 390, paddingLeft: 530 }}
                width="200px"
                src={`${IMG}/spr/dooropen2.gif`}
                alt="door"
                onClick={() => teleport(0, 0, 0)}
              />
            </div>
            <div
              className="fp-wallMedium"
              style={{
                height: 800,
                transform:
                  'translate3d(-1200px, -500px, 2800px) rotateY(90deg)',
              }}
            >
              <div onClick={showSpookyCat} style={{ cursor: 'pointer' }}>
                <img
                  width="200px"
                  style={{ paddingLeft: 530, paddingTop: 516 }}
                  src={`${IMG}/spr/fireplace.gif`}
                  alt="fireplace"
                />
              </div>
            </div>
            <div
              ref={spookyCatRef}
              className="fp-emptyplane"
              style={{
                transform:
                  'translateY(-60px) translateX(-800px) translateZ(2650px) rotateY(90deg)',
                display: 'none',
              }}
            >
              <img
                ref={spookyCatSpriteRef}
                width="200px"
                style={{ opacity: 0.1, transition: 'opacity 4s' }}
                src={`${IMG}/spr/angkitty.gif`}
                alt="spooky cat"
              />
            </div>
          </div>

          {/* Outer walls */}
          <div
            className="fp-wallLong"
            style={{ transform: 'translate3d(-800px, -200px, -1200px)' }}
          >
            <img
              style={{ paddingBottom: 90, paddingLeft: 90 }}
              width="200px"
              src={`${IMG}/rainwindow.gif`}
              alt=""
            />
            <img
              style={{ paddingBottom: 90, paddingLeft: 90 }}
              width="200px"
              src={`${IMG}/rainwindow.gif`}
              alt=""
            />
            <img
              className="fp-clickable"
              style={{ paddingTop: 90, paddingLeft: 90 }}
              width="200px"
              src={`${IMG}/spr/dooropen2.gif`}
              alt="door"
              onClick={() => teleport(28, -1860, -90)}
            />
          </div>
          <div
            className="fp-wallLong"
            style={{ transform: 'translate3d(-800px, -200px, 2000px)' }}
          />
          <div
            className="fp-wallLong"
            style={{
              transform: 'rotateY(-90deg) translate3d(400px, -200px, 2400px)',
            }}
          />
          <div
            className="fp-wallLong"
            style={{
              transform: 'rotateY(-90deg) translate3d(400px, -200px, -800px)',
            }}
          />
        </div>
      </div>

      {/* Mobile joystick overlays */}
      {isMobile && (
        <>
          <div className="fp-joystick fp-joystick-left">
            <div className="fp-joystick-ring">
              <div ref={leftStickRef} className="fp-joystick-knob" />
            </div>
            <span className="fp-joystick-label">move</span>
          </div>
          <div className="fp-joystick fp-joystick-right">
            <div className="fp-joystick-ring">
              <div ref={rightStickRef} className="fp-joystick-knob" />
            </div>
            <span className="fp-joystick-label">look</span>
          </div>
        </>
      )}
    </div>
  )
}

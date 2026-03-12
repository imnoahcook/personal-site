import { useEffect, useRef, useCallback } from 'react'

interface Platform {
  x: number
  y: number
  w: number
  h: number
  color: string
}

interface Coin {
  x: number
  y: number
  collected: boolean
}

const GRAVITY = 0.25
const JUMP_FORCE = -7
const MOVE_SPEED = 2
const PLAYER_W = 24
const PLAYER_H = 32

const platforms: Platform[] = [
  // Ground
  { x: 0, y: 550, w: 900, h: 50, color: '#0a2a1a' },
  // Platforms
  { x: 150, y: 440, w: 120, h: 16, color: '#1a3a2a' },
  { x: 350, y: 360, w: 100, h: 16, color: '#0a1a2a' },
  { x: 550, y: 300, w: 140, h: 16, color: '#1a3a2a' },
  { x: 200, y: 230, w: 100, h: 16, color: '#0a1a2a' },
  { x: 420, y: 170, w: 120, h: 16, color: '#1a3a2a' },
  { x: 650, y: 200, w: 100, h: 16, color: '#0a1a2a' },
  { x: 70, y: 140, w: 90, h: 16, color: '#1a3a2a' },
  { x: 750, y: 420, w: 100, h: 16, color: '#0a1a2a' },
  { x: 30, y: 340, w: 80, h: 16, color: '#1a3a2a' },
]

const initialCoins: Coin[] = [
  { x: 200, y: 410, collected: false },
  { x: 390, y: 330, collected: false },
  { x: 610, y: 270, collected: false },
  { x: 240, y: 200, collected: false },
  { x: 470, y: 140, collected: false },
  { x: 690, y: 170, collected: false },
  { x: 100, y: 110, collected: false },
  { x: 790, y: 390, collected: false },
  { x: 60, y: 310, collected: false },
]

export default function Platformer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const keysRef = useRef<Set<string>>(new Set())
  const gameStateRef = useRef({
    px: 100,
    py: 500,
    vx: 0,
    vy: 0,
    onGround: false,
    score: 0,
    coins: initialCoins.map((c) => ({ ...c })),
    frame: 0,
  })

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const state = gameStateRef.current
    const keys = keysRef.current

    // Input
    state.vx = 0
    if (keys.has('ArrowLeft') || keys.has('a')) state.vx = -MOVE_SPEED
    if (keys.has('ArrowRight') || keys.has('d')) state.vx = MOVE_SPEED
    if ((keys.has('ArrowUp') || keys.has('w') || keys.has(' ')) && state.onGround) {
      state.vy = JUMP_FORCE
      state.onGround = false
    }

    // Physics
    state.vy += GRAVITY
    state.px += state.vx
    state.py += state.vy

    // Platform collision
    state.onGround = false
    for (const plat of platforms) {
      if (
        state.px + PLAYER_W > plat.x &&
        state.px < plat.x + plat.w &&
        state.py + PLAYER_H > plat.y &&
        state.py + PLAYER_H < plat.y + plat.h + state.vy + 2 &&
        state.vy >= 0
      ) {
        state.py = plat.y - PLAYER_H
        state.vy = 0
        state.onGround = true
      }
    }

    // Boundaries
    if (state.px < 0) state.px = 0
    if (state.px + PLAYER_W > 900) state.px = 900 - PLAYER_W
    if (state.py > 600) {
      state.py = 500
      state.px = 100
      state.vy = 0
    }

    // Coin collection
    for (const coin of state.coins) {
      if (coin.collected) continue
      const dx = state.px + PLAYER_W / 2 - coin.x
      const dy = state.py + PLAYER_H / 2 - coin.y
      if (Math.sqrt(dx * dx + dy * dy) < 20) {
        coin.collected = true
        state.score++
      }
    }

    state.frame++

    // Render
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, 900, 600)

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(0, 204, 136, 0.03)'
    ctx.lineWidth = 1
    for (let x = 0; x < 900; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, 600)
      ctx.stroke()
    }
    for (let y = 0; y < 600; y += 40) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(900, y)
      ctx.stroke()
    }

    // Platforms
    for (const plat of platforms) {
      ctx.fillStyle = plat.color
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h)
      // Top edge glow
      ctx.strokeStyle = '#00cc8844'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(plat.x, plat.y)
      ctx.lineTo(plat.x + plat.w, plat.y)
      ctx.stroke()
    }

    // Coins
    for (const coin of state.coins) {
      if (coin.collected) continue
      const pulse = Math.sin(state.frame * 0.08) * 2
      ctx.beginPath()
      ctx.arc(coin.x, coin.y, 8 + pulse, 0, Math.PI * 2)
      ctx.fillStyle = '#00cc88'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(coin.x, coin.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#00ff99'
      ctx.fill()
    }

    // Player
    const bobble = state.onGround && state.vx !== 0 ? Math.sin(state.frame * 0.3) * 2 : 0

    // Body
    ctx.fillStyle = '#3388ff'
    ctx.fillRect(state.px + 4, state.py + 10 + bobble, PLAYER_W - 8, PLAYER_H - 16)

    // Head
    ctx.beginPath()
    ctx.arc(state.px + PLAYER_W / 2, state.py + 6 + bobble, 8, 0, Math.PI * 2)
    ctx.fillStyle = '#e0e0e0'
    ctx.fill()

    // Eyes
    const eyeDir = state.vx > 0 ? 2 : state.vx < 0 ? -2 : 0
    ctx.fillStyle = '#0a0a0a'
    ctx.beginPath()
    ctx.arc(state.px + PLAYER_W / 2 - 3 + eyeDir, state.py + 5 + bobble, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(state.px + PLAYER_W / 2 + 3 + eyeDir, state.py + 5 + bobble, 1.5, 0, Math.PI * 2)
    ctx.fill()

    // Legs
    if (state.onGround && state.vx !== 0) {
      const legAnim = Math.sin(state.frame * 0.3) * 4
      ctx.fillStyle = '#00cc88'
      ctx.fillRect(state.px + 5, state.py + PLAYER_H - 8 + bobble, 5, 8 + legAnim)
      ctx.fillRect(state.px + PLAYER_W - 10, state.py + PLAYER_H - 8 + bobble, 5, 8 - legAnim)
    } else {
      ctx.fillStyle = '#00cc88'
      ctx.fillRect(state.px + 5, state.py + PLAYER_H - 8 + bobble, 5, 8)
      ctx.fillRect(state.px + PLAYER_W - 10, state.py + PLAYER_H - 8 + bobble, 5, 8)
    }

    // HUD
    ctx.fillStyle = '#00cc88'
    ctx.font = "16px 'Orbitron', 'Space Mono', monospace"
    ctx.fillText(`COINS: ${state.score} / ${state.coins.length}`, 20, 30)

    if (state.score === state.coins.length) {
      ctx.fillStyle = '#00ff99'
      ctx.font = "bold 28px 'Orbitron', 'Space Mono', monospace"
      ctx.textAlign = 'center'
      ctx.fillText('YOU WIN!', 450, 100)
      ctx.font = "14px 'Space Mono', monospace"
      ctx.fillStyle = '#3388ff'
      ctx.fillText('Press R to restart', 450, 130)
      ctx.textAlign = 'left'
    }

    requestAnimationFrame(gameLoop)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key)
      if (e.key === 'r' || e.key === 'R') {
        const state = gameStateRef.current
        state.px = 100
        state.py = 500
        state.vx = 0
        state.vy = 0
        state.score = 0
        state.coins = initialCoins.map((c) => ({ ...c }))
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const raf = requestAnimationFrame(gameLoop)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      cancelAnimationFrame(raf)
    }
  }, [gameLoop])

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        background: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '48px',
      }}
    >
      <canvas
        ref={canvasRef}
        width={900}
        height={600}
        style={{
          border: '1px solid rgba(0, 204, 136, 0.15)',
          borderRadius: '8px',
          maxWidth: '95vw',
          maxHeight: 'calc(100vh - 140px)',
        }}
      />
      <div
        style={{
          marginTop: '1rem',
          color: '#555',
          fontSize: '0.7rem',
          fontFamily: "'Space Mono', monospace",
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          textAlign: 'center',
        }}
      >
        Arrow keys or WASD to move &bull; Collect all coins &bull; R to restart
      </div>
    </div>
  )
}

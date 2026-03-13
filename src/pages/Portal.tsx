import { useEffect, useRef } from 'react'

function Fractal() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = Math.min(window.innerWidth * 0.8, 500)
    canvas.width = size
    canvas.height = size

    let animId: number
    const draw = (time: number) => {
      const t = time * 0.001
      const imageData = ctx.createImageData(canvas.width, canvas.height)
      const data = imageData.data

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const nx = (x / canvas.width - 0.5) * 3
          const ny = (y / canvas.height - 0.5) * 3

          let zx = nx
          let zy = ny
          let i = 0
          const cx = Math.sin(t * 0.3) * 0.4 - 0.5
          const cy = Math.cos(t * 0.2) * 0.4

          while (zx * zx + zy * zy < 4 && i < 32) {
            const tmp = zx * zx - zy * zy + cx
            zy = 2 * zx * zy + cy
            zx = tmp
            i++
          }

          const idx = (y * canvas.width + x) * 4
          if (i === 32) {
            data[idx] = 0
            data[idx + 1] = 0
            data[idx + 2] = 0
          } else {
            const hue = (i / 32) * 360 + t * 20
            const r = Math.sin(hue * 0.0174) * 127 + 128
            const g = Math.sin((hue + 120) * 0.0174) * 127 + 128
            const b = Math.sin((hue + 240) * 0.0174) * 127 + 128
            data[idx] = r
            data[idx + 1] = g
            data[idx + 2] = b
          }
          data[idx + 3] = 255
        }
      }

      ctx.putImageData(imageData, 0, 0)
      animId = requestAnimationFrame(draw)
    }
    animId = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(animId)
  }, [])

  return <canvas ref={canvasRef} style={{ border: '2px solid #555', imageRendering: 'pixelated' }} />
}

export default function Portal() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Times New Roman', serif",
      color: '#e0e0e0',
      padding: 20,
      textAlign: 'center',
    }}>
      <h1 style={{
        fontFamily: "'Comic Sans MS', cursive",
        fontSize: 'clamp(24px, 5vw, 48px)',
        color: '#3333ff',
        textShadow: '0 0 20px #3333ff',
        marginBottom: 20,
        fontStyle: 'italic',
      }}>
        enter the virtual world?
      </h1>
      <div style={{
        border: '2px solid #888',
        padding: 20,
        maxWidth: 600,
      }}>
        <p style={{ fontSize: 18, marginBottom: 16 }}>
          the portal has opened, will you enter it?
        </p>
        <Fractal />
        <p style={{ marginTop: 16, color: '#666', fontSize: 14 }}>
          you are here now. there is no going back.
        </p>
      </div>
      <a
        href="/og"
        style={{
          marginTop: 30,
          color: '#00ff99',
          fontFamily: "'Courier New', monospace",
          fontSize: 14,
          textDecoration: 'none',
          border: '1px solid #00ff99',
          padding: '8px 16px',
        }}
      >
        {'<< '}return to safety
      </a>
    </div>
  )
}

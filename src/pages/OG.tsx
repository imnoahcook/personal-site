import { useEffect, useRef, useState } from 'react'
import './OG.css'

const sidebarLinks = [
  { icon: '\u{1F3E0}', label: 'home', href: '/' },
  { icon: '\u{1F30D}', label: 'blog', href: '#blog' },
  { icon: '\u{2753}', label: 'about', href: '#about' },
  { icon: '\u{1F3B5}', label: 'music', href: '#music' },
  { icon: '\u{1F3A8}', label: 'art', href: '#art' },
  { icon: '\u{1F4E7}', label: 'contact', href: 'mailto:imnoahcook@gmail.com' },
]

function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.3 + 0.05,
      brightness: Math.random(),
      phase: Math.random() * Math.PI * 2,
    }))

    let animId: number
    const draw = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const star of stars) {
        const twinkle = 0.4 + 0.6 * Math.sin(time * 0.001 * star.speed + star.phase)
        ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * star.brightness})`
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
        ctx.fill()
      }
      animId = requestAnimationFrame(draw)
    }
    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="og-starfield" />
}

function DraggableWidget() {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    const rect = ref.current!.getBoundingClientRect()
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !ref.current) return
      ref.current.style.left = e.clientX - offset.current.x + 'px'
      ref.current.style.top = e.clientY - offset.current.y + 'px'
      ref.current.style.right = 'auto'
      ref.current.style.bottom = 'auto'
    }
    const onMouseUp = () => {
      dragging.current = false
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <div ref={ref} className="og-widget" onMouseDown={onMouseDown}>
      <div className="og-widget-links">
        <a href="/">main site</a> | <a href="/physics">physics</a> | <a href="/platformer">platformer</a>
      </div>
      <div className="og-widget-text">hi! you can move me</div>
    </div>
  )
}

function VisitorCounter() {
  const [count] = useState(() => Math.floor(Math.random() * 9000) + 1337)
  return (
    <div className="og-visitor-counter">
      <span className="og-counter-label">visitors:</span>
      <span className="og-counter-digits">
        {String(count).padStart(6, '0').split('').map((d, i) => (
          <span key={i} className="og-counter-digit">{d}</span>
        ))}
      </span>
    </div>
  )
}

export default function OG() {
  return (
    <div className="og-page">
      <StarField />

      <div className="og-marquee-container">
        <div className="og-marquee">
          <span>
            {'★ '}welcome to noah&apos;s corner of the internet{'  ★  '}
            best viewed at 1024x768{'  ★  '}
            made with mass amounts of caffeine{'  ★  '}
            you are visitor #{Math.floor(Math.random() * 9000) + 1337}{'  ★  '}
            under construction since forever{'  ★  '}
          </span>
        </div>
      </div>

      <div className="og-layout">
        {/* Sidebar */}
        <nav className="og-sidebar">
          {sidebarLinks.map((link) => (
            <a key={link.label} href={link.href} className="og-sidebar-link">
              <span className="og-sidebar-icon">{link.icon}</span>
              <span className="og-sidebar-label">{link.label}</span>
            </a>
          ))}
        </nav>

        {/* Main content */}
        <main className="og-main">
          <h1 className="og-title">welcome to my site</h1>

          <div className="og-section">
            <h2 className="og-heading">about me</h2>
            <p className="og-text">
              hey i&apos;m noah. i build things for the internet. i like code, music,
              and making pixels do weird things. this page is a tribute to the beautiful
              chaos of the early web — when every site had a starfield background,
              visitor counters were flex, and &quot;under construction&quot; was a
              permanent state of being.
            </p>
          </div>

          <div className="og-section">
            <h2 className="og-heading">my links</h2>
            <ul className="og-link-list">
              <li><a href="https://github.com/imnoahcook" target="_blank" rel="noopener noreferrer">{'>> '}github</a></li>
              <li><a href="https://linkedin.com/in/noahpcook" target="_blank" rel="noopener noreferrer">{'>> '}linkedin</a></li>
              <li><a href="mailto:imnoahcook@gmail.com">{'>> '}email me</a></li>
            </ul>
          </div>

          <div className="og-section">
            <h2 className="og-heading">guestbook</h2>
            <div className="og-guestbook">
              <div className="og-guestbook-entry">
                <span className="og-gb-name">xX_c00lk1d_Xx</span>
                <span className="og-gb-date">03/13/2026</span>
                <p>awesome site dude!! love the stars background</p>
              </div>
              <div className="og-guestbook-entry">
                <span className="og-gb-name">webmaster_jane</span>
                <span className="og-gb-date">03/12/2026</span>
                <p>linked u on my webrings page. keep it real!</p>
              </div>
              <div className="og-guestbook-entry">
                <span className="og-gb-name">anonymous</span>
                <span className="og-gb-date">03/10/2026</span>
                <p>how do i make my site look like this?? teach me</p>
              </div>
            </div>
          </div>

          <div className="og-construction">
            <span className="og-blink">{'>>> '}PAGE UNDER CONSTRUCTION{'  <<<'}</span>
            <p>more stuff coming soon... probably... eventually...</p>
          </div>

          <VisitorCounter />
        </main>
      </div>

      <DraggableWidget />
    </div>
  )
}

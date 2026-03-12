import { useEffect, useRef, useState } from 'react'
import './OG.css'

type Tab = 'home' | 'blog' | 'about' | 'music' | 'art' | 'contact'

const sidebarLinks: { icon: string; label: Tab }[] = [
  { icon: '/og-icons/house.gif', label: 'home' },
  { icon: '/og-icons/world.gif', label: 'blog' },
  { icon: '/og-icons/question2.gif', label: 'about' },
  { icon: '/og-icons/spinningcd.gif', label: 'music' },
  { icon: '/og-icons/art.gif', label: 'art' },
  { icon: '/og-icons/ampersat.gif', label: 'contact' },
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

function TabContent({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'home':
      return (
        <>
          <h1 className="og-title">welcome to my site</h1>
          <div className="og-section">
            <p className="og-text">
              hey i&apos;m noah. i build things for the internet. i like code, music,
              and making pixels do weird things. this page is a tribute to the beautiful
              chaos of the early web — when every site had a starfield background,
              visitor counters were flex, and &quot;under construction&quot; was a
              permanent state of being.
            </p>
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
        </>
      )
    case 'blog':
      return (
        <>
          <h1 className="og-title">blog</h1>
          <div className="og-section">
            <h2 className="og-heading">03/13/2026 - the return of the old web</h2>
            <p className="og-text">
              remember when the internet was fun? when every site was a unique expression
              of someone&apos;s personality? no cookie-cutter templates, no algorithms
              deciding what you see. just pure, unfiltered creativity. i miss that.
              so i built this page as a love letter to those days.
            </p>
          </div>
          <div className="og-section">
            <h2 className="og-heading">03/10/2026 - first post!!</h2>
            <p className="og-text">
              hello world! this blog is where i&apos;ll dump my thoughts about code,
              the internet, music, and whatever else is rattling around in my brain.
              stay tuned i guess lol
            </p>
          </div>
        </>
      )
    case 'about':
      return (
        <>
          <h1 className="og-title">about me</h1>
          <div className="og-section">
            <h2 className="og-heading">who am i?</h2>
            <p className="og-text">
              i&apos;m noah. developer, creator, explorer. i spend most of my time
              building things for the internet — from full-stack web apps to generative
              art to AI systems. i believe the best software feels like magic.
            </p>
          </div>
          <div className="og-section">
            <h2 className="og-heading">fun facts</h2>
            <ul className="og-link-list">
              <li className="og-text">{'>> '}i&apos;ve been writing code since i was a kid</li>
              <li className="og-text">{'>> '}my favorite color is whatever #00ff99 is</li>
              <li className="og-text">{'>> '}i think Comic Sans gets a bad rap</li>
              <li className="og-text">{'>> '}this page took mass amounts of caffeine to make</li>
            </ul>
          </div>
        </>
      )
    case 'music':
      return (
        <>
          <h1 className="og-title">my music</h1>
          <div className="og-section">
            <h2 className="og-heading">what i&apos;m listening to</h2>
            <p className="og-text">
              music is a huge part of my life. here&apos;s some stuff i&apos;ve been
              into lately. imagine there&apos;s an auto-playing MIDI file right now.
              you can hear it in your heart.
            </p>
          </div>
          <div className="og-section">
            <h2 className="og-heading">current rotation</h2>
            <ul className="og-link-list">
              <li><span className="og-text">{'>> '}whatever sounds good at 3am</span></li>
              <li><span className="og-text">{'>> '}lo-fi beats to code to</span></li>
              <li><span className="og-text">{'>> '}that one song on repeat for 6 hours</span></li>
              <li><span className="og-text">{'>> '}early 2000s nostalgia hits</span></li>
            </ul>
          </div>
          <div className="og-construction">
            <span className="og-blink">{'♪ ♫ ♪ ♫ ♪ ♫'}</span>
            <p>embedded player coming soon... when i figure out how to autoplay MIDI in 2026</p>
          </div>
        </>
      )
    case 'art':
      return (
        <>
          <h1 className="og-title">art</h1>
          <div className="og-section">
            <h2 className="og-heading">creative works</h2>
            <p className="og-text">
              i make things with code that (hopefully) look cool. generative art,
              shaders, creative coding experiments — where math meets aesthetics.
            </p>
          </div>
          <div className="og-section">
            <h2 className="og-heading">gallery</h2>
            <div className="og-art-grid">
              {['#ff006e', '#00ff99', '#3388ff', '#ffff00', '#ff66ff', '#00ccff'].map((color, i) => (
                <div
                  key={i}
                  className="og-art-tile"
                  style={{
                    background: `linear-gradient(${45 + i * 30}deg, ${color}, ${color}44, #000)`,
                  }}
                >
                  <span className="og-art-label">piece #{i + 1}</span>
                </div>
              ))}
            </div>
            <p className="og-text" style={{ marginTop: 16, fontStyle: 'italic' }}>
              (imagine these are actual artworks and not gradient squares)
            </p>
          </div>
        </>
      )
    case 'contact':
      return (
        <>
          <h1 className="og-title">contact</h1>
          <div className="og-section">
            <h2 className="og-heading">get in touch</h2>
            <p className="og-text">
              want to say hi? collaborate on something? tell me my site is cool?
              (or roast it, i can take it)
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
            <h2 className="og-heading">sign my guestbook!!</h2>
            <p className="og-text">
              (guestbook form coming soon... for now just email me and i&apos;ll
              manually add your entry like it&apos;s 2003)
            </p>
          </div>
        </>
      )
  }
}

export default function OG() {
  const [activeTab, setActiveTab] = useState<Tab>('home')

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
            <button
              key={link.label}
              onClick={() => setActiveTab(link.label)}
              className={`og-sidebar-link${activeTab === link.label ? ' og-sidebar-active' : ''}`}
            >
              <img src={link.icon} alt={link.label} className="og-sidebar-icon" />
              <span className="og-sidebar-label">{link.label}</span>
            </button>
          ))}
        </nav>

        {/* Main content */}
        <main className="og-main">
          <TabContent tab={activeTab} />
        </main>
      </div>

      <DraggableWidget />
    </div>
  )
}

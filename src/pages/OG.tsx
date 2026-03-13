import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as THREE from 'three'
import LowPolyRabbit from '../components/LowPolyRabbit'
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

interface Post {
  id: number
  author: string
  message: string
  stars: number
  createdAt: string
}

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

    const colors = [
      [255, 255, 255],   // white
      [200, 180, 255],   // lavender
      [255, 150, 200],   // pink
      [150, 200, 255],   // light blue
      [180, 130, 255],   // purple
      [255, 200, 230],   // soft pink
      [145, 235, 255],   // teal
    ]

    const stars = Array.from({ length: 300 }, () => {
      const color = colors[Math.floor(Math.random() * colors.length)]
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2.5 + 0.3,
        speed: Math.random() * 0.3 + 0.05,
        brightness: Math.random() * 0.7 + 0.3,
        phase: Math.random() * Math.PI * 2,
        r: color[0],
        g: color[1],
        b: color[2],
      }
    })

    let animId: number
    const draw = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const star of stars) {
        const twinkle = 0.4 + 0.6 * Math.sin(time * 0.001 * star.speed + star.phase)
        ctx.fillStyle = `rgba(${star.r}, ${star.g}, ${star.b}, ${twinkle * star.brightness})`
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


function SwordCursor() {
  useEffect(() => {
    const size = 40
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(size, size)
    renderer.setPixelRatio(1)
    renderer.setClearColor(0x000000, 0)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1.3, 1.3, 1.3, -1.3, 0.1, 10)
    camera.position.set(1, 1, 5)
    camera.lookAt(0, 0, 0)

    const sword = new THREE.Group()

    // Blade
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.1, 0.05),
      new THREE.MeshStandardMaterial({ color: '#b8c8d8', flatShading: true })
    )
    blade.position.y = 0.15
    sword.add(blade)

    // Blade tip
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.085, 0.3, 4),
      new THREE.MeshStandardMaterial({ color: '#c8d8e8', flatShading: true })
    )
    tip.position.y = 0.85
    sword.add(tip)

    // Crossguard
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.07, 0.07),
      new THREE.MeshStandardMaterial({ color: '#c8a030', flatShading: true })
    )
    guard.position.y = -0.42
    sword.add(guard)

    // Handle
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.35, 5),
      new THREE.MeshStandardMaterial({ color: '#5d3a1a', flatShading: true })
    )
    handle.position.y = -0.63
    sword.add(handle)

    // Pommel
    const pommel = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 4, 3),
      new THREE.MeshStandardMaterial({ color: '#c8a030', flatShading: true })
    )
    pommel.position.y = -0.84
    sword.add(pommel)

    // Tilt so tip points upper-left (like a cursor)
    sword.rotation.z = Math.PI / 5
    sword.position.set(-0.15, 0.2, 0)

    scene.add(sword)
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(3, 4, 5)
    scene.add(dirLight)

    renderer.render(scene, camera)
    const url = renderer.domElement.toDataURL('image/png')

    const style = document.createElement('style')
    style.textContent = `
      .og-page { cursor: url(${url}) 2 2, default !important; }
      .og-page a, .og-page button { cursor: url(${url}) 2 2, pointer !important; }
    `
    document.head.appendChild(style)

    renderer.dispose()

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return null
}


function VisitorCounter() {
  const hasFired = useRef(false)
  const increment = useMutation({
    mutationFn: () => fetch('/api/visitors?page=og', { method: 'POST' }).then((r) => r.json()),
  })

  useEffect(() => {
    if (hasFired.current) return
    hasFired.current = true
    increment.mutate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const display = increment.data?.count ?? 0
  return (
    <div className="og-visitor-counter">
      <span className="og-counter-label">visitors:</span>
      <span className="og-counter-digits">
        {String(display).padStart(6, '0').split('').map((d: string, i: number) => (
          <span key={i} className="og-counter-digit">{d}</span>
        ))}
      </span>
    </div>
  )
}

const BANNED_WORDS = [
  // slurs
  'nigger', 'nigga', 'nigg3r', 'n1gger', 'n1gga', 'n1gg3r', 'nig', 'n1g',
  'faggot', 'fagg0t', 'f4ggot', 'f4gg0t', 'fag', 'f4g',
  'retard', 'r3tard', 'retrd',
  'tranny', 'tr4nny',
  'kike', 'k1ke',
  'chink', 'ch1nk',
  'spic', 'sp1c',
  'wetback', 'w3tback',
  'beaner', 'b3aner',
  'gook', 'g00k',
  'coon', 'c00n',
  'darkie', 'dark1e',
  'jigaboo', 'jiggaboo',
  'raghead', 'r4ghead',
  'towelhead',
  'zipperhead',
  'cracker', 'cr4cker',
  'honky', 'h0nky',
  'gringo', 'gr1ngo',
  'dyke', 'dyk3',
  'lesbo', 'l3sbo',
  // profanity
  'fuck', 'fck', 'fuk', 'f_ck', 'f*ck', 'fu¢k', 'phuck', 'phuk',
  'shit', 'sh1t', 'sht', 's#it', 'sh!t',
  'bitch', 'b1tch', 'b!tch',
  'cunt', 'c_nt', 'c*nt',
  'dick', 'd1ck',
  'cock', 'c0ck',
  'pussy', 'puss1', 'pu$$y',
  'ass', 'a$$',
  'whore', 'wh0re', 'h0e', 'hoe',
  'slut', 'sl_t',
  // misc
  'stfu', 'gtfo', 'kys',
  'nazi', 'n4zi', 'naz1',
  'hitler', 'h1tler',
]

function containsBannedWord(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[\s._\-*#!¢$@]+/g, '')
  return BANNED_WORDS.some((word) => {
    const normalizedWord = word.toLowerCase().replace(/[\s._\-*#!¢$@]+/g, '')
    return normalized.includes(normalizedWord)
  })
}

const BANNED_KEY = 'og-banned'

const FAKE_ENTRIES: Post[] = [
  { id: -1, author: 'xX_c00lk1d_Xx', message: 'awesome site dude!! love the stars background', stars: 42, createdAt: '2006-08-14T00:00:00Z' },
  { id: -2, author: 'webmaster_jane', message: 'linked u on my webrings page. keep it real!', stars: 28, createdAt: '2006-07-22T00:00:00Z' },
  { id: -3, author: 'anonymous', message: 'how do i make my site look like this?? teach me', stars: 15, createdAt: '2006-06-03T00:00:00Z' },
]

function Guestbook() {
  const queryClient = useQueryClient()
  const [starred, setStarred] = useState<Set<number>>(new Set())
  const [author, setAuthor] = useState('')
  const [message, setMessage] = useState('')
  const [banned, setBanned] = useState(() => localStorage.getItem(BANNED_KEY) === 'true')
  const [showBanModal, setShowBanModal] = useState(false)
  const firedStarsRef = useRef<Set<number>>(new Set())

  const { data: posts = [] } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: () => fetch('/api/posts').then((r) => r.json()),
  })

  const createPost = useMutation({
    mutationFn: (body: { author: string; message: string }) =>
      fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: (newPost: Post) => {
      queryClient.setQueryData<Post[]>(['posts'], (old = []) => [newPost, ...old])
      setAuthor('')
      setMessage('')
    },
  })

  const handleStar = (id: number) => {
    const willStar = !starred.has(id)
    setStarred((prev) => {
      const next = new Set(prev)
      if (willStar) next.add(id)
      else next.delete(id)
      return next
    })
    // Fire API at most once per session per real post
    if (willStar && id > 0 && !firedStarsRef.current.has(id)) {
      firedStarsRef.current.add(id)
      fetch(`/api/stars?id=${id}`, { method: 'POST' })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (banned) return
    if (!author.trim() || !message.trim() || createPost.isPending) return
    if (containsBannedWord(author) || containsBannedWord(message)) {
      localStorage.setItem(BANNED_KEY, 'true')
      setBanned(true)
      setShowBanModal(true)
      return
    }
    createPost.mutate({ author: author.trim(), message: message.trim() })
  }

  const allPosts = [...posts, ...FAKE_ENTRIES]

  return (
    <div className="og-section">
      <h2 className="og-heading">guestbook</h2>
      <div className="og-guestbook">
        {allPosts.map((post) => {
          const date = new Date(post.createdAt)
          const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`
          return (
            <div key={post.id} className="og-guestbook-entry">
              <div className="og-gb-header">
                <span>
                  <span className="og-gb-name">{post.author}</span>
                  <span className="og-gb-date">{dateStr}</span>
                </span>
                <button
                  className={`og-star-btn${starred.has(post.id) ? ' og-starred' : ''}`}
                  onClick={() => handleStar(post.id)}
                  title={starred.has(post.id) ? 'click to unstar' : 'give a star'}
                >
                  {starred.has(post.id) ? '\u2605' : '\u2606'} {post.stars + (starred.has(post.id) ? 1 : 0)}
                </button>
              </div>
              <p>{post.message}</p>
            </div>
          )
        })}
      </div>

      {showBanModal && (
        <div className="og-ban-overlay" onClick={() => setShowBanModal(false)}>
          <div className="og-ban-modal" onClick={(e) => e.stopPropagation()}>
            <h2>BANNED</h2>
            <p>you have been banned from the guestbook for using prohibited language.</p>
            <p className="og-ban-skull">&#9760;</p>
            <button className="og-ban-close" onClick={() => setShowBanModal(false)}>
              ok i deserve this
            </button>
          </div>
        </div>
      )}

      {banned ? (
        <div className="og-gb-form">
          <h2 className="og-heading">you are banned from the guestbook</h2>
          <p className="og-text" style={{ fontStyle: 'italic' }}>maybe don&apos;t be rude next time &#9760;</p>
        </div>
      ) : (
        <form className="og-gb-form" onSubmit={handleSubmit}>
          <h2 className="og-heading">sign my guestbook!!</h2>
          <p className="og-text" style={{ marginBottom: 12 }}>this may be the only chance we will know each other on this tiny blue dot. say something</p>
          <input
            className="og-gb-input"
            type="text"
            placeholder="your name (e.g. xX_h4ck3r_Xx)"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={50}
          />
          <textarea
            className="og-gb-textarea"
            placeholder="leave a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={3}
          />
          <button className="og-gb-submit" type="submit" disabled={createPost.isPending}>
            {createPost.isPending ? 'posting...' : '>> sign guestbook'}
          </button>
        </form>
      )}
    </div>
  )
}

const PIANO_KEYS = [
  { note: 'C', freq: 261.63, black: false },
  { note: 'C#', freq: 277.18, black: true },
  { note: 'D', freq: 293.66, black: false },
  { note: 'D#', freq: 311.13, black: true },
  { note: 'E', freq: 329.63, black: false },
  { note: 'F', freq: 349.23, black: false },
  { note: 'F#', freq: 369.99, black: true },
  { note: 'G', freq: 392.0, black: false },
  { note: 'G#', freq: 415.3, black: true },
  { note: 'A', freq: 440.0, black: false },
  { note: 'A#', freq: 466.16, black: true },
  { note: 'B', freq: 493.88, black: false },
  { note: 'C', freq: 523.25, black: false },
  { note: 'C', freq: 523.25, black: false },
]

const KEYBOARD_MAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5,
  t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, l: 13,
}

function RetroPiano() {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const [activeKeys, setActiveKeys] = useState<Set<number>>(new Set())

  const playNote = useCallback((freq: number, index: number) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext()
    }
    const ctx = audioCtxRef.current
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.8)

    setActiveKeys((prev) => new Set(prev).add(index))
    setTimeout(() => {
      setActiveKeys((prev) => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    }, 150)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const index = KEYBOARD_MAP[e.key.toLowerCase()]
      if (index !== undefined) {
        playNote(PIANO_KEYS[index].freq, index)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [playNote])

  return (
    <div className="og-piano-wrapper">
      <div className="og-piano-label">~ click or use keyboard (A-K) ~</div>
      <div className="og-piano">
        {PIANO_KEYS.map((key, i) => (
          <button
            key={key.note}
            className={`og-piano-key ${key.black ? 'og-piano-black' : 'og-piano-white'} ${activeKeys.has(i) ? 'og-piano-active' : ''}`}
            onMouseDown={() => playNote(key.freq, i)}
          >
            <span className="og-piano-note">{key.note}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ScaredPortal() {
  const [opened, setOpened] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pos = useRef({ x: 0, y: 0 })

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const btn = btnRef.current
    const container = containerRef.current
    if (!btn || !container || opened) return

    const btnRect = btn.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const btnCx = btnRect.left + btnRect.width / 2
    const btnCy = btnRect.top + btnRect.height / 2
    const dx = btnCx - e.clientX
    const dy = btnCy - e.clientY
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 120) {
      const flee = 40
      const angle = Math.atan2(dy, dx)
      let newX = pos.current.x + Math.cos(angle) * flee
      let newY = pos.current.y + Math.sin(angle) * flee

      const maxX = (containerRect.width - btnRect.width) / 2
      const maxY = (containerRect.height - btnRect.height) / 2
      newX = Math.max(-maxX, Math.min(maxX, newX))
      newY = Math.max(-maxY, Math.min(maxY, newY))

      pos.current = { x: newX, y: newY }
      btn.style.transform = `translate(${newX}px, ${newY}px)`
    }
  }, [opened])

  if (opened) {
    return (
      <div className="og-portal-section">
        <p className="og-portal-text">the portal has opened, will you enter it?</p>
        <a href="/portal" className="og-portal-link">
          <img src="/og-icons/portal.gif" alt="portal" className="og-portal-img" />
        </a>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="og-portal-section og-portal-scared"
      onPointerMove={onPointerMove}
    >
      <p className="og-portal-text">do you want to open the portal?</p>
      <button
        ref={btnRef}
        className="og-portal-scared-btn"
        onClick={() => setOpened(true)}
      >
        open it
      </button>
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
              this website is under construction, just like all of us
            </p>
          </div>
          <Guestbook />
          <ScaredPortal />
          <VisitorCounter />
        </>
      )
    case 'blog':
      return (
        <>
          <h1 className="og-title">blog</h1>
          <div className="og-section">
            <h2 className="og-heading">03/10/2026 - first post!!</h2>
            <p className="og-text">
              my first website was about ninjas and written in dreamweaver
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
              art to AI systems.            </p>
          </div>
          <div className="og-section">
            <h2 className="og-heading">fun facts</h2>
            <ul className="og-link-list">
              <li className="og-text">{'>> '}i&apos;ve been writing code since i was a kid</li>
              <li className="og-text">{'>> '}my favorite color is whatever #00ff99 is</li>
              <li className="og-text">{'>> '}i code with Comic Sans</li>
            </ul>
          </div>
        </>
      )
    case 'music':
      return (
        <>
          <h1 className="og-title">my music</h1>
          <RetroPiano />
        </>
      )
    case 'art':
      return (
        <>
          <h1 className="og-title">what is art really?</h1>
          <div className="og-section">
            <p className="og-text">i can&apos;t draw</p>
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
          </div>
        </>
      )
    case 'contact':
      return (
        <>
          <h1 className="og-title">contact</h1>
          <div className="og-section">
            <h2 className="og-heading">my links</h2>
            <ul className="og-link-list">
              <li><a href="https://github.com/imnoahcook" target="_blank" rel="noopener noreferrer">{'>> '}github</a></li>
              <li><a href="https://linkedin.com/in/noahpcook" target="_blank" rel="noopener noreferrer">{'>> '}linkedin</a></li>
              <li><a href="mailto:imnoahcook@gmail.com">{'>> '}email me</a></li>
            </ul>
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
      <SwordCursor />

      <div className="og-wordart-container">
        <h1 className="og-wordart">Noah Cook</h1>
      </div>

      <div className="og-marquee-container">
        <div className="og-marquee">
          <span>hi!</span>
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

      <LowPolyRabbit />
    </div>
  )
}

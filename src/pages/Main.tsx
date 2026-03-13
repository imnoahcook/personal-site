import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
// import { Canvas, useFrame } from '@react-three/fiber'
// import type { Group } from 'three'
import LowPolyRabbit from '../components/LowPolyRabbit'
import './Main.css'

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


// function SwordMesh() {
//   const groupRef = useRef<Group>(null)
//
//   useFrame(() => {
//     if (!groupRef.current) return
//     groupRef.current.position.y = Math.sin(Date.now() * 0.003) * 0.04
//   })
//
//   return (
//     <group ref={groupRef} rotation={[0.3, -0.5, 0.45]} position={[0, 0.05, 0]}>
//       <mesh position={[0, 0.35, 0]} scale={[0.18, 0.9, 0.08]}>
//         <octahedronGeometry args={[1, 0]} />
//         <meshStandardMaterial color="#d8e8f0" flatShading />
//       </mesh>
//       <mesh position={[0, -0.5, 0]} rotation={[0, 0, Math.PI / 4]} scale={[0.22, 0.22, 0.1]}>
//         <octahedronGeometry args={[1, 0]} />
//         <meshStandardMaterial color="#e8c840" flatShading />
//       </mesh>
//       <mesh position={[0, -0.75, 0]}>
//         <boxGeometry args={[0.09, 0.3, 0.09]} />
//         <meshStandardMaterial color="#a06830" flatShading />
//       </mesh>
//       <mesh position={[0, -0.94, 0]} scale={[0.8, 0.8, 0.8]}>
//         <tetrahedronGeometry args={[0.08, 0]} />
//         <meshStandardMaterial color="#e8c840" flatShading />
//       </mesh>
//     </group>
//   )
// }
//
// function SwordCursor() {
//   const ref = useRef<HTMLDivElement>(null)
//
//   useEffect(() => {
//     const el = ref.current
//     if (!el) return
//     el.style.display = 'none'
//     const onMove = (e: MouseEvent) => {
//       el.style.display = 'block'
//       el.style.transform = `translate(${e.clientX - 55}px, ${e.clientY - 20}px)`
//     }
//     window.addEventListener('mousemove', onMove)
//     return () => window.removeEventListener('mousemove', onMove)
//   }, [])
//
//   return (
//     <div
//       ref={ref}
//       style={{
//         position: 'fixed',
//         top: 0,
//         left: 0,
//         width: 192,
//         height: 192,
//         pointerEvents: 'none',
//         zIndex: 9999,
//       }}
//     >
//       <Canvas
//         camera={{ position: [0, 0, 4], fov: 40 }}
//         gl={{ alpha: true }}
//         style={{ background: 'transparent' }}
//         events={() => ({ enabled: false, priority: 0, compute: () => {}, connected: undefined })}
//       >
//         <ambientLight intensity={0.9} />
//         <directionalLight position={[3, 4, 5]} intensity={1.5} />
//         <directionalLight position={[-2, -1, 3]} intensity={0.5} />
//         <SwordMesh />
//       </Canvas>
//     </div>
//   )
// }


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

import { containsBannedWord } from '../bannedWords'

const BANNED_KEY = 'og-banned-v2'

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
    window.dispatchEvent(new CustomEvent('rabbit-quip', { detail: 'comment' }))
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
              this website is perpetually under construction, just like all of us
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

export default function Main() {
  const [activeTab, setActiveTab] = useState<Tab>('home')

  return (
    <div className="og-page">
      <StarField />
      {/* <SwordCursor /> */}

      <div className="og-wordart-container">
        <h1 className="og-wordart">Noah Cook</h1>
      </div>

      <div className="og-marquee-container">
        <div className="og-marquee">
          <span>hi!&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          <span>hi!&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
        </div>
      </div>

      <div className="og-layout">
        {/* Sidebar */}
        <nav className="og-sidebar">
          {sidebarLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => {
                setActiveTab(link.label)
                window.dispatchEvent(new CustomEvent('rabbit-quip', { detail: 'tab' }))
              }}
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

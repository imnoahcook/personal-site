import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import LowPolyRabbit from '../components/LowPolyRabbit'
import './Main.css'

type Tab = 'home' | 'blog' | 'about' | 'music' | 'art' | 'contact'

const sidebarLinks: { icon: string; label: Tab }[] = [
  { icon: '/icons/house.gif', label: 'home' },
  { icon: '/icons/world.gif', label: 'blog' },
  { icon: '/icons/question2.gif', label: 'about' },
  { icon: '/icons/spinningcd.gif', label: 'music' },
  { icon: '/icons/art.gif', label: 'art' },
  { icon: '/icons/ampersat.gif', label: 'contact' },
]

interface Post {
  id: number
  author: string
  message: string
  stars: number
  country: string
  createdAt: string
}

function countryFlag(code: string): string {
  const upper = code.toUpperCase()
  if (upper.length !== 2) return ''
  return String.fromCodePoint(
    ...upper.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  )
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

function getOrCreateUid(): string {
  const existing = getCookie('uid')
  if (existing) return existing
  const uid = crypto.randomUUID()
  setCookie('uid', uid, 365)
  return uid
}

function StarField() {
  return <div className="starfield" />
}

function VisitorCounter() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    getOrCreateUid()
    fetch('/api/visitors?page=og', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => setCount(d.count))
      .catch(() => {})
  }, [])

  const display = count
  return (
    <div className="visitor-counter">
      <span className="counter-label">visitors:</span>
      <span className="counter-digits">
        {String(display).padStart(6, '0').split('').map((d: string, i: number) => (
          <span key={i} className="counter-digit">{d}</span>
        ))}
      </span>
    </div>
  )
}

import { containsBannedWord } from '../bannedWords'

function Guestbook() {
  const queryClient = useQueryClient()
  const [starred, setStarred] = useState<Set<number>>(new Set())
  const [author, setAuthor] = useState('')
  const [message, setMessage] = useState('')
  const [banned, setBanned] = useState(false)
  const [showBanModal, setShowBanModal] = useState(false)
  const [myCountry, setMyCountry] = useState('')

  const { data: posts = [] } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: () => fetch('/api/posts').then((r) => r.json()),
  })

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.banned) setBanned(true)
        if (Array.isArray(d.starred)) setStarred(new Set(d.starred))
      })
      .catch(() => {})
    fetch('/api/country').then((r) => r.json()).then((d) => setMyCountry(d.country)).catch(() => {})
  }, [])

  const createPost = useMutation({
    mutationFn: (body: { author: string; message: string }) =>
      fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json().then((d) => ({ ok: r.ok, data: d }))),
    onSuccess: ({ ok, data }) => {
      if (!ok && data.banned) {
        setBanned(true)
        setShowBanModal(true)
        return
      }
      queryClient.setQueryData<Post[]>(['posts'], (old = []) => [data, ...old])
      setAuthor('')
      setMessage('')
    },
  })

  const toggleStar = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/stars?id=${id}`, { method: 'POST' }).then((r) => {
        if (!r.ok) throw new Error('star failed')
        return r.json()
      }),
    onMutate: (id: number) => {
      const prev = queryClient.getQueryData<Post[]>(['posts'])
      const wasStarred = starred.has(id)
      queryClient.setQueryData<Post[]>(['posts'], (old = []) =>
        old.map((p) => (p.id === id ? { ...p, stars: p.stars + (wasStarred ? -1 : 1) } : p))
      )
      setStarred((s) => {
        const next = new Set(s)
        if (wasStarred) next.delete(id); else next.add(id)
        return next
      })
      return { prev, wasStarred }
    },
    onError: (_err, id, context) => {
      if (context?.prev) queryClient.setQueryData(['posts'], context.prev)
      setStarred((s) => {
        const next = new Set(s)
        if (context?.wasStarred) next.add(id); else next.delete(id)
        return next
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (banned) return
    if (!author.trim() || !message.trim() || createPost.isPending) return
    if (containsBannedWord(author) || containsBannedWord(message)) {
      setBanned(true)
      setShowBanModal(true)
      return
    }
    createPost.mutate({ author: author.trim(), message: message.trim() })
    window.dispatchEvent(new CustomEvent('rabbit-quip', { detail: 'comment' }))
  }

  const allPosts = posts

  return (
    <div className="section">
      <h2 className="heading">guestbook</h2>
      <div className="guestbook">
        {allPosts.map((post) => {
          const date = new Date(post.createdAt)
          const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`
          return (
            <div key={post.id} className="guestbook-entry">
              <div className="gb-header">
                <span>
                  <span className="gb-name">{post.author} {countryFlag(post.country)}</span>
                  <span className="gb-date">{dateStr}</span>
                </span>
                <button
                  className={`star-btn${starred.has(post.id) ? ' starred' : ''}`}
                  onClick={() => toggleStar.mutate(post.id)}
                  aria-label={`${starred.has(post.id) ? 'Unstar' : 'Star'} post by ${post.author}, ${post.stars} stars`}
                >
                  {starred.has(post.id) ? '\u2605' : '\u2606'} {post.stars}
                </button>
              </div>
              <p>{post.message}</p>
            </div>
          )
        })}
      </div>

      {showBanModal && (
        <div className="ban-overlay" onClick={() => setShowBanModal(false)} role="dialog" aria-modal="true" aria-label="Banned notice">
          <div className="ban-modal" onClick={(e) => e.stopPropagation()}>
            <h2>BANNED</h2>
            <p>you have been banned from the guestbook for using prohibited language.</p>
            <p className="ban-skull">&#9760;</p>
            <button className="ban-close" onClick={() => setShowBanModal(false)}>
              ok i deserve this
            </button>
          </div>
        </div>
      )}

      {banned ? (
        <div className="gb-form">
          <h2 className="heading">you are banned from the guestbook</h2>
          <p className="text" style={{ fontStyle: 'italic' }}>maybe don&apos;t be rude next time &#9760;</p>
        </div>
      ) : (
        <form className="gb-form" onSubmit={handleSubmit}>
          <h2 className="heading">sign my guestbook!!</h2>
          <p className="text" style={{ marginBottom: 12 }}>this may be the only chance we will know each other on this tiny blue dot. say something</p>
          <label htmlFor="gb-author" className="sr-only">Your name</label>
          <input
            id="gb-author"
            className="gb-input"
            type="text"
            placeholder="your name (e.g. xX_h4ck3r_Xx)"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={50}
            aria-label="Your name"
          />
          <label htmlFor="gb-message" className="sr-only">Your message</label>
          <textarea
            id="gb-message"
            className="gb-textarea"
            placeholder="leave a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={3}
            aria-label="Your message"
          />
          <button className="gb-submit" type="submit" disabled={createPost.isPending}>
            {createPost.isPending ? 'posting...' : `>> sign guestbook ${myCountry ? countryFlag(myCountry) : ''}`}
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
    <div className="piano-wrapper">
      <div className="piano-label">~ click or use keyboard (A-K) ~</div>
      <div className="piano" role="group" aria-label="Piano keyboard">
        {PIANO_KEYS.map((key, i) => (
          <button
            key={i}
            className={`piano-key ${key.black ? 'piano-black' : 'piano-white'} ${activeKeys.has(i) ? 'piano-active' : ''}`}
            onMouseDown={() => playNote(key.freq, i)}
            aria-label={`Play note ${key.note}`}
          >
            <span className="piano-note">{key.note}</span>
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
      <div className="portal-section">
        <p className="portal-text">the portal has opened, will you enter it?</p>
        <a href="/portal" className="portal-link">
          <img src="/icons/portal.gif" alt="portal" className="portal-img" />
        </a>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="portal-section portal-scared"
      onPointerMove={onPointerMove}
    >
      <p className="portal-text">do you want to open the portal?</p>
      <button
        ref={btnRef}
        className="portal-scared-btn"
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
          <h1 className="title">welcome to my site</h1>
          <div className="section">
            <p className="text">
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
          <h1 className="title">blog</h1>
          <div className="section">
            <h2 className="heading">03/10/2026 - first post!!</h2>
            <p className="text">
              my first website was about ninjas and written in dreamweaver
            </p>
          </div>
        </>
      )
    case 'about':
      return (
        <>
          <h1 className="title">about me</h1>
          <div className="section">
            <h2 className="heading">who am i?</h2>
            <p className="text">
              i&apos;m noah. developer, creator, explorer. i spend most of my time
              building things for the internet — from full-stack web apps to generative
              art to AI systems.            </p>
          </div>
          <div className="section">
            <h2 className="heading">fun facts</h2>
            <ul className="link-list">
              <li className="text">{'>> '}i&apos;ve been writing code since i was a kid</li>
              <li className="text">{'>> '}my favorite color is whatever #00ff99 is</li>
              <li className="text">{'>> '}i code with Comic Sans</li>
            </ul>
          </div>
        </>
      )
    case 'music':
      return (
        <>
          <h1 className="title">my music</h1>
          <RetroPiano />
        </>
      )
    case 'art':
      return (
        <>
          <h1 className="title">art</h1>
          <div className="section">
            <p className="text">i can&apos;t draw</p>
          </div>
          <div className="section">
            <h2 className="heading">gallery</h2>
            <div className="art-grid">
              {['#ff006e', '#00ff99', '#3388ff', '#ffff00', '#ff66ff', '#00ccff'].map((color, i) => (
                <div
                  key={i}
                  className="art-tile"
                  style={{
                    background: `linear-gradient(${45 + i * 30}deg, ${color}, ${color}44, #000)`,
                  }}
                >
                  <span className="art-label">piece #{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )
    case 'contact':
      return (
        <>
          <h1 className="title">contact</h1>
          <div className="section">
            <h2 className="heading">my links</h2>
            <ul className="link-list">
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
    <div className="page">
      <StarField />

      <div className="wordart-container">
        <h1 className="wordart">Noah Cook</h1>
      </div>

      <div className="marquee-container">
        <div className="marquee">
          <span>hi!&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          <span>hi!&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
        </div>
      </div>

      <div className="layout">
        {/* Sidebar */}
        <nav className="sidebar" aria-label="Site sections">
          {sidebarLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => {
                setActiveTab(link.label)
                window.dispatchEvent(new CustomEvent('rabbit-quip', { detail: 'tab' }))
              }}
              className={`sidebar-link${activeTab === link.label ? ' sidebar-active' : ''}`}
              aria-current={activeTab === link.label ? 'page' : undefined}
            >
              <img src={link.icon} alt="" className="sidebar-icon" aria-hidden="true" />
              <span className="sidebar-label">{link.label}</span>
            </button>
          ))}
        </nav>

        {/* Main content */}
        <main className="main">
          <TabContent tab={activeTab} />
        </main>
      </div>

      <LowPolyRabbit />
    </div>
  )
}

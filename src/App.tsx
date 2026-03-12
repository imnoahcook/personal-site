import { useEffect, useRef, useCallback } from 'react'
import anime from 'animejs'
import HeroScene from './components/HeroScene'
import OrbLetter from './components/OrbLetter'
import CursorFollower from './components/CursorFollower'
import './App.css'

const skills = [
  {
    icon: '{}',
    title: 'Frontend',
    desc: 'React, TypeScript, Next.js, Three.js — crafting pixel-perfect, buttery-smooth interfaces.',
    level: 95,
    color: '#00cc88',
  },
  {
    icon: '>_',
    title: 'Backend',
    desc: 'Node.js, Bun, Python, Go — building systems that scale to the moon and back.',
    level: 88,
    color: '#3388ff',
  },
  {
    icon: '[]',
    title: 'Infrastructure',
    desc: 'AWS, SST, Docker, Terraform — infrastructure as code, deployed in seconds.',
    level: 82,
    color: '#00ff99',
  },
  {
    icon: '<>',
    title: 'Creative Dev',
    desc: 'Three.js, WebGL, GLSL shaders, generative art — where code meets art.',
    level: 90,
    color: '#00cc88',
  },
  {
    icon: '()',
    title: 'Mobile',
    desc: 'React Native, Swift — native-feeling apps, cross-platform wizardry.',
    level: 75,
    color: '#3388ff',
  },
  {
    icon: '//',
    title: 'AI / ML',
    desc: 'LLMs, embeddings, fine-tuning, RAG — making machines think.',
    level: 85,
    color: '#00ff99',
  },
]


function useIntersectionAnimation(
  selector: string,
  animationCallback: (entries: Element[]) => void,
  threshold = 0.2
) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target)
        if (visible.length > 0) {
          animationCallback(visible)
          visible.forEach((el) => observer.unobserve(el))
        }
      },
      { threshold }
    )

    const elements = document.querySelectorAll(selector)
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [selector, animationCallback, threshold])
}

export default function App() {
  const subtitleRef = useRef<HTMLParagraphElement>(null)

  // Hero subtitle anime.js staggered letter animation
  useEffect(() => {
    const el = subtitleRef.current
    if (!el) return
    const text = el.textContent ?? ''
    el.innerHTML = text
      .split('')
      .map((ch) =>
        ch === ' '
          ? '&nbsp;'
          : `<span class="inline-block opacity-0">${ch}</span>`
      )
      .join('')

    anime({
      targets: el.querySelectorAll('span'),
      opacity: [0, 1],
      translateY: [20, 0],
      easing: 'easeOutExpo',
      duration: 800,
      delay: anime.stagger(40, { start: 1000 }),
    })

    anime({
      targets: el,
      opacity: [0, 1],
      duration: 10,
      easing: 'linear',
    })
  }, [])

  // Animate section titles
  useIntersectionAnimation(
    '.section-title',
    useCallback((els: Element[]) => {
      anime({
        targets: els,
        opacity: [0, 1],
        translateY: [40, 0],
        easing: 'easeOutExpo',
        duration: 1200,
      })
    }, [])
  )

  // Animate about text
  useIntersectionAnimation(
    '.about-text',
    useCallback((els: Element[]) => {
      anime({
        targets: els,
        opacity: [0, 1],
        translateY: [30, 0],
        easing: 'easeOutExpo',
        duration: 1200,
        delay: 300,
      })
    }, [])
  )

  // Animate skill cards
  useIntersectionAnimation(
    '.skill-card',
    useCallback((els: Element[]) => {
      anime({
        targets: els,
        opacity: [0, 1],
        translateY: [60, 0],
        scale: [0.9, 1],
        easing: 'easeOutExpo',
        duration: 1000,
        delay: anime.stagger(100),
      })
      // Animate skill bars after cards appear
      setTimeout(() => {
        els.forEach((el) => {
          const bar = el.querySelector('.skill-bar') as HTMLElement | null
          if (bar) {
            bar.style.width = bar.dataset.level + '%'
          }
        })
      }, 500)
    }, [])
  )

  // Animate contact links
  useIntersectionAnimation(
    '.contact-link',
    useCallback((els: Element[]) => {
      anime({
        targets: els,
        opacity: [0, 1],
        translateY: [30, 0],
        easing: 'easeOutExpo',
        duration: 1000,
        delay: anime.stagger(150, { start: 300 }),
      })
    }, [])
  )

  // Floating background particles with anime.js
  useEffect(() => {
    const particles = document.querySelectorAll('.particle')
    particles.forEach((p, i) => {
      const el = p as HTMLElement
      el.style.left = Math.random() * 100 + 'vw'
      el.style.top = Math.random() * 100 + 'vh'
      el.style.background = i % 2 === 0 ? '#00cc88' : '#3388ff'

      anime({
        targets: el,
        translateX: () => anime.random(-200, 200),
        translateY: () => anime.random(-200, 200),
        opacity: [0, () => Math.random() * 0.5 + 0.1, 0],
        scale: [0, () => Math.random() * 2 + 0.5, 0],
        easing: 'easeInOutSine',
        duration: () => anime.random(4000, 8000),
        delay: () => anime.random(0, 3000),
        loop: true,
        direction: 'alternate',
      })
    })
  }, [])

  return (
    <div className="app relative">
      <CursorFollower />
      <div className="noise-overlay" />

      {/* Floating particles background */}
      <div className="particles-bg">
        {Array.from({ length: 30 }, (_, i) => (
          <div key={i} className="particle" />
        ))}
      </div>

      {/* ===== HERO ===== */}
      <section className="hero-section">
        <HeroScene />
        <div className="hero-overlay">
          <h1 className="hero-title hero-title-orb">
            <span className="glitch" data-text="N">N</span>
            <OrbLetter size={typeof window !== 'undefined' && window.innerWidth < 768 ? 60 : 120} />
            <span className="glitch" data-text="AH">AH</span>
            <span style={{ width: '0.3em', display: 'inline-block' }} />
            <span className="glitch" data-text="C">C</span>
            <OrbLetter size={typeof window !== 'undefined' && window.innerWidth < 768 ? 60 : 120} />
            <OrbLetter size={typeof window !== 'undefined' && window.innerWidth < 768 ? 60 : 120} />
            <span className="glitch" data-text="K">K</span>
          </h1>
          <p ref={subtitleRef} className="hero-subtitle">
            Developer &bull; Creator &bull; Explorer
          </p>
        </div>
        <div className="scroll-indicator">
          <span>scroll</span>
          <div className="scroll-arrow" />
        </div>
      </section>

      {/* ===== ABOUT ===== */}
      <section className="about-section">
        <div className="about-content">
          <h2 className="section-title">
            About Me
          </h2>
          <p className="about-text">
            I build things that live at the intersection of{' '}
            <span className="highlight">technology</span> and{' '}
            <span className="highlight">creativity</span>. From full-stack web
            apps to generative art, from AI systems to embedded firmware — if
            it involves code, I&apos;m probably obsessed with it. I believe the
            best software feels like{' '}
            <span className="highlight">magic</span>.
          </p>
        </div>
      </section>

      {/* ===== SKILLS ===== */}
      <section className="skills-section">
        <h2 className="section-title text-center">
          Skills & Tools
        </h2>
        <div className="skills-grid">
          {skills.map((skill) => (
            <div key={skill.title} className="skill-card">
              <div
                className="skill-card-icon font-mono font-bold"
                style={{ color: skill.color }}
              >
                {skill.icon}
              </div>
              <h3>{skill.title}</h3>
              <p>{skill.desc}</p>
              <div className="skill-bar-container">
                <div
                  className="skill-bar"
                  data-level={skill.level}
                  style={{
                    background: `linear-gradient(90deg, ${skill.color}, ${skill.color}88)`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CONTACT ===== */}
      <section className="contact-section">
        <h2 className="section-title">
          Let&apos;s Connect
        </h2>
        <p className="text-sm tracking-[0.3em] uppercase text-neutral-500">
          Always down to chat about cool projects — hire me
        </p>
        <div className="contact-links">
          <a href="https://github.com/imnoahcook" className="contact-link" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href="https://linkedin.com/in/noahpcook" className="contact-link" target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
          <a href="mailto:imnoahcook@gmail.com" className="contact-link">
            Email
          </a>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-8 text-center border-t border-white/5">
        <p className="text-xs tracking-[0.2em] uppercase text-neutral-600">
          Built with React + Three.js + Anime.js
        </p>
        <p className="text-xs mt-4 text-neutral-500 italic">
          This website is perpetually under construction, just like all of us.
        </p>
      </footer>
    </div>
  )
}

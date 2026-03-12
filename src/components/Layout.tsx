import { useRef, useEffect, useState } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import anime from 'animejs'

export default function Layout() {
  const location = useLocation()
  const contentRef = useRef<HTMLDivElement>(null)
  const [displayLocation, setDisplayLocation] = useState(location)

  useEffect(() => {
    if (location.pathname === displayLocation.pathname) return

    // Fade out
    anime({
      targets: contentRef.current,
      opacity: [1, 0],
      translateY: [0, -20],
      easing: 'easeInQuad',
      duration: 300,
      complete: () => {
        setDisplayLocation(location)
        // Fade in after location swap
        anime({
          targets: contentRef.current,
          opacity: [0, 1],
          translateY: [20, 0],
          easing: 'easeOutQuad',
          duration: 400,
        })
      },
    })
  }, [location, displayLocation])

  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-[100] flex items-center justify-center gap-6 py-4 px-6 bg-black/40 backdrop-blur-md border-b border-white/5">
        <NavLink to="/" label="Home" current={location.pathname} />
        <NavLink to="/physics" label="Physics" current={location.pathname} />
        <NavLink to="/platformer" label="Platformer" current={location.pathname} />
      </nav>
      <div ref={contentRef} style={{ opacity: 1 }}>
        <Outlet />
      </div>
    </>
  )
}

function NavLink({ to, label, current }: { to: string; label: string; current: string }) {
  const isActive = current === to
  return (
    <Link
      to={to}
      className="font-['Orbitron'] text-xs tracking-[0.2em] uppercase no-underline transition-colors duration-300"
      style={{
        color: isActive ? '#00cc88' : '#555',
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = '#3388ff' }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = '#555' }}
    >
      {label}
    </Link>
  )
}

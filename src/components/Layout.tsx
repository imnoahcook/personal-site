import anime from 'animejs'
import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

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
    <div ref={contentRef} style={{ opacity: 1 }}>
      <Outlet />
    </div>
  )
}

import { useEffect, useRef } from 'react'
import anime from 'animejs'

export default function CursorFollower() {
  const followerRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const follower = followerRef.current
    const dot = dotRef.current
    if (!follower || !dot) return

    let mouseX = 0
    let mouseY = 0

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY

      anime({
        targets: dot,
        left: mouseX - 3,
        top: mouseY - 3,
        duration: 50,
        easing: 'linear',
      })

      anime({
        targets: follower,
        left: mouseX - 10,
        top: mouseY - 10,
        duration: 400,
        easing: 'easeOutExpo',
      })
    }

    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [])

  return (
    <>
      <div ref={followerRef} className="cursor-follower" />
      <div ref={dotRef} className="cursor-dot" />
    </>
  )
}

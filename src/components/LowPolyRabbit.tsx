import { useRef, useEffect, useCallback, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function Rabbit({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const groupRef = useRef<THREE.Group>(null)
  const mouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      mouse.current.x = (e.clientX - cx) / (window.innerWidth / 2)
      mouse.current.y = -(e.clientY - cy) / (window.innerHeight / 2)
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [containerRef])

  useFrame(() => {
    if (!groupRef.current) return
    const targetY = Math.atan2(mouse.current.x, 1) * 1.2
    const targetX = Math.atan2(-mouse.current.y, 1) * 0.8
    groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.1
    groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.1
  })

  const bodyColor = '#e8d8b8'
  const innerEarColor = '#f0a0b0'
  const noseColor = '#f0a0b0'

  return (
    <group ref={groupRef} position={[0, -0.3, 0]}>
      {/* Head */}
      <mesh>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={bodyColor} flatShading />
      </mesh>

      {/* Left ear */}
      <group position={[-0.35, 1.3, 0]} rotation={[0, 0, 0.15]}>
        <mesh>
          <boxGeometry args={[0.3, 1.0, 0.15]} />
          <meshStandardMaterial color={bodyColor} flatShading />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[0.18, 0.7, 0.12]} />
          <meshStandardMaterial color={innerEarColor} flatShading />
        </mesh>
      </group>

      {/* Right ear */}
      <group position={[0.35, 1.3, 0]} rotation={[0, 0, -0.15]}>
        <mesh>
          <boxGeometry args={[0.3, 1.0, 0.15]} />
          <meshStandardMaterial color={bodyColor} flatShading />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[0.18, 0.7, 0.12]} />
          <meshStandardMaterial color={innerEarColor} flatShading />
        </mesh>
      </group>

      {/* Left eye */}
      <group position={[-0.35, 0.15, 0.85]}>
        <mesh>
          <sphereGeometry args={[0.18, 6, 4]} />
          <meshStandardMaterial color="#222" flatShading />
        </mesh>
        <mesh position={[0.05, 0.05, 0.1]}>
          <sphereGeometry args={[0.07, 4, 3]} />
          <meshStandardMaterial color="#fff" flatShading />
        </mesh>
      </group>

      {/* Right eye */}
      <group position={[0.35, 0.15, 0.85]}>
        <mesh>
          <sphereGeometry args={[0.18, 6, 4]} />
          <meshStandardMaterial color="#222" flatShading />
        </mesh>
        <mesh position={[0.05, 0.05, 0.1]}>
          <sphereGeometry args={[0.07, 4, 3]} />
          <meshStandardMaterial color="#fff" flatShading />
        </mesh>
      </group>

      {/* Nose */}
      <mesh position={[0, -0.15, 0.95]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.12, 0.15, 3]} />
        <meshStandardMaterial color={noseColor} flatShading />
      </mesh>

      {/* Cheeks */}
      <mesh position={[-0.4, -0.2, 0.65]}>
        <sphereGeometry args={[0.22, 5, 4]} />
        <meshStandardMaterial color={bodyColor} flatShading />
      </mesh>
      <mesh position={[0.4, -0.2, 0.65]}>
        <sphereGeometry args={[0.22, 5, 4]} />
        <meshStandardMaterial color={bodyColor} flatShading />
      </mesh>
    </group>
  )
}

const DEFAULT_BUBBLE = "hi i'm the rabbit. this is my site now."

const QUIPS: Record<string, string[]> = {
  click: ['hey!', 'ow!', 'stop', 'what?', 'sup', 'boop', 'rude', 'hi!', 'no'],
  tab: ['ooh', 'nice', 'hmm', 'cool', 'why?', 'ok', 'neat', 'ugh'],
  comment: ['wow', 'deep', 'lol', 'nice one', 'bold', 'heh', 'bravo', 'true'],
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function LowPolyRabbit() {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const didDrag = useRef(false)
  const offset = useRef({ x: 0, y: 0 })
  const [bubble, setBubble] = useState(DEFAULT_BUBBLE)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const showQuip = useCallback((category: string) => {
    const quips = QUIPS[category]
    if (!quips) return
    if (timerRef.current) clearTimeout(timerRef.current)
    setBubble(pick(quips))
    timerRef.current = setTimeout(() => setBubble(DEFAULT_BUBBLE), 2500)
  }, [])

  const pos = useRef({ x: 0, y: 0 })
  const hasBeenDragged = useRef(false)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true
    didDrag.current = false
    const el = wrapperRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (!hasBeenDragged.current) {
      pos.current = { x: rect.left, y: rect.top }
      hasBeenDragged.current = true
      el.style.right = 'auto'
      el.style.bottom = 'auto'
      el.style.left = '0px'
      el.style.top = '0px'
    }
    offset.current = { x: e.clientX - pos.current.x, y: e.clientY - pos.current.y }
    el.setPointerCapture(e.pointerId)
  }, [])

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current) return
      didDrag.current = true
      pos.current = { x: e.clientX - offset.current.x, y: e.clientY - offset.current.y }
      el.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`
    }
    const onPointerUp = () => {
      if (dragging.current && !didDrag.current) {
        showQuip('click')
      }
      dragging.current = false
    }

    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    return () => {
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
    }
  }, [showQuip])

  // Listen for quip events from the rest of the page
  useEffect(() => {
    const onQuip = (e: Event) => {
      const category = (e as CustomEvent).detail
      if (typeof category === 'string') showQuip(category)
    }
    window.addEventListener('rabbit-quip', onQuip)
    return () => window.removeEventListener('rabbit-quip', onQuip)
  }, [showQuip])

  return (
    <div
      ref={wrapperRef}
      className="rabbit-container"
      onPointerDown={onPointerDown}
    >
      <div className="rabbit-bubble">{bubble}</div>
      <div
        ref={containerRef}
        className="rabbit"
      >
        <Canvas
          camera={{ position: [0, 0, 4], fov: 40 }}
          style={{ background: 'transparent', pointerEvents: 'none' }}
          gl={{ alpha: true }}
          events={() => ({ enabled: false, priority: 0, compute: () => {}, connected: undefined })}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 3, 5]} intensity={1} />
          <directionalLight position={[-2, -1, 3]} intensity={0.3} />
          <Rabbit containerRef={containerRef} />
        </Canvas>
      </div>
    </div>
  )
}

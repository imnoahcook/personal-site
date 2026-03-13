import { useRef, useEffect, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function Rabbit({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const groupRef = useRef<THREE.Group>(null)
  const mouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      mouse.current.x = (e.clientX - cx) / (window.innerWidth / 2)
      mouse.current.y = -(e.clientY - cy) / (window.innerHeight / 2)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
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

export default function LowPolyRabbit() {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true
    const rect = wrapperRef.current!.getBoundingClientRect()
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    wrapperRef.current!.setPointerCapture(e.pointerId)
  }, [])

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current) return
      el.style.left = e.clientX - offset.current.x + 'px'
      el.style.top = e.clientY - offset.current.y + 'px'
      el.style.right = 'auto'
      el.style.bottom = 'auto'
    }
    const onPointerUp = () => {
      dragging.current = false
    }

    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    return () => {
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  return (
    <div
      ref={wrapperRef}
      className="og-rabbit-container"
      onPointerDown={onPointerDown}
    >
      <div className="og-rabbit-bubble">hi i&apos;m the rabbit. this is my site now.</div>
      <div
        ref={containerRef}
        className="og-rabbit"
      >
        <Canvas
          camera={{ position: [0, 0, 4], fov: 40 }}
          style={{ background: 'transparent' }}
          gl={{ alpha: true }}
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

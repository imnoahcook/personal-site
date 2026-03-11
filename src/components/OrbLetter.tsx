import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { Mesh, Group } from 'three'
import * as THREE from 'three'

function HUDRing({ radius, color, speed, tilt }: { radius: number; color: string; speed: number; tilt: [number, number, number] }) {
  const ref = useRef<Mesh>(null)
  useFrame(() => {
    if (!ref.current) return
    ref.current.rotation.z += speed
  })
  return (
    <mesh ref={ref} rotation={tilt}>
      <torusGeometry args={[radius, 0.008, 16, 100]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} />
    </mesh>
  )
}

function ArcSegment({ radius, color, startAngle, endAngle, tilt }: {
  radius: number
  color: string
  startAngle: number
  endAngle: number
  tilt: [number, number, number]
}) {
  const groupRef = useRef<Group>(null)
  const geometry = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, radius, radius, startAngle, endAngle, false, 0)
    const points3D = curve.getPoints(50).map(p => new THREE.Vector3(p.x, p.y, 0))
    const geo = new THREE.BufferGeometry().setFromPoints(points3D)
    return geo
  }, [radius, startAngle, endAngle])

  const material = useMemo(() => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }), [color])

  useFrame(() => {
    if (!groupRef.current) return
    groupRef.current.rotation.z += 0.003
  })

  return (
    <group rotation={tilt}>
      <group ref={groupRef}>
        <primitive object={new THREE.Line(geometry, material)} />
      </group>
    </group>
  )
}

function TickMarks({ radius, count, tilt }: { radius: number; count: number; tilt: [number, number, number] }) {
  const ref = useRef<Group>(null)
  const obj = useMemo(() => {
    const positions: number[] = []
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const inner = radius - 0.03
      const outer = radius + 0.03
      positions.push(Math.cos(angle) * inner, Math.sin(angle) * inner, 0)
      positions.push(Math.cos(angle) * outer, Math.sin(angle) * outer, 0)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const mat = new THREE.LineBasicMaterial({ color: '#00ff88', transparent: true, opacity: 0.3 })
    return new THREE.LineSegments(geo, mat)
  }, [radius, count])

  useFrame(() => {
    if (!ref.current) return
    ref.current.rotation.z -= 0.002
  })

  return (
    <group ref={ref} rotation={tilt}>
      <primitive object={obj} />
    </group>
  )
}

function WireSphere() {
  const ref = useRef<Mesh>(null)
  useFrame(() => {
    if (!ref.current) return
    ref.current.rotation.x += 0.005
    ref.current.rotation.y += 0.01
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.55, 24, 18]} />
      <meshBasicMaterial color="#00ff88" wireframe transparent opacity={0.7} />
    </mesh>
  )
}

function LatitudeLines() {
  const ref = useRef<Group>(null)
  useFrame(() => {
    if (!ref.current) return
    ref.current.rotation.x += 0.005
    ref.current.rotation.y += 0.01
  })

  const lines = useMemo(() => {
    const result: { radius: number; y: number }[] = []
    for (let i = -3; i <= 3; i++) {
      const y = (i / 3) * 0.5
      const r = Math.sqrt(Math.max(0, 0.55 * 0.55 - y * y))
      if (r > 0.05) result.push({ radius: r, y })
    }
    return result
  }, [])

  return (
    <group ref={ref}>
      {lines.map((line, i) => (
        <mesh key={i} position={[0, line.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[line.radius, 0.004, 8, 64]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  )
}

export default function OrbLetter({ size }: { size: number }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 2], fov: 50 }}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        verticalAlign: 'middle',
        marginTop: size * -0.08,
      }}
      gl={{ alpha: true, antialias: true }}
    >
      {/* Wireframe sphere core */}
      <WireSphere />
      <LatitudeLines />

      {/* Outer HUD rings */}
      <HUDRing radius={0.78} color="#ff3333" speed={0.008} tilt={[0.1, 0, 0]} />
      <HUDRing radius={0.85} color="#00ff88" speed={-0.005} tilt={[0.05, 0.1, 0]} />
      <HUDRing radius={0.92} color="#3388ff" speed={0.003} tilt={[-0.05, 0.05, 0]} />

      {/* Colored arc segments */}
      <ArcSegment radius={0.78} color="#ff3333" startAngle={-0.5} endAngle={0.8} tilt={[0.1, 0, 0.3]} />
      <ArcSegment radius={0.78} color="#ffaa00" startAngle={1.5} endAngle={2.5} tilt={[0.1, 0, 0.3]} />
      <ArcSegment radius={0.85} color="#00ffaa" startAngle={0} endAngle={1.2} tilt={[0.05, 0.1, -0.2]} />
      <ArcSegment radius={0.85} color="#00ff88" startAngle={2.5} endAngle={4.0} tilt={[0.05, 0.1, -0.2]} />
      <ArcSegment radius={0.92} color="#00aaff" startAngle={0.5} endAngle={1.8} tilt={[-0.05, 0.05, 0.1]} />

      {/* Tick marks */}
      <TickMarks radius={0.82} count={60} tilt={[0.08, 0.05, 0]} />
    </Canvas>
  )
}

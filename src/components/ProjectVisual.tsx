import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial, MeshWobbleMaterial } from '@react-three/drei'
import type { Mesh } from 'three'

function VisualA() {
  const ref = useRef<Mesh>(null)
  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.x += 0.01
    ref.current.rotation.y += 0.015
    const s = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.05
    ref.current.scale.setScalar(s)
  })
  return (
    <mesh ref={ref}>
      <torusKnotGeometry args={[1, 0.4, 100, 16]} />
      <MeshDistortMaterial
        color="#ff00ff"
        emissive="#ff00ff"
        emissiveIntensity={0.5}
        metalness={0.9}
        roughness={0.1}
        distort={0.3}
        speed={3}
      />
    </mesh>
  )
}

function VisualB() {
  const ref = useRef<Mesh>(null)
  useFrame(() => {
    if (!ref.current) return
    ref.current.rotation.y += 0.02
    ref.current.rotation.z += 0.01
  })
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.3, 2]} />
      <MeshWobbleMaterial
        color="#00ffff"
        emissive="#00ffff"
        emissiveIntensity={0.4}
        wireframe
        factor={0.4}
        speed={1.5}
      />
    </mesh>
  )
}

function VisualC() {
  const ref = useRef<Mesh>(null)
  useFrame(() => {
    if (!ref.current) return
    ref.current.rotation.x += 0.008
    ref.current.rotation.y += 0.012
  })
  return (
    <mesh ref={ref}>
      <dodecahedronGeometry args={[1.2, 0]} />
      <MeshDistortMaterial
        color="#ff6600"
        emissive="#ff6600"
        emissiveIntensity={0.5}
        metalness={1}
        roughness={0}
        distort={0.6}
        speed={2}
        transparent
        opacity={0.8}
      />
    </mesh>
  )
}

const visuals = [VisualA, VisualB, VisualC]

export default function ProjectVisual({ index }: { index: number }) {
  const Visual = visuals[index % visuals.length]
  return (
    <Canvas
      camera={{ position: [0, 0, 3.5], fov: 50 }}
      style={{ background: 'transparent' }}
      gl={{ alpha: true }}
    >
      <color attach="background" args={['#050510']} />
      <ambientLight intensity={0.3} />
      <pointLight position={[3, 3, 3]} intensity={1} color="#ff00ff" />
      <pointLight position={[-3, -3, 3]} intensity={0.5} color="#00ffff" />
      <Visual />
    </Canvas>
  )
}

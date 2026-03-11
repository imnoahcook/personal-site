import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, MeshDistortMaterial, MeshWobbleMaterial, Sparkles, Stars } from '@react-three/drei'
import type { Mesh, Group, Points, BufferAttribute } from 'three'

function FloatingTorus() {
  const ref = useRef<Mesh>(null)
  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.5
    ref.current.rotation.y += 0.005
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.3
  })
  return (
    <Float speed={2} rotationIntensity={2} floatIntensity={1}>
      <mesh ref={ref} position={[5, 1.5, -8]}>
        <torusKnotGeometry args={[0.6, 0.2, 128, 32]} />
        <MeshDistortMaterial
          color="#00cc88"
          emissive="#00cc88"
          emissiveIntensity={0.4}
          roughness={0.2}
          metalness={0.8}
          distort={0.4}
          speed={2}
          transparent
          opacity={0.8}
        />
      </mesh>
    </Float>
  )
}

function GlitchSphere() {
  const ref = useRef<Mesh>(null)
  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.y += 0.01
    ref.current.rotation.z = Math.cos(state.clock.elapsedTime * 0.4) * 0.3
    ref.current.position.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.5
  })
  return (
    <Float speed={1.5} rotationIntensity={1} floatIntensity={2}>
      <mesh ref={ref} position={[-5, -2, -6]}>
        <icosahedronGeometry args={[1, 1]} />
        <MeshWobbleMaterial
          color="#3388ff"
          emissive="#3388ff"
          emissiveIntensity={0.3}
          wireframe
          factor={0.6}
          speed={2}
        />
      </mesh>
    </Float>
  )
}

function WarpingOctahedron() {
  const ref = useRef<Mesh>(null)
  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.x += 0.008
    ref.current.rotation.y += 0.012
    const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1
    ref.current.scale.setScalar(scale)
  })
  return (
    <Float speed={3} rotationIntensity={3} floatIntensity={1.5}>
      <mesh ref={ref} position={[-2, 3, -10]}>
        <octahedronGeometry args={[0.5, 0]} />
        <MeshDistortMaterial
          color="#00ff99"
          emissive="#00ff99"
          emissiveIntensity={0.5}
          roughness={0.1}
          metalness={1}
          distort={0.5}
          speed={3}
          transparent
          opacity={0.7}
        />
      </mesh>
    </Float>
  )
}

function FloatingRing() {
  const ref = useRef<Mesh>(null)
  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.x = Math.PI / 2 + Math.sin(state.clock.elapsedTime) * 0.2
    ref.current.rotation.z += 0.01
  })
  return (
    <mesh ref={ref} position={[3, -2, -10]}>
      <torusGeometry args={[0.8, 0.03, 16, 100]} />
      <meshStandardMaterial
        color="#00cc88"
        emissive="#00cc88"
        emissiveIntensity={0.8}
        transparent
        opacity={0.6}
      />
    </mesh>
  )
}

function ParticleField() {
  const ref = useRef<Points>(null)
  const count = 2000

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20
    }
    return pos
  }, [])

  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.y += 0.0005
    ref.current.rotation.x += 0.0003
    const posAttr = ref.current.geometry.attributes.position as BufferAttribute
    const array = posAttr.array as Float32Array
    for (let i = 0; i < count; i++) {
      array[i * 3 + 1] += Math.sin(state.clock.elapsedTime + i * 0.1) * 0.001
    }
    posAttr.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color="#00cc88"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  )
}

function MouseFollower() {
  const ref = useRef<Group>(null)

  useFrame((state) => {
    if (!ref.current) return
    const x = state.pointer.x * 3
    const y = state.pointer.y * 2
    ref.current.position.x += (x - ref.current.position.x) * 0.05
    ref.current.position.y += (y - ref.current.position.y) * 0.05
    ref.current.rotation.x += 0.02
    ref.current.rotation.y += 0.03
  })

  return (
    <group ref={ref}>
      <mesh>
        <dodecahedronGeometry args={[0.15, 0]} />
        <MeshDistortMaterial
          color="#ffffff"
          emissive="#00cc88"
          emissiveIntensity={0.6}
          roughness={0}
          metalness={1}
          distort={0.3}
          speed={4}
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  )
}

function CameraRig() {
  useFrame((state) => {
    state.camera.position.x += (state.pointer.x * 0.5 - state.camera.position.x) * 0.02
    state.camera.position.y += (state.pointer.y * 0.3 - state.camera.position.y) * 0.02
    state.camera.lookAt(0, 0, 0)
  })
  return null
}

export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 75 }}
      className="hero-canvas"
      style={{ background: 'transparent' }}
      gl={{ alpha: true, antialias: true }}
    >
      <color attach="background" args={['#0a0a0a']} />
      <fog attach="fog" args={['#0a0a0a', 3, 15]} />

      <ambientLight intensity={0.2} />
      <pointLight position={[5, 5, 5]} intensity={1} color="#00cc88" />
      <pointLight position={[-5, -5, 5]} intensity={0.8} color="#3388ff" />
      <pointLight position={[0, 3, -3]} intensity={0.5} color="#00ff99" />

      <FloatingTorus />
      <GlitchSphere />
      <WarpingOctahedron />
      <FloatingRing />
      <ParticleField />
      <MouseFollower />
      <CameraRig />

      <Stars
        radius={50}
        depth={50}
        count={3000}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />
      <Sparkles
        count={100}
        scale={10}
        size={2}
        speed={0.5}
        color="#00cc88"
      />
    </Canvas>
  )
}

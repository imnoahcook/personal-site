import { useEffect, useRef, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics, useSphere, useBox } from '@react-three/cannon'
import type { Mesh } from 'three'
import * as THREE from 'three'

function useKeys() {
  const keys = useRef<Set<string>>(new Set())
  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase())
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])
  return keys
}

function ControllableCube({ onFlyChange, positionRef }: { onFlyChange: (f: boolean) => void; positionRef: React.MutableRefObject<[number, number, number]> }) {
  const keys = useKeys()
  const [flying, setFlying] = useState(false)
  const flyRef = useRef(false)

  const [ref, api] = useBox<Mesh>(() => ({
    mass: 5,
    position: [0, 3, 0],
    args: [0.8, 0.8, 0.8],
    restitution: 0.3,
    friction: 0.5,
    linearDamping: 0.4,
    angularDamping: 0.8,
  }))

  const velocity = useRef([0, 0, 0])
  useEffect(() => {
    const unsubVel = api.velocity.subscribe((v) => { velocity.current = v })
    const unsubPos = api.position.subscribe((p) => { positionRef.current = p as [number, number, number] })
    return () => { unsubVel(); unsubPos() }
  }, [api, positionRef])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        flyRef.current = !flyRef.current
        setFlying(flyRef.current)
        onFlyChange(flyRef.current)
        if (flyRef.current) {
          api.linearDamping.set(0.9)
        } else {
          api.linearDamping.set(0.4)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [api, onFlyChange])

  useFrame(() => {
    const force = 30
    const flyForce = 20
    const k = keys.current
    let fx = 0
    let fy = 0

    if (k.has('a') || k.has('arrowleft')) fx -= force
    if (k.has('d') || k.has('arrowright')) fx += force
    if (k.has('w') || k.has('arrowup')) {
      if (flyRef.current) {
        fy += flyForce
      } else {
        // Jump if roughly on the ground
        const [, vy] = velocity.current
        if (Math.abs(vy) < 0.5) {
          api.velocity.set(velocity.current[0], 8, velocity.current[2])
        }
      }
    }
    if (k.has('s') || k.has('arrowdown')) {
      if (flyRef.current) fy -= flyForce
    }

    if (flyRef.current) {
      // Counteract gravity when flying
      api.applyForce([fx, fy + 9.81 * 5, 0], [0, 0, 0])
    } else {
      api.applyForce([fx, fy, 0], [0, 0, 0])
    }

    // Spin the cube based on movement
    if (fx !== 0) {
      api.angularVelocity.set(0, 0, -fx * 0.05)
    }
  })

  return (
    <mesh ref={ref} castShadow>
      <boxGeometry args={[0.8, 0.8, 0.8]} />
      <meshStandardMaterial
        color={flying ? '#00ff99' : '#3388ff'}
        emissive={flying ? '#00ff99' : '#3388ff'}
        emissiveIntensity={flying ? 0.6 : 0.3}
        roughness={0.2}
        metalness={0.8}
      />
    </mesh>
  )
}

function FollowCamera({ positionRef }: { positionRef: React.MutableRefObject<[number, number, number]> }) {
  const { camera } = useThree()
  const smoothPos = useRef(new THREE.Vector3(0, 5, 12))

  useFrame(() => {
    const [x, y] = positionRef.current
    const targetX = x
    const targetY = y + 3
    const targetZ = 12

    smoothPos.current.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.05)
    camera.position.copy(smoothPos.current)
    camera.lookAt(x, y, 0)
  })

  return null
}

function StackBlock({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  const [ref] = useBox<Mesh>(() => ({
    mass: 1,
    position,
    args: size,
    restitution: 0.2,
    friction: 0.8,
  }))

  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.6} />
    </mesh>
  )
}

function SpherePart({ position, radius, color }: { position: [number, number, number]; radius: number; color: string }) {
  const [ref] = useSphere<Mesh>(() => ({
    mass: 0.5,
    position,
    args: [radius],
    restitution: 0.3,
  }))
  return (
    <mesh ref={ref} castShadow>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  )
}

function BoxPart({ position, args, color }: { position: [number, number, number]; args: [number, number, number]; color: string }) {
  const [ref] = useBox<Mesh>(() => ({
    mass: 0.5,
    position,
    args,
    restitution: 0.2,
  }))
  return (
    <mesh ref={ref} castShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  )
}

function StickFigure({ position }: { position: [number, number, number] }) {
  const [px, py, pz] = position
  return (
    <group>
      <SpherePart position={[px, py + 2.8, pz]} radius={0.25} color="#e0e0e0" />
      <BoxPart position={[px, py + 2, pz]} args={[0.3, 1, 0.3]} color="#00cc88" />
      <BoxPart position={[px - 0.2, py + 0.9, pz]} args={[0.2, 0.8, 0.2]} color="#3388ff" />
      <BoxPart position={[px + 0.2, py + 0.9, pz]} args={[0.2, 0.8, 0.2]} color="#3388ff" />
      <BoxPart position={[px - 0.4, py + 2.2, pz]} args={[0.16, 0.7, 0.16]} color="#e0e0e0" />
      <BoxPart position={[px + 0.4, py + 2.2, pz]} args={[0.16, 0.7, 0.16]} color="#e0e0e0" />
    </group>
  )
}

function Ground() {
  const [ref] = useBox<Mesh>(() => ({
    type: 'Static',
    position: [0, -0.1, 0],
    args: [40, 0.2, 10],
    friction: 1,
  }))
  return (
    <mesh ref={ref} receiveShadow>
      <boxGeometry args={[40, 0.2, 10]} />
      <meshStandardMaterial color="#111" roughness={1} />
    </mesh>
  )
}

function Walls() {
  const [leftRef] = useBox<Mesh>(() => ({
    type: 'Static',
    position: [-10, 5, 0],
    args: [0.2, 20, 10],
  }))
  const [rightRef] = useBox<Mesh>(() => ({
    type: 'Static',
    position: [10, 5, 0],
    args: [0.2, 20, 10],
  }))
  return (
    <>
      <mesh ref={leftRef}><boxGeometry args={[0.2, 20, 10]} /><meshBasicMaterial visible={false} /></mesh>
      <mesh ref={rightRef}><boxGeometry args={[0.2, 20, 10]} /><meshBasicMaterial visible={false} /></mesh>
    </>
  )
}

export default function PhysicsPlayground() {
  const [flying, setFlying] = useState(false)
  const cubePos = useRef<[number, number, number]>([0, 3, 0])
  return (
    <div style={{ width: '100%', height: '100vh', background: '#0a0a0a', paddingTop: '48px' }}>
      <Canvas
        shadows
        camera={{ position: [0, 5, 12], fov: 60 }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#0a0a0a']} />
        <fog attach="fog" args={['#0a0a0a', 10, 30]} />

        <ambientLight intensity={0.6} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={1.5}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-5, 5, 3]} intensity={0.5} color="#3388ff" />
        <pointLight position={[5, 3, -2]} intensity={0.5} color="#00cc88" />

        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]}>
            <ControllableCube onFlyChange={setFlying} positionRef={cubePos} />
            <Ground />
            <Walls />

            {/* Block tower 1 */}
            <StackBlock position={[-3, 0.5, 0]} size={[1, 1, 1]} color="#2a8a5a" />
            <StackBlock position={[-3, 1.5, 0]} size={[1, 1, 1]} color="#3366aa" />
            <StackBlock position={[-3, 2.5, 0]} size={[1, 1, 1]} color="#2a8a5a" />
            <StackBlock position={[-3, 3.5, 0]} size={[1, 1, 1]} color="#3366aa" />

            {/* Block tower 2 */}
            <StackBlock position={[3, 0.5, 0]} size={[1.2, 0.6, 1]} color="#5533aa" />
            <StackBlock position={[3, 1.1, 0]} size={[1.2, 0.6, 1]} color="#3366aa" />
            <StackBlock position={[3, 1.7, 0]} size={[1.2, 0.6, 1]} color="#5533aa" />
            <StackBlock position={[3, 2.3, 0]} size={[1.2, 0.6, 1]} color="#3366aa" />
            <StackBlock position={[3, 2.9, 0]} size={[1.2, 0.6, 1]} color="#5533aa" />
            <StackBlock position={[3, 3.5, 0]} size={[1.2, 0.6, 1]} color="#3366aa" />

            {/* Pyramid */}
            <StackBlock position={[0, 0.3, 0]} size={[2, 0.6, 1]} color="#2a8a5a" />
            <StackBlock position={[0, 0.9, 0]} size={[1.4, 0.6, 1]} color="#3366aa" />
            <StackBlock position={[0, 1.5, 0]} size={[0.8, 0.6, 1]} color="#2a8a5a" />

            {/* Stick figures */}
            <StickFigure position={[-6, 0.5, 0]} />
            <StickFigure position={[6, 0.5, 0]} />
          </Physics>
        </Suspense>

        <FollowCamera positionRef={cubePos} />
      </Canvas>

      <div style={{
        position: 'fixed',
        top: '60px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#00cc88',
        fontSize: '0.9rem',
        fontFamily: "'Orbitron', 'Space Mono', monospace",
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        Built with React Three Fiber
      </div>

      {flying && (
        <div style={{
          position: 'fixed',
          top: '90px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#00ff99',
          fontSize: '0.75rem',
          fontFamily: "'Orbitron', 'Space Mono', monospace",
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          pointerEvents: 'none',
          textShadow: '0 0 10px rgba(0, 255, 153, 0.5)',
        }}>
          FLY MODE ON
        </div>
      )}

      <div style={{
        position: 'fixed',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#555',
        fontSize: '0.7rem',
        fontFamily: "'Space Mono', monospace",
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        WASD to move &bull; W to jump &bull; F to toggle fly
      </div>
    </div>
  )
}

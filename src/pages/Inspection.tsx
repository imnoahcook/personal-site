import { useRef, useState, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import * as THREE from 'three'
import './Inspection.css'

interface ItemDef {
  name: string
  description: string
  color: string
  shape: 'box' | 'sphere' | 'cylinder' | 'torus' | 'cone'
  scale: [number, number, number]
  accentColor?: string
}

const ITEMS: ItemDef[] = [
  { name: 'HERB', description: 'A green herb. Restores a small amount of health.', color: '#2d8a4e', shape: 'cylinder', scale: [0.3, 0.6, 0.3], accentColor: '#1a5c30' },
  { name: 'KEY', description: 'A rusty old key. Opens something somewhere...', color: '#c4a43b', shape: 'torus', scale: [0.4, 0.4, 0.15], accentColor: '#8a7428' },
  { name: 'AMMO', description: 'Handgun bullets. 15 rounds.', color: '#8b6914', shape: 'box', scale: [0.5, 0.35, 0.3], accentColor: '#5c4a12' },
  { name: 'MAP', description: 'A crumpled map of the facility.', color: '#d4c9a8', shape: 'box', scale: [0.7, 0.02, 0.5], accentColor: '#a89b70' },
  { name: 'RADIO', description: 'A portable radio. Emits static...', color: '#3a3a3a', shape: 'box', scale: [0.25, 0.5, 0.15], accentColor: '#666' },
  { name: 'GEM', description: 'A blood-red gemstone. It pulses faintly.', color: '#9b1b30', shape: 'sphere', scale: [0.3, 0.3, 0.3], accentColor: '#cc2244' },
]

function Bag() {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.15
  })

  return (
    <group>
      {/* Main bag body */}
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <boxGeometry args={[1.8, 1.2, 0.9]} />
        <meshStandardMaterial color="#5c3a1e" flatShading roughness={0.9} />
      </mesh>
      {/* Flap */}
      <mesh position={[0, 0.65, 0.1]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[1.85, 0.15, 0.95]} />
        <meshStandardMaterial color="#4a2e15" flatShading roughness={0.9} />
      </mesh>
      {/* Buckle */}
      <mesh position={[0, 0.5, 0.5]}>
        <boxGeometry args={[0.3, 0.15, 0.08]} />
        <meshStandardMaterial color="#c4a43b" flatShading metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Strap left */}
      <mesh position={[-0.7, 0.9, 0]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.12, 0.6, 0.08]} />
        <meshStandardMaterial color="#3d2512" flatShading roughness={0.9} />
      </mesh>
      {/* Strap right */}
      <mesh position={[0.7, 0.9, 0]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.12, 0.6, 0.08]} />
        <meshStandardMaterial color="#3d2512" flatShading roughness={0.9} />
      </mesh>
    </group>
  )
}

function InspectableItem({ item, isSelected }: { item: ItemDef; isSelected: boolean }) {
  const meshRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!meshRef.current) return
    if (isSelected) {
      meshRef.current.rotation.y += 0.02
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.05
    }
  })

  const geometry = () => {
    switch (item.shape) {
      case 'box':
        return <boxGeometry args={item.scale} />
      case 'sphere':
        return <sphereGeometry args={[item.scale[0], 6, 4]} />
      case 'cylinder':
        return <cylinderGeometry args={[item.scale[0], item.scale[0], item.scale[1], 6]} />
      case 'torus':
        return <torusGeometry args={[item.scale[0], item.scale[2], 4, 6]} />
      case 'cone':
        return <coneGeometry args={[item.scale[0], item.scale[1], 5]} />
    }
  }

  return (
    <group ref={meshRef}>
      <mesh>
        {geometry()}
        <meshStandardMaterial
          color={item.color}
          flatShading
          roughness={0.8}
        />
      </mesh>
      {item.accentColor && item.shape === 'box' && (
        <mesh position={[0, item.scale[1] / 2 + 0.01, 0]}>
          <boxGeometry args={[item.scale[0] * 0.8, 0.02, item.scale[2] * 0.8]} />
          <meshStandardMaterial color={item.accentColor} flatShading />
        </mesh>
      )}
    </group>
  )
}

function Scene({ selectedItem }: { selectedItem: number | null }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[3, 4, 5]} intensity={0.8} color="#e8d0a0" />
      <directionalLight position={[-2, -1, 3]} intensity={0.2} color="#6688cc" />
      <pointLight position={[0, 2, 0]} intensity={0.4} color="#ffcc88" distance={8} />
      <Environment preset="night" />

      {selectedItem === null ? (
        <Bag />
      ) : (
        <InspectableItem item={ITEMS[selectedItem]} isSelected />
      )}

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI * 3 / 4}
      />

      {/* PS1 ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
        <planeGeometry args={[10, 10, 4, 4]} />
        <meshStandardMaterial color="#1a1a2e" flatShading roughness={1} />
      </mesh>
    </>
  )
}

export default function Inspection() {
  const [selectedItem, setSelectedItem] = useState<number | null>(null)

  const handleBack = useCallback(() => {
    setSelectedItem(null)
  }, [])

  return (
    <div className="inspect-page">
      <div className="inspect-viewport">
        <Canvas
          camera={{ position: [0, 1.5, 3.5], fov: 45 }}
          gl={{ alpha: false, antialias: false }}
          dpr={0.75}
          style={{ imageRendering: 'pixelated' }}
        >
          <Scene selectedItem={selectedItem} />
          <color attach="background" args={['#0a0a14']} />
        </Canvas>

        {/* PS1 scanline overlay */}
        <div className="inspect-scanlines" />

        {/* Dithering noise overlay */}
        <div className="inspect-dither" />
      </div>

      <div className="inspect-ui">
        <div className="inspect-header">
          {selectedItem !== null ? (
            <>
              <button className="inspect-back" onClick={handleBack}>&lt; BACK</button>
              <span className="inspect-title">{ITEMS[selectedItem].name}</span>
            </>
          ) : (
            <span className="inspect-title">INVENTORY</span>
          )}
        </div>

        {selectedItem !== null ? (
          <div className="inspect-description">
            <p>{ITEMS[selectedItem].description}</p>
            <p className="inspect-hint">Drag to rotate</p>
          </div>
        ) : (
          <div className="inspect-grid">
            {ITEMS.map((item, i) => (
              <button
                key={item.name}
                className="inspect-slot"
                onClick={() => setSelectedItem(i)}
              >
                <span className="inspect-slot-icon" style={{ color: item.color }}>
                  {item.shape === 'sphere' ? '●' : item.shape === 'torus' ? '◎' : item.shape === 'cylinder' ? '▮' : item.shape === 'cone' ? '▲' : '■'}
                </span>
                <span className="inspect-slot-name">{item.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <a href="/" className="inspect-home">HOME</a>
    </div>
  )
}

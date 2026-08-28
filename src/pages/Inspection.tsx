import { PointerLockControls, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js'
import './Inspection.css'

const PS1_SHADER_PATCH_FLAG = '__inspectionPs1ShaderPatched__'
const PS1_TEXTURE_KEYS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
] as const

type MaybeTexturedMaterial = THREE.Material & Record<string, unknown>
const ps1SimplifyModifier = new SimplifyModifier()
interface Ps1StyleOptions {
  affineUv?: boolean
  simplify?: boolean
  simplifyRatio?: number
}

function patchChunk(
  source: string,
  needle: string,
  replacement: string,
): string {
  return source.includes(needle) ? source.replace(needle, replacement) : source
}

function ensureInspectionPs1ShaderChunks() {
  const globalFlags = globalThis as typeof globalThis & {
    [PS1_SHADER_PATCH_FLAG]?: boolean
  }
  if (globalFlags[PS1_SHADER_PATCH_FLAG]) return

  THREE.ShaderChunk.uv_pars_vertex = patchChunk(
    THREE.ShaderChunk.uv_pars_vertex,
    'varying vec2 vMapUv;',
    [
      'varying vec2 vMapUv;',
      'varying vec2 vAffineUv;',
      'varying float vAffineW;',
    ].join('\n\t'),
  )

  THREE.ShaderChunk.uv_pars_fragment = patchChunk(
    THREE.ShaderChunk.uv_pars_fragment,
    'varying vec2 vMapUv;',
    [
      'varying vec2 vMapUv;',
      'varying vec2 vAffineUv;',
      'varying float vAffineW;',
    ].join('\n\t'),
  )

  THREE.ShaderChunk.project_vertex = patchChunk(
    THREE.ShaderChunk.project_vertex,
    'gl_Position = projectionMatrix * mvPosition;',
    [
      'gl_Position = projectionMatrix * mvPosition;',
      '',
      '#if defined( USE_MAP ) && defined( USE_PS1_AFFINE_UV )',
      '\tvAffineUv = vMapUv * gl_Position.w;',
      '\tvAffineW = gl_Position.w;',
      '#endif',
      '',
      '// PS1-style vertex snapping in clip space.',
      'vec2 ps1SnapGrid = vec2( 220.0, 165.0 );',
      'gl_Position.xy = floor( ( gl_Position.xy / gl_Position.w ) * ps1SnapGrid + 0.5 ) / ps1SnapGrid * gl_Position.w;',
    ].join('\n'),
  )

  THREE.ShaderChunk.map_fragment = patchChunk(
    THREE.ShaderChunk.map_fragment,
    'vec4 sampledDiffuseColor = texture2D( map, vMapUv );',
    [
      'vec2 affineMapUv = vMapUv;',
      '#ifdef USE_PS1_AFFINE_UV',
      '\taffineMapUv = vAffineUv / max( abs( vAffineW ), 0.00001 );',
      '#endif',
      'vec4 sampledDiffuseColor = texture2D( map, affineMapUv );',
    ].join('\n\t'),
  )

  THREE.ShaderChunk.colorspace_fragment = [
    'gl_FragColor = linearToOutputTexel( gl_FragColor );',
    '',
    '// Quantize after output conversion so the banding reads like limited hardware color depth.',
    'vec2 ps1Cell = mod( floor( gl_FragCoord.xy ), 4.0 );',
    'float ps1Dither = 0.0;',
    'if ( ps1Cell.x < 1.0 ) {',
    '\tif ( ps1Cell.y < 1.0 ) ps1Dither = 0.0;',
    '\telse if ( ps1Cell.y < 2.0 ) ps1Dither = 8.0;',
    '\telse if ( ps1Cell.y < 3.0 ) ps1Dither = 2.0;',
    '\telse ps1Dither = 10.0;',
    '} else if ( ps1Cell.x < 2.0 ) {',
    '\tif ( ps1Cell.y < 1.0 ) ps1Dither = 12.0;',
    '\telse if ( ps1Cell.y < 2.0 ) ps1Dither = 4.0;',
    '\telse if ( ps1Cell.y < 3.0 ) ps1Dither = 14.0;',
    '\telse ps1Dither = 6.0;',
    '} else if ( ps1Cell.x < 3.0 ) {',
    '\tif ( ps1Cell.y < 1.0 ) ps1Dither = 3.0;',
    '\telse if ( ps1Cell.y < 2.0 ) ps1Dither = 11.0;',
    '\telse if ( ps1Cell.y < 3.0 ) ps1Dither = 1.0;',
    '\telse ps1Dither = 9.0;',
    '} else {',
    '\tif ( ps1Cell.y < 1.0 ) ps1Dither = 15.0;',
    '\telse if ( ps1Cell.y < 2.0 ) ps1Dither = 7.0;',
    '\telse if ( ps1Cell.y < 3.0 ) ps1Dither = 13.0;',
    '\telse ps1Dither = 5.0;',
    '}',
    'float ps1ColorSteps = 24.0;',
    'gl_FragColor.rgb = clamp( floor( gl_FragColor.rgb * ps1ColorSteps + ( ps1Dither / 16.0 - 0.5 ) ) / ps1ColorSteps, 0.0, 1.0 );',
  ].join('\n')

  globalFlags[PS1_SHADER_PATCH_FLAG] = true
}

function applyPs1MaterialStyle(
  root: THREE.Object3D,
  options?: Ps1StyleOptions,
) {
  const affineUv = options?.affineUv ?? false
  const simplify = options?.simplify ?? true
  const simplifyRatio = options?.simplifyRatio ?? 0.55

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return

    if (simplify && !(child instanceof THREE.SkinnedMesh)) {
      child.geometry = simplifyPs1Geometry(child.geometry, simplifyRatio)
    }

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material]
    for (const material of materials) {
      if (!(material instanceof THREE.Material)) continue

      const texturedMaterial = material as MaybeTexturedMaterial
      let needsMaterialUpdate = false

      if (affineUv) {
        texturedMaterial.defines = {
          ...(texturedMaterial.defines as Record<string, unknown> | undefined),
          USE_PS1_AFFINE_UV: '',
        }
      } else if (
        texturedMaterial.defines &&
        'USE_PS1_AFFINE_UV' in texturedMaterial.defines
      ) {
        delete (texturedMaterial.defines as Record<string, unknown>)
          .USE_PS1_AFFINE_UV
      }

      for (const key of PS1_TEXTURE_KEYS) {
        const texture = texturedMaterial[key]
        if (!(texture instanceof THREE.Texture)) continue

        texture.minFilter = THREE.NearestFilter
        texture.magFilter = THREE.NearestFilter
        texture.generateMipmaps = false
        texture.anisotropy = 1
        texture.needsUpdate = true
      }

      if (
        'flatShading' in texturedMaterial &&
        texturedMaterial.flatShading !== true
      ) {
        texturedMaterial.flatShading = true
        needsMaterialUpdate = true
      }

      if (
        'normalMap' in texturedMaterial &&
        texturedMaterial.normalMap instanceof THREE.Texture
      ) {
        texturedMaterial.normalMap = null
        needsMaterialUpdate = true
      }

      if (
        'roughness' in texturedMaterial &&
        typeof texturedMaterial.roughness === 'number'
      ) {
        texturedMaterial.roughness = Math.max(texturedMaterial.roughness, 0.85)
      }

      if (
        'metalness' in texturedMaterial &&
        typeof texturedMaterial.metalness === 'number'
      ) {
        texturedMaterial.metalness *= 0.35
      }

      if (affineUv) needsMaterialUpdate = true
      if (needsMaterialUpdate) material.needsUpdate = true
    }
  })
}

ensureInspectionPs1ShaderChunks()

function createDinerFloorTexture() {
  const size = 16
  const data = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const isDark = (x + y) % 2 === 0
      const value = isDark ? 18 : 236
      const index = (y * size + x) * 4
      data[index] = value
      data[index + 1] = value
      data[index + 2] = value
      data[index + 3] = 255
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true
  return texture
}

const DINER_FLOOR_TEXTURE = createDinerFloorTexture()

function setupPs1Texture(
  texture: THREE.Texture,
  repeatX: number,
  repeatY: number,
) {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
}

function setupPs1SpriteTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
}

function simplifyPs1Geometry(
  geometry: THREE.BufferGeometry,
  simplifyRatio = 0.55,
) {
  const position = geometry.getAttribute('position')
  if (!position) return geometry

  const vertexCount = position.count
  if (vertexCount <= 96) return geometry

  const targetVertexCount = Math.max(
    48,
    Math.floor(vertexCount * simplifyRatio),
  )
  const removeCount = Math.min(
    vertexCount - 24,
    vertexCount - targetVertexCount,
  )
  if (removeCount <= 0) return geometry

  try {
    const simplified = ps1SimplifyModifier.modify(geometry, removeCount)
    simplified.computeBoundingBox()
    simplified.computeBoundingSphere()
    return simplified
  } catch {
    return geometry
  }
}

/* ── palette ──────────────────────────────────────────── */
const TEAL = '#5bb5a2'
const CREAM = '#e8dcc8'
const RED_VINYL = '#cc3333'
const CHROME = '#c0c0c0'
const FORMICA = '#d4c9a8'
const NEON_PINK = '#ff3366'
const NEON_GREEN = '#33ff99'

const W = 8 // diner half-width
const IMPOSSIBLE_HOUSE_X = 21
const IMPOSSIBLE_HOUSE_Z = 28
const IMPOSSIBLE_HOUSE_HALF_W = 3.2
const IMPOSSIBLE_HOUSE_HALF_D = 3
const IMPOSSIBLE_HOUSE_H = 4.2
const IMPOSSIBLE_HOUSE_REMOTE_X = 132
const IMPOSSIBLE_HOUSE_REMOTE_Z = -96
const IMPOSSIBLE_HOUSE_REMOTE_HALF_W = 12
const IMPOSSIBLE_HOUSE_REMOTE_HALF_D = 16
const HIDDEN_ROOM_CENTER_X = -96
const HIDDEN_ROOM_CENTER_Z = 84
const HIDDEN_ROOM_HALF_W = 18
const HIDDEN_ROOM_HALF_D = 16
const HIDDEN_ROOM_DOOR_HALF_D = 1
const HIDDEN_ROOM_SIDE_SEGMENT_D = HIDDEN_ROOM_HALF_D - HIDDEN_ROOM_DOOR_HALF_D
const HIDDEN_ROOM_SIDE_SEGMENT_OFFSET_Z =
  (HIDDEN_ROOM_HALF_D + HIDDEN_ROOM_DOOR_HALF_D) / 2

/* ── collision AABB ─────────────────────────────────── */
interface AABB {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

// box(centerX, centerZ, halfW, halfD)
function box(cx: number, cz: number, hw: number, hd: number): AABB {
  return { minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd }
}

function isInsideDinerFootprint(position: { x: number; z: number }) {
  return (
    position.x > -W - 0.5 &&
    position.x < W + 0.5 &&
    position.z > -W - 0.5 &&
    position.z < W + 0.5
  )
}

function isInsideImpossibleHouseExterior(position: { x: number; z: number }) {
  return (
    position.x > IMPOSSIBLE_HOUSE_X - IMPOSSIBLE_HOUSE_HALF_W - 0.5 &&
    position.x < IMPOSSIBLE_HOUSE_X + IMPOSSIBLE_HOUSE_HALF_W + 0.5 &&
    position.z > IMPOSSIBLE_HOUSE_Z - IMPOSSIBLE_HOUSE_HALF_D - 0.5 &&
    position.z < IMPOSSIBLE_HOUSE_Z + IMPOSSIBLE_HOUSE_HALF_D + 0.5
  )
}

const PLAYER_R = 0.3

const COLLIDERS: AABB[] = [
  // diner outer walls
  // back wall — split around kitchen opening (opening x=-2.3 to x=0.3)
  box(-5.15, -W, 2.85, 0.15), // back left of kitchen
  box(4.15, -W, 3.85, 0.15), // back right of kitchen
  // front wall — split around door (opening x=0.5 to x=3.5)
  box(-3.75, W, 4.25, 0.15), // front left of door
  box(5.75, W, 2.25, 0.15), // front right of door
  // left wall — split around hidden-room door opening (opening z=-1 to z=1)
  box(-W, -4.5, 0.15, 3.5), // left bottom (z -8 to -1)
  box(-W, 4.5, 0.15, 3.5), // left top (z 1 to 8)
  box(W, 0, 0.15, W), // right

  // counter main body
  box(-1, -3.5, 5, 0.6),
  // counter L body
  box(3.5, -1, 0.6, 2.6),

  // booths — full booth block (seats + table)
  box(6.5, -5, 1.2, 1.2),
  box(6.5, -1, 1.2, 1.2),
  box(6.5, 3, 1.2, 1.2),

  // bar stools (main counter)
  box(-4.5, -2.2, 0.3, 0.3),
  box(-3, -2.2, 0.3, 0.3),
  box(-1.5, -2.2, 0.3, 0.3),
  box(0, -2.2, 0.3, 0.3),
  box(1.5, -2.2, 0.3, 0.3),
  // bar stools (L section)
  box(2.2, 0.5, 0.3, 0.3),
  box(2.2, 2, 0.3, 0.3),

  // jukebox
  box(-6, -W + 0.5, 0.5, 0.3),

  // === STAIRWELL (behind kitchen, z < -W) ===
  box(-2.5, -19.75, 0.15, 11.75), // left wall
  box(0.5, -19.75, 0.15, 11.75), // right wall
  box(-1, -31.5, 1.6, 0.15), // back wall at bottom

  // === SHED — exterior entrance + large interior walls ===
  // Left wall / entrance (x=13, with door gap)
  box(13, -5.4, 0.15, 0.6),
  box(13, -2.6, 0.15, 0.6),
  // Front wall exterior (z=-2, with window gap)
  box(13.75, -2, 0.75, 0.15),
  box(16.25, -2, 0.75, 0.15),
  // Large interior boundaries (3x bigger: extends to x=25, z=-10 to z=2)
  box(25, -4, 0.15, 6), // far wall (was x=17)
  box(19, -10, 6, 0.15), // back wall (was z=-6)
  box(19, 2, 6, 0.15), // front-far wall (was z=-2, extends to z=2)

  // === IMPOSSIBLE HOUSE — tiny exterior shell behind spawn ===
  box(
    IMPOSSIBLE_HOUSE_X - 2.05,
    IMPOSSIBLE_HOUSE_Z - IMPOSSIBLE_HOUSE_HALF_D,
    1.15,
    0.15,
  ), // front left of door
  box(
    IMPOSSIBLE_HOUSE_X + 2.05,
    IMPOSSIBLE_HOUSE_Z - IMPOSSIBLE_HOUSE_HALF_D,
    1.15,
    0.15,
  ), // front right of door
  box(
    IMPOSSIBLE_HOUSE_X - IMPOSSIBLE_HOUSE_HALF_W,
    IMPOSSIBLE_HOUSE_Z,
    0.15,
    IMPOSSIBLE_HOUSE_HALF_D,
  ),
  box(
    IMPOSSIBLE_HOUSE_X + IMPOSSIBLE_HOUSE_HALF_W,
    IMPOSSIBLE_HOUSE_Z,
    0.15,
    IMPOSSIBLE_HOUSE_HALF_D,
  ),
  box(
    IMPOSSIBLE_HOUSE_X,
    IMPOSSIBLE_HOUSE_Z + IMPOSSIBLE_HOUSE_HALF_D,
    IMPOSSIBLE_HOUSE_HALF_W,
    0.15,
  ),

  // === IMPOSSIBLE HOUSE — remote interior ===
  box(
    IMPOSSIBLE_HOUSE_REMOTE_X - 8.4,
    IMPOSSIBLE_HOUSE_REMOTE_Z - IMPOSSIBLE_HOUSE_REMOTE_HALF_D,
    3.6,
    0.15,
  ), // front left
  box(
    IMPOSSIBLE_HOUSE_REMOTE_X + 8.4,
    IMPOSSIBLE_HOUSE_REMOTE_Z - IMPOSSIBLE_HOUSE_REMOTE_HALF_D,
    3.6,
    0.15,
  ), // front right
  box(
    IMPOSSIBLE_HOUSE_REMOTE_X - IMPOSSIBLE_HOUSE_REMOTE_HALF_W,
    IMPOSSIBLE_HOUSE_REMOTE_Z,
    0.15,
    IMPOSSIBLE_HOUSE_REMOTE_HALF_D,
  ),
  box(
    IMPOSSIBLE_HOUSE_REMOTE_X + IMPOSSIBLE_HOUSE_REMOTE_HALF_W,
    IMPOSSIBLE_HOUSE_REMOTE_Z,
    0.15,
    IMPOSSIBLE_HOUSE_REMOTE_HALF_D,
  ),
  box(
    IMPOSSIBLE_HOUSE_REMOTE_X,
    IMPOSSIBLE_HOUSE_REMOTE_Z + IMPOSSIBLE_HOUSE_REMOTE_HALF_D,
    IMPOSSIBLE_HOUSE_REMOTE_HALF_W,
    0.15,
  ),

  // === HIDDEN ROOM (bigger inside than outside) ===
  box(
    HIDDEN_ROOM_CENTER_X - HIDDEN_ROOM_HALF_W,
    HIDDEN_ROOM_CENTER_Z,
    0.15,
    HIDDEN_ROOM_HALF_D,
  ),
  box(
    HIDDEN_ROOM_CENTER_X,
    HIDDEN_ROOM_CENTER_Z - HIDDEN_ROOM_HALF_D,
    HIDDEN_ROOM_HALF_W,
    0.15,
  ),
  box(
    HIDDEN_ROOM_CENTER_X,
    HIDDEN_ROOM_CENTER_Z + HIDDEN_ROOM_HALF_D,
    HIDDEN_ROOM_HALF_W,
    0.15,
  ),
  box(
    HIDDEN_ROOM_CENTER_X + HIDDEN_ROOM_HALF_W,
    HIDDEN_ROOM_CENTER_Z - HIDDEN_ROOM_SIDE_SEGMENT_OFFSET_Z,
    0.15,
    HIDDEN_ROOM_SIDE_SEGMENT_D,
  ),
  box(
    HIDDEN_ROOM_CENTER_X + HIDDEN_ROOM_HALF_W,
    HIDDEN_ROOM_CENTER_Z + HIDDEN_ROOM_SIDE_SEGMENT_OFFSET_Z,
    0.15,
    HIDDEN_ROOM_SIDE_SEGMENT_D,
  ),
]

function collides(x: number, z: number): boolean {
  for (const c of COLLIDERS) {
    if (
      x + PLAYER_R > c.minX &&
      x - PLAYER_R < c.maxX &&
      z + PLAYER_R > c.minZ &&
      z - PLAYER_R < c.maxZ
    ) {
      return true
    }
  }
  return false
}

/* ── ground height (stairwell slope + second floor) ── */
function getGroundHeight(x: number, z: number, y?: number): number {
  // Stairwell down (behind kitchen)
  if (x > -2.7 && x < 0.7 && z < -8) {
    if (z >= -10) return 0
    if (z >= -30) return (z + 10) / 2.5
    return -8
  }
  // Staircase up to second floor (back-left, z=1 bottom to z=-7 top)
  if (x > -7.7 && x < -5.8 && z >= -7 && z <= 1) {
    return ((1 - z) / 8) * 5.1
  }
  // Second floor
  if (
    y !== undefined &&
    y > 3.5 &&
    x > -W + 0.3 &&
    x < W - 0.3 &&
    z > -W + 0.3 &&
    z < W - 0.3
  ) {
    return 5.1
  }
  return 0
}

/* ── teleport triggers ──────────────────────────────── */
interface Trigger {
  zone: AABB
  target: THREE.Vector3
  rotY?: number
}

const TRIGGERS: Trigger[] = [
  // kitchen pass-through → stairwell
  { zone: box(-1, -W - 0.3, 1.2, 0.5), target: new THREE.Vector3(-1, 1.6, -9) },
  // stairwell bottom → loop back to top (infinite staircase)
  { zone: box(-1, -31.3, 1.2, 0.5), target: new THREE.Vector3(-1, 1.6, -9) },
  // impossible house front door → much larger remote interior
  {
    zone: box(
      IMPOSSIBLE_HOUSE_X,
      IMPOSSIBLE_HOUSE_Z - IMPOSSIBLE_HOUSE_HALF_D + 0.45,
      0.8,
      0.35,
    ),
    target: new THREE.Vector3(
      IMPOSSIBLE_HOUSE_REMOTE_X,
      1.6,
      IMPOSSIBLE_HOUSE_REMOTE_Z - IMPOSSIBLE_HOUSE_REMOTE_HALF_D + 2.2,
    ),
    rotY: Math.PI,
  },
  // remote interior exit → back outside the small house
  {
    zone: box(
      IMPOSSIBLE_HOUSE_REMOTE_X,
      IMPOSSIBLE_HOUSE_REMOTE_Z - IMPOSSIBLE_HOUSE_REMOTE_HALF_D + 0.45,
      0.8,
      0.35,
    ),
    target: new THREE.Vector3(
      IMPOSSIBLE_HOUSE_X,
      1.6,
      IMPOSSIBLE_HOUSE_Z - IMPOSSIBLE_HOUSE_HALF_D - 1.4,
    ),
    rotY: 0,
  },
  // side door in diner → larger hidden room
  {
    zone: box(-W - 0.25, 0, 0.35, 0.8),
    target: new THREE.Vector3(
      HIDDEN_ROOM_CENTER_X + HIDDEN_ROOM_HALF_W - 3.5,
      1.6,
      HIDDEN_ROOM_CENTER_Z + 6,
    ),
    rotY: 2.35,
  },
  // hidden room door → back into diner
  {
    zone: box(
      HIDDEN_ROOM_CENTER_X + HIDDEN_ROOM_HALF_W - 0.25,
      HIDDEN_ROOM_CENTER_Z,
      0.35,
      0.8,
    ),
    target: new THREE.Vector3(-W + 1.25, 1.6, 0),
    rotY: -Math.PI / 2,
  },
]

/* ── Checkered floor ────────────────────────────────── */
function TileFloor({
  cx,
  cz,
  hw,
  hd,
  dark1,
  light1,
}: {
  cx: number
  cz: number
  hw: number
  hd: number
  dark1?: string
  light1?: string
}) {
  void dark1
  void light1
  return (
    <mesh position={[cx, 0.03, cz]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[hw * 2, hd * 2]} />
      <meshStandardMaterial
        map={DINER_FLOOR_TEXTURE}
        flatShading
        roughness={0.95}
      />
    </mesh>
  )
}

function OutdoorGround() {
  const groundMap = useLoader(
    THREE.TextureLoader,
    '/textures/inspection_ground_asphalt_03_diff_2k.jpg',
  )

  useEffect(() => {
    setupPs1Texture(groundMap, 14, 14)
  }, [groundMap])

  return (
    <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[160, 160]} />
      <meshStandardMaterial
        map={groundMap}
        color="#8f8f8f"
        flatShading
        roughness={1}
      />
    </mesh>
  )
}

function SkyDome() {
  const skyMap = useLoader(THREE.TextureLoader, '/fp-img/spacewithstars.gif')

  useEffect(() => {
    setupPs1Texture(skyMap, 10, 5)
  }, [skyMap])

  return (
    <mesh>
      <sphereGeometry args={[120, 20, 14]} />
      <meshBasicMaterial
        map={skyMap}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  )
}

function OneWayStairOccluder() {
  const groupRef = useRef<THREE.Group>(null)
  const { camera } = useThree()

  useFrame(() => {
    if (!groupRef.current) return
    groupRef.current.visible = !isInsideDinerFootprint(camera.position)
  })

  return (
    <group ref={groupRef} position={[-W + 0.06, 0, 0]}>
      <mesh position={[0, 1.75, 0]}>
        <boxGeometry args={[0.12, 3.5, 2.02]} />
        <meshStandardMaterial color={TEAL} flatShading roughness={0.88} />
      </mesh>
      <mesh position={[0.07, 1.75, 0]}>
        <boxGeometry args={[0.02, 3.3, 1.86]} />
        <meshStandardMaterial color="#6ec7b1" flatShading roughness={0.8} />
      </mesh>
    </group>
  )
}

function ImpossibleHouseDoorPreview() {
  const groupRef = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const wallMap = useLoader(
    THREE.TextureLoader,
    '/textures/diner_candidates/beige_wall_002_diff_2k.jpg',
  )
  const floorMap = useLoader(
    THREE.TextureLoader,
    '/textures/diner_candidates/portal_pine_floor.JPG',
  )

  useEffect(() => {
    setupPs1Texture(wallMap, 6, 3)
    setupPs1Texture(floorMap, 5, 8)
  }, [floorMap, wallMap])

  useFrame(() => {
    if (!groupRef.current) return
    const p = camera.position
    const inFront = p.z < IMPOSSIBLE_HOUSE_Z - IMPOSSIBLE_HOUSE_HALF_D + 0.8
    const centered = Math.abs(p.x - IMPOSSIBLE_HOUSE_X) < 8
    const closeEnough = p.z > IMPOSSIBLE_HOUSE_Z - 22
    groupRef.current.visible =
      !isInsideImpossibleHouseExterior(p) && inFront && centered && closeEnough
  })

  return (
    <group ref={groupRef}>
      <mesh
        position={[IMPOSSIBLE_HOUSE_X, 0.03, IMPOSSIBLE_HOUSE_Z + 4]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[11, 16]} />
        <meshStandardMaterial
          map={floorMap}
          color="#b39e85"
          flatShading
          roughness={0.95}
        />
      </mesh>
      <mesh position={[IMPOSSIBLE_HOUSE_X, 4.8, IMPOSSIBLE_HOUSE_Z + 4]}>
        <boxGeometry args={[11, 0.2, 16]} />
        <meshStandardMaterial color="#ddd7ca" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[IMPOSSIBLE_HOUSE_X - 5.5, 2.4, IMPOSSIBLE_HOUSE_Z + 4]}>
        <boxGeometry args={[0.2, 4.8, 16]} />
        <meshStandardMaterial
          map={wallMap}
          color="#eadfcd"
          flatShading
          roughness={0.92}
        />
      </mesh>
      <mesh position={[IMPOSSIBLE_HOUSE_X + 5.5, 2.4, IMPOSSIBLE_HOUSE_Z + 4]}>
        <boxGeometry args={[0.2, 4.8, 16]} />
        <meshStandardMaterial
          map={wallMap}
          color="#eadfcd"
          flatShading
          roughness={0.92}
        />
      </mesh>
      <mesh position={[IMPOSSIBLE_HOUSE_X, 2.4, IMPOSSIBLE_HOUSE_Z + 12]}>
        <boxGeometry args={[11, 4.8, 0.2]} />
        <meshStandardMaterial
          map={wallMap}
          color="#eadfcd"
          flatShading
          roughness={0.92}
        />
      </mesh>
      <mesh
        position={[IMPOSSIBLE_HOUSE_X - 2.8, 2.4, IMPOSSIBLE_HOUSE_Z + 1.8]}
      >
        <boxGeometry args={[1.4, 4.8, 7]} />
        <meshStandardMaterial
          map={wallMap}
          color="#eadfcd"
          flatShading
          roughness={0.92}
        />
      </mesh>
      <mesh
        position={[IMPOSSIBLE_HOUSE_X + 2.8, 2.4, IMPOSSIBLE_HOUSE_Z + 1.8]}
      >
        <boxGeometry args={[1.4, 4.8, 7]} />
        <meshStandardMaterial
          map={wallMap}
          color="#eadfcd"
          flatShading
          roughness={0.92}
        />
      </mesh>
      {[-3.2, 0, 3.2].map((x) => (
        <mesh
          key={x}
          position={[IMPOSSIBLE_HOUSE_X + x, 4.1, IMPOSSIBLE_HOUSE_Z + 5]}
        >
          <boxGeometry args={[1.8, 0.08, 0.35]} />
          <meshStandardMaterial
            color="#efe2ad"
            emissive="#efe2ad"
            emissiveIntensity={1.1}
            flatShading
          />
        </mesh>
      ))}
    </group>
  )
}

function ImpossibleHouseExterior() {
  const brickMap = useLoader(
    THREE.TextureLoader,
    '/textures/diner_candidates/portal_brick.JPG',
  )
  const roofMap = useLoader(
    THREE.TextureLoader,
    '/textures/diner_candidates/portal_plank.png',
  )
  const plantMap = useLoader(
    THREE.TextureLoader,
    '/textures/diner_candidates/portal_plant_a.png',
  )

  useEffect(() => {
    setupPs1Texture(brickMap, 2, 2)
    setupPs1Texture(roofMap, 3, 2)
    setupPs1SpriteTexture(plantMap)
  }, [brickMap, plantMap, roofMap])

  return (
    <group>
      <mesh
        position={[IMPOSSIBLE_HOUSE_X, 0.02, IMPOSSIBLE_HOUSE_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry
          args={[
            IMPOSSIBLE_HOUSE_HALF_W * 2 + 0.6,
            IMPOSSIBLE_HOUSE_HALF_D * 2 + 0.6,
          ]}
        />
        <meshStandardMaterial color="#6f6452" flatShading roughness={1} />
      </mesh>

      <mesh
        position={[
          IMPOSSIBLE_HOUSE_X - 2.05,
          IMPOSSIBLE_HOUSE_H / 2,
          IMPOSSIBLE_HOUSE_Z - IMPOSSIBLE_HOUSE_HALF_D,
        ]}
      >
        <boxGeometry args={[2.3, IMPOSSIBLE_HOUSE_H, 0.2]} />
        <meshStandardMaterial
          map={brickMap}
          color="#c3b59e"
          flatShading
          roughness={0.95}
        />
      </mesh>
      <mesh
        position={[
          IMPOSSIBLE_HOUSE_X + 2.05,
          IMPOSSIBLE_HOUSE_H / 2,
          IMPOSSIBLE_HOUSE_Z - IMPOSSIBLE_HOUSE_HALF_D,
        ]}
      >
        <boxGeometry args={[2.3, IMPOSSIBLE_HOUSE_H, 0.2]} />
        <meshStandardMaterial
          map={brickMap}
          color="#c3b59e"
          flatShading
          roughness={0.95}
        />
      </mesh>
      <mesh
        position={[
          IMPOSSIBLE_HOUSE_X,
          IMPOSSIBLE_HOUSE_H - 0.55,
          IMPOSSIBLE_HOUSE_Z - IMPOSSIBLE_HOUSE_HALF_D,
        ]}
      >
        <boxGeometry args={[1.8, 1.1, 0.2]} />
        <meshStandardMaterial
          map={brickMap}
          color="#c3b59e"
          flatShading
          roughness={0.95}
        />
      </mesh>

      <mesh
        position={[
          IMPOSSIBLE_HOUSE_X - IMPOSSIBLE_HOUSE_HALF_W,
          IMPOSSIBLE_HOUSE_H / 2,
          IMPOSSIBLE_HOUSE_Z,
        ]}
      >
        <boxGeometry
          args={[0.2, IMPOSSIBLE_HOUSE_H, IMPOSSIBLE_HOUSE_HALF_D * 2]}
        />
        <meshStandardMaterial
          map={brickMap}
          color="#c3b59e"
          flatShading
          roughness={0.95}
        />
      </mesh>
      <mesh
        position={[
          IMPOSSIBLE_HOUSE_X + IMPOSSIBLE_HOUSE_HALF_W,
          IMPOSSIBLE_HOUSE_H / 2,
          IMPOSSIBLE_HOUSE_Z,
        ]}
      >
        <boxGeometry
          args={[0.2, IMPOSSIBLE_HOUSE_H, IMPOSSIBLE_HOUSE_HALF_D * 2]}
        />
        <meshStandardMaterial
          map={brickMap}
          color="#c3b59e"
          flatShading
          roughness={0.95}
        />
      </mesh>
      <mesh
        position={[
          IMPOSSIBLE_HOUSE_X,
          IMPOSSIBLE_HOUSE_H / 2,
          IMPOSSIBLE_HOUSE_Z + IMPOSSIBLE_HOUSE_HALF_D,
        ]}
      >
        <boxGeometry
          args={[IMPOSSIBLE_HOUSE_HALF_W * 2, IMPOSSIBLE_HOUSE_H, 0.2]}
        />
        <meshStandardMaterial
          map={brickMap}
          color="#c3b59e"
          flatShading
          roughness={0.95}
        />
      </mesh>

      <mesh
        position={[
          IMPOSSIBLE_HOUSE_X,
          IMPOSSIBLE_HOUSE_H + 0.75,
          IMPOSSIBLE_HOUSE_Z,
        ]}
        rotation={[0, 0, -0.32]}
      >
        <boxGeometry
          args={[
            IMPOSSIBLE_HOUSE_HALF_W * 2 + 0.8,
            0.18,
            IMPOSSIBLE_HOUSE_HALF_D * 2 + 0.8,
          ]}
        />
        <meshStandardMaterial
          map={roofMap}
          color="#584438"
          flatShading
          roughness={0.95}
        />
      </mesh>
      <mesh
        position={[
          IMPOSSIBLE_HOUSE_X,
          IMPOSSIBLE_HOUSE_H + 0.75,
          IMPOSSIBLE_HOUSE_Z,
        ]}
        rotation={[0, 0, 0.32]}
      >
        <boxGeometry
          args={[
            IMPOSSIBLE_HOUSE_HALF_W * 2 + 0.8,
            0.18,
            IMPOSSIBLE_HOUSE_HALF_D * 2 + 0.8,
          ]}
        />
        <meshStandardMaterial
          map={roofMap}
          color="#584438"
          flatShading
          roughness={0.95}
        />
      </mesh>

      <mesh
        position={[IMPOSSIBLE_HOUSE_X - 3.9, 1.1, IMPOSSIBLE_HOUSE_Z + 1.6]}
      >
        <planeGeometry args={[1.8, 2.2]} />
        <meshStandardMaterial
          map={plantMap}
          transparent
          alphaTest={0.2}
          side={THREE.DoubleSide}
          flatShading
        />
      </mesh>
    </group>
  )
}

function ImpossibleHouseInterior() {
  const wallMap = useLoader(
    THREE.TextureLoader,
    '/textures/diner_candidates/beige_wall_002_diff_2k.jpg',
  )
  const floorMap = useLoader(
    THREE.TextureLoader,
    '/textures/diner_candidates/portal_pine_floor.JPG',
  )
  const plantMapA = useLoader(
    THREE.TextureLoader,
    '/textures/diner_candidates/portal_plant_a.png',
  )
  const plantMapB = useLoader(
    THREE.TextureLoader,
    '/textures/diner_candidates/portal_plant_b.png',
  )

  useEffect(() => {
    setupPs1Texture(wallMap, 8, 4)
    setupPs1Texture(floorMap, 8, 10)
    ;[plantMapA, plantMapB].forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.minFilter = THREE.NearestFilter
      texture.magFilter = THREE.NearestFilter
      texture.generateMipmaps = false
      texture.needsUpdate = true
    })
  }, [floorMap, plantMapA, plantMapB, wallMap])

  return (
    <group>
      <mesh
        position={[IMPOSSIBLE_HOUSE_REMOTE_X, 0.03, IMPOSSIBLE_HOUSE_REMOTE_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry
          args={[
            IMPOSSIBLE_HOUSE_REMOTE_HALF_W * 2,
            IMPOSSIBLE_HOUSE_REMOTE_HALF_D * 2,
          ]}
        />
        <meshStandardMaterial
          map={floorMap}
          color="#baa588"
          flatShading
          roughness={0.95}
        />
      </mesh>
      <mesh
        position={[IMPOSSIBLE_HOUSE_REMOTE_X, 5.2, IMPOSSIBLE_HOUSE_REMOTE_Z]}
      >
        <boxGeometry
          args={[
            IMPOSSIBLE_HOUSE_REMOTE_HALF_W * 2,
            0.2,
            IMPOSSIBLE_HOUSE_REMOTE_HALF_D * 2,
          ]}
        />
        <meshStandardMaterial color="#ddd7ca" flatShading roughness={0.9} />
      </mesh>

      <mesh
        position={[
          IMPOSSIBLE_HOUSE_REMOTE_X - IMPOSSIBLE_HOUSE_REMOTE_HALF_W,
          2.6,
          IMPOSSIBLE_HOUSE_REMOTE_Z,
        ]}
      >
        <boxGeometry args={[0.2, 5.2, IMPOSSIBLE_HOUSE_REMOTE_HALF_D * 2]} />
        <meshStandardMaterial
          map={wallMap}
          color="#eadfcd"
          flatShading
          roughness={0.92}
        />
      </mesh>
      <mesh
        position={[
          IMPOSSIBLE_HOUSE_REMOTE_X + IMPOSSIBLE_HOUSE_REMOTE_HALF_W,
          2.6,
          IMPOSSIBLE_HOUSE_REMOTE_Z,
        ]}
      >
        <boxGeometry args={[0.2, 5.2, IMPOSSIBLE_HOUSE_REMOTE_HALF_D * 2]} />
        <meshStandardMaterial
          map={wallMap}
          color="#eadfcd"
          flatShading
          roughness={0.92}
        />
      </mesh>
      <mesh
        position={[
          IMPOSSIBLE_HOUSE_REMOTE_X,
          2.6,
          IMPOSSIBLE_HOUSE_REMOTE_Z + IMPOSSIBLE_HOUSE_REMOTE_HALF_D,
        ]}
      >
        <boxGeometry args={[IMPOSSIBLE_HOUSE_REMOTE_HALF_W * 2, 5.2, 0.2]} />
        <meshStandardMaterial
          map={wallMap}
          color="#eadfcd"
          flatShading
          roughness={0.92}
        />
      </mesh>
      <mesh
        position={[
          IMPOSSIBLE_HOUSE_REMOTE_X - 8.4,
          2.6,
          IMPOSSIBLE_HOUSE_REMOTE_Z - IMPOSSIBLE_HOUSE_REMOTE_HALF_D,
        ]}
      >
        <boxGeometry args={[7.2, 5.2, 0.2]} />
        <meshStandardMaterial
          map={wallMap}
          color="#eadfcd"
          flatShading
          roughness={0.92}
        />
      </mesh>
      <mesh
        position={[
          IMPOSSIBLE_HOUSE_REMOTE_X + 8.4,
          2.6,
          IMPOSSIBLE_HOUSE_REMOTE_Z - IMPOSSIBLE_HOUSE_REMOTE_HALF_D,
        ]}
      >
        <boxGeometry args={[7.2, 5.2, 0.2]} />
        <meshStandardMaterial
          map={wallMap}
          color="#eadfcd"
          flatShading
          roughness={0.92}
        />
      </mesh>
      <mesh
        position={[
          IMPOSSIBLE_HOUSE_REMOTE_X,
          4.1,
          IMPOSSIBLE_HOUSE_REMOTE_Z - IMPOSSIBLE_HOUSE_REMOTE_HALF_D,
        ]}
      >
        <boxGeometry args={[9.6, 2.2, 0.2]} />
        <meshStandardMaterial
          map={wallMap}
          color="#eadfcd"
          flatShading
          roughness={0.92}
        />
      </mesh>

      <mesh
        position={[
          IMPOSSIBLE_HOUSE_REMOTE_X,
          0.08,
          IMPOSSIBLE_HOUSE_REMOTE_Z + 3,
        ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[14, 12]} />
        <meshStandardMaterial color="#7f3c42" flatShading roughness={1} />
      </mesh>

      {[-7.5, -2.5, 2.5, 7.5].map((x) => (
        <mesh
          key={x}
          position={[
            IMPOSSIBLE_HOUSE_REMOTE_X + x,
            4.25,
            IMPOSSIBLE_HOUSE_REMOTE_Z + 1,
          ]}
        >
          <boxGeometry args={[1.8, 0.08, 0.35]} />
          <meshStandardMaterial
            color="#efe2ad"
            emissive="#efe2ad"
            emissiveIntensity={1.2}
            flatShading
          />
        </mesh>
      ))}

      {[-8, 0, 8].map((x) => (
        <group
          key={x}
          position={[
            IMPOSSIBLE_HOUSE_REMOTE_X + x,
            0,
            IMPOSSIBLE_HOUSE_REMOTE_Z + 2,
          ]}
        >
          <mesh position={[0, 2.6, 0]}>
            <boxGeometry args={[0.55, 5.2, 0.55]} />
            <meshStandardMaterial color="#c8baa5" flatShading roughness={0.9} />
          </mesh>
        </group>
      ))}

      {[-6, 0, 6].map((x) => (
        <Booth
          key={x}
          position={[
            IMPOSSIBLE_HOUSE_REMOTE_X + x,
            0,
            IMPOSSIBLE_HOUSE_REMOTE_Z - 6,
          ]}
        />
      ))}
      {[-6, 0, 6].map((x) => (
        <Booth
          key={`lower-${x}`}
          position={[
            IMPOSSIBLE_HOUSE_REMOTE_X + x,
            0,
            IMPOSSIBLE_HOUSE_REMOTE_Z + 8,
          ]}
        />
      ))}

      <mesh
        position={[
          IMPOSSIBLE_HOUSE_REMOTE_X - 9,
          0.55,
          IMPOSSIBLE_HOUSE_REMOTE_Z + 2,
        ]}
      >
        <boxGeometry args={[4.5, 1.1, 6]} />
        <meshStandardMaterial color="#6d5a49" flatShading roughness={0.85} />
      </mesh>
      <mesh
        position={[
          IMPOSSIBLE_HOUSE_REMOTE_X - 9,
          1.15,
          IMPOSSIBLE_HOUSE_REMOTE_Z + 2,
        ]}
      >
        <boxGeometry args={[4.7, 0.12, 6.2]} />
        <meshStandardMaterial color={FORMICA} flatShading roughness={0.45} />
      </mesh>

      {[
        [
          IMPOSSIBLE_HOUSE_REMOTE_X - 10.2,
          IMPOSSIBLE_HOUSE_REMOTE_Z - 11,
          plantMapA,
        ],
        [
          IMPOSSIBLE_HOUSE_REMOTE_X + 10.4,
          IMPOSSIBLE_HOUSE_REMOTE_Z - 11,
          plantMapB,
        ],
        [
          IMPOSSIBLE_HOUSE_REMOTE_X - 10.4,
          IMPOSSIBLE_HOUSE_REMOTE_Z + 12,
          plantMapB,
        ],
      ].map(([x, z, texture], i) => (
        <mesh key={i} position={[x as number, 1.2, z as number]}>
          <planeGeometry args={[2.2, 2.6]} />
          <meshStandardMaterial
            map={texture as THREE.Texture}
            transparent
            alphaTest={0.2}
            side={THREE.DoubleSide}
            flatShading
          />
        </mesh>
      ))}

      <pointLight
        position={[IMPOSSIBLE_HOUSE_REMOTE_X, 4.2, IMPOSSIBLE_HOUSE_REMOTE_Z]}
        intensity={3.8}
        color="#f3e1b8"
        distance={28}
      />
    </group>
  )
}

/* ── Diner structure ────────────────────────────────── */
function DinerShell({
  offset,
  tealColor,
  creamColor,
}: {
  offset?: [number, number, number]
  tealColor?: string
  creamColor?: string
}) {
  const tc = tealColor ?? TEAL
  const cc = creamColor ?? CREAM
  const S = W * 2
  return (
    <group position={offset}>
      {/* Back wall — with kitchen opening */}
      <mesh position={[-4.5, 2.5, -W]}>
        <boxGeometry args={[7, 5, 0.2]} />
        <meshStandardMaterial color={tc} flatShading roughness={0.85} />
      </mesh>
      <mesh position={[3.5, 2.5, -W]}>
        <boxGeometry args={[9, 5, 0.2]} />
        <meshStandardMaterial color={tc} flatShading roughness={0.85} />
      </mesh>
      <mesh position={[-1, 4.25, -W]}>
        <boxGeometry args={[2.6, 1.5, 0.2]} />
        <meshStandardMaterial color={tc} flatShading roughness={0.85} />
      </mesh>
      {/* Left wall — split around hidden-room door opening (z=-1 to z=1) */}
      <mesh position={[-W, 2.5, -4.5]}>
        <boxGeometry args={[0.2, 5, 7]} />
        <meshStandardMaterial color={tc} flatShading roughness={0.85} />
      </mesh>
      <mesh position={[-W, 2.5, 4.5]}>
        <boxGeometry args={[0.2, 5, 7]} />
        <meshStandardMaterial color={tc} flatShading roughness={0.85} />
      </mesh>
      <mesh position={[-W, 4.25, 0]}>
        <boxGeometry args={[0.2, 1.5, 2]} />
        <meshStandardMaterial color={tc} flatShading roughness={0.85} />
      </mesh>
      {/* Hidden-room door frame */}
      <mesh position={[-W, 1.75, -1]}>
        <boxGeometry args={[0.25, 3.5, 0.08]} />
        <meshStandardMaterial color="#444" flatShading />
      </mesh>
      <mesh position={[-W, 1.75, 1]}>
        <boxGeometry args={[0.25, 3.5, 0.08]} />
        <meshStandardMaterial color="#444" flatShading />
      </mesh>
      <mesh position={[-W, 3.55, 0]}>
        <boxGeometry args={[0.25, 0.08, 2.1]} />
        <meshStandardMaterial color="#444" flatShading />
      </mesh>
      {/* Right wall lower (below windows) */}
      <mesh position={[W, 0.5, 0]}>
        <boxGeometry args={[0.2, 1, S]} />
        <meshStandardMaterial color={tc} flatShading roughness={0.85} />
      </mesh>
      {/* Right wall upper (above windows) */}
      <mesh position={[W, 3.75, 0]}>
        <boxGeometry args={[0.2, 2.5, S]} />
        <meshStandardMaterial color={tc} flatShading roughness={0.85} />
      </mesh>
      {/* Front wall left of door — opening from x=1 to x=3 */}
      <mesh position={[-3.5, 2.5, W]}>
        <boxGeometry args={[9, 5, 0.2]} />
        <meshStandardMaterial color={tc} flatShading roughness={0.85} />
      </mesh>
      {/* Front wall right of door */}
      <mesh position={[5.5, 2.5, W]}>
        <boxGeometry args={[5, 5, 0.2]} />
        <meshStandardMaterial color={tc} flatShading roughness={0.85} />
      </mesh>
      {/* Above door */}
      <mesh position={[2, 4.25, W]}>
        <boxGeometry args={[2, 1.5, 0.2]} />
        <meshStandardMaterial color={tc} flatShading roughness={0.85} />
      </mesh>
      {/* Door frame posts */}
      <mesh position={[1, 1.75, W]}>
        <boxGeometry args={[0.08, 3.5, 0.25]} />
        <meshStandardMaterial color="#444" flatShading />
      </mesh>
      <mesh position={[3, 1.75, W]}>
        <boxGeometry args={[0.08, 3.5, 0.25]} />
        <meshStandardMaterial color="#444" flatShading />
      </mesh>
      <mesh position={[2, 3.55, W]}>
        <boxGeometry args={[2.1, 0.08, 0.25]} />
        <meshStandardMaterial color="#444" flatShading />
      </mesh>
      {/* Ceiling — with larger hole above staircase so the upstairs reads from below */}
      <mesh position={[1.6, 5, 0]}>
        <boxGeometry args={[12.8, 0.2, S]} />
        <meshStandardMaterial color={cc} flatShading roughness={0.9} />
      </mesh>
      <mesh position={[-6.4, 5, 4.8]}>
        <boxGeometry args={[3.2, 0.2, 6.4]} />
        <meshStandardMaterial color={cc} flatShading roughness={0.9} />
      </mesh>
      <mesh position={[-6.4, 5, -7.75]}>
        <boxGeometry args={[3.2, 0.2, 0.5]} />
        <meshStandardMaterial color={cc} flatShading roughness={0.9} />
      </mesh>
    </group>
  )
}

/* ── Windows ────────────────────────────────────────── */
function Windows({ offset }: { offset?: [number, number, number] }) {
  const positions = [-6, -4, -2, 0, 2, 4, 6]
  return (
    <group position={offset}>
      {positions.map((z, i) => (
        <group key={i} position={[W - 0.15, 1.75, z]}>
          <mesh>
            <boxGeometry args={[0.05, 1.5, 1.5]} />
            <meshStandardMaterial
              color="#aaddee"
              emissive="#446688"
              emissiveIntensity={0.4}
              flatShading
              roughness={0.2}
              transparent
              opacity={0.7}
            />
          </mesh>
          <mesh position={[0.05, 0.8, 0]}>
            <boxGeometry args={[0.1, 0.1, 1.6]} />
            <meshStandardMaterial color="#333" flatShading />
          </mesh>
          <mesh position={[0.05, -0.8, 0]}>
            <boxGeometry args={[0.1, 0.1, 1.6]} />
            <meshStandardMaterial color="#333" flatShading />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ── Neon sign ──────────────────────────────────────── */
function NeonSign({ offset }: { offset?: [number, number, number] }) {
  const neonRef = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!neonRef.current) return
    const flicker = Math.sin(state.clock.elapsedTime * 12) > -0.8 ? 1 : 0.3
    neonRef.current.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material
        if (mat instanceof THREE.MeshStandardMaterial)
          mat.emissiveIntensity = 2 * flicker
      }
    })
  })
  return (
    <group position={offset}>
      <group ref={neonRef} position={[W - 0.3, 3.8, 0]}>
        {[-0.45, -0.15].map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <boxGeometry args={[0.04, 0.25, 0.2]} />
            <meshStandardMaterial
              color={NEON_PINK}
              emissive={NEON_PINK}
              emissiveIntensity={2}
              flatShading
            />
          </mesh>
        ))}
        {[0.15, 0.45].map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <boxGeometry args={[0.04, 0.25, 0.2]} />
            <meshStandardMaterial
              color={NEON_GREEN}
              emissive={NEON_GREEN}
              emissiveIntensity={2}
              flatShading
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* ── Door ────────────────────────────────────────────── */
/* ── Counter with overhang ──────────────────────────── */
function Counter({ offset }: { offset?: [number, number, number] }) {
  return (
    <group position={offset}>
      <mesh position={[-1, 0.5, -3.5]}>
        <boxGeometry args={[10, 1, 1.2]} />
        <meshStandardMaterial color="#888070" flatShading roughness={0.7} />
      </mesh>
      <mesh position={[-1, 1.05, -3.5]}>
        <boxGeometry args={[10.3, 0.12, 1.5]} />
        <meshStandardMaterial color={FORMICA} flatShading roughness={0.4} />
      </mesh>
      <mesh position={[-1, 1.05, -2.75]}>
        <boxGeometry args={[10.35, 0.06, 0.06]} />
        <meshStandardMaterial
          color={CHROME}
          metalness={0.9}
          roughness={0.1}
          flatShading
        />
      </mesh>
      <mesh position={[3.5, 0.5, -1]}>
        <boxGeometry args={[1.2, 1, 5.2]} />
        <meshStandardMaterial color="#888070" flatShading roughness={0.7} />
      </mesh>
      <mesh position={[3.5, 1.05, -1]}>
        <boxGeometry args={[1.5, 0.12, 5.5]} />
        <meshStandardMaterial color={FORMICA} flatShading roughness={0.4} />
      </mesh>
      <mesh position={[2.75, 1.05, -1]}>
        <boxGeometry args={[0.06, 0.06, 5.55]} />
        <meshStandardMaterial
          color={CHROME}
          metalness={0.9}
          roughness={0.1}
          flatShading
        />
      </mesh>
      <mesh position={[-1, 0.2, -2.85]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 10, 6]} />
        <meshStandardMaterial
          color={CHROME}
          metalness={0.9}
          roughness={0.1}
          flatShading
        />
      </mesh>
    </group>
  )
}

/* ── Bar stool ──────────────────────────────────────── */
function BarStool({ position }: { position: [number, number, number] }) {
  const seatRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (seatRef.current)
      seatRef.current.rotation.y =
        state.clock.elapsedTime * 0.15 + position[0] * 2
  })
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.9, 6]} />
        <meshStandardMaterial
          color={CHROME}
          metalness={0.9}
          roughness={0.1}
          flatShading
        />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.25, 0.28, 0.04, 8]} />
        <meshStandardMaterial
          color={CHROME}
          metalness={0.9}
          roughness={0.1}
          flatShading
        />
      </mesh>
      <mesh ref={seatRef} position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.25, 0.22, 0.12, 8]} />
        <meshStandardMaterial color={RED_VINYL} flatShading roughness={0.6} />
      </mesh>
    </group>
  )
}

/* ── Booth ──────────────────────────────────────────── */
function Booth({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, -0.7]}>
        <boxGeometry args={[2.4, 1, 0.5]} />
        <meshStandardMaterial color={RED_VINYL} flatShading roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.2, -0.9]}>
        <boxGeometry args={[2.4, 0.9, 0.15]} />
        <meshStandardMaterial color={RED_VINYL} flatShading roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.5, 0.7]}>
        <boxGeometry args={[2.4, 1, 0.5]} />
        <meshStandardMaterial color={RED_VINYL} flatShading roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.2, 0.9]}>
        <boxGeometry args={[2.4, 0.9, 0.15]} />
        <meshStandardMaterial color={RED_VINYL} flatShading roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[2, 0.08, 0.8]} />
        <meshStandardMaterial color={FORMICA} flatShading roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.1, 0.9, 0.1]} />
        <meshStandardMaterial
          color={CHROME}
          metalness={0.8}
          roughness={0.2}
          flatShading
        />
      </mesh>
    </group>
  )
}

/* ── Ceiling light ──────────────────────────────────── */
function CeilingLight({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.15, 0.25, 0.1, 6]} />
        <meshStandardMaterial color="#ddd" flatShading />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.3, 0.15, 0.2, 6]} />
        <meshStandardMaterial
          color={CREAM}
          emissive="#ffeecc"
          emissiveIntensity={0.5}
          flatShading
        />
      </mesh>
    </group>
  )
}

/* ── Jukebox ────────────────────────────────────────── */
function Jukebox({ offset }: { offset?: [number, number, number] }) {
  return (
    <group position={offset}>
      <group position={[-6, 0, -W + 0.5]}>
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[0.8, 2, 0.5]} />
          <meshStandardMaterial color="#553322" flatShading roughness={0.8} />
        </mesh>
        <mesh position={[0, 2.15, 0]}>
          <boxGeometry args={[0.7, 0.4, 0.45]} />
          <meshStandardMaterial color="#664433" flatShading roughness={0.8} />
        </mesh>
        <mesh position={[0, 1, 0.26]}>
          <boxGeometry args={[0.85, 2.05, 0.02]} />
          <meshStandardMaterial
            color={CHROME}
            metalness={0.8}
            roughness={0.2}
            flatShading
          />
        </mesh>
        <mesh position={[0, 1.5, 0.28]}>
          <boxGeometry args={[0.5, 0.6, 0.02]} />
          <meshStandardMaterial
            color="#ffaa33"
            emissive="#ff8800"
            emissiveIntensity={1.5}
            flatShading
          />
        </mesh>
        <mesh position={[0, 0.5, 0.28]}>
          <boxGeometry args={[0.5, 0.4, 0.02]} />
          <meshStandardMaterial
            color="#ff6699"
            emissive="#ff3366"
            emissiveIntensity={1}
            flatShading
          />
        </mesh>
      </group>
    </group>
  )
}

/* ═══════════════════════════════════════════════════════
   INFINITE STAIRCASE
   ═══════════════════════════════════════════════════════ */

function InfiniteStaircase() {
  const flickerRef = useRef<THREE.PointLight>(null)
  useFrame((state) => {
    if (flickerRef.current) {
      const t = state.clock.elapsedTime
      flickerRef.current.intensity =
        1.5 + Math.sin(t * 7) * Math.sin(t * 13) * 1.5
    }
  })

  const numSteps = 40
  const stepH = 0.2
  const stepD = 0.5
  const slopeAngle = Math.atan2(8, 20)
  const slopeLen = Math.sqrt(20 * 20 + 8 * 8)

  return (
    <group>
      {/* === Flat entry corridor (z=-8.2 to z=-10) === */}
      <mesh position={[-1, -0.05, -9]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 2]} />
        <meshStandardMaterial color="#444" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[-1, 3.95, -9]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 2]} />
        <meshStandardMaterial color="#2a2a2a" flatShading roughness={0.9} />
      </mesh>

      {/* === Steps === */}
      {Array.from({ length: numSteps }, (_, i) => {
        const z = -10 - i * stepD - stepD / 2
        const y = -i * stepH - stepH / 2
        return (
          <mesh key={i} position={[-1, y, z]}>
            <boxGeometry args={[2.8, stepH, stepD]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? '#555' : '#4a4a4a'}
              flatShading
              roughness={0.9}
            />
          </mesh>
        )
      })}

      {/* === Bottom landing (z=-30 to z=-31.5) === */}
      <mesh position={[-1, -8.05, -30.75]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 1.5]} />
        <meshStandardMaterial color="#444" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[-1, -4.05, -30.75]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 1.5]} />
        <meshStandardMaterial color="#2a2a2a" flatShading roughness={0.9} />
      </mesh>

      {/* === Walls === */}
      <mesh position={[-2.5, -2, -19.75]}>
        <boxGeometry args={[0.2, 12, 23.5]} />
        <meshStandardMaterial color="#3a3a3a" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0.5, -2, -19.75]}>
        <boxGeometry args={[0.2, 12, 23.5]} />
        <meshStandardMaterial color="#3a3a3a" flatShading roughness={0.9} />
      </mesh>
      {/* Back wall */}
      <mesh position={[-1, -4, -31.5]}>
        <boxGeometry args={[3.2, 10, 0.2]} />
        <meshStandardMaterial color="#333" flatShading roughness={0.9} />
      </mesh>

      {/* === Sloped ceiling === */}
      <mesh position={[-1, 0, -20]} rotation={[slopeAngle, 0, 0]}>
        <boxGeometry args={[3, 0.1, slopeLen]} />
        <meshStandardMaterial color="#2a2a2a" flatShading roughness={0.9} />
      </mesh>

      {/* === Handrail (left side) === */}
      <mesh position={[-2.2, -3, -20]} rotation={[slopeAngle, 0, 0]}>
        <boxGeometry args={[0.06, 0.06, slopeLen]} />
        <meshStandardMaterial
          color="#666"
          metalness={0.7}
          roughness={0.3}
          flatShading
        />
      </mesh>
      {/* Handrail supports */}
      {[0, 1, 2, 3, 4].map((i) => {
        const z = -12 - i * 4
        const y = getGroundHeight(-2.2, z)
        return (
          <mesh key={i} position={[-2.2, y + 0.5, z]}>
            <boxGeometry args={[0.04, 1, 0.04]} />
            <meshStandardMaterial color="#555" flatShading />
          </mesh>
        )
      })}

      {/* === Lighting (2 lights only) === */}
      <pointLight
        ref={flickerRef}
        position={[-1, 3.5, -9]}
        intensity={3}
        color="#ffeeaa"
        distance={12}
      />
      <pointLight
        position={[-1, -4, -22]}
        intensity={2}
        color="#aabb99"
        distance={15}
      />

      {/* Fluorescent tube fixtures */}
      {[-14, -20, -26].map((z) => {
        const y = getGroundHeight(-1, z) + 3.9
        return (
          <mesh key={z} position={[-1, y, z]}>
            <boxGeometry args={[1.2, 0.04, 0.08]} />
            <meshStandardMaterial
              color="#ddd"
              emissive="#aaffaa"
              emissiveIntensity={1}
              flatShading
            />
          </mesh>
        )
      })}

      {/* Pipes along ceiling */}
      {[-12, -16, -20, -24, -28].map((z) => {
        const y = getGroundHeight(-1, z) + 3.7
        return (
          <mesh key={z} position={[-2.2, y, z]}>
            <cylinderGeometry args={[0.04, 0.04, 2.6, 4]} />
            <meshStandardMaterial color="#555" flatShading metalness={0.5} />
          </mesh>
        )
      })}

      {/* Scratch marks on walls */}
      <mesh position={[-2.35, -2.5, -18]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.3, 0.01]} />
        <meshStandardMaterial
          color="#884444"
          flatShading
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[-2.35, -2.5, -18.15]} rotation={[0, Math.PI / 2, 0.5]}>
        <planeGeometry args={[0.25, 0.01]} />
        <meshStandardMaterial
          color="#884444"
          flatShading
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Step number markings (barely visible) */}
      {[10, 20, 30].map((n) => {
        const z = -10 - (n - 1) * stepD
        const y = -(n - 1) * stepH + 0.5
        return (
          <mesh key={n} position={[0.35, y, z]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[0.15, 0.15]} />
            <meshStandardMaterial
              color="#555"
              flatShading
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
    </group>
  )
}

/* ── First-person controller with collisions ────────── */
function FirstPersonControls({
  onZoneText,
}: {
  onZoneText: (t: string) => void
}) {
  const { camera, gl } = useThree()
  const keys = useRef(new Set<string>())
  const walkSpeed = 4
  const sprintSpeed = 8
  const lastTrigger = useRef(-1)
  const velocityY = useRef(0)
  const eyeHeight = 1.6
  const gravity = -15
  const jumpForce = 6
  const grounded = useRef(true)

  useEffect(() => {
    // URL params for debug spawn: /inspection?x=15&z=-2&y=1.6&ry=1.57
    const params = new URLSearchParams(window.location.search)
    const sx = params.get('x')
    const sy = params.get('y')
    const sz = params.get('z')
    const sry = params.get('ry')
    camera.position.set(
      sx ? parseFloat(sx) : 2,
      sy ? parseFloat(sy) : eyeHeight,
      sz ? parseFloat(sz) : 13,
    )
    if (sry) {
      camera.rotation.set(0, parseFloat(sry), 0)
    } else {
      camera.rotation.set(0, 0, 0)
    }
  }, [camera])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      keys.current.add(e.key.toLowerCase())
      if (e.key === ' ') e.preventDefault()
      // P = screenshot + log position
      if (e.key.toLowerCase() === 'p') {
        // Screenshot
        gl.render(
          gl.info.autoReset
            ? (camera.parent!.parent! as unknown as THREE.Scene)
            : new THREE.Scene(),
          camera,
        )
        const dataUrl = gl.domElement.toDataURL('image/png')
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `inspection_${Date.now()}.png`
        link.click()
      }
    }
    const onUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [camera, gl])

  useFrame((_, delta) => {
    const sprinting = keys.current.has('shift')
    const speed = sprinting ? sprintSpeed : walkSpeed

    const dir = new THREE.Vector3()
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    const right = new THREE.Vector3()
      .crossVectors(forward, camera.up)
      .normalize()

    if (keys.current.has('w') || keys.current.has('arrowup')) dir.add(forward)
    if (keys.current.has('s') || keys.current.has('arrowdown')) dir.sub(forward)
    if (keys.current.has('d') || keys.current.has('arrowright')) dir.add(right)
    if (keys.current.has('a') || keys.current.has('arrowleft')) dir.sub(right)

    if (dir.lengthSq() > 0) {
      dir.normalize().multiplyScalar(speed * delta)
      const cur = camera.position
      const nx = cur.x + dir.x
      const nz = cur.z + dir.z
      // eslint-disable-next-line react-hooks/immutability -- R3F camera movement is imperative per frame.
      if (!collides(nx, cur.z)) cur.x = nx
      if (!collides(cur.x, nz)) cur.z = nz
    }

    // jumping
    if (
      (keys.current.has(' ') || keys.current.has('space')) &&
      grounded.current
    ) {
      velocityY.current = jumpForce
      grounded.current = false
    }
    velocityY.current += gravity * delta
    camera.position.y += velocityY.current * delta
    const crouching = keys.current.has('control')
    const currentEye = crouching ? eyeHeight * 0.55 : eyeHeight
    const groundY =
      getGroundHeight(camera.position.x, camera.position.z, camera.position.y) +
      currentEye
    if (camera.position.y <= groundY) {
      camera.position.y = groundY
      velocityY.current = 0
      grounded.current = true
    }
    // smooth crouch when standing on ground
    if (grounded.current) {
      camera.position.y = groundY
    }

    // check triggers
    const px = camera.position.x
    const pz = camera.position.z
    for (let i = 0; i < TRIGGERS.length; i++) {
      const t = TRIGGERS[i]
      if (
        px > t.zone.minX &&
        px < t.zone.maxX &&
        pz > t.zone.minZ &&
        pz < t.zone.maxZ
      ) {
        if (lastTrigger.current !== i) {
          lastTrigger.current = i
          camera.position.copy(t.target)
          velocityY.current = 0
          grounded.current = true
          if (t.rotY !== undefined) {
            // rotate camera direction
            const euler = new THREE.Euler(0, t.rotY, 0, 'YXZ')
            camera.quaternion.setFromEuler(euler)
          }
        }
        break
      }
    }
    // reset trigger lock when not in any zone
    let inAny = false
    for (const t of TRIGGERS) {
      if (
        px > t.zone.minX &&
        px < t.zone.maxX &&
        pz > t.zone.minZ &&
        pz < t.zone.maxZ
      ) {
        inAny = true
        break
      }
    }
    if (!inAny) lastTrigger.current = -1

    // zone-based hint text
    if (px > -31 && px < -9 && pz > 11 && pz < 29)
      onZoneText('Asset showroom: food, characters, and urban kit pieces.')
    else if (
      px > IMPOSSIBLE_HOUSE_REMOTE_X - IMPOSSIBLE_HOUSE_REMOTE_HALF_W + 1 &&
      px < IMPOSSIBLE_HOUSE_REMOTE_X + IMPOSSIBLE_HOUSE_REMOTE_HALF_W - 1 &&
      pz > IMPOSSIBLE_HOUSE_REMOTE_Z - IMPOSSIBLE_HOUSE_REMOTE_HALF_D + 1 &&
      pz < IMPOSSIBLE_HOUSE_REMOTE_Z + IMPOSSIBLE_HOUSE_REMOTE_HALF_D - 1
    )
      onZoneText('The foyer is far too large for the house outside.')
    else if (pz < -8 && pz > -31.5 && px > -3)
      onZoneText('The stairs keep going down.')
    else if (
      px > HIDDEN_ROOM_CENTER_X - HIDDEN_ROOM_HALF_W + 1 &&
      px < HIDDEN_ROOM_CENTER_X + HIDDEN_ROOM_HALF_W - 1 &&
      pz > HIDDEN_ROOM_CENTER_Z - HIDDEN_ROOM_HALF_D + 1 &&
      pz < HIDDEN_ROOM_CENTER_Z + HIDDEN_ROOM_HALF_D - 1
    )
      onZoneText('This room should not fit behind that door.')
    else onZoneText('')
  })

  return <PointerLockControls />
}

/* ── GLB model helpers ─────────────────────────────── */
function FoodProp({
  url,
  position,
  scale = 1,
  rotation,
  ps1,
  simplify = false,
}: {
  url: string
  position: [number, number, number]
  scale?: number
  rotation?: [number, number, number]
  ps1?: boolean
  simplify?: boolean
}) {
  const { scene } = useGLTF(url)
  const cloned = scene.clone()
  applyPs1MaterialStyle(cloned, {
    affineUv: ps1 === true,
    simplify,
    simplifyRatio: ps1 === true ? 0.7 : 0.55,
  })
  return (
    <primitive
      object={cloned}
      position={position}
      scale={scale}
      rotation={rotation}
    />
  )
}

function OutsideCharacter({
  url,
  position,
  scale = 1,
  rotation,
  simplify = false,
}: {
  url: string
  position: [number, number, number]
  scale?: number
  rotation?: [number, number, number]
  simplify?: boolean
}) {
  const { scene } = useGLTF(url)
  const cloned = scene.clone()
  applyPs1MaterialStyle(cloned, {
    affineUv: false,
    simplify,
    simplifyRatio: 0.65,
  })
  return (
    <primitive
      object={cloned}
      position={position}
      scale={scale}
      rotation={rotation}
    />
  )
}

function DisplayPedestal({
  position,
  size = [1.2, 0.85, 1.2],
  color = '#5f6168',
}: {
  position: [number, number, number]
  size?: [number, number, number]
  color?: string
}) {
  return (
    <group position={position}>
      <mesh position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0, size[1] + 0.05, 0]}>
        <boxGeometry args={[size[0] + 0.08, 0.1, size[2] + 0.08]} />
        <meshStandardMaterial color="#b8aa8f" flatShading roughness={0.7} />
      </mesh>
    </group>
  )
}

function AssetShowroom() {
  return (
    <group position={[-20, 0, 20]}>
      <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[24, 18]} />
        <meshStandardMaterial color="#50535a" flatShading roughness={0.95} />
      </mesh>

      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[22, 16]} />
        <meshStandardMaterial color="#6d727c" flatShading roughness={1} />
      </mesh>

      <mesh position={[0, 0.02, -2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[22, 0.35]} />
        <meshStandardMaterial color="#d7c06b" flatShading roughness={1} />
      </mesh>

      <mesh position={[-3.75, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.35, 16]} />
        <meshStandardMaterial color="#d7c06b" flatShading roughness={1} />
      </mesh>

      <mesh position={[4.1, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.3, 16]} />
        <meshStandardMaterial color="#a97d4b" flatShading roughness={1} />
      </mesh>

      {[-10.5, -7, -3.5, 0, 3.5, 7, 10.5].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.22, -8]}>
            <boxGeometry args={[0.16, 0.44, 0.16]} />
            <meshStandardMaterial color="#ddd6c8" flatShading roughness={0.9} />
          </mesh>
          <mesh position={[x, 0.22, 8]}>
            <boxGeometry args={[0.16, 0.44, 0.16]} />
            <meshStandardMaterial color="#ddd6c8" flatShading roughness={0.9} />
          </mesh>
        </group>
      ))}

      {[-6, 0, 6].map((z) => (
        <group key={z}>
          <mesh position={[-11, 0.22, z]}>
            <boxGeometry args={[0.16, 0.44, 0.16]} />
            <meshStandardMaterial color="#ddd6c8" flatShading roughness={0.9} />
          </mesh>
          <mesh position={[11, 0.22, z]}>
            <boxGeometry args={[0.16, 0.44, 0.16]} />
            <meshStandardMaterial color="#ddd6c8" flatShading roughness={0.9} />
          </mesh>
        </group>
      ))}

      <mesh position={[-8, 0.4, -6.8]}>
        <boxGeometry args={[5.5, 0.8, 0.3]} />
        <meshStandardMaterial color="#26303d" flatShading />
      </mesh>
      <mesh position={[0.2, 0.4, -6.8]}>
        <boxGeometry args={[6.8, 0.8, 0.3]} />
        <meshStandardMaterial color="#26303d" flatShading />
      </mesh>
      <mesh position={[8, 0.4, -6.8]}>
        <boxGeometry args={[5.2, 0.8, 0.3]} />
        <meshStandardMaterial color="#26303d" flatShading />
      </mesh>

      <DisplayPedestal position={[-9, 0, -3.5]} />
      <FoodProp
        url="/models/showroom/food/burger.glb"
        position={[-9, 1, -3.5]}
        scale={0.9}
      />

      <DisplayPedestal position={[-6, 0, -3.5]} />
      <FoodProp
        url="/models/showroom/food/fries.glb"
        position={[-6, 1, -3.5]}
        scale={0.9}
      />

      <DisplayPedestal position={[-3, 0, -3.5]} />
      <FoodProp
        url="/models/showroom/food/donut.glb"
        position={[-3, 1, -3.5]}
        scale={1}
      />

      <DisplayPedestal position={[0, 0, -3.5]} />
      <FoodProp
        url="/models/showroom/food/soda-can.glb"
        position={[0, 1, -3.5]}
        scale={0.95}
        ps1
      />

      <DisplayPedestal position={[3, 0, -3.5]} />
      <FoodProp
        url="/models/showroom/food/cup-coffee.glb"
        position={[3, 1, -3.5]}
        scale={1}
      />

      <DisplayPedestal position={[6, 0, -3.5]} />
      <FoodProp
        url="/models/showroom/food/hot-dog.glb"
        position={[6, 1, -3.5]}
        scale={1}
      />

      <DisplayPedestal position={[9, 0, -3.5]} />
      <FoodProp
        url="/models/showroom/food/sandwich.glb"
        position={[9, 1, -3.5]}
        scale={1}
      />

      <DisplayPedestal position={[-9, 0, 1.5]} />
      <FoodProp
        url="/models/showroom/food/frappe.glb"
        position={[-9, 1, 1.5]}
        scale={0.95}
        ps1
      />

      <DisplayPedestal position={[-6, 0, 1.5]} />
      <FoodProp
        url="/models/showroom/food/bottle-ketchup.glb"
        position={[-6, 1, 1.5]}
        scale={0.95}
      />

      <DisplayPedestal position={[-3, 0, 1.5]} />
      <FoodProp
        url="/models/showroom/food/plate-dinner.glb"
        position={[-3, 1, 1.5]}
        scale={0.95}
      />

      <DisplayPedestal
        position={[0.5, 0, 2.5]}
        size={[1.4, 0.75, 1.4]}
        color="#4f5560"
      />
      <OutsideCharacter
        url="/models/showroom/characters/character-a.glb"
        position={[0.5, 0.8, 2.5]}
        scale={1.1}
        rotation={[0, -0.3, 0]}
      />

      <DisplayPedestal
        position={[3.8, 0, 2.5]}
        size={[1.4, 0.75, 1.4]}
        color="#4f5560"
      />
      <OutsideCharacter
        url="/models/showroom/characters/character-c.glb"
        position={[3.8, 0.8, 2.5]}
        scale={1.1}
        rotation={[0, 0.35, 0]}
      />

      <DisplayPedestal
        position={[7.1, 0, 2.5]}
        size={[1.4, 0.75, 1.4]}
        color="#4f5560"
      />
      <OutsideCharacter
        url="/models/showroom/characters/character-f.glb"
        position={[7.1, 0.8, 2.5]}
        scale={1.1}
        rotation={[0, -0.2, 0]}
      />

      <DisplayPedestal
        position={[10.4, 0, 2.5]}
        size={[1.4, 0.75, 1.4]}
        color="#4f5560"
      />
      <OutsideCharacter
        url="/models/showroom/characters/character-h.glb"
        position={[10.4, 0.8, 2.5]}
        scale={1.1}
        rotation={[0, 0.25, 0]}
      />

      <group position={[7.5, 0, 6.2]}>
        <FoodProp
          url="/models/showroom/urban/detail-bench.glb"
          position={[-3.6, 0, 0]}
          scale={1.4}
          simplify={false}
        />
        <FoodProp
          url="/models/showroom/urban/detail-dumpster-closed.glb"
          position={[0.4, 0, 0.1]}
          scale={1.2}
          rotation={[0, -0.6, 0]}
          simplify={false}
        />
        <FoodProp
          url="/models/showroom/urban/detail-light-double.glb"
          position={[4.4, 0, 0]}
          scale={1.25}
          simplify={false}
        />
        <FoodProp
          url="/models/showroom/urban/detail-awning-wide.glb"
          position={[0.2, 0.2, -2.2]}
          scale={1.3}
          simplify={false}
        />
      </group>
    </group>
  )
}

/* ── Hidden Room (remote, larger than the exterior suggests) */
function HiddenRoomInterior() {
  const wallMap = useLoader(
    THREE.TextureLoader,
    '/textures/diner_candidates/beige_wall_002_diff_2k.jpg',
  )
  const floorMap = useLoader(
    THREE.TextureLoader,
    '/textures/diner_candidates/portal_plank.png',
  )
  const plantMapA = useLoader(
    THREE.TextureLoader,
    '/textures/diner_candidates/portal_plant_a.png',
  )
  const plantMapB = useLoader(
    THREE.TextureLoader,
    '/textures/diner_candidates/portal_plant_b.png',
  )
  const posterMap = useLoader(
    THREE.TextureLoader,
    '/textures/diner_candidates/portal_building_202.png',
  )

  useEffect(() => {
    setupPs1Texture(wallMap, 9, 4)
    setupPs1Texture(floorMap, 10, 9)
    ;[plantMapA, plantMapB, posterMap].forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.minFilter = THREE.NearestFilter
      texture.magFilter = THREE.NearestFilter
      texture.generateMipmaps = false
      texture.needsUpdate = true
    })
  }, [floorMap, plantMapA, plantMapB, posterMap, wallMap])

  return (
    <group>
      <mesh
        position={[HIDDEN_ROOM_CENTER_X, 0.01, HIDDEN_ROOM_CENTER_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry
          args={[HIDDEN_ROOM_HALF_W * 2, HIDDEN_ROOM_HALF_D * 2]}
        />
        <meshStandardMaterial
          map={floorMap}
          color="#b3a285"
          flatShading
          roughness={0.95}
        />
      </mesh>
      <mesh position={[HIDDEN_ROOM_CENTER_X, 5, HIDDEN_ROOM_CENTER_Z]}>
        <boxGeometry
          args={[HIDDEN_ROOM_HALF_W * 2, 0.2, HIDDEN_ROOM_HALF_D * 2]}
        />
        <meshStandardMaterial color="#d9d0c0" flatShading roughness={0.9} />
      </mesh>

      <mesh
        position={[
          HIDDEN_ROOM_CENTER_X - HIDDEN_ROOM_HALF_W,
          2.5,
          HIDDEN_ROOM_CENTER_Z,
        ]}
      >
        <boxGeometry args={[0.2, 5, HIDDEN_ROOM_HALF_D * 2]} />
        <meshStandardMaterial
          map={wallMap}
          color="#e5d8c3"
          flatShading
          roughness={0.9}
        />
      </mesh>
      <mesh
        position={[
          HIDDEN_ROOM_CENTER_X,
          2.5,
          HIDDEN_ROOM_CENTER_Z - HIDDEN_ROOM_HALF_D,
        ]}
      >
        <boxGeometry args={[HIDDEN_ROOM_HALF_W * 2, 5, 0.2]} />
        <meshStandardMaterial
          map={wallMap}
          color="#e5d8c3"
          flatShading
          roughness={0.9}
        />
      </mesh>
      <mesh
        position={[
          HIDDEN_ROOM_CENTER_X,
          2.5,
          HIDDEN_ROOM_CENTER_Z + HIDDEN_ROOM_HALF_D,
        ]}
      >
        <boxGeometry args={[HIDDEN_ROOM_HALF_W * 2, 5, 0.2]} />
        <meshStandardMaterial
          map={wallMap}
          color="#e5d8c3"
          flatShading
          roughness={0.9}
        />
      </mesh>
      <mesh
        position={[
          HIDDEN_ROOM_CENTER_X + HIDDEN_ROOM_HALF_W,
          2.5,
          HIDDEN_ROOM_CENTER_Z - HIDDEN_ROOM_SIDE_SEGMENT_OFFSET_Z,
        ]}
      >
        <boxGeometry args={[0.2, 5, HIDDEN_ROOM_SIDE_SEGMENT_D * 2]} />
        <meshStandardMaterial
          map={wallMap}
          color="#e5d8c3"
          flatShading
          roughness={0.9}
        />
      </mesh>
      <mesh
        position={[
          HIDDEN_ROOM_CENTER_X + HIDDEN_ROOM_HALF_W,
          2.5,
          HIDDEN_ROOM_CENTER_Z + HIDDEN_ROOM_SIDE_SEGMENT_OFFSET_Z,
        ]}
      >
        <boxGeometry args={[0.2, 5, HIDDEN_ROOM_SIDE_SEGMENT_D * 2]} />
        <meshStandardMaterial
          map={wallMap}
          color="#e5d8c3"
          flatShading
          roughness={0.9}
        />
      </mesh>
      <mesh
        position={[
          HIDDEN_ROOM_CENTER_X + HIDDEN_ROOM_HALF_W,
          4.1,
          HIDDEN_ROOM_CENTER_Z,
        ]}
      >
        <boxGeometry args={[0.2, 1.8, 2.2]} />
        <meshStandardMaterial
          map={wallMap}
          color="#e5d8c3"
          flatShading
          roughness={0.9}
        />
      </mesh>

      <group
        position={[
          HIDDEN_ROOM_CENTER_X + HIDDEN_ROOM_HALF_W - 0.01,
          0,
          HIDDEN_ROOM_CENTER_Z,
        ]}
      >
        <mesh position={[0, 1.75, -1]}>
          <boxGeometry args={[0.08, 3.5, 0.08]} />
          <meshStandardMaterial color="#4d3a29" flatShading />
        </mesh>
        <mesh position={[0, 1.75, 1]}>
          <boxGeometry args={[0.08, 3.5, 0.08]} />
          <meshStandardMaterial color="#4d3a29" flatShading />
        </mesh>
        <mesh position={[0, 3.55, 0]}>
          <boxGeometry args={[0.08, 0.08, 2.1]} />
          <meshStandardMaterial color="#4d3a29" flatShading />
        </mesh>
        <mesh position={[-0.24, 1.75, -0.5]} rotation={[0, 0.48, 0]}>
          <boxGeometry args={[0.08, 3.4, 1.8]} />
          <meshStandardMaterial color="#5b3d2b" flatShading roughness={0.92} />
        </mesh>
      </group>

      {[-8, -3, 2, 7].map((x) => (
        <mesh
          key={x}
          position={[HIDDEN_ROOM_CENTER_X + x, 4.2, HIDDEN_ROOM_CENTER_Z]}
        >
          <boxGeometry args={[1.6, 0.08, 0.35]} />
          <meshStandardMaterial
            color="#f0e0aa"
            emissive="#f0e0aa"
            emissiveIntensity={1.2}
            flatShading
          />
        </mesh>
      ))}

      <mesh
        position={[HIDDEN_ROOM_CENTER_X, 0.14, HIDDEN_ROOM_CENTER_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color="#6a2835" flatShading roughness={1} />
      </mesh>

      {[-9, 0, 9].map((x) => (
        <Booth
          key={x}
          position={[HIDDEN_ROOM_CENTER_X + x, 0, HIDDEN_ROOM_CENTER_Z - 6]}
        />
      ))}
      {[-9, 0, 9].map((x) => (
        <Booth
          key={`south-${x}`}
          position={[HIDDEN_ROOM_CENTER_X + x, 0, HIDDEN_ROOM_CENTER_Z + 6]}
        />
      ))}

      <mesh position={[HIDDEN_ROOM_CENTER_X - 11, 0.55, HIDDEN_ROOM_CENTER_Z]}>
        <boxGeometry args={[6, 1.1, 3]} />
        <meshStandardMaterial color="#6d5a49" flatShading roughness={0.85} />
      </mesh>
      <mesh position={[HIDDEN_ROOM_CENTER_X - 11, 1.15, HIDDEN_ROOM_CENTER_Z]}>
        <boxGeometry args={[6.2, 0.12, 3.2]} />
        <meshStandardMaterial color={FORMICA} flatShading roughness={0.45} />
      </mesh>

      {[-6, 6].map((z) => (
        <group
          key={z}
          position={[HIDDEN_ROOM_CENTER_X + 11.5, 0, HIDDEN_ROOM_CENTER_Z + z]}
        >
          <mesh position={[0, 0.65, 0]}>
            <boxGeometry args={[3, 1.3, 0.45]} />
            <meshStandardMaterial
              color={RED_VINYL}
              flatShading
              roughness={0.6}
            />
          </mesh>
          <mesh position={[0, 1.3, 0.22]}>
            <boxGeometry args={[3, 0.8, 0.15]} />
            <meshStandardMaterial
              color={RED_VINYL}
              flatShading
              roughness={0.6}
            />
          </mesh>
        </group>
      ))}

      {[-8, 0, 8].map((x) => (
        <group
          key={`column-${x}`}
          position={[HIDDEN_ROOM_CENTER_X + x, 0, HIDDEN_ROOM_CENTER_Z]}
        >
          <mesh position={[0, 2.5, 0]}>
            <boxGeometry args={[0.45, 5, 0.45]} />
            <meshStandardMaterial color="#c6baa5" flatShading roughness={0.9} />
          </mesh>
        </group>
      ))}

      <mesh
        position={[
          HIDDEN_ROOM_CENTER_X,
          2.8,
          HIDDEN_ROOM_CENTER_Z - HIDDEN_ROOM_HALF_D + 0.15,
        ]}
      >
        <planeGeometry args={[7, 3.2]} />
        <meshStandardMaterial
          map={posterMap}
          transparent
          alphaTest={0.1}
          side={THREE.DoubleSide}
          flatShading
        />
      </mesh>

      {[
        [HIDDEN_ROOM_CENTER_X - 14.5, HIDDEN_ROOM_CENTER_Z - 11, plantMapA],
        [HIDDEN_ROOM_CENTER_X - 3, HIDDEN_ROOM_CENTER_Z + 11, plantMapB],
        [HIDDEN_ROOM_CENTER_X + 14, HIDDEN_ROOM_CENTER_Z - 10.5, plantMapA],
        [HIDDEN_ROOM_CENTER_X + 14, HIDDEN_ROOM_CENTER_Z + 10.5, plantMapB],
      ].map(([x, z, texture], i) => (
        <mesh key={i} position={[x as number, 1.2, z as number]}>
          <planeGeometry args={[2.2, 2.4]} />
          <meshStandardMaterial
            map={texture as THREE.Texture}
            transparent
            alphaTest={0.2}
            side={THREE.DoubleSide}
            flatShading
          />
        </mesh>
      ))}

      <pointLight
        position={[HIDDEN_ROOM_CENTER_X, 4.2, HIDDEN_ROOM_CENTER_Z]}
        intensity={3.5}
        color="#f4dfb2"
        distance={24}
      />
    </group>
  )
}

/* ── Staircase to second floor (back-left corner) ─── */
function UpStaircase() {
  const numSteps = 20
  const stepH = 5.1 / numSteps
  const stepD = 8 / numSteps

  return (
    <group>
      {/* Steps — going from z=1 (bottom) to z=-7 (top, second floor) */}
      {Array.from({ length: numSteps }, (_, i) => {
        const z = 1 - i * stepD - stepD / 2
        const y = i * stepH + stepH / 2
        return (
          <mesh key={i} position={[-6.75, y, z]}>
            <boxGeometry args={[1.5, stepH, stepD]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? '#555' : '#4a4a4a'}
              flatShading
              roughness={0.9}
            />
          </mesh>
        )
      })}
      {/* Handrail (open sides, no walls) */}
      <mesh position={[-5.9, 3.1, -3]} rotation={[Math.atan2(5.1, 8), 0, 0]}>
        <boxGeometry args={[0.06, 0.06, Math.sqrt(8 * 8 + 5.1 * 5.1)]} />
        <meshStandardMaterial
          color="#666"
          metalness={0.7}
          roughness={0.3}
          flatShading
        />
      </mesh>
    </group>
  )
}

/* ── One-Way Window Shed ─────────────────────────── */
function OneWayShed() {
  const cx = 15,
    cz = -4,
    hw = 2,
    hd = 2,
    h = 3
  return (
    <group>
      {/* Floor + ceiling provided by ShedInterior (large room) */}
      {/* Left wall — with door opening (gap z = cz-0.8 to cz+0.8) */}
      <mesh position={[cx - hw, h / 2, cz - 1.4]}>
        <boxGeometry args={[0.2, h, 1.2]} />
        <meshStandardMaterial color="#777" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[cx - hw, h / 2, cz + 1.4]}>
        <boxGeometry args={[0.2, h, 1.2]} />
        <meshStandardMaterial color="#777" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[cx - hw, 2.7, cz]}>
        <boxGeometry args={[0.2, 0.6, 1.6]} />
        <meshStandardMaterial color="#777" flatShading roughness={0.9} />
      </mesh>
      {/* Right wall + back wall removed — large interior extends beyond */}
      {/* Front wall — with window opening */}
      <mesh position={[cx - 1.25, h / 2, cz + hd]}>
        <boxGeometry args={[1.5, h, 0.2]} />
        <meshStandardMaterial color="#777" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[cx + 1.25, h / 2, cz + hd]}>
        <boxGeometry args={[1.5, h, 0.2]} />
        <meshStandardMaterial color="#777" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[cx, 2.5, cz + hd]}>
        <boxGeometry args={[1, 1, 0.2]} />
        <meshStandardMaterial color="#777" flatShading roughness={0.9} />
      </mesh>
      <mesh position={[cx, 0.3, cz + hd]}>
        <boxGeometry args={[1, 0.6, 0.2]} />
        <meshStandardMaterial color="#777" flatShading roughness={0.9} />
      </mesh>

      {/* ONE-WAY WALL: plane faces INWARD (-z), only visible from inside the room */}
      <mesh position={[cx, 1.3, cz + hd - 0.01]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1, 1.4]} />
        <meshStandardMaterial color="#777" flatShading roughness={0.9} />
      </mesh>

      {/* Window frame */}
      <mesh position={[cx - 0.52, 1.5, cz + hd + 0.02]}>
        <boxGeometry args={[0.06, 1.5, 0.06]} />
        <meshStandardMaterial color="#333" flatShading />
      </mesh>
      <mesh position={[cx + 0.52, 1.5, cz + hd + 0.02]}>
        <boxGeometry args={[0.06, 1.5, 0.06]} />
        <meshStandardMaterial color="#333" flatShading />
      </mesh>

      {/* Something inside — a table with a cup */}
      <mesh position={[cx, 0.45, cz - 0.5]}>
        <boxGeometry args={[0.6, 0.05, 0.6]} />
        <meshStandardMaterial color="#8b7355" flatShading />
      </mesh>
      <mesh position={[cx, 0.22, cz - 0.5]}>
        <boxGeometry args={[0.06, 0.44, 0.06]} />
        <meshStandardMaterial color="#666" flatShading />
      </mesh>

      {/* Light */}
      <pointLight
        position={[cx, 2.5, cz]}
        intensity={2}
        color="#ffeecc"
        distance={6}
      />
    </group>
  )
}

/* ── Shed Large Interior (3x bigger, remote location) */
function ShedInterior() {
  // Large interior overlapping with shed — door at x=13, extends to x=25, z=-10 to z=2
  // 12x12x9 vs the shed exterior of 4x4x3
  const h = 9
  return (
    <group>
      {/* Floor */}
      <mesh position={[19, 0.02, -4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#555" flatShading roughness={0.9} />
      </mesh>
      {/* Ceiling */}
      <mesh position={[19, h, -4]}>
        <boxGeometry args={[12.2, 0.15, 12.2]} />
        <meshStandardMaterial color="#666" flatShading roughness={0.9} />
      </mesh>
      {/* Far wall (x=25) */}
      <mesh position={[25, h / 2, -4]}>
        <boxGeometry args={[0.2, h, 12]} />
        <meshStandardMaterial color="#777" flatShading roughness={0.9} />
      </mesh>
      {/* Back wall (z=-10) */}
      <mesh position={[19, h / 2, -10]}>
        <boxGeometry args={[12, h, 0.2]} />
        <meshStandardMaterial color="#777" flatShading roughness={0.9} />
      </mesh>
      {/* Front-far wall (z=2) */}
      <mesh position={[19, h / 2, 2]}>
        <boxGeometry args={[12, h, 0.2]} />
        <meshStandardMaterial color="#777" flatShading roughness={0.9} />
      </mesh>

      {/* Table */}
      <mesh position={[19, 1.0, -6]}>
        <boxGeometry args={[1.5, 0.08, 1.5]} />
        <meshStandardMaterial color="#8b7355" flatShading />
      </mesh>
      <mesh position={[19, 0.5, -6]}>
        <boxGeometry args={[0.1, 1, 0.1]} />
        <meshStandardMaterial color="#666" flatShading />
      </mesh>
      {/* Chair */}
      <mesh position={[21, 0.5, -6]}>
        <boxGeometry args={[0.5, 0.05, 0.5]} />
        <meshStandardMaterial color="#8b7355" flatShading />
      </mesh>
      {[
        [-0.2, -0.2],
        [0.2, -0.2],
        [-0.2, 0.2],
        [0.2, 0.2],
      ].map(([lx, lz], i) => (
        <mesh key={i} position={[21 + lx, 0.25, -6 + lz]}>
          <boxGeometry args={[0.04, 0.5, 0.04]} />
          <meshStandardMaterial color="#8b7355" flatShading />
        </mesh>
      ))}

      {/* Lights */}
      <pointLight
        position={[19, 7, -4]}
        intensity={3}
        color="#ffeecc"
        distance={14}
      />
    </group>
  )
}

/* ── Ghost figure (only visible from outside) ─────── */
function GhostFigure({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()
  useFrame(() => {
    if (meshRef.current) {
      const p = camera.position
      const outside =
        p.x > W + 0.5 || p.x < -W - 0.5 || p.z > W + 0.5 || p.z < -W - 0.5
      meshRef.current.visible = outside
    }
  })
  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[0.6, 1.7, 0.6]} />
      <meshStandardMaterial color="#cc2222" flatShading />
    </mesh>
  )
}

/* ── Second floor (interior only — no exterior windows) */
function SecondFloor() {
  const S = W * 2
  const groupRef = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const upperFloorMap = useLoader(THREE.TextureLoader, '/fp-img/spr/floor.JPG')

  useEffect(() => {
    setupPs1Texture(upperFloorMap, 6, 6)
  }, [upperFloorMap])

  // Visible anywhere inside the diner so the upstairs can be seen from below,
  // but hidden from exterior views to preserve the impossible-space trick.
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.visible = isInsideDinerFootprint(camera.position)
    }
  })

  return (
    <group ref={groupRef} position={[0, 5, 0]}>
      {/* Lift slightly above the first-floor ceiling to avoid coplanar shimmer. */}
      {/* Floor — with hole for staircase */}
      <mesh position={[1.6, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12.8, S]} />
        <meshStandardMaterial
          map={upperFloorMap}
          color="#b7aa97"
          flatShading
          roughness={0.95}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh position={[-6.4, 0.16, 4.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 6.4]} />
        <meshStandardMaterial
          map={upperFloorMap}
          color="#b7aa97"
          flatShading
          roughness={0.95}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh position={[-6.4, 0.16, -7.75]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 0.5]} />
        <meshStandardMaterial
          map={upperFloorMap}
          color="#b7aa97"
          flatShading
          roughness={0.95}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      {/* Ceiling */}
      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[S, 0.2, S]} />
        <meshStandardMaterial color={CREAM} flatShading roughness={0.9} />
      </mesh>
      {/* Walls */}
      <mesh position={[-W, 2, 0]}>
        <boxGeometry args={[0.2, 4, S]} />
        <meshStandardMaterial color={TEAL} flatShading roughness={0.85} />
      </mesh>
      {/* Right wall — open with just window frames, real scene visible through */}
      <mesh position={[W, 0.3, 0]}>
        <boxGeometry args={[0.2, 0.6, S]} />
        <meshStandardMaterial color={TEAL} flatShading roughness={0.85} />
      </mesh>
      <mesh position={[W, 3.7, 0]}>
        <boxGeometry args={[0.2, 0.6, S]} />
        <meshStandardMaterial color={TEAL} flatShading roughness={0.85} />
      </mesh>
      <mesh position={[0, 2, -W]}>
        <boxGeometry args={[S, 4, 0.2]} />
        <meshStandardMaterial color={TEAL} flatShading roughness={0.85} />
      </mesh>
      <mesh position={[0, 2, W]}>
        <boxGeometry args={[S, 4, 0.2]} />
        <meshStandardMaterial color={TEAL} flatShading roughness={0.85} />
      </mesh>

      {/* Window frames only — no glass, real outside visible through */}
      {[-6, -4, -2, 0, 2, 4, 6].map((z, i) => (
        <group key={i} position={[W - 0.05, 2, z]}>
          <mesh position={[0, 1.2, 0]}>
            <boxGeometry args={[0.1, 0.1, 1.6]} />
            <meshStandardMaterial color="#333" flatShading />
          </mesh>
          <mesh position={[0, -1.2, 0]}>
            <boxGeometry args={[0.1, 0.1, 1.6]} />
            <meshStandardMaterial color="#333" flatShading />
          </mesh>
          {/* Vertical dividers */}
          <mesh position={[0, 0, -0.75]}>
            <boxGeometry args={[0.1, 2.4, 0.08]} />
            <meshStandardMaterial color="#333" flatShading />
          </mesh>
          <mesh position={[0, 0, 0.75]}>
            <boxGeometry args={[0.1, 2.4, 0.08]} />
            <meshStandardMaterial color="#333" flatShading />
          </mesh>
        </group>
      ))}

      {/* Light */}
      <pointLight
        position={[0, 3.5, 0]}
        intensity={3}
        color="#ffe4b5"
        distance={16}
      />
    </group>
  )
}

/* ── Scene ──────────────────────────────────────────── */
function Scene({ onZoneText }: { onZoneText: (t: string) => void }) {
  return (
    <>
      <SkyDome />

      {/* === OUTDOOR === */}
      <OutdoorGround />
      {/* Outdoor lighting */}
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.5}
        color="#8899bb"
      />

      {/* Character outside near entrance */}
      <OutsideCharacter
        url="/models/businessman.glb"
        position={[5, 0, W + 2]}
        scale={1.2}
        rotation={[0, Math.PI, 0]}
        simplify
      />

      <AssetShowroom />
      <ImpossibleHouseExterior />
      <ImpossibleHouseDoorPreview />
      <ImpossibleHouseInterior />

      {/* Main diner lighting */}
      <ambientLight intensity={2.5} />
      <directionalLight position={[4, 6, 3]} intensity={3} color="#f5e6c8" />
      <pointLight
        position={[0, 4.5, 0]}
        intensity={5}
        color="#ffe4b5"
        distance={18}
      />

      {/* === NORMAL DINER === */}
      <TileFloor cx={0} cz={0} hw={W} hd={W} />
      <DinerShell />
      <OneWayStairOccluder />
      <Windows />
      <NeonSign />
      <Counter />
      <Jukebox />

      <BarStool position={[-4.5, 0, -2.2]} />
      <BarStool position={[-3, 0, -2.2]} />
      <BarStool position={[-1.5, 0, -2.2]} />
      <BarStool position={[0, 0, -2.2]} />
      <BarStool position={[1.5, 0, -2.2]} />
      <BarStool position={[2.2, 0, 0.5]} />
      <BarStool position={[2.2, 0, 2]} />

      <Booth position={[6.5, 0, -5]} />
      <Booth position={[6.5, 0, -1]} />
      <Booth position={[6.5, 0, 3]} />

      <CeilingLight position={[-2, 4.9, -2]} />
      <CeilingLight position={[3, 4.9, 2]} />
      <CeilingLight position={[-5, 4.9, 4]} />
      <CeilingLight position={[5, 4.9, -4]} />

      {/* === DOOR INDICATORS === */}

      {/* "STAFF ONLY" sign + light above kitchen opening */}
      <mesh position={[-1, 3.8, -W + 0.15]}>
        <boxGeometry args={[1.4, 0.3, 0.04]} />
        <meshStandardMaterial
          color="#cc2222"
          emissive="#cc2222"
          emissiveIntensity={0.8}
          flatShading
        />
      </mesh>

      {/* Green "EXIT" above front door */}
      <mesh position={[2, 3.9, W - 0.05]}>
        <boxGeometry args={[0.8, 0.2, 0.04]} />
        <meshStandardMaterial
          color="#22cc22"
          emissive="#22cc22"
          emissiveIntensity={1.5}
          flatShading
        />
      </mesh>

      {/* === FOOD PROPS on counter and tables === */}
      <FoodProp url="/models/cup.glb" position={[-4, 1.15, -3.5]} scale={0.6} />
      <FoodProp url="/models/cup.glb" position={[-1, 1.15, -3.5]} scale={0.6} />
      <FoodProp
        url="/models/burger.glb"
        position={[-2.5, 1.15, -3.5]}
        scale={0.5}
      />
      <FoodProp
        url="/models/donut.glb"
        position={[0.5, 1.15, -3.5]}
        scale={0.5}
      />
      <FoodProp
        url="/models/soda_cup.glb"
        position={[2.5, 1.2, 0.5]}
        scale={0.4}
        ps1
      />
      {/* Food on booth tables */}
      <FoodProp
        url="/models/burger.glb"
        position={[6.5, 0.95, -5]}
        scale={0.4}
      />
      <FoodProp url="/models/cup.glb" position={[6.2, 0.95, -1]} scale={0.5} />
      <FoodProp
        url="/models/soda_cup.glb"
        position={[6.8, 0.95, 3]}
        scale={0.4}
        ps1
      />
      <FoodProp
        url="/models/donut.glb"
        position={[6.5, 0.95, 3.3]}
        scale={0.4}
      />

      {/* === CHARACTERS OUTSIDE WINDOWS === */}
      <OutsideCharacter
        url="/models/businessman.glb"
        position={[W + 1.5, 0, -2]}
        scale={1.2}
        rotation={[0, -Math.PI / 2, 0]}
        simplify
      />
      <OutsideCharacter
        url="/models/suit.glb"
        position={[W + 2, 0, 2]}
        scale={1.2}
        rotation={[0, -Math.PI / 3, 0]}
        simplify
      />
      <OutsideCharacter
        url="/models/worker.glb"
        position={[W + 1.2, 0, 5]}
        scale={1.2}
        rotation={[0, -Math.PI / 2, 0]}
        simplify
      />

      {/* === ONE-WAY WINDOW SHED (exterior) + LARGE INTERIOR (remote) === */}
      <OneWayShed />
      <ShedInterior />

      {/* === STAIRCASE TO SECOND FLOOR === */}
      <UpStaircase />

      {/* === GHOST FIGURE (only visible from outside through windows) === */}
      <GhostFigure position={[5, 0.85, -3]} />

      {/* === SECOND FLOOR (interior windows, no exterior) === */}
      <SecondFloor />

      {/* === DINER SCENE MODEL (outside) === */}
      <FoodProp
        url="/models/diner_scene.glb"
        position={[-12, 0.05, 12]}
        scale={1}
        simplify={false}
      />

      {/* === HIDDEN ROOM (bigger inside than outside) === */}
      <HiddenRoomInterior />

      {/* === INFINITE STAIRCASE === */}
      <InfiniteStaircase />

      <FirstPersonControls onZoneText={onZoneText} />
    </>
  )
}

/* ── Page ────────────────────────────────────────────── */
export default function Inspection() {
  const [zoneText, setZoneText] = useState('')

  return (
    <div className="inspect-page">
      <div className="inspect-viewport">
        <Canvas
          camera={{ position: [0, 1.6, 5], fov: 65 }}
          gl={{ alpha: false, antialias: false }}
          dpr={0.5}
          style={{ imageRendering: 'pixelated' }}
          scene={{ background: new THREE.Color('#4a4a5c') }}
        >
          <Scene onZoneText={setZoneText} />
        </Canvas>
        <div className="inspect-scanlines" />
        <div className="inspect-dither" />
      </div>

      <div className="inspect-ui">
        <div className="inspect-header">
          <span className="inspect-title">NOAH&apos;S DINER</span>
        </div>
        <div className="inspect-description">
          {zoneText ? (
            <p className="inspect-zone-text">{zoneText}</p>
          ) : (
            <>
              <p>A quiet place. The jukebox hums softly.</p>
              <p className="inspect-hint">
                Click to look around. WASD to move.
              </p>
            </>
          )}
        </div>
      </div>

      <a href="/" className="inspect-home">
        HOME
      </a>
    </div>
  )
}

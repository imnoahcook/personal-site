import { PointerLockControls } from '@react-three/drei'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as THREE from 'three'
import './NonEuclidean.css'
import type { PortalRuntime } from './nonEuclideanEngine'
import {
  applyCameraOverride,
  buildWorldColliders,
  carvePortalColliderOpening,
  createPortalMaterial,
  ENGINE_FOV,
  getMovementBasis,
  getPortalPlaneDistance,
  movePlayerCamera,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PORTAL_LAYER,
  PORTAL_PUSH,
  parseEngineMesh,
  renderRecursivePortals,
  resolveCameraOverride,
  setRendererLocalClipping,
  setRendererXrEnabled,
  setupTexture,
  tryTraversePortal,
  updateCameraNearFromPortals,
} from './nonEuclideanEngine'

const PLAYER_SPEED = 2.9
const SPRINT_MULTIPLIER = 1.75
const RECURSION_DEPTH = 4
const PORTAL_RENDER_SIZE = 1024
const keyState: Record<string, boolean> = {}

const TUNNEL_ONE_POSITION = new THREE.Vector3(-2.4, 0, -1.8)
const TUNNEL_ONE_SCALE = new THREE.Vector3(1, 1, 4.8)
const TUNNEL_TWO_POSITION = new THREE.Vector3(2.4, 0, 0)
const TUNNEL_TWO_SCALE = new THREE.Vector3(1, 1, 0.6)
const GROUND_SCALE = new THREE.Vector3(120, 1, 120)

const PORTAL_ONE_POSITION = new THREE.Vector3(-2.4, 1, 3)
const PORTAL_TWO_POSITION = new THREE.Vector3(2.4, 1, 0.6)
const PORTAL_THREE_POSITION = new THREE.Vector3(-2.4, 1, -6.6)
const PORTAL_FOUR_POSITION = new THREE.Vector3(2.4, 1, -0.6)
const PORTAL_ONE_ROTATION = 0
const PORTAL_TWO_ROTATION = 0
const PORTAL_THREE_ROTATION = Math.PI
const PORTAL_FOUR_ROTATION = Math.PI

function createRenderTargets() {
  return Array.from(
    { length: RECURSION_DEPTH },
    () =>
      new THREE.WebGLRenderTarget(PORTAL_RENDER_SIZE, PORTAL_RENDER_SIZE, {
        depthBuffer: true,
        stencilBuffer: false,
        magFilter: THREE.NearestFilter,
        minFilter: THREE.NearestFilter,
      }),
  )
}

interface Level1WorldProps {
  onCameraChange: (cameraState: CameraState) => void
  spawnOverride: ReturnType<typeof resolveCameraOverride>
}

interface CameraState {
  pitch: number
  x: number
  y: number
  yaw: number
  z: number
}

function setCameraSpawn(
  camera: THREE.PerspectiveCamera,
  spawnOverride: ReturnType<typeof resolveCameraOverride>,
) {
  applyCameraOverride(camera, spawnOverride)
}

function Level1World({ onCameraChange, spawnOverride }: Level1WorldProps) {
  const { camera, gl, scene } = useThree()
  const tunnelSource = useLoader(
    THREE.FileLoader,
    '/non-euclidean/engine/tunnel.obj',
  ) as string
  const groundSource = useLoader(
    THREE.FileLoader,
    '/non-euclidean/engine/ground.obj',
  ) as string
  const portalSource = useLoader(
    THREE.FileLoader,
    '/non-euclidean/engine/double_quad.obj',
  ) as string
  const tunnelTexture = useLoader(
    THREE.TextureLoader,
    '/non-euclidean/engine/checker_gray.bmp',
  )
  const groundTexture = useLoader(
    THREE.TextureLoader,
    '/non-euclidean/engine/checker_green.bmp',
  )
  const skyTexture = useLoader(
    THREE.TextureLoader,
    '/fp-img/spacewithstars.gif',
  )
  const tunnelMesh = useMemo(
    () => parseEngineMesh(tunnelSource),
    [tunnelSource],
  )
  const groundMesh = useMemo(
    () => parseEngineMesh(groundSource),
    [groundSource],
  )
  const portalGeometry = useMemo(
    () => parseEngineMesh(portalSource).geometry,
    [portalSource],
  )
  const colliders = useMemo(() => {
    let result = [
      ...buildWorldColliders(tunnelMesh.colliders, {
        position: TUNNEL_ONE_POSITION,
        scale: TUNNEL_ONE_SCALE,
      }),
      ...buildWorldColliders(tunnelMesh.colliders, {
        position: TUNNEL_TWO_POSITION,
        scale: TUNNEL_TWO_SCALE,
      }),
    ]
    result = carvePortalColliderOpening(
      result,
      PORTAL_ONE_POSITION,
      PORTAL_ONE_ROTATION,
      0.6,
    )
    result = carvePortalColliderOpening(
      result,
      PORTAL_TWO_POSITION,
      PORTAL_TWO_ROTATION,
      0.6,
    )
    result = carvePortalColliderOpening(
      result,
      PORTAL_THREE_POSITION,
      PORTAL_THREE_ROTATION,
      0.6,
    )
    result = carvePortalColliderOpening(
      result,
      PORTAL_FOUR_POSITION,
      PORTAL_FOUR_ROTATION,
      0.6,
    )
    return result
  }, [tunnelMesh.colliders])
  const portalOneRef = useRef<THREE.Mesh>(null)
  const portalTwoRef = useRef<THREE.Mesh>(null)
  const portalThreeRef = useRef<THREE.Mesh>(null)
  const portalFourRef = useRef<THREE.Mesh>(null)
  const targetsOne = useMemo(() => createRenderTargets(), [])
  const targetsTwo = useMemo(() => createRenderTargets(), [])
  const targetsThree = useMemo(() => createRenderTargets(), [])
  const targetsFour = useMemo(() => createRenderTargets(), [])
  const portalCameraOne = useMemo(
    () => new THREE.PerspectiveCamera(75, 1, 0.05, 300),
    [],
  )
  const portalCameraTwo = useMemo(
    () => new THREE.PerspectiveCamera(75, 1, 0.05, 300),
    [],
  )
  const portalCameraThree = useMemo(
    () => new THREE.PerspectiveCamera(75, 1, 0.05, 300),
    [],
  )
  const portalCameraFour = useMemo(
    () => new THREE.PerspectiveCamera(75, 1, 0.05, 300),
    [],
  )
  const portalMaterialOne = useMemo(() => createPortalMaterial(), [])
  const portalMaterialTwo = useMemo(() => createPortalMaterial(), [])
  const portalMaterialThree = useMemo(() => createPortalMaterial(), [])
  const portalMaterialFour = useMemo(() => createPortalMaterial(), [])
  const previousPosition = useRef(new THREE.Vector3(0, PLAYER_HEIGHT, 5))
  const blockedPortalIndex = useRef<number | null>(null)
  const cameraSampleTimer = useRef(0)

  useEffect(() => {
    setupTexture(tunnelTexture)
    setupTexture(groundTexture, 120, 120)
    setupTexture(skyTexture)
    setCameraSpawn(camera as THREE.PerspectiveCamera, spawnOverride)
    previousPosition.current.copy((camera as THREE.PerspectiveCamera).position)
    onCameraChange({
      pitch: (camera as THREE.PerspectiveCamera).rotation.x,
      x: (camera as THREE.PerspectiveCamera).position.x,
      y: (camera as THREE.PerspectiveCamera).position.y,
      yaw: (camera as THREE.PerspectiveCamera).rotation.y,
      z: (camera as THREE.PerspectiveCamera).position.z,
    })
    portalOneRef.current?.layers.set(PORTAL_LAYER)
    portalTwoRef.current?.layers.set(PORTAL_LAYER)
    portalThreeRef.current?.layers.set(PORTAL_LAYER)
    portalFourRef.current?.layers.set(PORTAL_LAYER)
    setRendererLocalClipping(gl, true)
    return () => {
      for (const target of [
        ...targetsOne,
        ...targetsTwo,
        ...targetsThree,
        ...targetsFour,
      ]) {
        target.dispose()
      }
      portalMaterialOne.dispose()
      portalMaterialTwo.dispose()
      portalMaterialThree.dispose()
      portalMaterialFour.dispose()
    }
  }, [
    camera,
    gl,
    groundTexture,
    portalMaterialFour,
    portalMaterialOne,
    portalMaterialThree,
    portalMaterialTwo,
    skyTexture,
    spawnOverride,
    targetsFour,
    targetsOne,
    targetsThree,
    targetsTwo,
    tunnelTexture,
    onCameraChange,
  ])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      keyState[event.code] = true
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      keyState[event.code] = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useFrame((_, delta) => {
    const activeCamera = camera as THREE.PerspectiveCamera
    previousPosition.current.copy(activeCamera.position)
    const { forward, side } = getMovementBasis(activeCamera)

    const moveStep =
      PLAYER_SPEED *
      (keyState.ShiftLeft || keyState.ShiftRight ? SPRINT_MULTIPLIER : 1) *
      delta
    if (keyState.KeyW)
      movePlayerCamera(
        activeCamera,
        forward.x * moveStep,
        forward.z * moveStep,
        colliders,
      )
    if (keyState.KeyS)
      movePlayerCamera(
        activeCamera,
        -forward.x * moveStep,
        -forward.z * moveStep,
        colliders,
      )
    if (keyState.KeyA)
      movePlayerCamera(
        activeCamera,
        side.x * moveStep,
        side.z * moveStep,
        colliders,
      )
    if (keyState.KeyD)
      movePlayerCamera(
        activeCamera,
        -side.x * moveStep,
        -side.z * moveStep,
        colliders,
      )
    activeCamera.updateMatrixWorld(true)

    const portalPairs: Array<{
      source: RefObject<THREE.Mesh | null>
      sourceIndex: number
      target: RefObject<THREE.Mesh | null>
      targetIndex: number
    }> = [
      {
        source: portalOneRef,
        sourceIndex: 0,
        target: portalTwoRef,
        targetIndex: 1,
      },
      {
        source: portalTwoRef,
        sourceIndex: 1,
        target: portalOneRef,
        targetIndex: 0,
      },
      {
        source: portalThreeRef,
        sourceIndex: 2,
        target: portalFourRef,
        targetIndex: 3,
      },
      {
        source: portalFourRef,
        sourceIndex: 3,
        target: portalThreeRef,
        targetIndex: 2,
      },
    ]

    const portalRefs = [
      portalOneRef,
      portalTwoRef,
      portalThreeRef,
      portalFourRef,
    ]
    if (blockedPortalIndex.current !== null) {
      const blockedPortal = portalRefs[blockedPortalIndex.current].current
      if (
        blockedPortal &&
        Math.abs(getPortalPlaneDistance(activeCamera.position, blockedPortal)) >
          PLAYER_RADIUS + PORTAL_PUSH
      ) {
        blockedPortalIndex.current = null
      }
    }

    for (const pair of portalPairs) {
      if (blockedPortalIndex.current === pair.sourceIndex) {
        continue
      }

      if (
        tryTraversePortal(
          previousPosition.current,
          activeCamera.position,
          activeCamera,
          pair.source.current,
          pair.target.current,
        )
      ) {
        blockedPortalIndex.current = pair.targetIndex
        break
      }
    }

    if (
      !portalOneRef.current ||
      !portalTwoRef.current ||
      !portalThreeRef.current ||
      !portalFourRef.current
    )
      return

    const renderer = gl as THREE.WebGLRenderer
    const xrEnabled = renderer.xr.enabled
    setRendererXrEnabled(renderer, false)

    const portals: PortalRuntime[] = [
      {
        mesh: portalOneRef.current,
        frontTargetIndex: 1,
        backTargetIndex: 1,
        camera: portalCameraOne,
        renderTargets: targetsOne,
      },
      {
        mesh: portalTwoRef.current,
        frontTargetIndex: 0,
        backTargetIndex: 0,
        camera: portalCameraTwo,
        renderTargets: targetsTwo,
      },
      {
        mesh: portalThreeRef.current,
        frontTargetIndex: 3,
        backTargetIndex: 3,
        camera: portalCameraThree,
        renderTargets: targetsThree,
      },
      {
        mesh: portalFourRef.current,
        frontTargetIndex: 2,
        backTargetIndex: 2,
        camera: portalCameraFour,
        renderTargets: targetsFour,
      },
    ]

    updateCameraNearFromPortals(activeCamera, portals)
    renderRecursivePortals(
      renderer,
      scene,
      activeCamera,
      portals,
      RECURSION_DEPTH,
    )
    setRendererXrEnabled(renderer, xrEnabled)

    cameraSampleTimer.current += delta
    if (cameraSampleTimer.current >= 0.1) {
      cameraSampleTimer.current = 0
      onCameraChange({
        pitch: activeCamera.rotation.x,
        x: activeCamera.position.x,
        y: activeCamera.position.y,
        yaw: activeCamera.rotation.y,
        z: activeCamera.position.z,
      })
    }
  }, 1)

  return (
    <>
      <color attach="background" args={['#010103']} />

      <mesh position={[0, 4, 0]}>
        <sphereGeometry args={[120, 24, 24]} />
        <meshBasicMaterial
          map={skyTexture}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>

      <mesh
        geometry={groundMesh.geometry}
        position={[0, 0, 0]}
        scale={GROUND_SCALE}
      >
        <meshBasicMaterial
          map={groundTexture}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh
        geometry={tunnelMesh.geometry}
        position={TUNNEL_ONE_POSITION}
        scale={TUNNEL_ONE_SCALE}
      >
        <meshBasicMaterial
          map={tunnelTexture}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh
        geometry={tunnelMesh.geometry}
        position={TUNNEL_TWO_POSITION}
        scale={TUNNEL_TWO_SCALE}
      >
        <meshBasicMaterial
          map={tunnelTexture}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh
        ref={portalOneRef}
        geometry={portalGeometry}
        position={PORTAL_ONE_POSITION}
        scale={[0.6, 0.999, 1]}
      >
        <primitive object={portalMaterialOne} attach="material" />
      </mesh>
      <mesh
        ref={portalTwoRef}
        geometry={portalGeometry}
        position={PORTAL_TWO_POSITION}
        scale={[0.6, 0.999, 1]}
      >
        <primitive object={portalMaterialTwo} attach="material" />
      </mesh>
      <mesh
        ref={portalThreeRef}
        geometry={portalGeometry}
        position={PORTAL_THREE_POSITION}
        rotation={[0, PORTAL_THREE_ROTATION, 0]}
        scale={[0.6, 0.999, 1]}
      >
        <primitive object={portalMaterialThree} attach="material" />
      </mesh>
      <mesh
        ref={portalFourRef}
        geometry={portalGeometry}
        position={PORTAL_FOUR_POSITION}
        rotation={[0, PORTAL_FOUR_ROTATION, 0]}
        scale={[0.6, 0.999, 1]}
      >
        <primitive object={portalMaterialFour} attach="material" />
      </mesh>

      <PointerLockControls />
    </>
  )
}

export default function NonEuclideanLevel1() {
  const params = useParams()
  const [cameraState, setCameraState] = useState<CameraState>({
    pitch: 0,
    x: 0,
    y: PLAYER_HEIGHT,
    yaw: 0,
    z: 5,
  })
  const spawnOverride = useMemo(
    () =>
      resolveCameraOverride(
        new THREE.Vector3(0, PLAYER_HEIGHT, 5),
        0,
        0,
        params,
      ),
    [params],
  )

  return (
    <div className="non-euclidean-page">
      <div className="non-euclidean-viewport">
        <Canvas
          camera={{
            fov: ENGINE_FOV,
            near: 0.05,
            far: 300,
            position: [0, PLAYER_HEIGHT, 5],
          }}
          gl={{ antialias: false }}
        >
          <Level1World
            onCameraChange={setCameraState}
            spawnOverride={spawnOverride}
          />
        </Canvas>
      </div>

      <div className="non-euclidean-ui">
        <p className="non-euclidean-title">LEVEL1</p>
        <p className="non-euclidean-copy">
          current position: x={cameraState.x.toFixed(3)} y=
          {cameraState.y.toFixed(3)} z={cameraState.z.toFixed(3)} yaw=
          {cameraState.yaw.toFixed(4)} pitch={cameraState.pitch.toFixed(4)}
        </p>

        <div className="non-euclidean-links">
          <Link to="/non-euclidean">all demos</Link>
        </div>
      </div>
    </div>
  )
}

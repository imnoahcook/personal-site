import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import * as THREE from 'three'
import './NonEuclidean.css'
import type { Collider2D, PortalRuntime } from './nonEuclideanEngine'
import {
  buildWorldColliders,
  carvePortalColliderOpening,
  collides,
  createAtlasTextureMaterial,
  createPortalMaterial,
  ENGINE_FOV,
  getPortalPlaneDistance,
  getPortalPlaneScaleRatio,
  getPortalTargetIndex,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PORTAL_LAYER,
  PORTAL_PUSH,
  parseEngineMesh,
  renderRecursivePortals,
  setRendererLocalClipping,
  setRendererXrEnabled,
  setupTexture,
  tryTraversePortal,
  updateCameraNearFromPortals,
} from './nonEuclideanEngine'

const FIXED_DT = 0.002
const MAX_STEPS = 30
const WALK_SPEED = 2.9
const WALK_ACCEL = 50
const SPRINT_MULTIPLIER = 1.75
const PLAYER_DRAG = 0.002
const GROUND_FRICTION = 0.04
const MOUSE_SENSITIVITY = 0.005
const BOB_FREQ = 8
const BOB_OFFS = 0.015
const BOB_DAMP = 0.04
const BOB_MIN = 0.1
const TAU = Math.PI * 2
const SCALE_TRANSITION_MIN_RATIO_DELTA = 0.04
const SCALE_TRANSITION_MIN_ZOOM = 0.45
const SCALE_TRANSITION_MAX_ZOOM = 2.25
const PORTAL_GEOMETRY_SOURCE = '/non-euclidean/engine/double_quad.obj'
const PLAYER_CUBE_SIZE = new THREE.Vector3(0.45, 0.9, 0.45)
const PLAYER_CUBE_EYE_OFFSET = 0.95

const tempMove = new THREE.Vector3()
const tempStep = new THREE.Vector3()

interface TextureAtlasConfig {
  columns: number
  rows: number
}

export interface SceneMeshConfig {
  id: string
  includeColliders?: boolean
  position: THREE.Vector3
  rotation?: THREE.Euler
  scale: THREE.Vector3
  source: string
  texture?: string
  textureAtlas?: TextureAtlasConfig
  textureRepeat?: [number, number]
}

export interface ScenePortalConfig {
  backTargetIndex: number
  frontTargetIndex: number
  position: THREE.Vector3
  rotation?: THREE.Euler
  scale: THREE.Vector3
}

export interface NonEuclideanSceneConfig {
  backgroundColor: string
  cameraFar: number
  meshes: SceneMeshConfig[]
  playerHeight?: number
  portalRenderSize?: number
  portals: ScenePortalConfig[]
  recursionDepth?: number
  routeBase: string
  sampleCameraHeight?: (x: number, z: number) => number
  scaleTransitionDuration?: number
  skyTexture?: string
  showPlayerCube?: boolean
  spawnPitch?: number
  spawnPosition: THREE.Vector3
  spawnYaw?: number
  title: string
}

interface CameraState {
  pitch: number
  x: number
  y: number
  yaw: number
  z: number
}

interface CameraOverride {
  pitch: number
  position: THREE.Vector3
  yaw: number
}

interface SceneWorldProps {
  config: NonEuclideanSceneConfig
  onCameraChange: (cameraState: CameraState) => void
  onLockChange: (locked: boolean) => void
  onReady: () => void
  renderPortals: boolean
  spawnOverride: CameraOverride
}

function createRenderTargets(size: number, depth: number) {
  return Array.from(
    { length: depth },
    () =>
      new THREE.WebGLRenderTarget(size, size, {
        depthBuffer: true,
        stencilBuffer: false,
        magFilter: THREE.NearestFilter,
        minFilter: THREE.NearestFilter,
      }),
  )
}

function wrapAngle(angle: number) {
  let value = angle
  while (value > Math.PI) value -= TAU
  while (value < -Math.PI) value += TAU
  return value
}

function clampPitch(angle: number) {
  return THREE.MathUtils.clamp(angle, -Math.PI / 2, Math.PI / 2)
}

function getBobOffset(bobMagnitude: number, bobPhase: number) {
  if (bobMagnitude < BOB_MIN) {
    return 0
  }

  const theta = (Math.PI / 2) * Math.sin(bobPhase)
  return bobMagnitude * BOB_OFFS * (1 - Math.cos(theta))
}

function moveBody(
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  deltaTime: number,
  colliders: Collider2D[],
  bodyHeight: number,
  sampleCameraHeight?: (x: number, z: number) => number,
) {
  const nextX = position.x + velocity.x * deltaTime
  if (!collides(nextX, position.z, colliders)) {
    position.x = nextX
  } else {
    velocity.x = 0
  }

  const nextZ = position.z + velocity.z * deltaTime
  if (!collides(position.x, nextZ, colliders)) {
    position.z = nextZ
  } else {
    velocity.z = 0
  }

  position.y = sampleCameraHeight
    ? sampleCameraHeight(position.x, position.z)
    : bodyHeight
}

function readCameraNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function resolveSceneCameraOverride(
  defaultPosition: THREE.Vector3,
  defaultYaw: number,
  defaultPitch: number,
  raw: Record<string, string | undefined>,
): CameraOverride {
  return {
    pitch: readCameraNumber(raw.pitch, defaultPitch),
    position: new THREE.Vector3(
      readCameraNumber(raw.x, defaultPosition.x),
      readCameraNumber(raw.y, defaultPosition.y),
      readCameraNumber(raw.z, defaultPosition.z),
    ),
    yaw: readCameraNumber(raw.yaw, defaultYaw),
  }
}

function SpaceSky({ texture }: { texture: THREE.Texture }) {
  const { camera } = useThree()
  const skyRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (skyRef.current) {
      skyRef.current.position.copy(camera.position)
    }
  })

  return (
    <mesh ref={skyRef}>
      <sphereGeometry args={[120, 24, 24]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        toneMapped={false}
      />
    </mesh>
  )
}

function MeshTextureMaterial({
  atlas,
  texture,
}: {
  atlas?: TextureAtlasConfig
  texture?: THREE.Texture
}) {
  const atlasColumns = atlas?.columns ?? 1
  const atlasRows = atlas?.rows ?? 1
  const atlasMaterial = useMemo(
    () =>
      texture && atlas
        ? createAtlasTextureMaterial(texture, atlasColumns, atlasRows)
        : null,
    [atlas, atlasColumns, atlasRows, texture],
  )

  useEffect(
    () => () => {
      atlasMaterial?.dispose()
    },
    [atlasMaterial],
  )

  if (atlasMaterial) {
    return <primitive object={atlasMaterial} attach="material" />
  }

  return (
    <meshBasicMaterial
      map={texture}
      toneMapped={false}
      side={THREE.DoubleSide}
    />
  )
}

function SceneWorld({
  config,
  onCameraChange,
  onLockChange,
  onReady,
  renderPortals,
  spawnOverride,
}: SceneWorldProps) {
  const { camera, gl, scene } = useThree()
  const recursionDepth = config.recursionDepth ?? 4
  const portalRenderSize = config.portalRenderSize ?? 1024
  const bodyHeight = config.playerHeight ?? PLAYER_HEIGHT
  const scaleTransitionDuration = config.scaleTransitionDuration ?? 0
  const uniqueMeshSources = useMemo(
    () =>
      Array.from(
        new Set([
          ...config.meshes.map((mesh) => mesh.source),
          PORTAL_GEOMETRY_SOURCE,
        ]),
      ),
    [config.meshes],
  )
  const uniqueTextureSources = useMemo(() => {
    const paths = config.meshes
      .map((mesh) => mesh.texture)
      .filter((value): value is string => Boolean(value))

    if (config.skyTexture) {
      paths.push(config.skyTexture)
    }

    return Array.from(new Set(paths))
  }, [config.meshes, config.skyTexture])
  const rawMeshSources = useLoader(
    THREE.FileLoader,
    uniqueMeshSources,
  ) as string[]
  const loadedTextures = useLoader(
    THREE.TextureLoader,
    uniqueTextureSources,
  ) as THREE.Texture[]
  const parsedMeshes = useMemo(() => {
    const entries: Array<[string, ReturnType<typeof parseEngineMesh>]> =
      uniqueMeshSources.map((path, index) => [
        path,
        parseEngineMesh(rawMeshSources[index]),
      ])
    return new Map<string, ReturnType<typeof parseEngineMesh>>(entries)
  }, [rawMeshSources, uniqueMeshSources])
  const textures = useMemo(() => {
    const entries: Array<[string, THREE.Texture]> = uniqueTextureSources.map(
      (path, index) => [path, loadedTextures[index]],
    )
    return new Map<string, THREE.Texture>(entries)
  }, [loadedTextures, uniqueTextureSources])
  const portalGeometry = parsedMeshes.get(PORTAL_GEOMETRY_SOURCE)?.geometry
  const colliders = useMemo(() => {
    let result = config.meshes.flatMap((mesh) => {
      if (!mesh.includeColliders) {
        return []
      }

      const parsedMesh = parsedMeshes.get(mesh.source)
      if (!parsedMesh) {
        return []
      }

      return buildWorldColliders(parsedMesh.colliders, {
        position: mesh.position,
        scale: mesh.scale,
      })
    })

    for (const portal of config.portals) {
      result = carvePortalColliderOpening(
        result,
        portal.position,
        portal.rotation?.y ?? 0,
        portal.scale.x,
      )
    }

    return result
  }, [config.meshes, config.portals, parsedMeshes])
  const portalMeshes = useRef<Array<THREE.Mesh | null>>([])
  const portalTargets = useMemo(
    () =>
      config.portals.map(() =>
        createRenderTargets(portalRenderSize, recursionDepth),
      ),
    [config.portals, portalRenderSize, recursionDepth],
  )
  const portalCameras = useMemo(
    () =>
      config.portals.map(
        () =>
          new THREE.PerspectiveCamera(ENGINE_FOV, 1, 0.05, config.cameraFar),
      ),
    [config.cameraFar, config.portals],
  )
  const portalMaterials = useMemo(
    () => config.portals.map(() => createPortalMaterial()),
    [config.portals],
  )
  const playerCubeRef = useRef<THREE.Mesh>(null)
  const bodyPosition = useRef(spawnOverride.position.clone())
  const previousBodyPosition = useRef(spawnOverride.position.clone())
  const velocity = useRef(new THREE.Vector3())
  const cameraSampleTimer = useRef(0)
  const fixedStepRemainder = useRef(0)
  const mouseDelta = useRef({ x: 0, y: 0 })
  const pressedKeys = useRef<Record<string, boolean>>({})
  const yaw = useRef(spawnOverride.yaw)
  const pitch = useRef(spawnOverride.pitch)
  const bobMagnitude = useRef(0)
  const bobPhase = useRef(0)
  const lockedRef = useRef(false)
  const cameraEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const blockedPortalIndex = useRef<number | null>(null)
  const scaleTransitionElapsed = useRef(Infinity)
  const scaleTransitionStartZoom = useRef(1)
  const activeCameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const domElementRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    activeCameraRef.current = camera as THREE.PerspectiveCamera
  }, [camera])

  useEffect(() => {
    domElementRef.current = gl.domElement
  }, [gl])

  useEffect(() => {
    for (const mesh of config.meshes) {
      if (!mesh.texture) continue
      const texture = textures.get(mesh.texture)
      if (!texture) continue
      const [repeatX, repeatY] = mesh.textureRepeat ?? [1, 1]
      setupTexture(texture, repeatX, repeatY)
    }

    if (config.skyTexture) {
      const skyTexture = textures.get(config.skyTexture)
      if (skyTexture) {
        setupTexture(skyTexture)
      }
    }

    const activeCamera = activeCameraRef.current
    if (!activeCamera) {
      return
    }
    activeCamera.rotation.order = 'YXZ'
    bodyPosition.current.copy(spawnOverride.position)
    previousBodyPosition.current.copy(spawnOverride.position)
    velocity.current.set(0, 0, 0)
    yaw.current = spawnOverride.yaw
    pitch.current = spawnOverride.pitch
    bobMagnitude.current = 0
    bobPhase.current = 0
    fixedStepRemainder.current = 0
    mouseDelta.current.x = 0
    mouseDelta.current.y = 0
    activeCamera.position.copy(spawnOverride.position)
    activeCamera.rotation.set(spawnOverride.pitch, spawnOverride.yaw, 0)
    activeCamera.zoom = 1
    activeCamera.updateProjectionMatrix()
    activeCamera.updateMatrixWorld(true)
    scaleTransitionElapsed.current = Infinity
    scaleTransitionStartZoom.current = 1

    for (const mesh of portalMeshes.current) {
      mesh?.layers.set(PORTAL_LAYER)
    }

    onCameraChange({
      pitch: pitch.current,
      x: bodyPosition.current.x,
      y: bodyPosition.current.y,
      yaw: yaw.current,
      z: bodyPosition.current.z,
    })
    onReady()
    setRendererLocalClipping(gl, true)

    return () => {
      for (const targets of portalTargets) {
        for (const target of targets) {
          target.dispose()
        }
      }
      for (const material of portalMaterials) {
        material.dispose()
      }
    }
  }, [
    config.meshes,
    config.skyTexture,
    gl,
    onCameraChange,
    onReady,
    portalMaterials,
    portalTargets,
    spawnOverride,
    textures,
  ])

  useEffect(() => {
    const target = domElementRef.current
    if (!target) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      pressedKeys.current[event.code] = true
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      pressedKeys.current[event.code] = false
    }

    const clearKeys = () => {
      pressedKeys.current = {}
    }

    target.addEventListener('keydown', handleKeyDown)
    target.addEventListener('keyup', handleKeyUp)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', clearKeys)

    return () => {
      target.removeEventListener('keydown', handleKeyDown)
      target.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', clearKeys)
    }
  }, [])

  useEffect(() => {
    const target = domElementRef.current
    if (!target) {
      return
    }
    target.tabIndex = 0
    target.style.outline = 'none'

    const handleClick = () => {
      target.focus()
      if (document.pointerLockElement !== target) {
        target.requestPointerLock()
      }
    }

    const handlePointerLockChange = () => {
      lockedRef.current = document.pointerLockElement === target
      if (!lockedRef.current) {
        pressedKeys.current = {}
      }
      onLockChange(lockedRef.current)
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!lockedRef.current) return
      mouseDelta.current.x += event.movementX
      mouseDelta.current.y += event.movementY
    }

    target.addEventListener('click', handleClick)
    document.addEventListener('pointerlockchange', handlePointerLockChange)
    document.addEventListener('mousemove', handleMouseMove)

    return () => {
      target.removeEventListener('click', handleClick)
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
      document.removeEventListener('mousemove', handleMouseMove)
      if (document.pointerLockElement === target) {
        document.exitPointerLock()
      }
      onLockChange(false)
    }
  }, [onLockChange])

  useFrame((_, delta) => {
    const activeCamera = activeCameraRef.current
    if (!activeCamera) {
      return
    }

    yaw.current = wrapAngle(
      yaw.current - mouseDelta.current.x * MOUSE_SENSITIVITY,
    )
    pitch.current = clampPitch(
      pitch.current - mouseDelta.current.y * MOUSE_SENSITIVITY,
    )
    mouseDelta.current.x = 0
    mouseDelta.current.y = 0

    fixedStepRemainder.current += Math.min(delta, FIXED_DT * MAX_STEPS)

    for (
      let step = 0;
      fixedStepRemainder.current >= FIXED_DT && step < MAX_STEPS;
      step += 1
    ) {
      fixedStepRemainder.current -= FIXED_DT
      previousBodyPosition.current.copy(bodyPosition.current)

      velocity.current.multiplyScalar(1 - PLAYER_DRAG)
      moveBody(
        bodyPosition.current,
        velocity.current,
        FIXED_DT,
        colliders,
        bodyHeight,
        config.sampleCameraHeight,
      )

      velocity.current.x *= 1 - GROUND_FRICTION
      velocity.current.z *= 1 - GROUND_FRICTION

      let moveForward = 0
      let moveLeft = 0
      const sprinting = Boolean(
        pressedKeys.current.ShiftLeft || pressedKeys.current.ShiftRight,
      )
      const targetSpeed = WALK_SPEED * (sprinting ? SPRINT_MULTIPLIER : 1)
      const targetAccel = WALK_ACCEL * (sprinting ? SPRINT_MULTIPLIER : 1)
      if (pressedKeys.current.KeyW) moveForward += 1
      if (pressedKeys.current.KeyS) moveForward -= 1
      if (pressedKeys.current.KeyA) moveLeft += 1
      if (pressedKeys.current.KeyD) moveLeft -= 1

      const moveMagnitude = Math.hypot(moveForward, moveLeft)
      if (moveMagnitude > 1) {
        moveForward /= moveMagnitude
        moveLeft /= moveMagnitude
      }

      tempMove.set(
        -moveLeft * Math.cos(yaw.current) - moveForward * Math.sin(yaw.current),
        0,
        moveLeft * Math.sin(yaw.current) - moveForward * Math.cos(yaw.current),
      )

      velocity.current.addScaledVector(tempMove, targetAccel * FIXED_DT)

      tempStep.set(velocity.current.x, 0, velocity.current.z)
      if (tempStep.lengthSq() > targetSpeed * targetSpeed) {
        tempStep.setLength(targetSpeed)
        velocity.current.x = tempStep.x
        velocity.current.z = tempStep.z
      }

      const stepDistance = bodyPosition.current.distanceTo(
        previousBodyPosition.current,
      )
      const targetBobMagnitude = stepDistance / FIXED_DT
      bobMagnitude.current =
        bobMagnitude.current * (1 - BOB_DAMP) + targetBobMagnitude * BOB_DAMP
      if (bobMagnitude.current < BOB_MIN) {
        bobPhase.current = 0
      } else {
        bobPhase.current += BOB_FREQ * FIXED_DT
        if (bobPhase.current > TAU) {
          bobPhase.current -= TAU
        }
      }

      activeCamera.rotation.order = 'YXZ'
      activeCamera.position.copy(bodyPosition.current)
      activeCamera.rotation.set(pitch.current, yaw.current, 0)
      activeCamera.updateMatrixWorld(true)

      if (blockedPortalIndex.current !== null) {
        const blockedPortal = portalMeshes.current[blockedPortalIndex.current]
        if (
          blockedPortal &&
          Math.abs(
            getPortalPlaneDistance(bodyPosition.current, blockedPortal),
          ) >
            PLAYER_RADIUS + PORTAL_PUSH
        ) {
          blockedPortalIndex.current = null
        }
      }

      let traversed = false

      for (
        let index = 0;
        index < config.portals.length && !traversed;
        index += 1
      ) {
        if (blockedPortalIndex.current === index) {
          continue
        }

        const sourceMesh = portalMeshes.current[index]
        if (!sourceMesh) {
          continue
        }

        const targetIndex = getPortalTargetIndex(
          {
            backTargetIndex: config.portals[index].backTargetIndex,
            frontTargetIndex: config.portals[index].frontTargetIndex,
            camera: portalCameras[index],
            mesh: sourceMesh,
            renderTargets: portalTargets[index],
          },
          previousBodyPosition.current,
        )
        const targetMesh = portalMeshes.current[targetIndex]
        const scaleRatio = targetMesh
          ? getPortalPlaneScaleRatio(sourceMesh, targetMesh)
          : 1
        traversed = tryTraversePortal(
          previousBodyPosition.current,
          bodyPosition.current,
          activeCamera,
          sourceMesh,
          targetMesh,
          velocity.current,
        )

        if (traversed) {
          blockedPortalIndex.current = targetIndex

          if (
            scaleTransitionDuration > 0 &&
            Math.abs(Math.log(scaleRatio)) > SCALE_TRANSITION_MIN_RATIO_DELTA
          ) {
            scaleTransitionElapsed.current = 0
            scaleTransitionStartZoom.current = THREE.MathUtils.clamp(
              1 / scaleRatio,
              SCALE_TRANSITION_MIN_ZOOM,
              SCALE_TRANSITION_MAX_ZOOM,
            )
            activeCamera.zoom = scaleTransitionStartZoom.current
            activeCamera.updateProjectionMatrix()
          }
        }
      }

      if (traversed) {
        bobMagnitude.current = 0
        bobPhase.current = 0
      }

      bodyPosition.current.copy(activeCamera.position)
      bodyPosition.current.y = config.sampleCameraHeight
        ? config.sampleCameraHeight(
            bodyPosition.current.x,
            bodyPosition.current.z,
          )
        : bodyHeight
      cameraEuler.current.setFromQuaternion(activeCamera.quaternion, 'YXZ')
      yaw.current = wrapAngle(cameraEuler.current.y)
      pitch.current = clampPitch(cameraEuler.current.x)
    }

    if (
      scaleTransitionDuration > 0 &&
      scaleTransitionElapsed.current < scaleTransitionDuration
    ) {
      scaleTransitionElapsed.current = Math.min(
        scaleTransitionElapsed.current + delta,
        scaleTransitionDuration,
      )
      const progress = scaleTransitionElapsed.current / scaleTransitionDuration
      const eased = progress * progress * (3 - 2 * progress)
      activeCamera.zoom = THREE.MathUtils.lerp(
        scaleTransitionStartZoom.current,
        1,
        eased,
      )
      activeCamera.updateProjectionMatrix()
    } else if (activeCamera.zoom !== 1) {
      activeCamera.zoom = 1
      activeCamera.updateProjectionMatrix()
    }

    activeCamera.rotation.order = 'YXZ'
    activeCamera.position.copy(bodyPosition.current)
    activeCamera.position.y += getBobOffset(
      bobMagnitude.current,
      bobPhase.current,
    )
    activeCamera.rotation.set(pitch.current, yaw.current, 0)
    activeCamera.updateMatrixWorld(true)

    if (playerCubeRef.current) {
      playerCubeRef.current.position.set(
        bodyPosition.current.x,
        bodyPosition.current.y - PLAYER_CUBE_EYE_OFFSET,
        bodyPosition.current.z,
      )
      playerCubeRef.current.rotation.set(0, yaw.current, 0)
    }

    const renderer = gl as THREE.WebGLRenderer
    const xrEnabled = renderer.xr.enabled
    setRendererXrEnabled(renderer, false)

    if (
      !renderPortals ||
      !portalGeometry ||
      portalMeshes.current.some((mesh) => !mesh)
    ) {
      renderer.setRenderTarget(null)
      renderer.clear(true, true, true)
      renderer.render(scene, activeCamera)
      setRendererXrEnabled(renderer, xrEnabled)
      return
    }

    const portals: PortalRuntime[] = config.portals.map((portal, index) => ({
      backTargetIndex: portal.backTargetIndex,
      frontTargetIndex: portal.frontTargetIndex,
      camera: portalCameras[index],
      mesh: portalMeshes.current[index]!,
      renderTargets: portalTargets[index],
    }))
    updateCameraNearFromPortals(activeCamera, portals)
    renderRecursivePortals(
      renderer,
      scene,
      activeCamera,
      portals,
      recursionDepth,
    )
    setRendererXrEnabled(renderer, xrEnabled)

    cameraSampleTimer.current += delta
    if (cameraSampleTimer.current >= 0.1) {
      cameraSampleTimer.current = 0
      onCameraChange({
        pitch: pitch.current,
        x: bodyPosition.current.x,
        y: bodyPosition.current.y,
        yaw: yaw.current,
        z: bodyPosition.current.z,
      })
    }
  }, 1)

  if (!portalGeometry) {
    return null
  }

  return (
    <>
      <color attach="background" args={[config.backgroundColor]} />

      {config.skyTexture && textures.get(config.skyTexture) && (
        <SpaceSky texture={textures.get(config.skyTexture)!} />
      )}

      {config.meshes.map((mesh) => {
        const parsedMesh = parsedMeshes.get(mesh.source)
        const texture = mesh.texture ? textures.get(mesh.texture) : undefined
        if (!parsedMesh) {
          return null
        }

        return (
          <mesh
            key={mesh.id}
            geometry={parsedMesh.geometry}
            position={mesh.position}
            rotation={mesh.rotation}
            scale={mesh.scale}
          >
            <MeshTextureMaterial atlas={mesh.textureAtlas} texture={texture} />
          </mesh>
        )
      })}

      {renderPortals &&
        config.portals.map((portal, index) => (
          <mesh
            key={index}
            ref={(mesh) => {
              portalMeshes.current[index] = mesh
            }}
            geometry={portalGeometry}
            position={portal.position}
            rotation={portal.rotation}
            scale={portal.scale}
          >
            <primitive object={portalMaterials[index]} attach="material" />
          </mesh>
        ))}

      {config.showPlayerCube && (
        <mesh ref={playerCubeRef} scale={PLAYER_CUBE_SIZE}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#f3e37c" toneMapped={false} />
        </mesh>
      )}
    </>
  )
}

export default function NonEuclideanScenePage({
  config,
}: {
  config: NonEuclideanSceneConfig
}) {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const [cameraState, setCameraState] = useState<CameraState>({
    pitch: config.spawnPitch ?? 0,
    x: config.spawnPosition.x,
    y: config.spawnPosition.y,
    yaw: config.spawnYaw ?? 0,
    z: config.spawnPosition.z,
  })
  const spawnOverride = useMemo(
    () =>
      resolveSceneCameraOverride(
        config.spawnPosition,
        config.spawnYaw ?? 0,
        config.spawnPitch ?? 0,
        params,
      ),
    [config, params],
  )
  const hideHud = searchParams.get('hud') === '0'
  const renderPortals = searchParams.get('portals') !== '0'

  useEffect(() => {
    document.body.dataset.nonEuclideanReady = '0'
    return () => {
      delete document.body.dataset.nonEuclideanReady
    }
  }, [])

  const handleReady = useCallback(() => {
    document.body.dataset.nonEuclideanReady = '1'
  }, [])

  const handleLockChange = useCallback(() => {}, [])

  return (
    <div className="non-euclidean-page">
      <div className="non-euclidean-viewport">
        <Canvas
          camera={{
            fov: ENGINE_FOV,
            near: 0.05,
            far: config.cameraFar,
            position: [
              config.spawnPosition.x,
              config.spawnPosition.y,
              config.spawnPosition.z,
            ],
          }}
          frameloop="always"
          gl={{ antialias: false }}
        >
          <SceneWorld
            config={config}
            onCameraChange={setCameraState}
            onLockChange={handleLockChange}
            onReady={handleReady}
            renderPortals={renderPortals}
            spawnOverride={spawnOverride}
          />
        </Canvas>
      </div>

      {!hideHud && (
        <div className="non-euclidean-ui">
          <p className="non-euclidean-title">{config.title.toUpperCase()}</p>
          <p className="non-euclidean-copy">
            current position: x={cameraState.x.toFixed(3)} y=
            {cameraState.y.toFixed(3)} z={cameraState.z.toFixed(3)} yaw=
            {cameraState.yaw.toFixed(4)} pitch={cameraState.pitch.toFixed(4)}
          </p>

          <div className="non-euclidean-links">
            <Link to="/non-euclidean">all demos</Link>
          </div>
        </div>
      )}
    </div>
  )
}

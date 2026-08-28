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
  createPortalMaterial,
  ENGINE_FOV,
  getPortalPlaneDistance,
  getPortalTargetIndex,
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

const HOUSE_1_POSITION = new THREE.Vector3(0, 0, -20)
const HOUSE_2_POSITION = new THREE.Vector3(200, 0, -20)
const HOUSE_SCALE = new THREE.Vector3(1, 3, 1)
const RECURSION_DEPTH = 4
const PORTAL_RENDER_SIZE = 2048
const CAMERA_FAR = 100
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

const tempMove = new THREE.Vector3()
const tempStep = new THREE.Vector3()

const PORTAL_CONFIGS = [
  {
    backTargetIndex: 2,
    frontTargetIndex: 1,
    position: new THREE.Vector3(10, 1.5, -4),
    rotation: new THREE.Euler(0, Math.PI / 2, 0),
  },
  {
    backTargetIndex: 0,
    frontTargetIndex: 2,
    position: new THREE.Vector3(216, 1.5, -10),
    rotation: new THREE.Euler(0, -Math.PI, 0),
  },
  {
    backTargetIndex: 1,
    frontTargetIndex: 0,
    position: new THREE.Vector3(204, 1.5, -10),
    rotation: new THREE.Euler(0, 0, 0),
  },
] as const

const skyVertexShader = `
varying vec3 vWorldDirection;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldDirection = normalize(worldPosition.xyz - cameraPosition);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const skyFragmentShader = `
precision highp float;

#define LIGHT vec3(0.36, 0.80, 0.48)
#define SUN_SIZE 0.002
#define SUN_SHARPNESS 1.0

varying vec3 vWorldDirection;

void main() {
  vec3 n = normalize(vWorldDirection);
  float h = (1.0 - n.y) * (1.0 - n.y) * 0.5;
  vec3 sky = vec3(0.2 + h, 0.5 + h, 1.0);
  float s = dot(n, LIGHT) - 1.0 + SUN_SIZE;
  float sun = min(exp(s * SUN_SHARPNESS / SUN_SIZE), 1.0);
  gl_FragColor = vec4(max(sky, sun), 1.0);
}
`

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

  position.y = PLAYER_HEIGHT
}

function EngineSky() {
  const { camera } = useThree()
  const skyRef = useRef<THREE.Mesh>(null)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        depthWrite: false,
        fragmentShader: skyFragmentShader,
        side: THREE.BackSide,
        toneMapped: false,
        vertexShader: skyVertexShader,
      }),
    [],
  )

  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    if (skyRef.current) {
      skyRef.current.position.copy(camera.position)
    }
  })

  return (
    <mesh ref={skyRef}>
      <sphereGeometry args={[80, 24, 24]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

interface Level26WorldProps {
  onCameraChange: (cameraState: CameraState) => void
  onLockChange: (locked: boolean) => void
  onReady: () => void
  renderPortals: boolean
  spawnOverride: ReturnType<typeof resolveCameraOverride>
}

interface CameraState {
  pitch: number
  x: number
  y: number
  yaw: number
  z: number
}

function Level26World({
  onCameraChange,
  onLockChange,
  onReady,
  renderPortals,
  spawnOverride,
}: Level26WorldProps) {
  const { camera, gl, scene } = useThree()
  const houseSource = useLoader(
    THREE.FileLoader,
    '/non-euclidean/engine/square_rooms.obj',
  ) as string
  const portalSource = useLoader(
    THREE.FileLoader,
    '/non-euclidean/engine/double_quad.obj',
  ) as string
  const houseTextureA = useLoader(
    THREE.TextureLoader,
    '/non-euclidean/engine/three_room.bmp',
  )
  const houseTextureB = useLoader(
    THREE.TextureLoader,
    '/non-euclidean/engine/three_room2.bmp',
  )
  const parsedMesh = useMemo(() => parseEngineMesh(houseSource), [houseSource])
  const portalGeometry = useMemo(
    () => parseEngineMesh(portalSource).geometry,
    [portalSource],
  )
  const colliders = useMemo(() => {
    let result = [
      ...buildWorldColliders(parsedMesh.colliders, {
        position: HOUSE_1_POSITION,
        scale: HOUSE_SCALE,
      }),
      ...buildWorldColliders(parsedMesh.colliders, {
        position: HOUSE_2_POSITION,
        scale: HOUSE_SCALE,
      }),
    ]

    for (const portal of PORTAL_CONFIGS) {
      result = carvePortalColliderOpening(
        result,
        portal.position,
        portal.rotation.y,
        2,
      )
    }

    return result
  }, [parsedMesh.colliders])
  const portalMeshes = useRef<Array<THREE.Mesh | null>>([null, null, null])
  const portalTargets = useMemo(
    () => PORTAL_CONFIGS.map(() => createRenderTargets()),
    [],
  )
  const portalCameras = useMemo(
    () =>
      PORTAL_CONFIGS.map(
        () => new THREE.PerspectiveCamera(ENGINE_FOV, 1, 0.05, CAMERA_FAR),
      ),
    [],
  )
  const portalMaterials = useMemo(
    () => PORTAL_CONFIGS.map(() => createPortalMaterial()),
    [],
  )
  const bodyPosition = useRef(new THREE.Vector3(3, PLAYER_HEIGHT, 3))
  const previousBodyPosition = useRef(new THREE.Vector3(3, PLAYER_HEIGHT, 3))
  const velocity = useRef(new THREE.Vector3())
  const cameraSampleTimer = useRef(0)
  const fixedStepRemainder = useRef(0)
  const mouseDelta = useRef({ x: 0, y: 0 })
  const pressedKeys = useRef<Record<string, boolean>>({})
  const yaw = useRef(0)
  const pitch = useRef(0)
  const bobMagnitude = useRef(0)
  const bobPhase = useRef(0)
  const lockedRef = useRef(false)
  const cameraEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const blockedPortalIndex = useRef<number | null>(null)

  useEffect(() => {
    setupTexture(houseTextureA)
    setupTexture(houseTextureB)

    const activeCamera = camera as THREE.PerspectiveCamera
    // eslint-disable-next-line react-hooks/immutability
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
    activeCamera.updateMatrixWorld(true)

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
    camera,
    gl,
    houseTextureA,
    houseTextureB,
    onCameraChange,
    onReady,
    portalMaterials,
    portalTargets,
    spawnOverride,
  ])

  useEffect(() => {
    const target = gl.domElement

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
  }, [gl.domElement])

  useEffect(() => {
    const target = gl.domElement
    // eslint-disable-next-line react-hooks/immutability
    target.tabIndex = 0
    // eslint-disable-next-line react-hooks/immutability
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
  }, [gl.domElement, onLockChange])

  useFrame((_, delta) => {
    const activeCamera = camera as THREE.PerspectiveCamera

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
      moveBody(bodyPosition.current, velocity.current, FIXED_DT, colliders)

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

      // eslint-disable-next-line react-hooks/immutability
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
        index < PORTAL_CONFIGS.length && !traversed;
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
            backTargetIndex: PORTAL_CONFIGS[index].backTargetIndex,
            frontTargetIndex: PORTAL_CONFIGS[index].frontTargetIndex,
            camera: portalCameras[index],
            mesh: sourceMesh,
            renderTargets: portalTargets[index],
          },
          previousBodyPosition.current,
        )
        const targetMesh = portalMeshes.current[targetIndex]
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
        }
      }

      if (traversed) {
        bobMagnitude.current = 0
        bobPhase.current = 0
      }

      bodyPosition.current.copy(activeCamera.position)
      bodyPosition.current.y = PLAYER_HEIGHT
      cameraEuler.current.setFromQuaternion(activeCamera.quaternion, 'YXZ')
      yaw.current = wrapAngle(cameraEuler.current.y)
      pitch.current = clampPitch(cameraEuler.current.x)
    }

    activeCamera.rotation.order = 'YXZ'
    activeCamera.position.copy(bodyPosition.current)
    activeCamera.position.y += getBobOffset(
      bobMagnitude.current,
      bobPhase.current,
    )
    activeCamera.rotation.set(pitch.current, yaw.current, 0)
    activeCamera.updateMatrixWorld(true)

    const renderer = gl as THREE.WebGLRenderer
    const xrEnabled = renderer.xr.enabled
    setRendererXrEnabled(renderer, false)

    if (!renderPortals || portalMeshes.current.some((mesh) => !mesh)) {
      renderer.setRenderTarget(null)
      renderer.clear(true, true, true)
      renderer.render(scene, activeCamera)
      setRendererXrEnabled(renderer, xrEnabled)
      return
    }

    const portals: PortalRuntime[] = PORTAL_CONFIGS.map((portal, index) => ({
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
      RECURSION_DEPTH,
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

  return (
    <>
      <color attach="background" args={['#6e9fff']} />

      <EngineSky />

      <mesh
        geometry={parsedMesh.geometry}
        position={HOUSE_1_POSITION}
        scale={HOUSE_SCALE}
      >
        <meshBasicMaterial
          map={houseTextureA}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh
        geometry={parsedMesh.geometry}
        position={HOUSE_2_POSITION}
        scale={HOUSE_SCALE}
      >
        <meshBasicMaterial
          map={houseTextureB}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {renderPortals &&
        PORTAL_CONFIGS.map((portal, index) => (
          <mesh
            key={index}
            ref={(mesh) => {
              portalMeshes.current[index] = mesh
            }}
            geometry={portalGeometry}
            position={portal.position}
            rotation={portal.rotation}
            scale={[2, 1.5, 1]}
          >
            <primitive object={portalMaterials[index]} attach="material" />
          </mesh>
        ))}
    </>
  )
}

export default function NonEuclideanLevel26() {
  const params = useParams()
  const { x, y, z, yaw, pitch } = params
  const [searchParams] = useSearchParams()
  const [cameraState, setCameraState] = useState<CameraState>({
    pitch: 0,
    x: 3,
    y: PLAYER_HEIGHT,
    yaw: 0,
    z: 3,
  })
  const spawnOverride = useMemo(
    () =>
      resolveCameraOverride(new THREE.Vector3(3, PLAYER_HEIGHT, 3), 0, 0, {
        x,
        y,
        z,
        yaw,
        pitch,
      }),
    [pitch, x, y, yaw, z],
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
            far: CAMERA_FAR,
            position: [3, PLAYER_HEIGHT, 3],
          }}
          frameloop="always"
          gl={{ antialias: false }}
        >
          <Level26World
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
          <p className="non-euclidean-title">LEVEL2(6)</p>
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

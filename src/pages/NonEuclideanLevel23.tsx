import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import './NonEuclidean.css'
import {
  carvePortalColliderOpening,
  createPortalMaterial,
  ENGINE_FOV,
  getPortalPlaneDistance,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PORTAL_PUSH,
  PORTAL_LAYER,
  buildWorldColliders,
  collides,
  parseEngineMesh,
  resolveCameraOverride,
  renderRecursivePortals,
  setRendererLocalClipping,
  setRendererXrEnabled,
  setupTexture,
  tryTraversePortal,
  updateCameraNearFromPortals,
} from './nonEuclideanEngine'
import type { PortalRuntime } from './nonEuclideanEngine'

const HOUSE_POSITION = new THREE.Vector3(0, 0, -20)
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

const DOOR_3_POSITION = new THREE.Vector3(16, 1.5, -10)
const DOOR_4_POSITION = new THREE.Vector3(10, 1.5, -4)
const DOOR_3_ROTATION = new THREE.Euler(0, -Math.PI, 0)
const DOOR_4_ROTATION = new THREE.Euler(0, Math.PI / 2, 0)

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
  return Array.from({ length: RECURSION_DEPTH }, () => new THREE.WebGLRenderTarget(PORTAL_RENDER_SIZE, PORTAL_RENDER_SIZE, {
    depthBuffer: true,
    stencilBuffer: false,
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestFilter,
  }))
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
  colliders: ReturnType<typeof buildWorldColliders>,
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
  const material = useMemo(() => new THREE.ShaderMaterial({
    depthWrite: false,
    fragmentShader: skyFragmentShader,
    side: THREE.BackSide,
    toneMapped: false,
    vertexShader: skyVertexShader,
  }), [])

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

interface Level23WorldProps {
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

function Level23World({ onCameraChange, onLockChange, onReady, renderPortals, spawnOverride }: Level23WorldProps) {
  const { camera, gl, scene } = useThree()
  const houseSource = useLoader(THREE.FileLoader, '/non-euclidean/engine/square_rooms.obj') as string
  const portalSource = useLoader(THREE.FileLoader, '/non-euclidean/engine/double_quad.obj') as string
  const houseTexture = useLoader(THREE.TextureLoader, '/non-euclidean/engine/three_room.bmp')
  const parsedMesh = useMemo(() => parseEngineMesh(houseSource), [houseSource])
  const portalGeometry = useMemo(() => parseEngineMesh(portalSource).geometry, [portalSource])
  const colliders = useMemo(
    () => {
      let result = buildWorldColliders(parsedMesh.colliders, { position: HOUSE_POSITION, scale: HOUSE_SCALE })
      result = carvePortalColliderOpening(result, DOOR_3_POSITION, DOOR_3_ROTATION.y, 2)
      result = carvePortalColliderOpening(result, DOOR_4_POSITION, DOOR_4_ROTATION.y, 2)
      return result
    },
    [parsedMesh.colliders],
  )
  const portalMeshA = useRef<THREE.Mesh>(null)
  const portalMeshB = useRef<THREE.Mesh>(null)
  const portalTargetsA = useMemo(() => createRenderTargets(), [])
  const portalTargetsB = useMemo(() => createRenderTargets(), [])
  const portalCameraA = useMemo(() => new THREE.PerspectiveCamera(ENGINE_FOV, 1, 0.05, CAMERA_FAR), [])
  const portalCameraB = useMemo(() => new THREE.PerspectiveCamera(ENGINE_FOV, 1, 0.05, CAMERA_FAR), [])
  const portalMaterialA = useMemo(() => createPortalMaterial(), [])
  const portalMaterialB = useMemo(() => createPortalMaterial(), [])
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
    setupTexture(houseTexture)

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
    portalMeshA.current?.layers.set(PORTAL_LAYER)
    portalMeshB.current?.layers.set(PORTAL_LAYER)

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
      for (const target of [...portalTargetsA, ...portalTargetsB]) {
        target.dispose()
      }
      portalMaterialA.dispose()
      portalMaterialB.dispose()
    }
  }, [camera, gl, houseTexture, onCameraChange, onReady, portalMaterialA, portalMaterialB, portalTargetsA, portalTargetsB, spawnOverride])

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

    yaw.current = wrapAngle(yaw.current - mouseDelta.current.x * MOUSE_SENSITIVITY)
    pitch.current = clampPitch(pitch.current - mouseDelta.current.y * MOUSE_SENSITIVITY)
    mouseDelta.current.x = 0
    mouseDelta.current.y = 0

    fixedStepRemainder.current += Math.min(delta, FIXED_DT * MAX_STEPS)

    for (let step = 0; fixedStepRemainder.current >= FIXED_DT && step < MAX_STEPS; step += 1) {
      fixedStepRemainder.current -= FIXED_DT
      previousBodyPosition.current.copy(bodyPosition.current)

      velocity.current.multiplyScalar(1 - PLAYER_DRAG)
      moveBody(bodyPosition.current, velocity.current, FIXED_DT, colliders)

      velocity.current.x *= 1 - GROUND_FRICTION
      velocity.current.z *= 1 - GROUND_FRICTION

      let moveForward = 0
      let moveLeft = 0
      const sprinting = Boolean(pressedKeys.current.ShiftLeft || pressedKeys.current.ShiftRight)
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

      const stepDistance = bodyPosition.current.distanceTo(previousBodyPosition.current)
      const targetBobMagnitude = stepDistance / FIXED_DT
      bobMagnitude.current = bobMagnitude.current * (1 - BOB_DAMP) + targetBobMagnitude * BOB_DAMP
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

      if (blockedPortalIndex.current === 0 && portalMeshA.current) {
        if (Math.abs(getPortalPlaneDistance(bodyPosition.current, portalMeshA.current)) > PLAYER_RADIUS + PORTAL_PUSH) {
          blockedPortalIndex.current = null
        }
      } else if (blockedPortalIndex.current === 1 && portalMeshB.current) {
        if (Math.abs(getPortalPlaneDistance(bodyPosition.current, portalMeshB.current)) > PLAYER_RADIUS + PORTAL_PUSH) {
          blockedPortalIndex.current = null
        }
      }

      let traversed = false

      if (blockedPortalIndex.current !== 0) {
        traversed = tryTraversePortal(
          previousBodyPosition.current,
          bodyPosition.current,
          activeCamera,
          portalMeshA.current,
          portalMeshB.current,
          velocity.current,
        )
        if (traversed) {
          blockedPortalIndex.current = 1
        }
      }

      if (!traversed && blockedPortalIndex.current !== 1) {
        traversed = tryTraversePortal(
          previousBodyPosition.current,
          bodyPosition.current,
          activeCamera,
          portalMeshB.current,
          portalMeshA.current,
          velocity.current,
        )
        if (traversed) {
          blockedPortalIndex.current = 0
        }
      }

      if (traversed) {
        // Crossing a portal should not leave the camera mid-bob from the source room.
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
    activeCamera.position.y += getBobOffset(bobMagnitude.current, bobPhase.current)
    activeCamera.rotation.set(pitch.current, yaw.current, 0)
    activeCamera.updateMatrixWorld(true)

    const renderer = gl as THREE.WebGLRenderer
    const xrEnabled = renderer.xr.enabled
    setRendererXrEnabled(renderer, false)

    if (!portalMeshA.current || !portalMeshB.current || !renderPortals) {
      renderer.setRenderTarget(null)
      renderer.clear(true, true, true)
      renderer.render(scene, activeCamera)
      setRendererXrEnabled(renderer, xrEnabled)
      return
    }

    const portals: PortalRuntime[] = [
      { mesh: portalMeshA.current, frontTargetIndex: 1, backTargetIndex: 1, camera: portalCameraA, renderTargets: portalTargetsA },
      { mesh: portalMeshB.current, frontTargetIndex: 0, backTargetIndex: 0, camera: portalCameraB, renderTargets: portalTargetsB },
    ]
    updateCameraNearFromPortals(activeCamera, portals)
    renderRecursivePortals(renderer, scene, activeCamera, portals, RECURSION_DEPTH)
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

      <mesh geometry={parsedMesh.geometry} position={HOUSE_POSITION} scale={HOUSE_SCALE}>
        <meshBasicMaterial map={houseTexture} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>

      {renderPortals && <mesh ref={portalMeshA} geometry={portalGeometry} position={DOOR_3_POSITION} rotation={DOOR_3_ROTATION} scale={[2, 1.5, 1]}>
        <primitive object={portalMaterialA} attach="material" />
      </mesh>}

      {renderPortals && <mesh ref={portalMeshB} geometry={portalGeometry} position={DOOR_4_POSITION} rotation={DOOR_4_ROTATION} scale={[2, 1.5, 1]}>
        <primitive object={portalMaterialB} attach="material" />
      </mesh>}
    </>
  )
}

export default function NonEuclideanLevel23() {
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
    () => resolveCameraOverride(new THREE.Vector3(3, PLAYER_HEIGHT, 3), 0, 0, { x, y, z, yaw, pitch }),
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
          camera={{ fov: ENGINE_FOV, near: 0.05, far: CAMERA_FAR, position: [3, PLAYER_HEIGHT, 3] }}
          frameloop="always"
          gl={{ antialias: false }}
        >
          <Level23World
            onCameraChange={setCameraState}
            onLockChange={handleLockChange}
            onReady={handleReady}
            renderPortals={renderPortals}
            spawnOverride={spawnOverride}
          />
        </Canvas>
      </div>

      {!hideHud && <div className="non-euclidean-ui">
        <p className="non-euclidean-title">LEVEL2(3)</p>
        <p className="non-euclidean-copy">
          current position: x={cameraState.x.toFixed(3)} y={cameraState.y.toFixed(3)} z={cameraState.z.toFixed(3)} yaw={cameraState.yaw.toFixed(4)} pitch={cameraState.pitch.toFixed(4)}
        </p>

        <div className="non-euclidean-links">
          <Link to="/non-euclidean">all demos</Link>
        </div>
      </div>}
    </div>
  )
}

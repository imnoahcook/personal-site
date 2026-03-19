import * as THREE from 'three'

export interface Collider2D {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface EngineMeshData {
  geometry: THREE.BufferGeometry
  colliders: Collider2D[]
}

export interface PortalRuntime {
  backTargetIndex: number
  camera: THREE.PerspectiveCamera
  frontTargetIndex: number
  mesh: THREE.Mesh
  renderTargets: THREE.WebGLRenderTarget[]
}

export const PLAYER_HEIGHT = 1.5
export const PLAYER_RADIUS = 0.2
export const PORTAL_PUSH = 0.12
export const ENGINE_FOV = 60
export const NEAR_MIN = 1e-3
export const NEAR_MAX = 1e-1
export const WORLD_LAYER = 0
export const PORTAL_LAYER = 1
const COLLIDER_THICKNESS = 0.08

const tempSourceInverse = new THREE.Matrix4()
const tempWarpMatrix = new THREE.Matrix4()
const tempScale = new THREE.Vector3()
const tempIntersect = new THREE.Vector3()
const tempTargetQuat = new THREE.Quaternion()
const tempPortalNormal = new THREE.Vector3()
const tempPortalPosition = new THREE.Vector3()
const tempToPortal = new THREE.Vector3()
const tempClipPlane = new THREE.Plane()
const tempClipVector = new THREE.Vector4()
const tempQVector = new THREE.Vector4()
const tempClosestPoint = new THREE.Vector3()
const tempXAxis = new THREE.Vector3()
const tempYAxis = new THREE.Vector3()
const tempPortalWorld = new THREE.Matrix4()
const tempAxisScale = new THREE.Vector3()
const tempPrevWorld = new THREE.Vector3()
const tempCurWorld = new THREE.Vector3()
const tempPortalXAxis = new THREE.Vector3()
const tempPortalYAxis = new THREE.Vector3()
const tempPortalBump = new THREE.Vector3()
const portalVertexShader = `
varying vec4 vClipPosition;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vClipPosition = gl_Position;
}
`

const portalFragmentShader = `
#include <common>

uniform sampler2D tex;
uniform vec3 fallbackColor;
uniform bool useTexture;
varying vec4 vClipPosition;

void main() {
  vec4 color = vec4(fallbackColor, 1.0);

  if (!useTexture) {
    gl_FragColor = linearToOutputTexel(color);
  } else {
    vec2 uv = (vClipPosition.xy / vClipPosition.w) * 0.5 + 0.5;
    color = vec4(texture2D(tex, uv).rgb, 1.0);
    gl_FragColor = linearToOutputTexel(color);
  }
}
`

export function createPortalMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      fallbackColor: { value: new THREE.Color('#ff00aa') },
      tex: { value: null as THREE.Texture | null },
      useTexture: { value: false },
    },
    fragmentShader: portalFragmentShader,
    toneMapped: false,
    vertexShader: portalVertexShader,
  })
}

export function setupTexture(texture: THREE.Texture, repeatX = 1, repeatY = 1) {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
}

export function setRendererLocalClipping(renderer: THREE.WebGLRenderer, enabled: boolean) {
  renderer.localClippingEnabled = enabled
}

export function setRendererXrEnabled(renderer: THREE.WebGLRenderer, enabled: boolean) {
  renderer.xr.enabled = enabled
}

export function setRendererClippingPlanes(renderer: THREE.WebGLRenderer, clippingPlanes: THREE.Plane[]) {
  renderer.clippingPlanes = clippingPlanes
}

export function getMovementBasis(camera: THREE.PerspectiveCamera) {
  const forward = new THREE.Vector3()
  const side = new THREE.Vector3()
  camera.getWorldDirection(forward)
  forward.y = 0
  forward.normalize()
  side.crossVectors(camera.up, forward).normalize()
  return { forward, side }
}

export interface CameraOverride {
  pitch: number
  position: THREE.Vector3
  yaw: number
}

interface CameraOverrideInput {
  pitch?: string
  x?: string
  y?: string
  yaw?: string
  z?: string
}

export function resolveCameraOverride(
  defaultPosition: THREE.Vector3,
  defaultYaw = 0,
  defaultPitch = 0,
  raw?: CameraOverrideInput,
): CameraOverride {
  const readNumber = (value: string | undefined, fallback: number) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const y = Math.max(readNumber(raw?.y, defaultPosition.y), PLAYER_HEIGHT)

  return {
    position: new THREE.Vector3(
      readNumber(raw?.x, defaultPosition.x),
      y,
      readNumber(raw?.z, defaultPosition.z),
    ),
    yaw: readNumber(raw?.yaw, defaultYaw),
    pitch: readNumber(raw?.pitch, defaultPitch),
  }
}

export function applyCameraOverride(camera: THREE.PerspectiveCamera, override: CameraOverride) {
  camera.rotation.order = 'YXZ'
  camera.position.copy(override.position)
  camera.rotation.set(override.pitch, override.yaw, 0)
  camera.updateMatrixWorld(true)
}

export function getNearestPortalDistance(cameraPosition: THREE.Vector3, portals: PortalRuntime[]) {
  let nearest = Infinity

  for (const portal of portals) {
    portal.mesh.updateWorldMatrix(true, false)
    tempPortalWorld.copy(portal.mesh.matrixWorld)
    tempPortalWorld.decompose(tempPortalPosition, tempTargetQuat, tempAxisScale)
    tempXAxis.setFromMatrixColumn(tempPortalWorld, 0)
    tempYAxis.setFromMatrixColumn(tempPortalWorld, 1)

    const delta = tempClosestPoint.copy(cameraPosition).sub(tempPortalPosition)
    const xDot = delta.dot(tempXAxis)
    const yDot = delta.dot(tempYAxis)
    const xMagSq = tempXAxis.lengthSq()
    const yMagSq = tempYAxis.lengthSq()
    const clampedX = THREE.MathUtils.clamp(xDot / (xMagSq || 1), -1, 1)
    const clampedY = THREE.MathUtils.clamp(yDot / (yMagSq || 1), -1, 1)

    tempClosestPoint.copy(tempPortalPosition)
      .addScaledVector(tempXAxis, clampedX)
      .addScaledVector(tempYAxis, clampedY)

    nearest = Math.min(nearest, tempClosestPoint.distanceTo(cameraPosition))
  }

  return nearest
}

export function updateCameraNearFromPortals(camera: THREE.PerspectiveCamera, portals: PortalRuntime[]) {
  const nearest = getNearestPortalDistance(camera.position, portals)
  const near = THREE.MathUtils.clamp(nearest * 0.5, NEAR_MIN, NEAR_MAX)
  camera.near = near
  camera.updateProjectionMatrix()
}

function addTriangle(
  targetPositions: number[],
  targetUvs: number[],
  vertices: number[],
  uvs: number[],
  a: number,
  b: number,
  c: number,
  at: number,
  bt: number,
  ct: number,
) {
  const face = [
    { v: a, uv: at },
    { v: b, uv: bt },
    { v: c, uv: ct },
  ]

  for (const item of face) {
    targetPositions.push(
      vertices[item.v * 3],
      vertices[item.v * 3 + 1],
      vertices[item.v * 3 + 2],
    )
    targetUvs.push(
      uvs[item.uv * 2] ?? 0,
      uvs[item.uv * 2 + 1] ?? 0,
    )
  }
}

function parseFaceToken(token: string) {
  const parts = token.split('/')
  const vertexIndex = Number(parts[0]) - 1
  const uvIndex = parts[1] ? Number(parts[1]) - 1 : vertexIndex
  return { vertexIndex, uvIndex }
}

export function parseEngineMesh(source: string): EngineMeshData {
  const vertexPalette: number[] = []
  const uvPalette: number[] = []
  const positions: number[] = []
  const uvs: number[] = []
  const colliders: Collider2D[] = []

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    if (line.startsWith('v ')) {
      const [x, y, z] = line.slice(2).trim().split(/\s+/).map(Number)
      vertexPalette.push(x, y, z)
      continue
    }

    if (line.startsWith('vt ')) {
      const [u, v] = line.slice(3).trim().split(/\s+/).map(Number)
      uvPalette.push(u, v)
      continue
    }

    if (line.startsWith('f ')) {
      if (line === 'f **') {
        const vertexCount = vertexPalette.length / 3
        const uvCount = uvPalette.length / 2
        if (vertexCount < 4 || uvCount < 4) continue

        const a = vertexCount - 4
        const b = vertexCount - 3
        const c = vertexCount - 2
        const d = vertexCount - 1
        const at = uvCount - 4
        const bt = uvCount - 3
        const ct = uvCount - 2
        const dt = uvCount - 1
        addTriangle(positions, uvs, vertexPalette, uvPalette, a, b, c, at, bt, ct)
        addTriangle(positions, uvs, vertexPalette, uvPalette, c, d, a, ct, dt, at)
        continue
      }

      const tokens = line.slice(2).trim().split(/\s+/).map(parseFaceToken)
      if (tokens.length < 3) continue

      if (tokens.length === 3) {
        addTriangle(
          positions,
          uvs,
          vertexPalette,
          uvPalette,
          tokens[0].vertexIndex,
          tokens[1].vertexIndex,
          tokens[2].vertexIndex,
          tokens[0].uvIndex,
          tokens[1].uvIndex,
          tokens[2].uvIndex,
        )
        continue
      }

      addTriangle(
        positions,
        uvs,
        vertexPalette,
        uvPalette,
        tokens[0].vertexIndex,
        tokens[1].vertexIndex,
        tokens[2].vertexIndex,
        tokens[0].uvIndex,
        tokens[1].uvIndex,
        tokens[2].uvIndex,
      )
      addTriangle(
        positions,
        uvs,
        vertexPalette,
        uvPalette,
        tokens[2].vertexIndex,
        tokens[3].vertexIndex,
        tokens[0].vertexIndex,
        tokens[2].uvIndex,
        tokens[3].uvIndex,
        tokens[0].uvIndex,
      )
      continue
    }

    if (line.startsWith('c ')) {
      const tokens = line.slice(2).trim().split(/\s+/)
      let indices: number[]

      if (tokens[0] === '*') {
        const vertexCount = vertexPalette.length / 3
        if (vertexCount < 3) continue
        indices = [vertexCount - 3, vertexCount - 2, vertexCount - 1]
      } else {
        indices = tokens.slice(0, 3).map((token) => Number(token) - 1)
      }

      const xs = indices.map((index) => vertexPalette[index * 3])
      const ys = indices.map((index) => vertexPalette[index * 3 + 1])
      const zs = indices.map((index) => vertexPalette[index * 3 + 2])
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)

      if (maxY - minY < 0.1) continue

      let minX = Math.min(...xs)
      let maxX = Math.max(...xs)
      let minZ = Math.min(...zs)
      let maxZ = Math.max(...zs)

      if (maxX - minX < COLLIDER_THICKNESS) {
        minX -= COLLIDER_THICKNESS
        maxX += COLLIDER_THICKNESS
      }
      if (maxZ - minZ < COLLIDER_THICKNESS) {
        minZ -= COLLIDER_THICKNESS
        maxZ += COLLIDER_THICKNESS
      }

      colliders.push({ minX, maxX, minZ, maxZ })
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()

  return { geometry, colliders }
}

export function buildWorldColliders(
  localColliders: Collider2D[],
  transform: { position: THREE.Vector3; scale: THREE.Vector3 },
): Collider2D[] {
  return localColliders.map((collider) => {
    const minX = transform.position.x + collider.minX * transform.scale.x
    const maxX = transform.position.x + collider.maxX * transform.scale.x
    const minZ = transform.position.z + collider.minZ * transform.scale.z
    const maxZ = transform.position.z + collider.maxZ * transform.scale.z

    return {
      minX: Math.min(minX, maxX),
      maxX: Math.max(minX, maxX),
      minZ: Math.min(minZ, maxZ),
      maxZ: Math.max(minZ, maxZ),
    }
  })
}

export function carvePortalColliderOpening(
  colliders: Collider2D[],
  portalPosition: THREE.Vector3,
  portalRotationY: number,
  halfWidth: number,
  halfThickness = PLAYER_RADIUS + 0.05,
): Collider2D[] {
  const facingX = Math.abs(Math.sin(portalRotationY)) > 0.5
  const openingMin = (facingX ? portalPosition.z : portalPosition.x) - halfWidth
  const openingMax = (facingX ? portalPosition.z : portalPosition.x) + halfWidth
  const planeMin = (facingX ? portalPosition.x : portalPosition.z) - halfThickness
  const planeMax = (facingX ? portalPosition.x : portalPosition.z) + halfThickness
  const carved: Collider2D[] = []

  for (const collider of colliders) {
    const lateralMin = facingX ? collider.minZ : collider.minX
    const lateralMax = facingX ? collider.maxZ : collider.maxX
    const planeColliderMin = facingX ? collider.minX : collider.minZ
    const planeColliderMax = facingX ? collider.maxX : collider.maxZ
    const intersectsOpening = openingMax > lateralMin && openingMin < lateralMax
    const intersectsPlane = planeMax > planeColliderMin && planeMin < planeColliderMax

    if (!intersectsOpening || !intersectsPlane) {
      carved.push(collider)
      continue
    }

    if (lateralMin < openingMin) {
      carved.push(facingX
        ? { minX: collider.minX, maxX: collider.maxX, minZ: lateralMin, maxZ: openingMin }
        : { minX: lateralMin, maxX: openingMin, minZ: collider.minZ, maxZ: collider.maxZ })
    }

    if (lateralMax > openingMax) {
      carved.push(facingX
        ? { minX: collider.minX, maxX: collider.maxX, minZ: openingMax, maxZ: lateralMax }
        : { minX: openingMax, maxX: lateralMax, minZ: collider.minZ, maxZ: collider.maxZ })
    }
  }

  return carved
}

export function collides(x: number, z: number, colliders: Collider2D[]): boolean {
  return colliders.some((collider) => (
    x + PLAYER_RADIUS > collider.minX &&
    x - PLAYER_RADIUS < collider.maxX &&
    z + PLAYER_RADIUS > collider.minZ &&
    z - PLAYER_RADIUS < collider.maxZ
  ))
}

export function movePlayerCamera(
  camera: THREE.PerspectiveCamera,
  deltaX: number,
  deltaZ: number,
  colliders: Collider2D[],
) {
  const nextX = camera.position.x + deltaX
  const nextZ = camera.position.z + deltaZ

  if (!collides(nextX, camera.position.z, colliders)) {
    camera.position.x = nextX
  }
  if (!collides(camera.position.x, nextZ, colliders)) {
    camera.position.z = nextZ
  }
  camera.position.y = PLAYER_HEIGHT
}

export function applyPortalTransform(
  source: THREE.Object3D,
  target: THREE.Object3D,
  matrixWorld: THREE.Matrix4,
  outPosition: THREE.Vector3,
  outQuaternion: THREE.Quaternion,
) {
  getPortalWarpMatrix(source, target, matrixWorld, tempWarpMatrix)
  tempWarpMatrix.decompose(outPosition, outQuaternion, tempScale)
}

export function getPortalWarpMatrix(
  source: THREE.Object3D,
  target: THREE.Object3D,
  matrixWorld: THREE.Matrix4,
  outMatrix: THREE.Matrix4,
) {
  source.updateWorldMatrix(true, false)
  target.updateWorldMatrix(true, false)
  tempSourceInverse.copy(source.matrixWorld).invert()
  return outMatrix.copy(target.matrixWorld).multiply(tempSourceInverse).multiply(matrixWorld)
}

export function getPortalDeltaMatrix(
  source: THREE.Object3D,
  target: THREE.Object3D,
  outMatrix: THREE.Matrix4,
) {
  source.updateWorldMatrix(true, false)
  target.updateWorldMatrix(true, false)
  tempSourceInverse.copy(source.matrixWorld).invert()
  return outMatrix.copy(target.matrixWorld).multiply(tempSourceInverse)
}

export function applyMatrixToDirection(
  direction: THREE.Vector3,
  matrix: THREE.Matrix4,
  outDirection = direction,
) {
  const elements = matrix.elements
  const x = direction.x
  const y = direction.y
  const z = direction.z

  return outDirection.set(
    elements[0] * x + elements[4] * y + elements[8] * z,
    elements[1] * x + elements[5] * y + elements[9] * z,
    elements[2] * x + elements[6] * y + elements[10] * z,
  )
}

function getPortalNormal(portal: THREE.Object3D) {
  portal.getWorldQuaternion(tempTargetQuat)
  return tempPortalNormal.set(0, 0, -1).applyQuaternion(tempTargetQuat)
}

export function getPortalPlaneDistance(position: THREE.Vector3, portal: THREE.Object3D) {
  portal.updateWorldMatrix(true, false)
  const portalPosition = portal.getWorldPosition(tempPortalPosition)
  const portalNormal = getPortalNormal(portal)
  return tempToPortal.copy(position).sub(portalPosition).dot(portalNormal)
}

export function getPortalTargetIndex(portal: PortalRuntime, position: THREE.Vector3) {
  return getPortalPlaneDistance(position, portal.mesh) > 0
    ? portal.frontTargetIndex
    : portal.backTargetIndex
}

export function updatePortalCamera(
  source: THREE.Object3D,
  target: THREE.Object3D,
  mainCamera: THREE.PerspectiveCamera,
  portalCamera: THREE.PerspectiveCamera,
) {
  getPortalWarpMatrix(source, target, mainCamera.matrixWorld, tempWarpMatrix)

  portalCamera.fov = mainCamera.fov
  portalCamera.near = mainCamera.near
  portalCamera.far = mainCamera.far
  portalCamera.aspect = mainCamera.aspect
  portalCamera.projectionMatrix.copy(mainCamera.projectionMatrix)
  portalCamera.projectionMatrixInverse.copy(mainCamera.projectionMatrixInverse)
  portalCamera.matrixAutoUpdate = false
  portalCamera.matrixWorld.copy(tempWarpMatrix)
  portalCamera.matrixWorldInverse.copy(tempWarpMatrix).invert()
  portalCamera.position.setFromMatrixPosition(tempWarpMatrix)
  portalCamera.quaternion.setFromRotationMatrix(tempWarpMatrix)
  portalCamera.scale.setFromMatrixScale(tempWarpMatrix)
}

export function applyPortalObliqueClip(
  portalCamera: THREE.PerspectiveCamera,
  sourceCamera: THREE.PerspectiveCamera,
  sourcePortal: THREE.Object3D,
  extraClip: number,
) {
  const portalPosition = sourcePortal.getWorldPosition(tempPortalPosition)
  const normal = getPortalNormal(sourcePortal).clone()
  const frontDirection = sourceCamera.position.clone().sub(portalPosition).dot(normal) > 0

  if (frontDirection) {
    normal.multiplyScalar(-1)
  }

  const clipPoint = portalPosition.clone().sub(normal.clone().multiplyScalar(extraClip))
  const clipNormal = normal.clone().multiplyScalar(-1)

  tempClipPlane.setFromNormalAndCoplanarPoint(clipNormal, clipPoint)
  tempClipPlane.applyMatrix4(sourceCamera.matrixWorldInverse)

  tempClipVector.set(
    tempClipPlane.normal.x,
    tempClipPlane.normal.y,
    tempClipPlane.normal.z,
    tempClipPlane.constant,
  )

  const elements = portalCamera.projectionMatrix.elements
  tempQVector.set(
    (Math.sign(tempClipVector.x) + elements[8]) / elements[0],
    (Math.sign(tempClipVector.y) + elements[9]) / elements[5],
    -1,
    (1 + elements[10]) / elements[14],
  )

  tempClipVector.multiplyScalar(2 / tempClipVector.dot(tempQVector))
  elements[2] = tempClipVector.x
  elements[6] = tempClipVector.y
  elements[10] = tempClipVector.z + 1
  elements[14] = tempClipVector.w
  portalCamera.projectionMatrixInverse.copy(portalCamera.projectionMatrix).invert()
}

export function tryTraversePortal(
  prevPosition: THREE.Vector3,
  currentPosition: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  source: THREE.Object3D | null,
  target: THREE.Object3D | null,
  velocity?: THREE.Vector3,
) {
  if (!source || !target) return false
  source.updateWorldMatrix(true, false)
  target.updateWorldMatrix(true, false)

  const portalPosition = source.getWorldPosition(tempPortalPosition)
  const portalNormal = getPortalNormal(source).clone()
  tempPortalBump.copy(portalNormal).multiplyScalar(prevPosition.clone().sub(portalPosition).dot(portalNormal) > 0 ? 1 : -1)
  tempPortalBump.multiplyScalar(2 * NEAR_MIN)

  tempPrevWorld.copy(prevPosition)
  tempCurWorld.copy(currentPosition)

  const planePoint = tempPortalPosition.clone().add(tempPortalBump)
  const da = portalNormal.dot(tempPrevWorld.sub(planePoint))
  const db = portalNormal.dot(tempCurWorld.sub(planePoint))

  if (da * db > 0) {
    return false
  }

  const denominator = da - db
  if (Math.abs(denominator) < 0.00001) return false

  const t = da / denominator
  tempIntersect.lerpVectors(prevPosition, currentPosition, t).sub(planePoint)

  tempPortalXAxis.setFromMatrixColumn(source.matrixWorld, 0)
  tempPortalYAxis.setFromMatrixColumn(source.matrixWorld, 1)

  if (Math.abs(tempIntersect.dot(tempPortalXAxis)) >= tempPortalXAxis.lengthSq()) {
    return false
  }
  if (Math.abs(tempIntersect.dot(tempPortalYAxis)) >= tempPortalYAxis.lengthSq()) {
    return false
  }

  camera.updateMatrixWorld()
  getPortalDeltaMatrix(source, target, tempWarpMatrix)

  tempClosestPoint.copy(currentPosition).addScaledVector(tempPortalBump, -2)
  tempClosestPoint.applyMatrix4(tempWarpMatrix)
  getPortalWarpMatrix(source, target, camera.matrixWorld, tempWarpMatrix)
  tempWarpMatrix.decompose(tempPortalPosition, camera.quaternion, tempScale)
  camera.position.copy(tempClosestPoint)

  if (velocity) {
    applyMatrixToDirection(velocity, tempWarpMatrix, velocity)
  }

  camera.position.y = PLAYER_HEIGHT
  camera.updateMatrixWorld(true)
  return true
}

function setPortalTexture(mesh: THREE.Mesh, texture: THREE.Texture | null) {
  const material = mesh.material as THREE.ShaderMaterial
  material.uniforms.tex.value = texture
  material.uniforms.useTexture.value = texture !== null
}

function renderSceneRecursive(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  portals: PortalRuntime[],
  depth: number,
  skipIndex: number,
  renderTarget: THREE.WebGLRenderTarget | null,
  rootExtraClip: number,
) {
  const originalCameraMask = camera.layers.mask
  const originalAutoClear = renderer.autoClear
  const originalBackground = scene.background
  const allowNestedPortals = renderTarget === null
  const hiddenIndices: number[] = []
  if (skipIndex >= 0) {
    portals[skipIndex].mesh.visible = false
    hiddenIndices.push(skipIndex)
  }

  if (depth > 0 && allowNestedPortals) {
    for (let index = 0; index < portals.length; index += 1) {
      if (index === skipIndex) continue

      const portal = portals[index]
      const targetIndex = getPortalTargetIndex(portal, camera.position)
      const target = portals[targetIndex]
      updatePortalCamera(portal.mesh, target.mesh, camera, portal.camera)
      renderSceneRecursive(
        renderer,
        scene,
        portal.camera,
        portals,
        depth - 1,
        targetIndex,
        portal.renderTargets[depth - 1],
        rootExtraClip,
      )
      setPortalTexture(portal.mesh, portal.renderTargets[depth - 1].texture)
    }
  } else {
    for (let index = 0; index < portals.length; index += 1) {
      if (index === skipIndex) continue
      setPortalTexture(portals[index].mesh, null)
    }
  }

  setRendererClippingPlanes(renderer, [])
  renderer.setRenderTarget(renderTarget)
  renderer.autoClear = false
  renderer.clear(true, true, true)
  camera.layers.set(WORLD_LAYER)
  renderer.render(scene, camera)
  if (allowNestedPortals) {
    camera.layers.set(PORTAL_LAYER)
    scene.background = null
    renderer.render(scene, camera)
    scene.background = originalBackground
  }
  camera.layers.mask = originalCameraMask
  renderer.autoClear = originalAutoClear

  for (const index of hiddenIndices) {
    portals[index].mesh.visible = true
  }
}

export function renderRecursivePortals(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  portals: PortalRuntime[],
  recursionDepth: number,
) {
  scene.updateMatrixWorld(true)
  camera.updateMatrixWorld(true)
  const rootExtraClip = Math.min(getNearestPortalDistance(camera.position, portals) * 0.5, 0.1)
  renderSceneRecursive(renderer, scene, camera, portals, recursionDepth, -1, null, rootExtraClip)
  setRendererClippingPlanes(renderer, [])
  renderer.setRenderTarget(null)
}

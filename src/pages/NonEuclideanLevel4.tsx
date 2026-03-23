import * as THREE from 'three'
import NonEuclideanScenePage from './NonEuclideanScenePage'
import type { NonEuclideanSceneConfig } from './NonEuclideanScenePage'

const SPACE_SKY = '/fp-img/spacewithstars.gif'
const CAMERA_EYE_HEIGHT = 1.5

function sampleSlopeFloorHeight(localZ: number) {
  if (localZ <= -0.5) {
    return 0
  }

  if (localZ >= 0.5) {
    return -1
  }

  return -(localZ + 0.5)
}

function sampleLevel4CameraHeight(x: number, z: number) {
  const sampleGround = (centerX: number, centerZ: number, rotationY: number) => {
    const dx = x - centerX
    const dz = z - centerZ
    const cos = Math.cos(-rotationY)
    const sin = Math.sin(-rotationY)
    const localX = (dx * cos - dz * sin) / 10
    const localZ = (dx * sin + dz * cos) / 10

    if (localX < -1 || localX > 1 || localZ < -1 || localZ > 1) {
      return null
    }

    return sampleSlopeFloorHeight(localZ) * 2 + CAMERA_EYE_HEIGHT
  }

  return sampleGround(0, 0, 0) ?? sampleGround(200, 0, Math.PI) ?? (CAMERA_EYE_HEIGHT - 2)
}

const config: NonEuclideanSceneConfig = {
  title: 'Level4',
  routeBase: '/non-euclidean/level4',
  backgroundColor: '#010103',
  skyTexture: SPACE_SKY,
  cameraFar: 320,
  playerHeight: -0.5,
  portalRenderSize: 1024,
  sampleCameraHeight: sampleLevel4CameraHeight,
  showPlayerCube: true,
  spawnPosition: new THREE.Vector3(0, -0.5, 8),
  meshes: [
    { id: 'ground1', source: '/non-euclidean/engine/ground_slope.obj', texture: '/non-euclidean/engine/checker_green.bmp', position: new THREE.Vector3(0, 0, 0), scale: new THREE.Vector3(10, 2, 10), textureRepeat: [10, 10], includeColliders: true },
    { id: 'ground2', source: '/non-euclidean/engine/ground_slope.obj', texture: '/non-euclidean/engine/checker_green.bmp', position: new THREE.Vector3(200, 0, 0), rotation: new THREE.Euler(0, Math.PI, 0), scale: new THREE.Vector3(10, 2, 10), textureRepeat: [10, 10], includeColliders: true },
    { id: 'tunnel1', source: '/non-euclidean/engine/tunnel_slope.obj', texture: '/non-euclidean/engine/checker_gray.bmp', position: new THREE.Vector3(0, 0, 0), rotation: new THREE.Euler(0, Math.PI, 0), scale: new THREE.Vector3(1, 1, 5), includeColliders: true },
    { id: 'tunnel2', source: '/non-euclidean/engine/tunnel_slope.obj', texture: '/non-euclidean/engine/checker_gray.bmp', position: new THREE.Vector3(200, 0, 0), scale: new THREE.Vector3(1, 1, 5), includeColliders: true },
  ],
  portals: [
    { backTargetIndex: 3, frontTargetIndex: 3, position: new THREE.Vector3(0, 1, -5), rotation: new THREE.Euler(0, Math.PI, 0), scale: new THREE.Vector3(0.6, 0.999, 1) },
    { backTargetIndex: 2, frontTargetIndex: 2, position: new THREE.Vector3(0, -1, 5), rotation: new THREE.Euler(0, Math.PI, 0), scale: new THREE.Vector3(0.6, 0.999, 1) },
    { backTargetIndex: 1, frontTargetIndex: 1, position: new THREE.Vector3(200, 1, 5), rotation: new THREE.Euler(0, Math.PI, 0), scale: new THREE.Vector3(0.6, 0.999, 1) },
    { backTargetIndex: 0, frontTargetIndex: 0, position: new THREE.Vector3(200, -1, -5), rotation: new THREE.Euler(0, Math.PI, 0), scale: new THREE.Vector3(0.6, 0.999, 1) },
  ],
}

export default function NonEuclideanLevel4() {
  return <NonEuclideanScenePage config={config} />
}

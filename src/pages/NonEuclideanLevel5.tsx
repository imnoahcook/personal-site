import * as THREE from 'three'
import NonEuclideanScenePage from './NonEuclideanScenePage'
import type { NonEuclideanSceneConfig } from './NonEuclideanScenePage'

const SPACE_SKY = '/fp-img/spacewithstars.gif'

const config: NonEuclideanSceneConfig = {
  title: 'Level5',
  routeBase: '/non-euclidean/level5',
  backgroundColor: '#010103',
  skyTexture: SPACE_SKY,
  cameraFar: 320,
  portalRenderSize: 1024,
  spawnPosition: new THREE.Vector3(0, 1.5, 5),
  meshes: [
    { id: 'ground1', source: '/non-euclidean/engine/ground.obj', texture: '/non-euclidean/engine/checker_green.bmp', position: new THREE.Vector3(0, 0, 0), scale: new THREE.Vector3(12, 1.2, 12), textureRepeat: [12, 12] },
    { id: 'ground2', source: '/non-euclidean/engine/ground.obj', texture: '/non-euclidean/engine/checker_green.bmp', position: new THREE.Vector3(200, 0, 0), scale: new THREE.Vector3(12, 1.2, 12), textureRepeat: [12, 12] },
    { id: 'tunnel1', source: '/non-euclidean/engine/tunnel_scale.obj', texture: '/non-euclidean/engine/checker_gray.bmp', position: new THREE.Vector3(-1.2, 0, 0), scale: new THREE.Vector3(1, 1, 2.4), includeColliders: true },
    { id: 'tunnel2', source: '/non-euclidean/engine/tunnel.obj', texture: '/non-euclidean/engine/checker_gray.bmp', position: new THREE.Vector3(201.2, 0, 0), scale: new THREE.Vector3(1, 1, 2.4), includeColliders: true },
    { id: 'tunnel3', source: '/non-euclidean/engine/tunnel.obj', texture: '/non-euclidean/engine/checker_gray.bmp', position: new THREE.Vector3(-1, 0, -4.2), rotation: new THREE.Euler(0, Math.PI / 2, 0), scale: new THREE.Vector3(0.25, 0.25, 0.6) },
  ],
  portals: [
    { backTargetIndex: 1, frontTargetIndex: 1, position: new THREE.Vector3(-1.2, 1, 2.4), scale: new THREE.Vector3(0.6, 0.999, 1) },
    { backTargetIndex: 0, frontTargetIndex: 0, position: new THREE.Vector3(201.2, 1, 2.4), scale: new THREE.Vector3(0.6, 0.999, 1) },
    { backTargetIndex: 3, frontTargetIndex: 3, position: new THREE.Vector3(-1.2, 0.5, -2.4), scale: new THREE.Vector3(0.3, 0.499, 0.5) },
    { backTargetIndex: 2, frontTargetIndex: 2, position: new THREE.Vector3(201.2, 1, -2.4), rotation: new THREE.Euler(0, Math.PI, 0), scale: new THREE.Vector3(0.6, 0.999, 1) },
  ],
}

export default function NonEuclideanLevel5() {
  return <NonEuclideanScenePage config={config} />
}

import * as THREE from 'three'
import type { NonEuclideanSceneConfig } from './NonEuclideanScenePage'
import NonEuclideanScenePage from './NonEuclideanScenePage'

const SPACE_SKY = '/fp-img/spacewithstars.gif'
const ROOM_SCALE = new THREE.Vector3(1.1, 1.1, 1.1)
const PILLAR_SCALE = new THREE.Vector3(0.1, 0.1, 0.1)
const GROUND_SCALE = new THREE.Vector3(20, 2, 20)

function roomPortal(
  positionX: number,
  backTargetIndex: number,
  frontTargetIndex: number,
) {
  return {
    backTargetIndex,
    frontTargetIndex,
    position: new THREE.Vector3(positionX, 1.65, -1.1),
    rotation: new THREE.Euler(0, -Math.PI / 2, 0),
    scale: new THREE.Vector3(1.1, 1.65, 1),
  }
}

const config: NonEuclideanSceneConfig = {
  title: 'Level3',
  routeBase: '/non-euclidean/level3',
  backgroundColor: '#010103',
  skyTexture: SPACE_SKY,
  cameraFar: 600,
  portalRenderSize: 1024,
  spawnPosition: new THREE.Vector3(0, 1.5, 3),
  meshes: [
    {
      id: 'ground1',
      source: '/non-euclidean/engine/ground.obj',
      texture: '/non-euclidean/engine/checker_green.bmp',
      position: new THREE.Vector3(0, 0, 0),
      scale: GROUND_SCALE,
      textureRepeat: [20, 20],
    },
    {
      id: 'ground2',
      source: '/non-euclidean/engine/ground.obj',
      texture: '/non-euclidean/engine/checker_green.bmp',
      position: new THREE.Vector3(200, 0, 0),
      scale: GROUND_SCALE,
      textureRepeat: [20, 20],
    },
    {
      id: 'ground3',
      source: '/non-euclidean/engine/ground.obj',
      texture: '/non-euclidean/engine/checker_green.bmp',
      position: new THREE.Vector3(400, 0, 0),
      scale: GROUND_SCALE,
      textureRepeat: [20, 20],
    },
    {
      id: 'pillar1',
      source: '/non-euclidean/engine/pillar.obj',
      texture: '/non-euclidean/engine/white.bmp',
      position: new THREE.Vector3(0, 0, 0),
      scale: PILLAR_SCALE,
      includeColliders: true,
    },
    {
      id: 'pillar2',
      source: '/non-euclidean/engine/pillar.obj',
      texture: '/non-euclidean/engine/white.bmp',
      position: new THREE.Vector3(200, 0, 0),
      scale: PILLAR_SCALE,
      includeColliders: true,
    },
    {
      id: 'pillar3',
      source: '/non-euclidean/engine/pillar.obj',
      texture: '/non-euclidean/engine/white.bmp',
      position: new THREE.Vector3(400, 0, 0),
      scale: PILLAR_SCALE,
      includeColliders: true,
    },
    {
      id: 'room1',
      source: '/non-euclidean/engine/pillar_room.obj',
      texture: '/non-euclidean/engine/three_room.bmp',
      position: new THREE.Vector3(0, 0, 0),
      scale: ROOM_SCALE,
      includeColliders: true,
    },
    {
      id: 'room2',
      source: '/non-euclidean/engine/pillar_room.obj',
      texture: '/non-euclidean/engine/three_room.bmp',
      position: new THREE.Vector3(200, 0, 0),
      scale: ROOM_SCALE,
      includeColliders: true,
    },
    {
      id: 'room3',
      source: '/non-euclidean/engine/pillar_room.obj',
      texture: '/non-euclidean/engine/three_room.bmp',
      position: new THREE.Vector3(400, 0, 0),
      scale: ROOM_SCALE,
      includeColliders: true,
    },
    {
      id: 'statue1',
      source: '/non-euclidean/engine/teapot.obj',
      texture: '/non-euclidean/engine/gold.bmp',
      position: new THREE.Vector3(0, 0.5, 9),
      rotation: new THREE.Euler(0, Math.PI / 2, 0),
      scale: new THREE.Vector3(0.5, 0.5, 0.5),
    },
    {
      id: 'statue2',
      source: '/non-euclidean/engine/bunny.obj',
      texture: '/non-euclidean/engine/gold.bmp',
      position: new THREE.Vector3(200, -0.4, 9),
      rotation: new THREE.Euler(0, Math.PI, 0),
      scale: new THREE.Vector3(14, 14, 14),
    },
    {
      id: 'statue3',
      source: '/non-euclidean/engine/suzanne.obj',
      texture: '/non-euclidean/engine/gold.bmp',
      position: new THREE.Vector3(400, 0.9, 9),
      rotation: new THREE.Euler(0, Math.PI, 0),
      scale: new THREE.Vector3(1.2, 1.2, 1.2),
    },
  ],
  portals: [roomPortal(0, 1, 2), roomPortal(200, 2, 0), roomPortal(400, 0, 1)],
}

export default function NonEuclideanLevel3() {
  return <NonEuclideanScenePage config={config} />
}

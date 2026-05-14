import * as THREE from 'three'
import NonEuclideanScenePage from './NonEuclideanScenePage'
import type { NonEuclideanSceneConfig } from './NonEuclideanScenePage'

const FLOORPLAN_SCALE = 0.1524

function floorplanPortal(
  x: number,
  y: number,
  z: number,
  backTargetIndex: number,
  frontTargetIndex: number,
  rotationY = 0,
) {
  return {
    backTargetIndex,
    frontTargetIndex,
    position: new THREE.Vector3(x * FLOORPLAN_SCALE, y * FLOORPLAN_SCALE, z * FLOORPLAN_SCALE),
    rotation: new THREE.Euler(0, rotationY, 0),
    scale: new THREE.Vector3(4 * FLOORPLAN_SCALE, 10 * FLOORPLAN_SCALE, 1),
  }
}

const config: NonEuclideanSceneConfig = {
  title: 'Level6',
  routeBase: '/non-euclidean/level6',
  backgroundColor: '#040406',
  cameraFar: 100,
  portalRenderSize: 1024,
  spawnPosition: new THREE.Vector3(2, 1.5, 2),
  meshes: [
    {
      id: 'floorplan',
      source: '/non-euclidean/engine/floorplan.obj',
      texture: '/non-euclidean/engine/floorplan_textures.bmp',
      textureAtlas: { columns: 4, rows: 4 },
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(FLOORPLAN_SCALE, FLOORPLAN_SCALE, FLOORPLAN_SCALE),
      includeColliders: true,
    },
  ],
  portals: [
    floorplanPortal(33, 10, 25.5, 1, 2),
    floorplanPortal(74, 10, 25.5, 2, 0),
    floorplanPortal(33, 10, 66.5, 0, 1),
    floorplanPortal(63.5, 10, 48, 4, 5, Math.PI / 2),
    floorplanPortal(63.5, 10, 7, 5, 3, Math.PI / 2),
    floorplanPortal(22.5, 10, 48, 3, 4, Math.PI / 2),
  ],
}

export default function NonEuclideanLevel6() {
  return <NonEuclideanScenePage config={config} />
}

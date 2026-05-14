import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { getPortalPlaneScaleRatio } from './nonEuclideanEngine'

describe('getPortalPlaneScaleRatio', () => {
  it('returns the target/source portal plane scale ratio', () => {
    const source = new THREE.Object3D()
    const target = new THREE.Object3D()

    source.scale.set(0.3, 0.5, 1)
    target.scale.set(0.6, 1, 1)

    expect(getPortalPlaneScaleRatio(source, target)).toBeCloseTo(2)
  })

  it('ignores portal thickness when measuring visible plane scale', () => {
    const source = new THREE.Object3D()
    const target = new THREE.Object3D()

    source.scale.set(1, 1, 0.25)
    target.scale.set(1, 1, 4)

    expect(getPortalPlaneScaleRatio(source, target)).toBeCloseTo(1)
  })
})

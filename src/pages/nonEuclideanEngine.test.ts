import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseEngineMesh } from './nonEuclideanEngine'

describe('parseEngineMesh', () => {
  it('does not create 2D blockers from walkable sloped floor collider markers', () => {
    const mesh = parseEngineMesh(`
v 1 0 -0.5
v -1 0 -0.5
v -1 -1 0.5
c *
`)

    expect(mesh.colliders).toHaveLength(0)
  })

  it('leaves the level 4 sloped outside ground walkable', () => {
    const source = readFileSync(
      'public/non-euclidean/engine/ground_slope.obj',
      'utf8',
    )
    const mesh = parseEngineMesh(source)

    expect(mesh.colliders).toHaveLength(0)
  })

  it('still creates 2D blockers from vertical wall collider markers', () => {
    const mesh = parseEngineMesh(`
v 0 0 0
v 0 2 0
v 0 2 1
c *
`)

    expect(mesh.colliders).toEqual([
      {
        minX: -0.08,
        maxX: 0.08,
        minZ: 0,
        maxZ: 1,
      },
    ])
  })
})

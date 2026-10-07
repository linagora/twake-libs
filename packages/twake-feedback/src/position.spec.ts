import { describe, expect, it } from 'vitest'

import { snapToEdge } from './position'

describe('snapToEdge', () => {
  const viewport = { width: 1000, height: 800 }

  it('snaps a wide button by its center', () => {
    // Its left edge is left of the middle, its center right of it
    expect(snapToEdge({ left: 420, top: 400 }, viewport, 0, 200).side).toBe(
      'right'
    )
    expect(snapToEdge({ left: 420, top: 400 }, viewport, 0).side).toBe('left')
  })
})

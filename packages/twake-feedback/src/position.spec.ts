import { describe, expect, it } from 'vitest'

import { getFormInset, snapToEdge } from './position'

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

describe('getFormInset', () => {
  it('opens the form upward from a button in the lower half', () => {
    expect(getFormInset({ side: 'right', bottom: 16 }, 800)).toBe(
      'auto 16px 16px auto'
    )
  })

  it('opens the form downward from a button moved to the top', () => {
    // The button spans 16 to 72 px from the top: the form starts at its top
    expect(getFormInset({ side: 'left', bottom: 728 }, 800)).toBe(
      '16px auto auto 16px'
    )
  })
})

import { act, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { describe, expect, it } from 'vitest'

import { TwakeBar } from './TwakeBar'
import { makeApp, makeSdk, renderWithSdk } from './testUtils'

const APP = { slug: 'calendar', name: 'Calendar', icon: 'https://cal/icon.svg' }

const renderBar = (
  sdk = makeSdk(),
  props: Partial<React.ComponentProps<typeof TwakeBar>> = {}
): ReturnType<typeof renderWithSdk> =>
  renderWithSdk(<TwakeBar app={APP} {...props} />, sdk)

describe('TwakeBar', () => {
  it('shows an avatar skeleton while waiting for credentials', () => {
    renderBar(makeSdk({ status: 'waiting' }))

    expect(
      screen.queryByTestId('twake-bar-avatar-skeleton')
    ).toBeInTheDocument()
  })

  it('shows logged out on a public page', () => {
    renderBar(makeSdk({ status: 'public' }))

    expect(screen.queryByTestId('twake-bar-avatar-skeleton')).toBe(null)
    expect(screen.queryByTestId('twake-bar-home')).toBeInTheDocument()
  })

  it('links the home button to the home app once the client is ready', async () => {
    const sdk = makeSdk({
      status: 'waiting',
      apps: [makeApp({ slug: 'home' })]
    })
    renderBar(sdk)

    act(() => sdk.setStatus('ready'))

    expect(screen.queryByTestId('twake-bar-avatar-skeleton')).toBe(null)
    await waitFor(() =>
      expect(screen.getByTestId('twake-bar-home')).toHaveAttribute(
        'href',
        'https://alice-home.twake.example/'
      )
    )
  })

  it('lets the host replace the left side', () => {
    renderBar(makeSdk(), { slots: { left: <span>Custom left</span> } })

    expect(screen.queryByText('Custom left')).toBeInTheDocument()
    expect(screen.queryByTestId('twake-bar-home')).toBe(null)
  })
})

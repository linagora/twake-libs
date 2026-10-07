import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { TwakeBar } from './TwakeBar'
import { INSTANCE, makeApp, makeSdk, renderWithSdk } from './testUtils'

const APP = { slug: 'calendar', name: 'Calendar', icon: 'https://cal/icon.svg' }

const renderBar = (
  sdk = makeSdk(),
  props: Partial<React.ComponentProps<typeof TwakeBar>> = {}
): ReturnType<typeof renderWithSdk> =>
  renderWithSdk(<TwakeBar app={APP} onLogOut={vi.fn()} {...props} />, sdk)

describe('TwakeBar', () => {
  it('shows an avatar skeleton and no menu while waiting for credentials', () => {
    renderBar(makeSdk({ status: 'waiting' }))

    expect(
      screen.queryByTestId('twake-bar-avatar-skeleton')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('twake-bar-user-button')).toBe(null)
    expect(screen.queryByTestId('twake-bar-apps-button')).toBe(null)
  })

  it('shows logged out on a public page', () => {
    renderBar(makeSdk({ status: 'public' }))

    expect(screen.queryByTestId('twake-bar-avatar-skeleton')).toBe(null)
    expect(screen.queryByTestId('twake-bar-user-button')).toBe(null)
    expect(screen.queryByTestId('twake-bar-home')).toBeInTheDocument()
  })

  it('shows the home logo, not a link, until the platform gives its URL', () => {
    renderBar(makeSdk({ status: 'public' }))

    const home = screen.getByTestId('twake-bar-home')
    expect(home.tagName).toBe('SPAN')
    expect(home).not.toHaveAttribute('aria-label')
    expect(screen.queryByRole('link', { name: 'Home' })).toBe(null)
  })

  it('shows the menus once the client is ready', async () => {
    const sdk = makeSdk({
      status: 'waiting',
      apps: [makeApp({ slug: 'home' })],
      context: { help_link: 'https://help.example' }
    })
    renderBar(sdk)

    act(() => sdk.setStatus('ready'))

    expect(screen.queryByTestId('twake-bar-apps-button')).toBeInTheDocument()
    expect(screen.queryByTestId('twake-bar-avatar-skeleton')).toBe(null)
    expect(await screen.findByRole('link', { name: 'Help' })).toHaveAttribute(
      'href',
      'https://help.example'
    )
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

  it('hands the logout to the host', async () => {
    const onLogOut = vi.fn()
    const user = userEvent.setup()
    renderBar(makeSdk({ instance: INSTANCE }), { onLogOut })

    const button = screen.getByTestId('twake-bar-user-button')
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)
    await user.click(await screen.findByTestId('twake-bar-logout'))

    expect(onLogOut).toHaveBeenCalledTimes(1)
  })
})

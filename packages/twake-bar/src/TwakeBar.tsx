import { Skeleton, styled } from '@linagora/twake-mui'
import React from 'react'

import { BarLeft, type BarApp } from './BarLeft'
import { useSdkStatus } from './SdkProvider'
import { useBarLocales } from './useBarLocales'
import { useIsMobile } from './useIsMobile'

export const TWAKE_BAR_HEIGHT = '3rem'

export interface TwakeBarSlots {
  /** Replaces the home button and the app title */
  left?: React.ReactNode
  center?: React.ReactNode
  /** Fills the space between the title and the menus */
  search?: React.ReactNode
  /** Rendered before the menus */
  right?: React.ReactNode
}

export interface TwakeBarProps {
  app: BarApp
  slots?: TwakeBarSlots
}

const Root = styled('header')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  width: '100%',
  height: TWAKE_BAR_HEIGHT,
  padding: '0 1.25rem 0 1rem',
  // theme.vars exists once the host theme has cssVariables (twake-mui >= 10)
  backgroundColor: (theme.vars || theme).palette.background.paper,
  color: (theme.vars || theme).palette.text.primary,
  [theme.breakpoints.down('md')]: {
    padding: '0 1rem 0 0'
  }
}))

const Grow = styled('div')({ flexGrow: 1 })

/**
 * The top bar of the platform: home button and app title. Logged out when
 * the client is `public`, with an avatar skeleton while it is `waiting`.
 */
export const TwakeBar = ({
  app,
  slots = {}
}: TwakeBarProps): React.ReactElement => {
  useBarLocales()
  const status = useSdkStatus()
  const isMobile = useIsMobile()

  return (
    <Root role="banner" data-testid="twake-bar" data-status={status}>
      {slots.left ?? <BarLeft app={app} />}
      {slots.center}
      <Grow>{slots.search}</Grow>
      {slots.right}
      {status === 'waiting' && (
        <Skeleton
          variant="circular"
          width={isMobile ? 24 : 32}
          height={isMobile ? 24 : 32}
          data-testid="twake-bar-avatar-skeleton"
        />
      )}
    </Root>
  )
}

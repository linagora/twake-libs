import { Skeleton, styled, useBreakpoints } from '@linagora/twake-mui'
import React from 'react'

import { AppsMenu } from './AppsMenu'
import { BarLeft, type BarApp } from './BarLeft'
import { HelpLink } from './HelpLink'
import { useSdkStatus } from './SdkProvider'
import { UserMenu } from './UserMenu'
import { useBarLocales } from './useBarLocales'

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
  /** Called by the log out item: the host owns the logout */
  onLogOut: () => void
  slots?: TwakeBarSlots
  showEmailDomainChip?: boolean
}

const Root = styled('header')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  width: '100%',
  height: TWAKE_BAR_HEIGHT,
  padding: '0 1.25rem 0 1rem',
  backgroundColor: theme.vars.palette.background.paper,
  color: theme.vars.palette.text.primary,
  boxShadow: `inset 0 -1px 0 ${theme.vars.palette.divider}`,
  [theme.breakpoints.down('md')]: {
    padding: '0 1rem 0 0'
  }
}))

const Grow = styled('div')({ flexGrow: 1 })

// cozy-bar metrics: 8px padded icon buttons, the avatar 8px after them
const Right = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  color: theme.vars.palette.text.secondary,
  '& .MuiIconButton-root': { padding: 8, color: 'inherit' },
  '& nav:last-child .MuiIconButton-root': { padding: 0, marginLeft: 8 }
}))

/**
 * The top bar of the platform: home button, app title, help, apps menu and
 * user menu. Logged out when the client is `public`, with an avatar skeleton
 * while it is `waiting`.
 */
export const TwakeBar = ({
  app,
  onLogOut,
  slots = {},
  showEmailDomainChip
}: TwakeBarProps): React.ReactElement => {
  useBarLocales()
  const status = useSdkStatus()
  const { isMobile } = useBreakpoints()

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
      {status === 'ready' && (
        <Right>
          <HelpLink />
          <AppsMenu />
          <UserMenu
            onLogOut={onLogOut}
            showEmailDomainChip={showEmailDomainChip}
          />
        </Right>
      )}
    </Root>
  )
}

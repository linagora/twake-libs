import { Icon, TwakeText, TwakeWorkplace } from '@linagora/twake-icons'
import { Divider, styled, useBreakpoints } from '@linagora/twake-mui'
import type { Sdk } from '@linagora/twake-sdk'
import React, { useState } from 'react'

import { useI18n } from 'twake-i18n'

import { useSdk } from './SdkProvider'
import { useBarLocales } from './useBarLocales'
import { useSdkData } from './useSdkData'

export interface BarApp {
  slug: string
  name: string
  /** URL of the app icon, served by the host */
  icon: string
  /** URL of the app text logo, served by the host */
  textIcon?: string
}

// Same metrics as cozy-bar: 32px icons, the home button 12px before the
// divider, the divider 8px before the title
const Left = styled('div')({
  display: 'flex',
  alignItems: 'center',
  '& .MuiDivider-root': { marginRight: 8 }
})

const HomeLink = styled('a')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginRight: 12,
  [theme.breakpoints.down('md')]: { marginLeft: 8, marginRight: 0 }
}))

const HomeIcon = styled('img')({ width: 32, height: 32 })
const AppIcon = styled('img')({
  width: 32,
  height: 32,
  flexShrink: 0,
  marginRight: 4
})
// Black on light, white on dark, like the twake-mui AppTitle
const Wordmark = styled(TwakeText)(({ theme }) => ({
  height: 22,
  width: 'auto',
  marginRight: 8,
  fill: '#000',
  ...theme.applyStyles('dark', { fill: '#fff' })
}))
const AppTextIcon = styled('img')({ height: 22, width: 'auto' })

const loadHomeURL = (sdk: Sdk): Promise<string | null> => sdk.getAppURL('home')

const HomeButton = (): React.ReactElement => {
  const sdk = useSdk()
  const { t } = useI18n()
  const { data: homeURL } = useSdkData(loadHomeURL)
  const [hasIconFailed, setIconFailed] = useState(false)
  const handleIconError = (): void => setIconFailed(true)

  const icon = hasIconFailed ? (
    <Icon icon={TwakeWorkplace} size="32" />
  ) : (
    <HomeIcon
      src={`${sdk.platformURL}/assets/images/icon-cozy-home.svg`}
      alt=""
      onError={handleIconError}
    />
  )

  // Until the platform gives the URL of its home, the logo alone: an `a`
  // without `href` is not a link, and cannot be named
  if (!homeURL) {
    return (
      <HomeLink as="span" data-testid="twake-bar-home">
        {icon}
      </HomeLink>
    )
  }

  return (
    <HomeLink
      href={homeURL}
      aria-label={t('twakeBar.home')}
      data-testid="twake-bar-home"
    >
      {icon}
    </HomeLink>
  )
}

export const BarLeft = ({ app }: { app: BarApp }): React.ReactElement => {
  useBarLocales()
  const { isMobile } = useBreakpoints()

  if (isMobile) return <HomeButton />

  return (
    <Left>
      <HomeButton />
      <Divider orientation="vertical" flexItem />
      <AppIcon src={app.icon} alt={app.textIcon ? '' : app.name} />
      <Wordmark aria-hidden="true" />
      {app.textIcon && <AppTextIcon src={app.textIcon} alt={app.name} />}
    </Left>
  )
}

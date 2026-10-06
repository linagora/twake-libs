import type { Sdk, SdkStatus } from '@linagora/twake-sdk'
import React, { createContext, useContext, useSyncExternalStore } from 'react'

const SdkContext = createContext<Sdk | null>(null)

export interface SdkProviderProps {
  client: Sdk
  children?: React.ReactNode
}

export const SdkProvider = ({
  client,
  children
}: SdkProviderProps): React.ReactElement => (
  <SdkContext.Provider value={client}>{children}</SdkContext.Provider>
)

export const useSdk = (): Sdk => {
  const sdk = useContext(SdkContext)
  if (!sdk) {
    throw new Error('[twake-bar] useSdk must be used under a SdkProvider')
  }
  return sdk
}

export const useSdkStatus = (): SdkStatus => {
  const sdk = useSdk()
  return useSyncExternalStore(
    listener => sdk.onStatusChange(listener),
    () => sdk.status
  )
}

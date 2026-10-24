#!/usr/bin/env node
// Runs the fake SSO in a container of an end-to-end stack, set up from the
// environment.
import { readFileSync } from 'node:fs'

import { startFakeSso, type Person } from './sso.js'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`twake-fake-sso needs ${name}`)
  return value
}

const env = process.env
if (!env.TLS_KEY !== !env.TLS_CERT) {
  throw new Error('twake-fake-sso needs both TLS_KEY and TLS_CERT, or neither')
}
const sso = await startFakeSso({
  issuer: required('ISSUER'),
  ...(env.PORT && { port: Number(env.PORT) }),
  ...(env.TLS_KEY &&
    env.TLS_CERT && {
      tls: { key: readFileSync(env.TLS_KEY), cert: readFileSync(env.TLS_CERT) }
    }),
  backend: {
    clientId: required('BACKEND_CLIENT_ID'),
    clientSecret: required('BACKEND_CLIENT_SECRET')
  },
  audience: required('AUDIENCE'),
  ...(env.PEOPLE && {
    people: JSON.parse(env.PEOPLE) as Record<string, Person>
  }),
  ...(env.ORGANIZATION !== undefined && {
    organization: env.ORGANIZATION || null
  }),
  ...(env.FRAME_ANCESTORS && { frameAncestors: env.FRAME_ANCESTORS }),
  ...(env.BACKCHANNEL_LOGOUT_URI && {
    backchannelLogoutUri: env.BACKCHANNEL_LOGOUT_URI
  })
})
process.stdout.write(`fake SSO at ${sso.url}\n`)

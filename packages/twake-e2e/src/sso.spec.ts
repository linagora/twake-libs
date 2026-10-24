import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

import * as client from 'openid-client'
import { afterEach, describe, expect, it } from 'vitest'

import { startFakeSso, type FakeSso, type FakeSsoOptions } from './sso.js'

const AUDIENCE = 'app'
const REDIRECT_URI = 'https://app.e2e.test/callback'

const closing: (() => Promise<void>)[] = []
afterEach(async () => {
  await Promise.all(closing.splice(0).map(close => close()))
})

async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>(resolve => server.listen(0, resolve))
  const { port } = server.address() as AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

async function start(options: Partial<FakeSsoOptions> = {}): Promise<{
  sso: FakeSso
  frontend: client.Configuration
}> {
  const sso = await startFakeSso({
    issuer: `http://127.0.0.1:${await freePort()}`,
    audience: AUDIENCE,
    ...options
  })
  closing.push(sso.close)
  return {
    sso,
    frontend: await client.discovery(
      new URL(sso.url),
      AUDIENCE,
      undefined,
      client.None(),
      { execute: [client.allowInsecureRequests] }
    )
  }
}

interface Authorization {
  response: Response
  callback: URL | null
  verifier: string
}

// What the browser does on the SSO's page: the redirect is a meta refresh.
async function authorize(
  sso: FakeSso,
  frontend: client.Configuration,
  {
    username,
    cookie,
    silent
  }: { username?: string; cookie?: string; silent?: boolean }
): Promise<Authorization> {
  const verifier = client.randomPKCECodeVerifier()
  const url = client.buildAuthorizationUrl(frontend, {
    redirect_uri: REDIRECT_URI,
    scope: 'openid email',
    code_challenge: await client.calculatePKCECodeChallenge(verifier),
    code_challenge_method: 'S256',
    state: 'state',
    ...(silent && { prompt: 'none' })
  })
  const response = await fetch(`${sso.url}/authorize`, {
    method: 'POST',
    headers: cookie ? { cookie } : {},
    body: new URLSearchParams([
      ...url.searchParams,
      ...(username ? [['username', username] as [string, string]] : [])
    ])
  })
  const target = /url=([^"]+)"/.exec(await response.clone().text())?.[1]
  return {
    response,
    callback: target ? new URL(target.replace(/&amp;/g, '&')) : null,
    verifier
  }
}

async function signIn(
  sso: FakeSso,
  frontend: client.Configuration,
  username: string
): Promise<{ accessToken: string; cookie: string; sid: string }> {
  const { response, callback, verifier } = await authorize(sso, frontend, {
    username
  })
  const tokens = await client.authorizationCodeGrant(
    frontend,
    callback as URL,
    { pkceCodeVerifier: verifier, expectedState: 'state' }
  )
  const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
  return {
    accessToken: tokens.access_token,
    cookie,
    sid: tokens.claims()?.sid as string
  }
}

describe('sign-in', () => {
  it('signs a person in and tells the app who they are', async () => {
    const { sso, frontend } = await start()

    const { accessToken } = await signIn(sso, frontend, 'alice')

    await expect(
      client.fetchUserInfo(frontend, accessToken, client.skipSubjectCheck)
    ).resolves.toMatchObject({
      sub: 'alice@acme.e2e.test',
      uuid: '0a11ce00-0000-4000-8000-000000000001',
      email: 'alice@acme.e2e.test',
      name: 'Alice Martin',
      org_id: 'acme.e2e.test',
      org_role: 'admin'
    })
  })

  it('offers a button per person', async () => {
    const { sso, frontend } = await start()

    const { response } = await authorize(sso, frontend, {})

    const page = await response.text()
    expect(page).toContain('Sign in as alice')
    expect(page).toContain('Sign in as bob')
  })

  it('keeps the session in a cookie the browser accepts over plain HTTP', async () => {
    const { sso, frontend } = await start()

    const { response } = await authorize(sso, frontend, { username: 'alice' })

    const cookie = response.headers.get('set-cookie')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).not.toContain('Secure')
  })

  it('signs in a B2C user with no organization', async () => {
    const { sso, frontend } = await start({ organization: null })

    const { accessToken } = await signIn(sso, frontend, 'bob')

    const claims = await client.fetchUserInfo(
      frontend,
      accessToken,
      client.skipSubjectCheck
    )
    expect(claims).not.toHaveProperty('org_id')
    expect(claims.email).toBe('bob@e2e.test')
  })

  it('refuses a code with the wrong verifier', async () => {
    const { sso, frontend } = await start()
    const { callback } = await authorize(sso, frontend, { username: 'alice' })

    await expect(
      client.authorizationCodeGrant(frontend, callback as URL, {
        pkceCodeVerifier: client.randomPKCECodeVerifier(),
        expectedState: 'state'
      })
    ).rejects.toThrow()
  })
})

describe('silent sign-in', () => {
  it('reuses the SSO session of the browser', async () => {
    const { sso, frontend } = await start()
    const { cookie } = await signIn(sso, frontend, 'alice')

    const { callback } = await authorize(sso, frontend, {
      cookie,
      silent: true
    })

    expect(callback?.searchParams.has('code')).toBe(true)
  })

  it('answers login_required without a session', async () => {
    const { sso, frontend } = await start()

    const { callback } = await authorize(sso, frontend, { silent: true })

    expect(callback?.searchParams.get('error')).toBe('login_required')
    expect(callback?.searchParams.get('state')).toBe('state')
  })

  it('lets only frameAncestors show its pages in a frame', async () => {
    const { sso, frontend } = await start({
      frameAncestors: 'https://space.e2e.test'
    })

    const { response } = await authorize(sso, frontend, { silent: true })

    expect(response.headers.get('content-security-policy')).toBe(
      'frame-ancestors https://space.e2e.test'
    )
  })
})

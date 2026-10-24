// A stand-in for LemonLDAP: just enough OpenID Connect for an end-to-end suite
// to sign people in through the browser and for the backend to check their
// tokens.
import {
  createHash,
  createSign,
  generateKeyPairSync,
  randomBytes,
  randomUUID
} from 'node:crypto'
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type RequestListener,
  type ServerResponse
} from 'node:http'
import { createServer as createHttpsServer } from 'node:https'

export interface Person {
  // The LDAP entryUUID, which the SSO gives as the `uuid` claim.
  uuid: string
  name: string
  email?: string
  orgRole?: 'owner' | 'admin' | 'moderator' | 'member'
}

export const ALICE: Person = {
  uuid: '0a11ce00-0000-4000-8000-000000000001',
  name: 'Alice Martin',
  orgRole: 'admin'
}
export const BOB: Person = {
  uuid: '0b0b0000-0000-4000-8000-000000000002',
  name: 'Bob Durand',
  orgRole: 'member'
}

export interface FakeSsoOptions {
  // As the browser and the backend reach the SSO, e.g. https://oidc:8443.
  issuer: string
  // Defaults to the issuer's port.
  port?: number
  // Without it, the SSO is served over plain HTTP.
  tls?: { key: string | Buffer; cert: string | Buffer }
  // The `aud` of the access tokens.
  audience: string
  people?: Record<string, Person>
  // null signs everyone in as a B2C user, with no org_id.
  organization?: string | null
  // Who may show the SSO's pages in a frame.
  frameAncestors?: string
}

export interface FakeSso {
  url: string
  close: () => Promise<void>
}

interface Grant {
  username: string
  sid: string
  clientId: string
  redirectUri: string
  challenge: string
  nonce: string | null
}

type Token = Grant & { exp: number }

const TOKEN_TTL_S = 3600
const b64url = (data: Buffer | string): string =>
  Buffer.from(data).toString('base64url')

const escape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type'
  })
  res.end(JSON.stringify(body))
}

async function readForm(req: IncomingMessage): Promise<URLSearchParams> {
  let body = ''
  for await (const chunk of req) body += String(chunk)
  return new URLSearchParams(body)
}

const warn = (...parts: unknown[]): void => {
  process.stderr.write(`${parts.map(String).join(' ')}\n`)
}

export async function startFakeSso(options: FakeSsoOptions): Promise<FakeSso> {
  const issuer = options.issuer.replace(/\/$/, '')
  const people = options.people ?? { alice: ALICE, bob: BOB }
  const organization =
    options.organization === undefined ? 'acme.e2e.test' : options.organization
  const frameAncestors = options.frameAncestors ?? "'self'"
  const secure = new URL(issuer).protocol === 'https:'
  // Browsers drop Secure cookies, and so SameSite=None ones, over plain HTTP.
  const cookieAttributes = secure
    ? 'Path=/; Secure; HttpOnly; SameSite=None'
    : 'Path=/; HttpOnly; SameSite=Lax'

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048
  })
  const kid = randomUUID()
  const codes = new Map<string, Grant>()
  const accessTokens = new Map<string, Token>()
  const sessions = new Map<string, string>()
  const isLive = (token: Token | undefined): token is Token =>
    !!token &&
    sessions.has(token.sid) &&
    token.exp > Math.floor(Date.now() / 1000)

  const jwt = (claims: Record<string, unknown>): string => {
    const header = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }))
    const body = b64url(JSON.stringify(claims))
    const signature = createSign('RSA-SHA256')
      .update(`${header}.${body}`)
      .sign(privateKey)
    return `${header}.${body}.${b64url(signature)}`
  }

  const emailOf = (username: string): string =>
    people[username]?.email ?? `${username}@${organization ?? 'e2e.test'}`

  const userinfo = (grant: Grant): Record<string, unknown> => {
    const person = people[grant.username]
    return {
      sub: emailOf(grant.username),
      sid: grant.sid,
      uuid: person.uuid,
      email: emailOf(grant.username),
      name: person.name,
      ...(organization !== null && {
        org_id: organization,
        org_role: person.orgRole ?? 'member'
      })
    }
  }

  // LemonLDAP answers /authorize with a page, which the browser shows only in
  // the frames its frame-ancestors lists: a bare 302 would never be checked.
  const portalHeaders = {
    'content-type': 'text/html',
    'content-security-policy': `frame-ancestors ${frameAncestors}`
  }
  const answer = (
    res: ServerResponse,
    query: URLSearchParams,
    params: Record<string, string>,
    headers: Record<string, string> = {}
  ): void => {
    const back = new URL(query.get('redirect_uri') ?? '')
    for (const [key, value] of Object.entries(params)) {
      back.searchParams.set(key, value)
    }
    const state = query.get('state')
    if (state) back.searchParams.set('state', state)
    res.writeHead(200, { ...portalHeaders, ...headers })
    res.end(
      `<!doctype html><meta http-equiv="refresh" content="0;url=${escape(back.href)}">`
    )
  }

  const cookieSession = (
    header: string | undefined
  ): { sid: string; username: string } | null => {
    const sid = /(?:^|;\s*)e2e_sid=([^;]+)/.exec(header ?? '')?.[1]
    const username = sid ? sessions.get(sid) : undefined
    return sid && username ? { sid, username } : null
  }

  const issueCode = (
    res: ServerResponse,
    query: URLSearchParams,
    sid: string,
    username: string
  ): void => {
    const code = b64url(randomBytes(24))
    codes.set(code, {
      username,
      sid,
      clientId: query.get('client_id') ?? '',
      redirectUri: query.get('redirect_uri') ?? '',
      challenge: query.get('code_challenge') ?? '',
      nonce: query.get('nonce')
    })
    answer(
      res,
      query,
      { code, iss: issuer },
      { 'set-cookie': `e2e_sid=${sid}; ${cookieAttributes}` }
    )
  }

  const loginPage = (query: URLSearchParams): string => {
    const buttons = Object.keys(people)
      .map(
        username =>
          `<button name="username" value="${escape(username)}">Sign in as ${escape(username)}</button>`
      )
      .join('')
    const hidden = [...query]
      .map(
        ([key, value]) =>
          `<input type="hidden" name="${escape(key)}" value="${escape(value)}">`
      )
      .join('')
    return `<!doctype html><title>Fake SSO</title><form method="post" action="/authorize">${hidden}${buttons}</form>`
  }

  const handle = async (
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> => {
    const url = new URL(req.url ?? '/', issuer)
    if (req.method === 'OPTIONS') {
      json(res, 204, null)
      return
    }

    switch (url.pathname) {
      case '/.well-known/openid-configuration': {
        json(res, 200, {
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          userinfo_endpoint: `${issuer}/userinfo`,
          jwks_uri: `${issuer}/jwks`,
          response_types_supported: ['code'],
          subject_types_supported: ['public'],
          id_token_signing_alg_values_supported: ['RS256'],
          code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: ['none', 'client_secret_basic']
        })
        return
      }

      case '/jwks': {
        json(res, 200, {
          keys: [
            {
              ...publicKey.export({ format: 'jwk' }),
              kid,
              alg: 'RS256',
              use: 'sig'
            }
          ]
        })
        return
      }

      case '/authorize': {
        const query =
          req.method === 'POST' ? await readForm(req) : url.searchParams
        const username = query.get('username')
        if (username !== null && Object.hasOwn(people, username)) {
          const sid = randomUUID()
          sessions.set(sid, username)
          query.delete('username')
          issueCode(res, query, sid, username)
          return
        }
        const session = cookieSession(req.headers.cookie)
        if (session) {
          issueCode(res, query, session.sid, session.username)
          return
        }
        if (query.get('prompt') === 'none') {
          answer(res, query, { error: 'login_required' })
          return
        }
        res.writeHead(200, portalHeaders)
        res.end(loginPage(query))
        return
      }

      case '/token': {
        const form = await readForm(req)
        const grant = codes.get(form.get('code') ?? '')
        codes.delete(form.get('code') ?? '')
        const verifier = form.get('code_verifier') ?? ''
        if (
          !grant ||
          grant.redirectUri !== form.get('redirect_uri') ||
          b64url(createHash('sha256').update(verifier).digest()) !==
            grant.challenge
        ) {
          json(res, 400, { error: 'invalid_grant' })
          return
        }
        const now = Math.floor(Date.now() / 1000)
        const accessToken = b64url(randomBytes(32))
        accessTokens.set(accessToken, { ...grant, exp: now + TOKEN_TTL_S })
        json(res, 200, {
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: TOKEN_TTL_S,
          id_token: jwt({
            iss: issuer,
            aud: grant.clientId,
            sub: emailOf(grant.username),
            sid: grant.sid,
            iat: now,
            exp: now + TOKEN_TTL_S,
            ...(grant.nonce !== null && { nonce: grant.nonce })
          })
        })
        return
      }

      case '/userinfo': {
        const token = accessTokens.get(
          (req.headers.authorization ?? '').replace(/^Bearer /, '')
        )
        if (!isLive(token)) {
          json(res, 401, { error: 'invalid_token' })
          return
        }
        json(res, 200, userinfo(token))
        return
      }

      default: {
        json(res, 404, { error: 'not_found' })
      }
    }
  }

  const listener: RequestListener = (req, res) => {
    handle(req, res).catch((error: unknown) => {
      warn(error)
      json(res, 500, { error: 'server_error' })
    })
  }
  const server = options.tls
    ? createHttpsServer(options.tls, listener)
    : createHttpServer(listener)
  const port =
    options.port ?? (Number(new URL(issuer).port) || (secure ? 443 : 80))
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, () => {
      server.off('error', reject)
      resolve()
    })
  })

  return {
    url: issuer,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections()
        server.close(error => (error ? reject(error) : resolve()))
      })
  }
}

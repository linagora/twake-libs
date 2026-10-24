import type { Browser, Locator, Page } from '@playwright/test'

export interface SignInOptions {
  // Where the sign-in starts, `/` by default.
  path?: string
  // What the app shows once the person is signed in: signIn waits for it.
  signedIn?: (page: Page) => Locator
}

export async function signIn(
  page: Page,
  person: string,
  { path = '/', signedIn }: SignInOptions = {}
): Promise<void> {
  await page.goto(path)
  const button = page.getByRole('button', { name: `Sign in as ${person}` })
  await button.waitFor()
  const sso = new URL(page.url()).origin
  await button.click()
  // The SSO hands back with a meta refresh, so wait to leave it, not for a load.
  await page.waitForURL(url => url.origin !== sso)
  if (signedIn) await signedIn(page).waitFor()
}

/** A browser of its own, so each person has their own SSO session. */
export async function asPerson(
  browser: Browser,
  person: string,
  options?: SignInOptions
): Promise<Page> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await signIn(page, person, options)
  return page
}

/**
 * Signs the person out of the SSO in another tab of their browser: the SSO
 * forgets their session and, with a back-channel logout URI, tells the
 * backend, which refuses its tokens from then on.
 */
export async function signOutOfTheSso(
  page: Page,
  ssoUrl: string
): Promise<void> {
  const context = page.context()
  const signedIn = (await context.cookies(ssoUrl)).some(
    cookie => cookie.name === 'e2e_sid'
  )
  if (!signedIn) throw new Error('Nobody is signed in to the SSO')
  const tab = await context.newPage()
  await tab.goto(new URL('/logout', ssoUrl).href)
  await tab.close()
}

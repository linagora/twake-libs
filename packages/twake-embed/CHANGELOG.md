# @linagora/twake-embed [3.0.0](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@2.1.0...@linagora/twake-embed@3.0.0) (2026-10-08)


* feat(twake-embed)!: Drop the theme message ([7d834eb](https://github.com/linagora/twake-libs/commit/7d834eb108ac73d6009a7b6c33755abb1b432540)), closes [twake-space#272](https://github.com/twake-space/issues/272)


### BREAKING CHANGES

* `THEME_MESSAGE`, `ThemeMessage` and `themeMessage` are
gone, and `parseHostMessage` no longer reads `twake-space:theme`.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

# @linagora/twake-embed [2.1.0](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@2.0.1...@linagora/twake-embed@2.1.0) (2026-10-07)


### Features

* **twake-embed:** Report the counts of an app for the tabs of TwakeSpace ([232b0c9](https://github.com/linagora/twake-libs/commit/232b0c9fc4b3dabc4bcc43decf29a0a0e98ea391))

## @linagora/twake-embed [2.0.1](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@2.0.0...@linagora/twake-embed@2.0.1) (2026-10-07)


### Bug Fixes

* **twake-embed:** Ask TwakeSpace for its greeting when the app boots late ([#14](https://github.com/linagora/twake-libs/issues/14)) ([4492645](https://github.com/linagora/twake-libs/commit/44926455210e4a10097e999a3a36ef0d34b6f02b))

# @linagora/twake-embed [2.0.0](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@1.1.0...@linagora/twake-embed@2.0.0) (2026-10-07)


* feat(twake-embed)!: Learn the host from its greeting, leave the overlay to twake-mui ([#11](https://github.com/linagora/twake-libs/issues/11)) ([16dc511](https://github.com/linagora/twake-libs/commit/16dc511156f8f1979eb74676282cb619d0dc0678))


### BREAKING CHANGES

* `connectSpaceOverlay`, `computeOverlayRegion`,
`SpaceOverlay` and `SpaceOverlayStatus` are gone, take them from
@linagora/twake-mui. An app that gives no `hostOrigins` posts nothing until
TwakeSpace greets it, so TwakeSpace sends `helloMessage()` on each load of
a frame first.

Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>

# @linagora/twake-embed [1.1.0](https://github.com/linagora/twake-libs/compare/@linagora/twake-embed@1.0.0...@linagora/twake-embed@1.1.0) (2026-10-07)


### Bug Fixes

* **twake-embed:** Refuse a double slash or a backslash in a path ([38b5065](https://github.com/linagora/twake-libs/commit/38b5065f017604971ecc5fda1900f1bf2f9587a2))
* **twake-embed:** Resolve the package under Jest without a module mapper ([625caff](https://github.com/linagora/twake-libs/commit/625caff35c380579b44d1f6b3cf9e5aa9fa6f677))


### Features

* **twake-embed:** Let an app ask TwakeSpace for the whole page ([f9f3fee](https://github.com/linagora/twake-libs/commit/f9f3fee17364267c11d059a04680da9daa3fe3a6))
* **twake-embed:** Name the whole page of TwakeSpace, not the full screen ([c67f1c5](https://github.com/linagora/twake-libs/commit/c67f1c5d5b33a86431df2ebe0a9ba50638a19b23))
* **twake-embed:** Tell the browser's full screen from the page of TwakeSpace ([780326b](https://github.com/linagora/twake-libs/commit/780326b3eb327f40a0cce8f1534a94aa96d5b707))

# @linagora/twake-embed 1.0.0 (2026-10-07)


### Bug Fixes

* **twake-embed:** Connect on the callback page of the silent login too ([14aa929](https://github.com/linagora/twake-libs/commit/14aa92931fb2f8f285359b2cb7ce4251417671b1))


### Features

* **twake-embed:** Add the embed contract with TwakeSpace ([4bff16f](https://github.com/linagora/twake-libs/commit/4bff16f372a8d8e31191a4ebd8d09a76ddcea33e))

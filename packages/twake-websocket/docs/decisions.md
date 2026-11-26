# Decisions

Decisions taken on @linagora/twake-websocket, oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-10-13, [Architecture] The connection popups live in twake-websocket

- Decision: twake-websocket ships the snackbars of the connection (`WebSocketErrorSnackbar`, `WebSocketStatusSnackbar`), so every app shows the same ones; `@linagora/twake-mui` and `twake-i18n` are optional peer dependencies, for apps that use the connection without them.
- Decided by: zatteo, [review comment](https://github.com/linagora/twake-libs/pull/31#issuecomment-6139351081) and [peer dependencies](https://github.com/linagora/twake-libs/pull/31#discussion_r4255234777); the team, 2026-11-23, as reported by Camille Moussu
- Why: the apps must behave alike when the connection fails, and React is already a peer dependency.
- Scope: desktop and mobile, every app that uses twake-websocket.

## 2026-11-23, [UX] A sleeping tab shows no connection error

- Decision: the connection clears its error once the socket is open again and reconnects when the tab becomes visible; `WebSocketErrorSnackbar` shows an error only when it lasts 5 seconds with the tab visible.
- Decided by: Camille Moussu, [linagora/twake-calendar-frontend#2171](https://github.com/linagora/twake-calendar-frontend/issues/2171)
- Why: a tab left asleep loses its socket and reconnects on wake-up, so its error is not a connection failure the user must hear about.
- Scope: desktop and mobile, every app that uses twake-websocket.

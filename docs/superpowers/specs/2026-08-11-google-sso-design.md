# Google SSO — Design

Date: 2026-08-11
Status: Approved

## Goal

Add Google Single Sign-On to Minerva. Users can sign in or sign up with Google via a button on the login page and a button on the register page, backed by a server-side Google OAuth implementation. Credentials start as `.env` placeholders; real values are added later by the developer.

## Approach

Server-side Authorization Code flow (option A). All token handling happens on the backend. No new runtime dependencies on either side (Bun's native `fetch` calls Google's endpoints; the frontend uses a plain `<a>` navigation). Reuses the existing HMAC-signed session cookies.

## Flow

1. User clicks "Sign in with Google" (or "Sign up with Google") → browser navigates to `GET /api/auth/google?next=<path>`.
2. Backend issues a short-lived signed `minerva_oauth_state` cookie (reuses `createSessionToken` / `verifySessionToken` from `src/auth/session.ts`, 10-minute TTL — no new crypto code), then HTTP 302-redirects to Google's authorization URL.
3. Google signs the user in and redirects to `GET /api/auth/google/callback?code=…&state=…`.
4. Backend verifies `state` matches the cookie, exchanges `code` for an access token at `https://oauth2.googleapis.com/token` (client secret sent server-side only), and fetches the profile from `https://www.googleapis.com/oauth2/v3/userinfo` (`openid email profile` scopes).
5. Backend finds the user by lowercased email.
   - Nonexistent → creates `User` (no `passwordHash`) and a `UserProfile` (name from Google).
   - Existing → linked and logged in (password login remains unaffected).
6. Backend sets the standard `minerva_session` cookie, clears the state cookie, and 302-redirects to `${FRONTEND_ORIGIN}/oauth/callback?next=…`.
7. Frontend callback route calls `/api/auth/me`, hydrates session/profile/workspace, and routes to `next` or `/dashboard` (or `/onboarding` when `profileCompleted` is false); on 401 it routes to `/login`.

## Backend changes (`project-minerva-be`)

### `src/config/env.ts`

Add optional config, defaulting to empty:

- `googleClientId` → `GOOGLE_CLIENT_ID`
- `googleClientSecret` → `GOOGLE_CLIENT_SECRET`
- `googleRedirectUri` → `GOOGLE_REDIRECT_URI`, default `http://localhost:3000/api/auth/google/callback`

When both client id and secret are unset, the Google routes respond 503 `GOOGLE_NOT_CONFIGURED` ("Google sign-in is not configured") instead of crashing the server. This keeps the app bootable while credentials are placeholders.

### `src/models/User.ts`

`passwordHash` becomes `required: false` (Google-created users have no password). Login already fails to `INVALID_CREDENTIALS` when `passwordHash` is missing; register keeps returning `EMAIL_IN_USE` for existing emails including Google-only accounts.

### `src/modules/auth/google.ts` (new)

Pure helpers, unit-testable without network:

- `buildGoogleAuthUrl(state: string): string` — Google authorization URL with `client_id`, `redirect_uri`, `response_type=code`, `scope=openid email profile`, `prompt=select_account`, `state`.
- `exchangeCodeForToken(code: string): Promise<{ accessToken: string }>` — POST to `https://oauth2.googleapis.com/token` with `client_id`, `client_secret`, `code`, `redirect_uri`, `grant_type=authorization_code`.
- `fetchGoogleProfile(accessToken: string): Promise<{ email: string; name?: string; emailVerified?: boolean }>` — GET `userinfo`; returns empty profile on failure (non-2xx). (`UserProfile` has no avatar field, so the photo is not persisted.)

### `src/modules/auth/routes.ts`

Two new GET routes on `authRoutes`:

- `GET /api/auth/google` — reads and sanitizes `next` (internal path matching `/^(?!\/)/`), requires database, checks config, builds state token + cookie, 302s to the Google auth URL.
- `GET /api/auth/google/callback` — reads `code`, `state`, `error`:
  - `error` present → 302 to `${frontendOrigin}/login?error=google_denied`.
  - state missing or mismatched → 400 `INVALID_OAUTH_STATE`.
  - code missing → 400 `MISSING_OAUTH_CODE`.
  - exchange/profile failure → 503 `GOOGLE_AUTH_FAILED`.
  - Otherwise finds/creates the user, sets the session cookie (default TTL from config), clears the state cookie, 302s to `${frontendOrigin}/oauth/callback?next=…`.

`requireTrustedMutationOrigin` already skips GET requests, so no origin changes are needed. The existing auth attempt limiters do not apply to the OAuth flow.

## Frontend changes (`project-minerva-fe`)

### `src/components/GoogleSignInButton.vue` (new)

Reusable button: inline Google "G" SVG, full-width secondary-button styling. Props: `label` (e.g. "Sign in with Google"), optional `next` (appended as `?next=` to the href). Renders an `<a>` pointing at `${API_BASE_URL}/api/auth/google`.

### `src/views/LoginView.vue`

Add the Google button directly under the "Log in" submit button, with a small "or" divider. Passes `next` from `route.query.redirect` when present.

### `src/views/RegisterView.vue`

Add the Google button under the "Create account" button, with a small "or" divider. No `next`.

### `src/views/OAuthCallbackView.vue` (new) + route `/oauth/callback`

Not auth-gated (this is the post-SSO landing). On mount:

1. Calls `/api/auth/me`; on 401 → `router.push('/login')`.
2. Sets session/tokenBalance via `useAppState`, fetches the profile if `profileCompleted`, calls `hydrateWorkspace()` (mirrors `LoginView.submit`).
3. Routes to sanitized `next` if present, else `/dashboard`, or `/onboarding` when `profileCompleted` is false.

Renders a minimal "Finishing sign-in…" state with a spinner.

## Error handling summary

| Case | Behavior |
| --- | --- |
| Google not configured | 503 `GOOGLE_NOT_CONFIGURED` at the start route |
| User denies / Google error | Redirect to `/login?error=google_denied` |
| State mismatch or missing | 400 `INVALID_OAUTH_STATE` |
| Missing code | 400 `MISSING_OAUTH_CODE` |
| Token exchange or profile fetch fails | 503 `GOOGLE_AUTH_FAILED` |
| Existing email | Linked and logged in |
| New email | Account + profile created, session issued |

## Configuration

Add to `project-minerva-be/.env` and `.env.example`:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

Developer steps for later: create an OAuth client in Google Cloud Console, set the authorized redirect URI to `GOOGLE_REDIRECT_URI`, and fill in the two credential values. No frontend env changes (button uses existing `API_BASE_URL`).

## Verification

- Backend: `bun run check` (tsc), `bun test` — add `google.test.ts` covering `buildGoogleAuthUrl` parameter construction and the signed-state token round-trip via `verifySessionToken`.
- Frontend: `bun run build` (vue-tsc + vite).
- Manual: run backend + frontend, click both Google buttons, confirm Google sign-in, return to dashboard/onboarding, and that a password login for the same email still works.
# Forgot Password via Resend — Design

Date: 2026-08-11
Status: Approved

## Goal

Let users reset a forgotten password through email. The existing dead "Forgot password?" button on the login page becomes a link to a dedicated flow: enter email → receive a branded email via Resend with a styled button → click through to a reset page → set a new password.

## Approach

Stateless, HMAC-signed reset token (reuses the session signing in `src/auth/session.ts`, same pattern as the Google OAuth state nonce). No new model, no new runtime dependency: Resend is called with Bun's native `fetch`.

## Flow

1. Login page "Forgot password?" → `RouterLink` to `/forgot-password`.
2. `/forgot-password` page: enter email → `POST /api/auth/forgot-password {email}`.
3. Backend looks up the user. Only if the account has a `passwordHash` it mints a 30-minute signed token (userId embedded with a `reset:` prefix), builds `${FRONTEND_ORIGIN}/reset-password?token=…`, and emails it via Resend. The response is always generic `{success:true}` — no account enumeration. Google-only accounts silently receive nothing.
4. Email body is a branded HTML email (inline CSS) with a CTA button whose href is the reset URL.
5. `/reset-password?token=…` page: validates the token on load, user sets a new password → `POST /api/auth/reset-password {token, password}` → token verified, argon2 hash written → success screen → log in with the new password.

## Reset email (Resend HTML)

Inline-styled, site-branded, no `<style>` block (email clients strip them). Resembles the Minerva look with the violet `#5b45f5` palette:

- Violet header bar (`#5b45f5`, rounded top corners) with the white "Minerva" wordmark — text only, no image logo, so it renders regardless of whether the frontend origin is hotlinkable.
- White body card: "Reset your password" heading, one supporting sentence, and a centered **CTA button** — inline `display:inline-block; background:#5b45f5; color:#fff; padding:14px 28px; border-radius:13px; font-weight:800` — labeled "Reset password", href = the token-bearing reset URL.
- Fallback plain-text link below the button for clients that render buttons as raw links.
- Small note: "If you didn't request this, you can safely ignore this email."
- No unsubscribe/reply-to handling (ponytail: a transactional email doesn't need it).

The reset URL is built server-side from `FRONTEND_ORIGIN` + a base64url token, so no HTML escaping of user input is needed.

## Backend changes (`project-minerva-be`)

### `src/config/env.ts`

- `resendApiKey` → `RESEND_API_KEY`
- `resendFrom` → `RESEND_FROM`
- When either is unset, the forgot route returns 503 `EMAIL_NOT_CONFIGURED`; the server still boots.

### `src/modules/auth/reset.ts` (new)

- `createResetToken(userId: string): Promise<string>` — `createSessionToken({ userId: 'reset:' + userId, role: 'user' }, 30 * 60)`.
- `verifyResetToken(token: string): Promise<string | null>` — `verifySessionToken`; strips the `reset:` prefix; null on missing/wrong prefix/expired.
- `sendPasswordResetEmail(email: string, resetUrl: string): Promise<void>` — `fetch` POST to `https://api.resend.com/emails` with `Authorization: Bearer ${config.resendApiKey}` and body `{ from, to: [email], subject: 'Reset your Minerva password', html }`. Non-2xx → `AppError(503, 'EMAIL_SEND_FAILED', …)`.
- `assertEmailConfigured()` — throws 503 `EMAIL_NOT_CONFIGURED` when key/from are missing.

### `src/modules/auth/abuse-control.ts`

- Extend the `AuthOperation` union with `forgot` and add a `forgotAttempts` limiter (5 / 15 min) so the endpoint can't be used to spam emails.

### `src/modules/auth/routes.ts` (all public)

- `POST /api/auth/forgot-password` — `requireDatabase`, `requireTrustedMutationOrigin`, enforce forgot limit, `assertEmailConfigured`. Look up the user; if they have a `passwordHash`, mint token, send email. Always return `{ success: true }`.
- `GET /api/auth/reset-password?token=…` — validates the token; 200 or 400 `INVALID_RESET_TOKEN`.
- `POST /api/auth/reset-password` — body `{ token, password }`; verify token → load user (guarded: skip users without a `passwordHash`), enforce the existing `passwordPattern`, write a new argon2 hash via `withArgon2Capacity`. Return `{ success: true }` or 400 `INVALID_RESET_TOKEN` on bad/expired token.

## Frontend changes (`project-minerva-fe`)

### `src/views/LoginView.vue`

Replace the dead `<button>Forgot password?</button>` with `<RouterLink to="/forgot-password" class="font-bold text-[#5b45f5]">Forgot password?</RouterLink>`.

### `src/views/ForgotPasswordView.vue` (new) + `/forgot-password`

Mirrors the login/register split layout (left violet brand panel, right form). Email field + "Send reset link" button → on success swap in a confirmation card: "If an account exists for that email, a reset link is on the way." Link back to login.

### `src/views/ResetPasswordView.vue` (new) + `/reset-password`

Reads `token` from the query string. Validates it on mount via the GET endpoint; invalid/expired → error state. Otherwise new-password + confirm fields (same 8+ / capital / number rules as register), posts to reset, then a success state with a link to `/login`. No token in the URL → error state.

### `src/router/index.ts`

Add `/forgot-password` and `/reset-password` as public routes (no `workspace`/`requiresAuth` meta), consistent with `/login` and `/register`.

## Configuration

Add to `project-minerva-be/.env` and `.env.example`:

```
# Resend transactional email (forgot password)
RESEND_API_KEY=
RESEND_FROM=Minerva <onboarding@resend.dev>
```

Real values go in the gitignored `.env`. Until then the forgot route returns 503 `EMAIL_NOT_CONFIGURED` (dev-facing), same graceful-degradation pattern as the Google credentials.

## Verification

- Backend: `bun run check`; `bun test` — add `reset.test.ts` covering reset-token round-trip, wrong-prefix rejection, and expiry.
- Frontend: `bun run build` (vue-tsc + vite).
- Live smoke test (once `RESEND_API_KEY`/`RESEND_FROM` are set): request a reset and confirm the branded email renders with a working button that lands on `/reset-password`.
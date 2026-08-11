# Backend Data Sync — Design

Date: 2026-08-11
Status: Approved

## Goal

Close the remaining gaps where the Minerva frontend still relies on static files or browser-localStorage instead of the authenticated backend. Three features:

1. **Mentors catalog + token-charged booking** — a new backend module serving the mentor catalog and managing bookings that debit the user's token balance.
2. **IELTS progress sync** — persist the two user-level IELTS states (completed simulation sets and practice results) to the backend and restore them on login, instead of localStorage.
3. **Data-driven token pricing** — the token purchase packs are served by the backend; prices stay fixed (unchanged values).

Everything else (scholarship catalog, applications, checklists, documents, notes, versions, onboarding profile, interview sessions, AI usage, token top-up) already reads from the backend and is out of scope.

## Status of existing features

| Feature | Current source | In scope? |
| --- | --- | --- |
| Scholarship catalog | `GET /api/scholarships` + static fallback | No (done) |
| Applications / checklist / documents / notes / versions | `hydrateWorkspace()` + per-application calls | No (done) |
| Onboarding profile | `GET/PUT /api/profile` + local mirror | No (done) |
| IELTS question sets, submissions, evaluations | `GET /api/ielts/sets/:n`, submissions/evaluations | No (done) |
| Mock interview, AI chat, doc reviews, token top-up | `ai`, `ielts`, billing endpoints | No (done) |
| **Mentors catalog** | `data/mentors.ts` (6 hardcoded) | **Yes** |
| **Mentor booking** | `minerva-booking` localStorage | **Yes** |
| **IELTS simulation flags + practice results** | localStorage only | **Yes** |
| **Token purchase packs** | hardcoded `packs` array in `PaymentView` | **Yes** |

## Feature 1 — Mentors catalog + token-charged booking

### Backend (`project-minerva-be`)

A `Mentor` model and a `Booking` model already exist in `src/models/Mentor.ts`, `mentorSeed` already runs at startup (`src/db/seed.ts` → `seedMentors`), and `Transaction.type` already includes `'mentor_booking'`. Only the routes module is missing.

**New file `src/modules/mentors/routes.ts`** (Elysia, on the `mentorsRoutes` export; registered in `src/app.ts`):

- `GET /api/mentors` — `requireDatabase()`, `requireAuth(request)`, returns catalog. Shape per mentor:
  ```ts
  { id: string; name: string; avatarUrl: string | null; expertise: string[];
    scholarshipExperience: string[]; availableDays: string[];
    availableTimeSlots: string[]; priceInTokens: number }
  ```
- `GET /api/bookings` — current user's bookings, newest first. Shape per booking:
  ```ts
  { id: string; mentorId: string; mentorName: string; service: string;
    date: string; time: string; notes: string; status: string }
  ```
- `POST /api/mentors/:id/bookings` — `requireDatabase()`, `requireAuth(request)`, `requireTrustedMutationOrigin(request)`. Body `{ service, date, time, notes }`. Validates `:id` and that the mentor exists (`assertFound`). Debits `priceInTokens` directly on the user via `User.findOneAndUpdate({ _id, tokenBalance: { $gte: priceInTokens } }, { $inc: { tokenBalance: -priceInTokens } }, { new: true })` (the `mongoTokenBalanceStore`/paid-operation helper only supports a ±1 token first-token reserve, so a direct atomic decrement is used for a variable-price charge, matching the `demo-topups` pattern). If the update resolves `null` (insufficient balance), throw `AppError(402, 'TOKEN_BALANCE_DEPLETED', …, { tokenBalance: 0 })`. On success, `Booking.create({ userId, mentorId, dateTime, status: 'approved', tokensCharged, meetingLink: null })` and `Transaction.create({ userId, amount: price, type: 'mentor_booking', status: 'success' })`. Returns:
  ```ts
  { booking: { id; mentorId; mentorName; service; date; time; notes; status }, tokenBalance: number }
  ```
  `date` is the `YYYY-MM-DD` string and `time` a start-time string from the body; the stored `dateTime` is `new Date(\`${date}T${time}:00\`)`.
- `DELETE /api/bookings/:id` — `requireAuth`, `requireTrustedMutationOrigin`. Validates `:id`, finds the current user's booking (`Booking.findOne({ _id, userId })`, `assertFound`). If its `status` is `'pending'` or `'approved'`, refund `tokensCharged` via `User.updateOne({ _id }, { $inc: { tokenBalance: tokensCharged } })` and set `status = 'cancelled'`; otherwise just mark cancelled. Returns `{ cancelled: true, tokenBalance }`.

The mentor price comes from `priceInTokens` on the `Mentor` document. No static price list is introduced server-side.

**Tests (`src/modules/mentors/mentors.test.ts`)** use the `bun:test` style. They exercise a thin exported `attemptTokenCharge` helper that passes the charge amount through a stubbed update function (no database), asserting the exact amount is applied and that `null` (insufficient balance) surfaces. Cover: charge applies the mentor price, and `null` on depleted balance.

### Frontend (`project-minerva-fe`)

- `src/composables/useAppState.ts`:
  - Add `mentors` ref (defaults to `staticMentors`, the existing `data/mentors.ts` export), plus `mentorCatalogError`.
  - Add `normalizeMentor(raw): Mentor` following the existing `normalizeRemoteDocument` pattern. Maps: `id` (from `_id`/`id`), `name`, `initials` (derive first letters of the first two name words), `photo` (<<`avatarUrl`>>), `expertise` (join `raw.expertise` array), `scholarshipExperience` (join array), `highlight` (fallback to the first `expertise` entry or `''`), `services` (fallback `['Essay review', 'Mock interview']` if absent), `sessionPrice` (`` `${priceInTokens} tokens` ``), `availableTimes` (from `availableTimeSlots`), `rating` (default `5`), `biography` (default to `scholarshipExperience` string).
  - Add `loadMentors(force?: boolean): Promise<void>` mirroring `loadScholarshipCatalog`: idempotent single-flight, `GET /api/mentors`, on success `mentors.value = mappedCatalogConcatenatedWithStaticFallbackDeduped`, sets `mentorCatalogError` on failure but keeps the static fallback. Add `mentors`, `loadMentors`, `mentorCatalogError` to the returned object, and reset them in `resetUserState`.
  - Add booking state: `booking` ref is already present (from `minerva-booking`). Add `hydrateBooking()` that `GET /api/bookings` (non-fatal on failure, keeps local last value) and picks the current/most recent booking, and `bookMentor(payload)` / `cancelMentorBooking()` that call the backend then update `booking` (optimistic + rollback on error), calling `syncAiTokenBalance` with the response's `tokenBalance` on booking/cancel.
  - `App.vue`: call `loadMentors()` and `hydrateBooking()` alongside the existing `loadScholarshipCatalog()` in `onMounted`.
- `src/views/MentorsView.vue`: replace the `import { mentors } from '../data/mentors'` static import so the catalog reads from `useAppState().mentors` (computed catalog). Filtering/search logic stays client-side unchanged. Replace the free-form IDR booking flow:
  - The booking modal's confirm button is disabled when `tokenBalance < chosen.priceInTokens`; show the token price next to it.
  - On confirm, call `bookMentor(chosen, { service, date, time, notes })`; on a 402 response, `toast` the depleted message and keep the modal open (no booking created).
  - The booking banner/countdown logic is unchanged (reads `booking`).
- Keep `data/mentors.ts` (it is the offline fallback via `mentors` ref default). Add `priceInTokens` and token-based `sessionPrice` so the offline fallback renders the same cards.

## Feature 2 — IELTS progress sync

### Backend

- `src/models/User.ts`: add two fields to `UserSchema`:
  ```ts
  completedIeltsSimulationSets: { type: [Number], default: [] },
  ieltsPracticeResults: { type: [new Schema({ scholarshipId: String, type: String, score: Number, completedAt: Date, explanation: String }, { _id: false })], default: [] },
  ```
- `src/modules/ielts/introduction.ts` (prefix-only, no auth) or in `ielts/routes.ts` as signed-in handlers:
  - `GET /api/ielts/progress` — `requireDatabase()`, `requireAuth(request)`. Returns `{ completedIeltsSimulationSets: number[], ieltsPracticeResults: [...] }` from the user doc (defaults `[]`).
  - `PUT /api/ielts/progress` — `requireTrustedMutationOrigin`, `requireDatabase`, `requireAuth`. Body `{ completedIeltsSimulationSets: number[], ieltsPracticeResults: [...] }`. Full-state upsert via `User.findByIdAndUpdate(userId, { $set: { … } }, { new: true })`. Returns the same shape. Normalizes `completedAt` to ISO.

### Frontend

- `composables/useAppState.ts`: expose `completedIeltsSimulationSets` and `practiceByScholarship` refs (they already partially exist) and a `loadIeltsProgress()` that `GET /api/ielts/progress` on login (non-fatal on failure) and writes both refs; a watcher (deep) that `PUT`s the full state whenever either changes (debounced ~800ms, single in-flight guard, non-fatal on failure — retry on next change).
- `views/TestPrepView.vue`: remove the `localStorage.getItem('minerva-ielts-simulation-sets')` and the `watch(completedSimulationSets, …)` localStorage write; use the `useAppState` refs instead. All other IELTS behavior stays.
- `resetUserState` already clears the legacy localStorage keys, so no change there.

## Feature 3 — Data-driven token pricing (prices fixed)

### Backend

- `src/modules/auth/routes.ts`: the canonical pack data is already `demoTokenPacks = { starter: 10, momentum: 30, focus: 60 }`. Add a `GET /api/pricing/packs` route (auth not required — it is static reference data; still calls `requireDatabase()`). Returns pack metadata built from `demoTokenPacks`:
  ```ts
  { packs: [
    { id: 'starter',   name: 'Starter',   tokens: 10, price: '$4.99',  description: 'A focused boost for one application.',     badge: '' },
    { id: 'momentum',  name: 'Momentum',  tokens: 30, price: '$11.99', description: 'Great for an active application season.',  badge: 'Most popular' },
    { id: 'focus',     name: 'Focus',     tokens: 60, price: '$19.99', description: 'Extra support across several folders.',     badge: '' },
  ] }
  ```
  `tokens` is read from `demoTokenPacks` (single source); `price` and `description`/`badge` are the fixed display strings. Prices are unchanged.

### Frontend

- `views/PaymentView.vue`: replace the hardcoded `packs` const with a `ref` populated from `GET /api/pricing/packs` in `onMounted`, falling back to the local array (current values) when the request fails. The double-dots-packed `[...] as const` type is replaced by a `PricingPack`-shaped ref type. All rendering and the top-up POST (which sends `packId`) stay the same.
- `views/PricingView.vue`: keep the three static plans, but when the packs have loaded, use the served `tokens`/`name` to render the "Tokens" plan's feature list (e.g. `N tokens`) instead of a hardcoded string. Prices remain "Pricing to Be Announced" — nothing about the visible price changes.

## Error handling summary

| Case | Behavior |
| --- | --- |
| Mentors catalog fetch fails | `mentorCatalogError` set; page keeps static fallback |
| Mentor booking with insufficient balance | 402 `TOKEN_BALANCE_DEPLETED`; modal stays open, toast message |
| Booking create/transaction failure after charge | `refundMentorTokens(userId, price)` refunds the full charge; error surfaces via `workspaceError`/toast |
| Cancel a `pending`/`approved` booking | Tokens refunded, `status = 'cancelled'` |
| IELTS progress fetch fails on login | Non-fatal; local values used, next change retries the PUT |
| Pricing packs fetch fails | PaymentView falls back to the local pack array |

## Global constraints

- Backend: Bun + Elysia, Mongoose. Follow existing route modules (`checklists/routes.ts`, `ielts/routes.ts`). Reuse `requireDatabase`, `requireAuth`, `requireTrustedMutationOrigin`, `AppError`, `assertFound`. Variable-price charges use a direct atomic `tokenBalance: { $gte }` + `$inc` decrement (the `mongoTokenBalanceStore`/`createPaidAiOperationRunner` helpers only support a ±1 first-token reserve). No new runtime dependencies.
- Frontend: Vue 3 `<script setup>`, `useAppState` composable is the single state owner; follow `loadScholarshipCatalog`'s single-flight + fallback pattern. No new dependencies. All copy stays in existing style (no invented prices; demo framing unchanged).
- Tests: backend `bun test` (repo already uses `bun:test`; no DB-free helper exists for model IO, so route tests target the pure helpers and paid-operation-style stubs). Frontend `npm run build` (vue-tsc + vite).

## Verification

- Backend: `bun run check` (tsc) then `bun test` passes, including new `mentors.test.ts`.
- Frontend: `npm run build` (vue-tsc + vite) passes.
- Manual: mentors list renders from backend; booking a mentor with enough tokens debits balance, creates a `Booking` and a `Transaction(type: mentor_booking)`, and shows in `GET /api/bookings`; cancelling refunds tokens; booking with insufficient balance is blocked; complete an IELTS simulation → flag persists across reload/login; `PaymentView` and `PricingView` render the same packs as today.

## Out of scope (deferred)

- Data-driven subscription plans in `PricingView` beyond the tokens card (Free/Premium stay static).
- Multi-booking calendar, day-of-week slot gating, admin mentor CRUD, meeting links, bank/e-wallet payment methods.
- Backend mentor search/filter endpoint (the FE filters client-side).
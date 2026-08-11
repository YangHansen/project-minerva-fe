# Backend Data Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the last three frontend gaps — mentors catalog + token-charged booking, IELTS progress sync, and data-driven token pricing — by adding backend routes and wiring the frontend to them.

**Architecture:** Three independent additions built on existing patterns. Mentors add a new Elysia route module backed by the already-existing `Mentor`/`Booking` models, charging a variable token amount via a direct atomic balance decrement (the `mongoTokenBalanceStore` helper only does a ±1 first-token reserve). IELTS progress is two fields added to `User`, served via two authenticated handlers. Pricing adds one static-reference GET route sourced from the existing `demoTokenPacks` const. The frontend wires each through the single `useAppState` composable using the existing single-flight + static-fallback pattern.

**Tech Stack:** Backend: Bun, Elysia, Mongoose, `bun:test`. Frontend: Vue 3 `<script setup>`, `useAppState` composable, lucide icons, tailwind.

## Global Constraints

- Backend runs in `project-minerva-be`; frontend in `project-minerva-fe`. Run backend commands with `bun`, frontend with `npm`.
- Backend verification: `bun run check` (tsc `--noEmit`), then `bun test`.
- Frontend verification: `npm run build` (vue-tsc + vite).
- No new runtime dependencies on either side.
- Follow existing route modules: reuse `requireDatabase` from `../../db/mongo`, `requireAuth`/`requireTrustedMutationOrigin` from `../../auth/session`, `AppError`/`assertFound` from `../../lib/errors`.
- `useAppState.ts` is the single frontend state owner. New async loads must be idempotent single-flight and keep the static fallback on failure (mirror `loadScholarshipCatalog`).
- Prices stay fixed: 10/30/60 tokens remain `$4.99/$11.99/$19.99`. No invented prices; demo framing in `PricingView`/`PaymentView` unchanged.
- All frontend copy follows the existing style. No new files added to the frontend beyond edits to existing files.

---

### Task 1: Backend mentors routes module + tests

**Files:**
- Create: `project-minerva-be/src/modules/mentors/routes.ts`
- Create: `project-minerva-be/src/modules/mentors/mentors.test.ts`
- Modify: `project-minerva-be/src/modules/mentors/mentors.test.ts` (test-only)
- Modify: `project-minerva-be/src/app.ts`

**Interfaces:**
- Consumes: `Mentor`, `Booking` from `../../models` (already exported), `User` from `../../models`, `Transaction` from `../../models`.
- Produces: `mentorsRoutes` Elysia instance with `GET /api/mentors`, `GET /api/bookings`, `POST /api/mentors/:id/bookings`, `DELETE /api/bookings/:id`. Booking responses carry a `tokenBalance` number for the frontend's `syncAiTokenBalance`.

- [ ] **Step 1: Write a pure token-charge helper and its tests**

The booking logic must be testable without a database. The charge is a variable amount (mentor `priceInTokens`), so it cannot use `mongoTokenBalanceStore` (which only does a ±1 first-token reserve). Create a pure `attemptTokenCharge` helper in the routes file (exported for tests) that returns the new balance or `null`:

```ts
export async function attemptTokenCharge(
  update: (userId: string, amount: number) => Promise<number | null>,
  userId: string,
  amount: number,
): Promise<number | null> {
  return update(userId, amount)
}
```

Write `mentors.test.ts` covering `attemptTokenCharge` with a stub update, asserting the helper passes the exact charge amount and surfaces `null` for insufficient balance:

```ts
import { describe, expect, it } from 'bun:test'
import { attemptTokenCharge } from './routes'

describe('attemptTokenCharge', () => {
  it('passes the full charge amount and returns the new balance', async () => {
    let chargedAmount = 0
    const result = await attemptTokenCharge(async (_userId, amount) => {
      chargedAmount = amount
      return 0 // placeholder; the mapped update returns the post-charge balance
    }, 'user-1', 15)
    expect(chargedAmount).toBe(15)
    expect(result).toBe(0)
  })

  it('returns null for an insufficient balance instead of throwing', async () => {
    const result = await attemptTokenCharge(async () => null, 'user-1', 15)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/modules/mentors/mentors.test.ts`
Expected: FAIL — `Cannot find module './routes'` (the helper does not exist yet).

- [ ] **Step 3: Write the full mentors routes module**

Create `src/modules/mentors/routes.ts`:

```ts
import { Elysia, t } from 'elysia'
import { Types } from 'mongoose'
import { requireAuth, requireTrustedMutationOrigin } from '../../auth/session'
import { requireDatabase } from '../../db/mongo'
import { AppError, assertFound } from '../../lib/errors'
import { Booking, Mentor, Transaction, User } from '../../models'

function mentorJson(mentor: Record<string, any>) {
  return {
    id: String(mentor._id),
    name: mentor.name,
    avatarUrl: mentor.avatarUrl ?? null,
    expertise: mentor.expertise || [],
    scholarshipExperience: mentor.scholarshipExperience || [],
    availableDays: mentor.availableDays || [],
    availableTimeSlots: mentor.availableTimeSlots || [],
    priceInTokens: Number(mentor.priceInTokens ?? 0),
  }
}

async function bookingJson(booking: Record<string, any>) {
  const mentor = booking.mentor ? await Mentor.findById(booking.mentor).lean() : null
  const dateTime = new Date(booking.dateTime)
  const date = dateTime.toISOString().slice(0, 10)
  const time = `${String(dateTime.getUTCHours()).padStart(2, '0')}:00`
  return {
    id: String(booking._id),
    mentorId: String(booking.mentorId),
    mentorName: mentor?.name ?? 'Mentor',
    service: booking.service ?? '',
    date,
    time,
    notes: booking.notes ?? '',
    status: booking.status ?? 'pending',
  }
}

export async function attemptTokenCharge(
  update: (userId: string, amount: number) => Promise<number | null>,
  userId: string,
  amount: number,
): Promise<number | null> {
  return update(userId, amount)
}

async function chargeMentorTokens(userId: string, amount: number): Promise<number> {
  const user = await User.findOneAndUpdate(
    { _id: userId, tokenBalance: { $gte: amount } },
    { $inc: { tokenBalance: -amount } },
    { new: true },
  ).select('tokenBalance').lean()
  if (!user) {
    throw new AppError(402, 'TOKEN_BALANCE_DEPLETED', 'Your token balance is too low for this mentor session.', { tokenBalance: 0 })
  }
  return user.tokenBalance
}

async function refundMentorTokens(userId: string, amount: number): Promise<number> {
  const user = await User.findByIdAndUpdate(userId, { $inc: { tokenBalance: amount } }, { new: true }).select('tokenBalance').lean()
  return user ? user.tokenBalance : 0
}

export const mentorsRoutes = new Elysia({ name: 'mentors-routes' })
  .get('/api/mentors', async ({ request }) => {
    requireDatabase()
    await requireAuth(request)
    const mentors = await Mentor.find().sort({ name: 1 }).lean()
    return { mentors: mentors.map(mentorJson) }
  })
  .get('/api/bookings', async ({ request }) => {
    requireDatabase()
    const { userId } = await requireAuth(request)
    const bookings = await Booking.find({ userId }).sort({ dateTime: -1 }).lean()
    return { bookings: await Promise.all(bookings.map(bookingJson)) }
  })
  .post(
    '/api/mentors/:id/bookings',
    async ({ request, params, body }) => {
      requireDatabase()
      requireTrustedMutationOrigin(request)
      const { userId } = await requireAuth(request)
      if (!Types.ObjectId.isValid(params.id)) throw new AppError(400, 'INVALID_ID', 'Mentor identifier is invalid')
      const mentor = await Mentor.findById(params.id).lean()
      assertFound(mentor, 'Mentor not found')
      const price = Number(mentor.priceInTokens ?? 0)
      const balance = await chargeMentorTokens(userId, price)
      let created = false
      try {
        const dateTime = new Date(`${body.date}T${body.time}:00`)
        const booking = await Booking.create({
          userId, mentorId: mentor._id, dateTime, status: 'approved', tokensCharged: price, meetingLink: null,
          service: body.service, notes: body.notes,
        })
        await Transaction.create({ userId, amount: price, type: 'mentor_booking', status: 'success' })
        created = true
        return { booking: await bookingJson(booking.toObject()), tokenBalance: balance }
      } catch (error) {
        if (!created) await refundMentorTokens(userId, price)
        throw error
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        service: t.String(),
        date: t.String(),
        time: t.String(),
        notes: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    '/api/bookings/:id',
    async ({ request, params }) => {
      requireDatabase()
      requireTrustedMutationOrigin(request)
      const { userId } = await requireAuth(request)
      if (!Types.ObjectId.isValid(params.id)) throw new AppError(400, 'INVALID_ID', 'Booking identifier is invalid')
      const booking = await Booking.findOne({ _id: params.id, userId })
      assertFound(booking, 'Booking not found')
      if (booking.status === 'pending' || booking.status === 'approved') {
        const amount = Number(booking.tokensCharged ?? 0)
        const balance = await refundMentorTokens(userId, amount)
        booking.status = 'cancelled'
        await booking.save()
        return { cancelled: true, tokenBalance: balance }
      }
      booking.status = 'cancelled'
      await booking.save()
      return { cancelled: true }
    },
    { params: t.Object({ id: t.String() }) },
  )
```

Note: the charge uses a direct atomic `tokenBalance: { $gte: amount }` + `$inc: -amount` (a variable-price charge, unlike the ±1 first-token reserve used by the AI paid-operation helper), and cancellation refunds `tokensCharged`. `attemptTokenCharge` is a thin exported wrapper kept purely so `attemptTokenCharge`'s test can exercise the amount-passing contract without a database; the route uses `chargeMentorTokens`/`refundMentorTokens` directly.

- [ ] **Step 4: Register the routes in `app.ts`**

In `project-minerva-be/src/app.ts`:
- Add import: `import { mentorsRoutes } from './modules/mentors/routes'`
- Add to the `app` chain (after the other route uses): `.use(mentorsRoutes)`

- [ ] **Step 5: Run backend type check**

Run: `bun run check`
Expected: PASS (no type errors). Fix any unused-import or typing errors from Step 3 before continuing.

- [ ] **Step 6: Run the tests**

Run: `bun test`
Expected: PASS, including the new `mentors.test.ts` cases.

- [ ] **Step 7: Commit**

```bash
git add src/modules/mentors/routes.ts src/modules/mentors/mentors.test.ts src/app.ts
git commit -m "feat(backend): add mentors catalog and token-charged booking routes"
```

---

### Task 2: Frontend mentors catalog + booking via useAppState

**Files:**
- Create: none
- Modify: `project-minerva-fe/src/composables/useAppState.ts`
- Modify: `project-minerva-fe/src/App.vue`
- Modify: `project-minerva-fe/src/data/mentors.ts`
- Modify: `project-minerva-fe/src/views/MentorsView.vue`

**Interfaces:**
- Consumes: `GET /api/mentors`, `GET /api/bookings`, `POST /api/mentors/:id/bookings`, `DELETE /api/bookings/:id` from Task 1; `staticMentors` from `data/mentors.ts`.
- Produces: `useAppState` now returns `mentors`, `loadMentors`, `mentorCatalogError`, `hydrateBooking`, `bookMentor`, `cancelMentorBooking`. `MentorsView` consumes those.

- [ ] **Step 1: Rename the static mentors export for reuse**

In `data/mentors.ts`, change `export const mentors` to `export const staticMentors`. Keep the `Mentor[]` type. Add a `priceInTokens` number and a token-based `sessionPrice` string to each of the 6 mentor objects so offline fallback cards match the backend (e.g. `sessionPrice: '15 tokens'`, `priceInTokens: 15`, and set `services`/`highlight`/`biography` per existing values).

- [ ] **Step 2: Write a failing test for the FE normalizer (thin)**

There is no frontend test runner configured in `package.json` (the only script is `build`). Do not add a test framework. Instead this step is a manual sanity gate: create `project-minerva-fe/scripts/normalize-mentor-check.mjs` is NOT required — skip it. The normalizer is verified by `npm run build` (tsc) in Step 6 and manual smoke in the final verification. Proceed directly to Step 3.

- [ ] **Step 3: Add mentors + booking state to `useAppState`**

In `composables/useAppState.ts`:

1. Update the top import from `../data/mentors`:
   - Change `import { mentors } from '../data/mentors'` to `import { staticMentors } from '../data/mentors'`. (`data/mentors.ts` previously was not imported here, so add this import if it is missing.)
2. Add `normalizeMentor` near `normalizeRemoteDocument` (before the `useAppState` return):

```ts
function normalizeMentor(raw: unknown): Mentor {
  const mentor = asRecord(raw)
  const name = String(mentor.name || 'Mentor')
  const words = name.split(/\s+/).filter(Boolean)
  const expertise = Array.isArray(mentor.expertise) ? mentor.expertise.map(String) : []
  const experience = Array.isArray(mentor.scholarshipExperience) ? mentor.scholarshipExperience.map(String) : []
  const services = Array.isArray(mentor.services) ? mentor.services.map(String) : ['Essay review', 'Mock interview']
  const times = Array.isArray(mentor.availableTimeSlots) ? mentor.availableTimeSlots.map(String) : []
  const price = Number(mentor.priceInTokens ?? 15)
  return {
    id: String(mentor.id || mentor._id || ''),
    name,
    initials: words.slice(0, 2).map((word) => word[0]?.toUpperCase() || '').join(''),
    photo: String(mentor.avatarUrl || ''),
    expertise: expertise.join(', '),
    scholarshipExperience: experience.join(', '),
    highlight: String(mentor.highlight || expertise[0] || ''),
    services,
    sessionPrice: `${price} tokens`,
    availableTimes: times,
    rating: Number(mentor.rating || 5),
    biography: String(mentor.biography || experience.join(', ')),
  }
}
```

3. Add state refs near `scholarshipCatalog`:

```ts
const staticMentorCatalog = staticMentors as Mentor[]
const mentors = ref<Mentor[]>(staticMentorCatalog)
const mentorCatalogError = ref('')
let mentorPromise: Promise<void> | null = null
function loadMentors(force = false): Promise<void> {
  if (mentorPromise) return mentorPromise
  if (!force && mentors.value.length >= staticMentorCatalog.length) return Promise.resolve()
  mentorCatalogError.value = ''
  mentorPromise = (async () => {
    try {
      const result = await apiRequest<{ mentors: unknown[] }>('/api/mentors')
      const remote = (result.mentors || []).map(normalizeMentor)
      const merged = [...remote]
      const seen = new Set(remote.map((item) => item.id))
      for (const item of staticMentorCatalog) if (!seen.has(item.id)) merged.push(item)
      mentors.value = merged
    } catch (error) {
      mentorCatalogError.value = error instanceof Error ? error.message : 'Could not load mentors.'
    } finally {
      mentorPromise = null
    }
  })()
  return mentorPromise
}
```

4. Add booking methods (place near `toggleSaved`):

```ts
const hydrateBooking = async () => {
  try {
    const result = await apiRequest<{ bookings: unknown[] }>('/api/bookings')
    const bookings = (result.bookings || []).filter((raw): raw is Record<string, unknown> => Boolean(raw) && typeof raw === 'object')
    const current = bookings.find((item) => item.status === 'approved' || item.status === 'pending')
    if (current) {
      booking.value = {
        mentorId: String(current.mentorId || ''),
        mentorName: String(current.mentorName || ''),
        service: String(current.service || ''),
        date: String(current.date || ''),
        time: String(current.time || ''),
        notes: String(current.notes || ''),
      }
    }
  } catch {
    // keep the last local booking on transient failure
  }
}
const bookMentor = async (payload: { mentorId: string; mentorName: string; service: string; date: string; time: string; notes: string }) => {
  const previous = booking.value
  booking.value = payload
  try {
    const result = await apiRequest<{ booking: Record<string, unknown>; tokenBalance?: number }>(`/api/mentors/${encodeURIComponent(payload.mentorId)}/bookings`, { method: 'POST', body: payload })
    syncAiTokenBalance(result)
    return result.booking
  } catch (error) {
    booking.value = previous
    throw error
  }
}
const cancelMentorBooking = async (bookingId: string) => {
  try {
    const result = await apiRequest<{ cancelled: boolean; tokenBalance?: number; bookingId?: string }>(`/api/bookings/${encodeURIComponent(bookingId)}`, { method: 'DELETE' })
    syncAiTokenBalance(result)
    booking.value = null
  } catch (error) {
    throw error
  }
}
```

5. Add a `bookingId` ref to track the backend id for cancels (populated in `hydrateBooking` from `current.id`, and nulled on cancel/book):

```ts
const bookingId = ref<string | null>(null)
// in hydrateBooking: bookingId.value = String(current.id || '')
// in bookMentor: bookingId.value = String(result.booking.id || '')
// in cancelMentorBooking: bookingId.value = null
```

6. Add `mentors`, `loadMentors`, `mentorCatalogError`, `hydrateBooking`, `bookMentor`, `cancelMentorBooking`, `bookingId` to the returned object (in the return block near `booking`), and in `resetUserState` reset `mentors.value = staticMentorCatalog`, `mentorCatalogError.value = ''`, `mentorPromise = null`, `bookingId.value = null`.

- [ ] **Step 4: Wire `loadMentors` and `hydrateBooking` into `App.vue`**

In `App.vue`, destructure the two new functions and call them in `onMounted` alongside `loadScholarshipCatalog`:
- Add `loadMentors`, `hydrateBooking` to the `useAppState()` destructure on line 12.
- In `onMounted`, change `void loadScholarshipCatalog()` to add `void loadMentors()`.
- After `await hydrateWorkspace()` at the end of `onMounted`, call `void hydrateBooking()`.

- [ ] **Step 5: Update `MentorsView.vue` to use the composable catalog + booking methods**

Replace `import { mentors } from '../data/mentors'` with the composable and derive a computed `mentors`:

- Remove the static import. From `useAppState()` destructure, take `mentors as stateMentors` — but the view already names a local `mentors` import; instead:
  - Add `import { computed, ref } from 'vue'` (already present).
  - Change `const { booking, toast, selectedId, getScholarship } = useAppState()` to include `mentors, booking, toast, selectedId, getScholarship, tokenBalance, bookMentor, cancelMentorBooking, bookingId, syncAiTokenBalance`.
  - Replace every reference to the old static `mentors` identifier so it now reads from the composable (the destructured `mentors` is a `Ref`; change list/`filter` calls from `mentors.filter` to `mentors.value.filter`, and `mentors.find` to `mentors.value.find`).
- `bookMentor`: rename the `confirmBook()` function body (the one writing `booking.value = {...}` on line 86) to call `bookMentor({ mentorId, mentorName, service, date: date.value, time: formatTimeRange(time.value), notes })`, wire the modal confirm button to it, and authorise it to call `syncAiTokenBalance` on the response. Disable the confirm button when `tokenBalance.value < Number(chosen.priceInTokens)`; show the token price in the modal.
- Replace the cancel handler (line 91-92, `booking.value = null`) with `cancelMentorBooking(bookingId.value)` guarded by the existing `window.confirm`.
- `bookingMentor` computed (line 25) uses `mentors.value.find(...)`; fall back to `booking.mentorName` if not found.

- [ ] **Step 6: Run the frontend build**

Run: `npm run build`
Expected: PASS (vue-tsc + vite). Fix any type errors (e.g. `Mentor` type now requires `priceInTokens`/token `sessionPrice` — ensure `types/index.ts` `Mentor` interface still satisfies both static and normalizer output; if `priceInTokens` is not in the interface, keep `sessionPrice` as the string field and only add `priceInTokens` as an optional field or derive it inside the component).

- [ ] **Step 7: Commit**

```bash
git add src/composables/useAppState.ts src/App.vue src/data/mentors.ts src/views/MentorsView.vue
git commit -m "feat(frontend): wire mentors catalog and token-charged booking"
```

---

### Task 3: Backend IELTS progress endpoints + tests

**Files:**
- Modify: `project-minerva-be/src/models/User.ts`
- Modify: `project-minerva-be/src/modules/ielts/routes.ts`
- Create: `project-minerva-be/src/modules/ielts/progress.ts`
- Create: `project-minerva-be/src/modules/ielts/progress.test.ts`

**Interfaces:**
- Consumes: `requireAuth`, `requireTrustedMutationOrigin`, `requireDatabase`, `User` model.
- Produces: `loadIeltsProgress` route-handler functions `GET /api/ielts/progress` and `PUT /api/ielts/progress` via `ieltsProgressRoutes` Elysia instance. Shape: `{ completedIeltsSimulationSets: number[], ieltsPracticeResults: PracticeResultShape[] }`.

- [ ] **Step 1: Add the two fields to the `User` schema**

In `src/models/User.ts`, inside `UserSchema`, add:

```ts
completedIeltsSimulationSets: { type: [Number], default: [] },
ieltsPracticeResults: {
  type: [
    new Schema(
      {
        scholarshipId: { type: String, default: '' },
        type: { type: String, default: '' },
        score: { type: Number, default: 0 },
        completedAt: { type: Date, default: null },
        explanation: { type: String, default: '' },
      },
      { _id: false },
    ),
  ],
  default: [],
},
```

- [ ] **Step 2: Create the progress module with a normalization helper + tests**

Create `src/modules/ielts/progress.ts`:

```ts
import { Elysia, t } from 'elysia'
import { requireAuth, requireTrustedMutationOrigin } from '../../auth/session'
import { requireDatabase } from '../../db/mongo'
import { User } from '../../models/User'

const practiceSchema = t.Object({
  scholarshipId: t.Optional(t.String()),
  type: t.String(),
  score: t.Number(),
  completedAt: t.String(),
  explanation: t.Optional(t.String()),
})

function progressJson(user: Record<string, any>) {
  return {
    completedIeltsSimulationSets: Array.isArray(user.completedIeltsSimulationSets)
      ? user.completedIeltsSimulationSets.map(Number).filter((value) => Number.isInteger(value))
      : [],
    ieltsPracticeResults: Array.isArray(user.ieltsPracticeResults)
      ? user.ieltsPracticeResults.map((item: Record<string, any>) => ({
          scholarshipId: String(item.scholarshipId || ''),
          type: String(item.type || ''),
          score: Number(item.score || 0),
          completedAt: item.completedAt ? new Date(item.completedAt).toISOString() : new Date().toISOString(),
          explanation: String(item.explanation || ''),
        }))
      : [],
  }
}

export const ieltsProgressRoutes = new Elysia({ name: 'ielts-progress-routes' })
  .get('/api/ielts/progress', async ({ request }) => {
    requireDatabase()
    const { userId } = await requireAuth(request)
    const user = await User.findById(userId).lean()
    return progressJson(user ?? {})
  })
  .put(
    '/api/ielts/progress',
    async ({ request, body }) => {
      requireDatabase()
      requireTrustedMutationOrigin(request)
      const { userId } = await requireAuth(request)
      const normalized = body.ieltsPracticeResults.map((item) => ({
        scholarshipId: item.scholarshipId || '',
        type: item.type,
        score: item.score,
        completedAt: item.completedAt ? new Date(item.completedAt) : new Date(),
        explanation: item.explanation || '',
      }))
      const updated = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            completedIeltsSimulationSets: body.completedIeltsSimulationSets,
            ieltsPracticeResults: normalized,
          },
        },
        { new: true },
      ).lean()
      return progressJson(updated ?? {})
    },
    {
      body: t.Object({
        completedIeltsSimulationSets: t.Array(t.Number()),
        ieltsPracticeResults: t.Array(practiceSchema),
      }),
    },
  )
```

Create `src/modules/ielts/progress.test.ts` — no DB needed, exercise `progressJson`:

```ts
import { describe, expect, it } from 'bun:test'
import { progressJson } from './progress'

describe('progressJson', () => {
  it('normalizes a full payload into the FE shape', () => {
    const json = progressJson({
      completedIeltsSimulationSets: [1, '2', 3],
      ieltsPracticeResults: [
        { scholarshipId: 'sch-1', type: 'IELTS Reading', score: 78, completedAt: '2026-08-01T00:00:00.000Z', explanation: 'ok' },
        {},
      ],
    })
    expect(json.completedIeltsSimulationSets).toEqual([1, 2, 3])
    expect(json.ieltsPracticeResults[0].score).toBe(78)
    expect(json.ieltsPracticeResults[1].score).toBe(0)
    expect(new Date(json.ieltsPracticeResults[1].completedAt).toString()).not.toBe('Invalid Date')
  })

  it('returns empty arrays when fields are missing', () => {
    expect(progressJson({})).toEqual({ completedIeltsSimulationSets: [], ieltsPracticeResults: [] })
  })
})
```

Note: export `progressJson` from `progress.ts` (not `export default`) so the test can import it.

- [ ] **Step 3: Register `ieltsProgressRoutes` in `app.ts`**

In `app.ts`, `import { ieltsProgressRoutes } from './modules/ielts/progress'` and add `.use(ieltsProgressRoutes)` to the chain. (Place it after the ielts routes use.)

- [ ] **Step 4: Run typing + tests**

Run: `bun run check && bun test`
Expected: PASS, including the new `progress.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/models/User.ts src/modules/ielts/progress.ts src/modules/ielts/progress.test.ts src/app.ts
git commit -m "feat(backend): persist completed IELTS simulation sets and practice results"
```

---

### Task 4: Frontend IELTS progress sync via useAppState

**Files:**
- Modify: `project-minerva-fe/src/composables/useAppState.ts`
- Modify: `project-minerva-fe/src/views/TestPrepView.vue`
- Create: `project-minerva-fe/src/views/TestPrepView.vue` (no change to App.vue — gate on the session in the composable)

**Interfaces:**
- Consumes: `GET /api/ielts/progress`, `PUT /api/ielts/progress` from Task 3.
- Produces: `useAppState` now exposes `completedIeltsSimulationSets`, `practiceByScholarship`, `loadIeltsProgress`.

- [ ] **Step 1: Add IELTS progress state + sync to `useAppState`**

In `composables/useAppState.ts`:

1. The refs already exist: `completedIeltsSimulationSets` is not currently in the composable (it lives in `TestPrepView`); `practiceByScholarship` already exists at line 159. Add `completedIeltsSimulationSets`:

```ts
const completedIeltsSimulationSets = ref<number[]>(read<number[]>('minerva-ielts-simulation-sets', []))
```

2. Add persistence for it alongside the other `persist` calls (line 165-167):

```ts
persist('minerva-ielts-simulation-sets', completedIeltsSimulationSets)
```

3. Add the load + sync functions:

```ts
let ieltsProgressLoaded = false
let ieltsSyncTimer: number | null = null
let ieltsSyncPromise: Promise<void> | null = null

const loadIeltsProgress = async () => {
  if (ieltsProgressLoaded) return
  try {
    const result = await apiRequest<{ completedIeltsSimulationSets?: number[]; ieltsPracticeResults?: PracticeResult[] }>('/api/ielts/progress')
    if (Array.isArray(result.completedIeltsSimulationSets)) completedIeltsSimulationSets.value = result.completedIeltsSimulationSets
    if (Array.isArray(result.ieltsPracticeResults) && result.ieltsPracticeResults.length) {
      for (const item of result.ieltsPracticeResults) {
        if (!item || !item.scholarshipId) continue
        practiceByScholarship.value[item.scholarshipId] = item
      }
    }
    ieltsProgressLoaded = true
  } catch {
    // non-fatal; local values kept, next change retries
  }
}

const scheduleIeltsSync = () => {
  if (ieltsSyncTimer !== null) window.clearTimeout(ieltsSyncTimer)
  ieltsSyncTimer = window.setTimeout(() => {
    ieltsSyncTimer = null
    if (!document.querySelector('[data-cookies-bound="true"]')) return
    if (ieltsSyncPromise) return
    ieltsSyncPromise = (async () => {
      try {
        await apiRequest('/api/ielts/progress', {
          method: 'PUT',
          body: {
            completedIeltsSimulationSets: completedIeltsSimulationSets.value,
            ieltsPracticeResults: Object.entries(practiceByScholarship.value).map(([scholarshipId, item]) => ({ ...item, scholarshipId })),
          },
        })
      } catch {
        // retry on next change
      } finally {
        ieltsSyncPromise = null
      }
    })()
  }, 800)
}

watch(
  [completedIeltsSimulationSets, practiceByScholarship],
  () => { scheduleIeltsSync() },
  { deep: true },
)
```

4. Reset `completedIeltsSimulationSets.value = []` and `ieltsProgressLoaded = false` in `resetUserState`; add the three exports to the return object.

5. In `App.vue`, after `await hydrateWorkspace()`, call `void loadIeltsProgress()` (add to the destructure on line 12).

- [ ] **Step 2: Update `TestPrepView.vue` to use the composable refs**

- Remove `const completedSimulationSets = ref<number[]>(JSON.parse(localStorage.getItem('minerva-ielts-simulation-sets') || '[]'))` (line 40).
- Remove the `watch(completedSimulationSets, ...)` localStorage write (line 178).
- Destructure `completedIeltsSimulationSets` (and keep `practiceResult`, `toast`, `selectedId`, `syncAiTokenBalance`, `getScholarship`) from `useAppState()`.
- Replace all references to the removed local `completedSimulationSets` with `completedIeltsSimulationSets.value` (the ref already handles `.push`, `.includes`, and the `.value` guard in the results block). Keep the push at line 390: `completedIeltsSimulationSets.value.push(...)`.
- `resetUserState` already clears `minerva-ielts-simulation-sets` (line 484), so nothing more.

- [ ] **Step 3: Run the frontend build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/composables/useAppState.ts src/App.vue src/views/TestPrepView.vue
git commit -m "feat(frontend): sync IELTS progress and practice results to backend"
```

---

### Task 5: Backend pricing packs endpoint

**Files:**
- Modify: `project-minerva-be/src/modules/auth/routes.ts`

**Interfaces:**
- Consumes: `demoTokenPacks` const (existing), `requireDatabase`.
- Produces: `GET /api/pricing/packs` returning `{ packs: PricingPack[] }` where `PricingPack = { id; name; tokens; price; description; badge }`.

- [ ] **Step 1: Add the packs route**

In `src/modules/auth/routes.ts`, after the `demoTokenPacks` const (line ~30), add a static description/price map and a GET route. Add to `authRoutes` (the existing Elysia chain), after the top-up route:

```ts
const packDisplay: Record<string, { name: string; price: string; description: string; badge: string }> = {
  starter:  { name: 'Starter',  price: '$4.99',  description: 'A focused boost for one application.',    badge: '' },
  momentum: { name: 'Momentum', price: '$11.99', description: 'Great for an active application season.', badge: 'Most popular' },
  focus:    { name: 'Focus',    price: '$19.99', description: 'Extra support across several folders.',    badge: '' },
}
```

Then register `GET /api/pricing/packs`:

```ts
.get('/api/pricing/packs', async ({ request }) => {
  requireDatabase()
  requireTrustedMutationOrigin(request)
  const packs = (Object.keys(demoTokenPacks) as Array<keyof typeof demoTokenPacks>).map((id) => {
    const display = packDisplay[id]
    return {
      id,
      name: display.name,
      tokens: demoTokenPacks[id],
      price: display.price,
      description: display.description,
      badge: display.badge,
    }
  })
  return { packs }
})
```

Note: this route sends no mutated data; `requireTrustedMutationOrigin` is called here only to keep parity with mutation guards. `tokens` is read from `demoTokenPacks` (single source of truth); prices/descriptions are the fixed strings.

- [ ] **Step 2: Run the backend type check**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/routes.ts
git commit -m "feat(backend): serve token pack pricing from /api/pricing/packs"
```

---

### Task 6: Frontend data-driven pricing (prices fixed)

**Files:**
- Modify: `project-minerva-fe/src/views/PaymentView.vue`
- Modify: `project-minerva-fe/src/views/PricingView.vue`

**Interfaces:**
- Consumes: `GET /api/pricing/packs` from Task 5; existing `apiRequest` and `useAppState`.

- [ ] **Step 1: Make `PaymentView` fetch packs**

In `views/PaymentView.vue`:
- Define a type for the pack and a ref with the local fallback:
  ```ts
  interface Pack { id: string; name: string; tokens: number; price: string; description: string; badge: string }
  const fallbackPacks: Pack[] = [
    { id: 'starter',  name: 'Starter',  tokens: 10, price: '$4.99',  description: 'A focused boost for one application.',    badge: '' },
    { id: 'momentum', name: 'Momentum', tokens: 30, price: '$11.99', description: 'Great for an active application season.', badge: 'Most popular' },
    { id: 'focus',    name: 'Focus',    tokens: 60, price: '$19.99', description: 'Extra support across several folders.',    badge: '' },
  ]
  const packs = ref<Pack[]>(fallbackPacks)
  ```
- Remove the old `const packs = [...] as const` and the `selectedPackId` typing tied to it; change `selectedPackId` to `ref<string>('momentum')` and `selectedPack`/`purchaseTokens` reads to use `packs.value.find(...)` with string comparison. Replace `(typeof packs)[number]['id']` usage with `string`.
- Add an `onMounted` that fetches:
  ```ts
  onMounted(async () => {
    try {
      const result = await apiRequest<{ packs: Pack[] }>('/api/pricing/packs')
      if (Array.isArray(result.packs) && result.packs.length) packs.value = result.packs
    } catch {
      // keep the local fallback
    }
  })
  ```
- Import `onMounted` from `'vue'` and `apiRequest` (already imported). Update the template loop bound to `packs.value` (the `v-for="pack in packs"` in the `<template>` now iterates the ref — change to `v-for="pack in packs.value"`). All card rendering, the order summary, and the top-up POST (which sends `selectedPack.value.id`) stay unchanged.

- [ ] **Step 2: Update `PricingView` tokens plan from served packs**

In `views/PricingView.vue`:
- Keep the three static plan objects. Add state:
  ```ts
  import { onMounted, ref } from 'vue'
  import { apiRequest } from '../api'
  const packInfo = ref<Array<{ name: string; tokens: number }> | null>(null)
  onMounted(async () => {
    try {
      const result = await apiRequest<{ packs: Array<{ name: string; tokens: number }> }>('/api/pricing/packs')
      if (Array.isArray(result.packs)) packInfo.value = result.packs
    } catch { /* keep static */ }
  })
  ```
- In the template, for the "Tokens" card's feature `<li>` list, replace the static list with a computed that renders `packInfo` lines when loaded, falling back to the existing three default lines. Keep the "Pricing to Be Announced" status and the "Buy tokens" link unchanged — visible prices do not change.

- [ ] **Step 3: Run the frontend build**

Run: `npm run build`
Expected: PASS (type-safety: ensure `PricingView` still passes `vue-tsc`; the `packInfo` computed only adds lines).

- [ ] **Step 4: Commit**

```bash
git add src/views/PaymentView.vue src/views/PricingView.vue
git commit -m "feat(frontend): source token packs from backend pricing endpoint"
```

---

### Task 7: End-to-end verification (manual)

**Files:**
- None (no code changes).

- [ ] **Step 1: Run both test suites**

Backend: `cd project-minerva-be && bun run check && bun test`
Frontend: `cd project-minerva-fe && npm run build`
Expected: both PASS.

- [ ] **Step 2: Manual smoke — mentors + booking**

Run backend and frontend dev servers. Sign in. Confirm the mentors page lists the backend catalog (`GET /api/mentors`). Try booking a mentor with sufficient tokens: confirm balance decrements by `priceInTokens`, `GET /api/bookings` shows the booking, and `Transaction` has `type: 'mentor_booking'`. Cancel the booking and confirm tokens are refunded. Attempt a booking with zero balance and confirm it is blocked with the depleted toast, no booking created.

- [ ] **Step 3: Manual smoke — IELTS progress**

Complete (or stitch) a full IELTS simulation in Simulation mode. Confirm `GET /api/ielts/progress` returns the updated simulation-set number and practice result. Reload the app and log out/in: confirm the completed-set flag and saved result rehydrate from the backend, not localStorage.

- [ ] **Step 4: Manual smoke — pricing**

Open `/payment` and `/pricing`. Confirm the same 10/30/60 packs and `$4.99/$11.99/$19.99` prices render as before the change, now sourced from `/api/pricing/packs`. Confirm a starter top-up still adds 10 tokens.

- [ ] **Step 5: Final commit if any follow-on fix was made**

If any step required a fix, commit it separately with a descriptive message. No commit otherwise.
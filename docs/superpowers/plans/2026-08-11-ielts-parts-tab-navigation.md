# IELTS Parts Tab Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tab navigation for listening (4 parts) and reading (3 parts) in the IELTS practice interface, allowing users to navigate between parts within each section.

**Architecture:** Filter exercises by section and order to get one per part. Add reactive refs to track active part. Change answer arrays from flat to per-part records. Render tabs above exam content, showing only selected parts in practice mode.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), TypeScript, Tailwind CSS

## Global Constraints

- Vue 3 with `<script setup>` and Composition API
- TypeScript strict mode
- Tailwind CSS for styling
- Follow existing code conventions in `TestPrepView.vue`
- No new dependencies required
- Backend API unchanged — frontend adapts to existing data structure

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/services/ielts.ts` | Modify | Add `instruction` field to `IeltsExercise` interface |
| `src/views/TestPrepView.vue` | Modify | All UI and logic changes for parts tab navigation |

---

### Task 1: Update IeltsExercise Interface

**Files:**
- Modify: `src/services/ielts.ts:12-20`

**Interfaces:**
- Produces: `IeltsExercise` with `instruction` field

- [ ] **Step 1: Add instruction field to IeltsExercise interface**

```typescript
export interface IeltsExercise {
  id: string
  section: IeltsSection
  title: string
  instruction: string  // Per-part instructions from backend
  content: string
  audioUrl: string | null
  order: number
  questions: IeltsQuestion[]
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx vue-tsc --noEmit`
Expected: PASS (no type errors in this file)

- [ ] **Step 3: Commit**

```bash
git add src/services/ielts.ts
git commit -m "feat(ielts): add instruction field to IeltsExercise interface"
```

---

### Task 2: Add Part Tracking State

**Files:**
- Modify: `src/views/TestPrepView.vue:33-44`

**Interfaces:**
- Produces: `listeningPart`, `readingPart` refs, updated `listeningAnswers`, `readingAnswers`

- [ ] **Step 1: Add part tracking refs after line 48**

```typescript
const listeningPart = ref(1)
const readingPart = ref(1)
```

- [ ] **Step 2: Change answer arrays to per-part records**

Replace lines 44-45:
```typescript
const listeningAnswers = ref<Record<number, string[]>>({
  1: [], 2: [], 3: [], 4: []
})
const readingAnswers = ref<Record<number, string[]>>({
  1: [], 2: [], 3: []
})
```

- [ ] **Step 3: Commit**

```bash
git add src/views/TestPrepView.vue
git commit -m "feat(ielts): add per-part answer tracking state"
```

---

### Task 3: Add Filtered Exercise Computed Properties

**Files:**
- Modify: `src/views/TestPrepView.vue:95-104`

**Interfaces:**
- Produces: `listeningExercises`, `readingExercises`, `currentListeningExercise`, `currentReadingExercise`

- [ ] **Step 1: Replace single exercise getters with filtered arrays**

Replace lines 95-96:
```typescript
const listeningExercises = computed(() =>
  exercises.value
    .filter(item => item.section === 'listening')
    .sort((a, b) => a.order - b.order)
)
const readingExercises = computed(() =>
  exercises.value
    .filter(item => item.section === 'reading')
    .sort((a, b) => a.order - b.order)
)
```

- [ ] **Step 2: Add current exercise getters**

After the filtered arrays, add:
```typescript
const currentListeningExercise = computed(() =>
  listeningExercises.value[listeningPart.value - 1]
)
const currentReadingExercise = computed(() =>
  readingExercises.value[readingPart.value - 1]
)
```

- [ ] **Step 3: Commit**

```bash
git add src/views/TestPrepView.vue
git commit -m "feat(ielts): add filtered exercise computed properties"
```

---

### Task 4: Update Answer and Label Getters

**Files:**
- Modify: `src/views/TestPrepView.vue:99-104`

**Interfaces:**
- Consumes: `currentListeningExercise`, `currentReadingExercise`
- Produces: Updated `listeningLabels`, `readingQuestionItems`, `readingParagraphs`, `listeningAudioUrl`

- [ ] **Step 1: Update listeningLabels to use current exercise**

Replace line 99:
```typescript
const listeningLabels = computed(() =>
  currentListeningExercise.value?.questions.map(item => item.questionText) || []
)
```

- [ ] **Step 2: Update readingQuestionItems to use current exercise**

Replace line 100:
```typescript
const readingQuestionItems = computed(() =>
  currentReadingExercise.value?.questions.map(item => ({
    text: item.questionText,
    type: item.type,
    options: item.options
  })) || []
)
```

- [ ] **Step 3: Update readingParagraphs to use current exercise**

Replace lines 101-104:
```typescript
const readingParagraphs = computed(() =>
  (currentReadingExercise.value?.content.split('\n').filter(Boolean) || []).map(line => {
    const match = line.match(/^([A-E])\.\s*(.*)$/s)
    return match ? { letter: match[1], body: match[2] } : { letter: '', body: line }
  })
)
```

- [ ] **Step 4: Update listeningAudioUrl to use current exercise**

Replace line 105:
```typescript
const listeningAudioUrl = computed(() => mediaUrl(currentListeningExercise.value?.audioUrl))
```

- [ ] **Step 5: Commit**

```bash
git add src/views/TestPrepView.vue
git commit -m "feat(ielts): update getters to use current exercise"
```

---

### Task 5: Update Answered Count and Total Questions

**Files:**
- Modify: `src/views/TestPrepView.vue:110-116`

**Interfaces:**
- Consumes: `listeningAnswers`, `readingAnswers`, `currentListeningExercise`, `currentReadingExercise`

- [ ] **Step 1: Update answeredCount for per-part tracking**

Replace lines 110-115:
```typescript
const answeredCount = computed(() => {
  if (currentSkill.value === 'Listening') {
    const answers = listeningAnswers.value[listeningPart.value] || []
    return answers.filter(Boolean).length
  }
  if (currentSkill.value === 'Reading') {
    const answers = readingAnswers.value[readingPart.value] || []
    return answers.filter(Boolean).length
  }
  if (currentSkill.value === 'Writing') return Number(Boolean(writingAnswers.value[1].trim())) + Number(Boolean(writingAnswers.value[2].trim()))
  return Number(recordingSaved.value)
})
```

- [ ] **Step 2: Update totalQuestions to use current exercise**

Replace line 116:
```typescript
const totalQuestions = computed(() => {
  if (currentSkill.value === 'Listening') return currentListeningExercise.value?.questions.length || 0
  if (currentSkill.value === 'Reading') return currentReadingExercise.value?.questions.length || 0
  if (currentSkill.value === 'Writing') return 2
  return 3
})
```

- [ ] **Step 3: Commit**

```bash
git add src/views/TestPrepView.vue
git commit -m "feat(ielts): update count getters for per-part tracking"
```

---

### Task 6: Update Reset and Submission Logic

**Files:**
- Modify: `src/views/TestPrepView.vue:123-326`

**Interfaces:**
- Consumes: `listeningAnswers`, `readingAnswers`, `listeningExercises`, `readingExercises`

- [ ] **Step 1: Update resetAttempt to clear per-part answers**

Replace lines 134-135:
```typescript
listeningAnswers.value = { 1: [], 2: [], 3: [], 4: [] }
readingAnswers.value = { 1: [], 2: [], 3: [] }
```

- [ ] **Step 2: Update firstIncompleteFullSkill for per-part answers**

Replace lines 257-262:
```typescript
const firstIncompleteFullSkill = (): Skill | null => {
  for (const part of [1, 2, 3, 4]) {
    const answers = listeningAnswers.value[part] || []
    if (answers.some(answer => !answer.trim())) return 'Listening'
  }
  for (const part of [1, 2, 3]) {
    const answers = readingAnswers.value[part] || []
    if (answers.some(answer => !answer.trim())) return 'Reading'
  }
  if (!writingAnswers.value[1].trim() || !writingAnswers.value[2].trim()) return 'Writing'
  if ([1, 2, 3].some((part) => !speakingRecordings.has(part))) return 'Speaking'
  return null
}
```

- [ ] **Step 3: Update submission to send per-exercise answers**

Replace lines 284-289:
```typescript
const autoScored = exercises.value
  .filter(item => (fullTest.value || currentSkill.value === 'Listening' || currentSkill.value === 'Reading') && (item.section === 'listening' || item.section === 'reading'))
  .map(item => ({
    exerciseId: item.id,
    answers: item.section === 'listening'
      ? listeningAnswers.value[item.order] || []
      : readingAnswers.value[item.order] || []
  }))
```

- [ ] **Step 4: Update playListening to use current exercise**

Replace line 180:
```typescript
const script = currentListeningExercise.value?.content || ''
```

- [ ] **Step 5: Commit**

```bash
git add src/views/TestPrepView.vue
git commit -m "feat(ielts): update reset and submission logic for per-part answers"
```

---

### Task 7: Add Tab Navigation UI

**Files:**
- Modify: `src/views/TestPrepView.vue:585-641`

**Interfaces:**
- Consumes: `listeningPart`, `readingPart`, `listeningExercises`, `readingExercises`, `selectedParts`, `currentSkill`, `mode`

- [ ] **Step 1: Add listening tab bar**

After line 585 (`<section v-if="currentSkill === 'Listening'"...>`), before the audio player, add:
```html
<div class="flex gap-2 border-b border-slate-200 bg-[#fafafe] px-6 py-3">
  <button
    v-for="exercise in listeningExercises"
    :key="exercise.order"
    class="rounded-xl px-4 py-2 text-sm font-extrabold transition-colors"
    :class="listeningPart === exercise.order ? 'bg-[#17136b] text-white' : 'text-slate-500 hover:bg-slate-100'"
    :disabled="mode === 'practice' && !selectedParts.listening.includes(exercise.order)"
    @click="listeningPart = exercise.order"
  >
    Part {{ exercise.order }}
  </button>
</div>
```

- [ ] **Step 2: Add reading tab bar**

After line 616 (`<section v-else-if="currentSkill === 'Reading'"...>`), before the passage article, add:
```html
<div class="flex gap-2 border-b border-slate-200 bg-[#fafafe] px-6 py-3">
  <button
    v-for="exercise in readingExercises"
    :key="exercise.order"
    class="rounded-xl px-4 py-2 text-sm font-extrabold transition-colors"
    :class="readingPart === exercise.order ? 'bg-[#17136b] text-white' : 'text-slate-500 hover:bg-slate-100'"
    :disabled="mode === 'practice' && !selectedParts.reading.includes(exercise.order)"
    @click="readingPart = exercise.order"
  >
    Part {{ exercise.order }}
  </button>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/views/TestPrepView.vue
git commit -m "feat(ielts): add tab navigation UI for listening and reading"
```

---

### Task 8: Update Listening Section Template

**Files:**
- Modify: `src/views/TestPrepView.vue:585-614`

**Interfaces:**
- Consumes: `currentListeningExercise`, `listeningLabels`, `listeningAnswers`, `listeningPart`

- [ ] **Step 1: Update listening section to use current exercise**

Replace line 601 (hardcoded instruction):
```html
<p class="text-xs font-extrabold uppercase tracking-[.14em] text-[#5b45f5]">
  Part {{ listeningPart }} · Questions 1–{{ listeningLabels.length }}
</p>
```

Replace line 603 (hardcoded instruction):
```html
<p class="mt-5 text-sm italic text-slate-500">{{ currentListeningExercise?.instruction }}</p>
```

- [ ] **Step 2: Update listening answer inputs to use per-part answers**

Replace line 609 (answer input):
```html
<input v-model="listeningAnswers[listeningPart][index]" class="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#5b45f5]" />
```

- [ ] **Step 3: Commit**

```bash
git add src/views/TestPrepView.vue
git commit -m "feat(ielts): update listening section to use current exercise"
```

---

### Task 9: Update Reading Section Template

**Files:**
- Modify: `src/views/TestPrepView.vue:616-641`

**Interfaces:**
- Consumes: `currentReadingExercise`, `readingQuestionItems`, `readingParagraphs`, `readingAnswers`, `readingPart`

- [ ] **Step 1: Update reading section to use current exercise**

Replace line 618 (hardcoded instruction):
```html
<p class="text-xs font-extrabold uppercase tracking-[.14em] text-[#5b45f5]">
  Part {{ readingPart }} · Reading passage {{ readingPart }}
</p>
```

Replace line 620 (hardcoded instruction):
```html
<p class="mt-2 text-sm italic text-slate-500">{{ currentReadingExercise?.instruction }}</p>
```

- [ ] **Step 2: Update reading answer inputs to use per-part answers**

Replace line 632 (matching/mcq select):
```html
<select v-if="question.type === 'matching' || question.type === 'mcq'" v-model="readingAnswers[readingPart][index]" class="w-24 rounded-lg border border-slate-300 px-3 py-2">
```

Replace line 636 (gap-fill input):
```html
<input v-else v-model="readingAnswers[readingPart][index]" class="w-40 rounded-lg border border-slate-300 px-3 py-2" />
```

- [ ] **Step 3: Commit**

```bash
git add src/views/TestPrepView.vue
git commit -m "feat(ielts): update reading section to use current exercise"
```

---

### Task 10: Update Footer Navigator

**Files:**
- Modify: `src/views/TestPrepView.vue:684-694`

**Interfaces:**
- Consumes: `listeningAnswers`, `readingAnswers`, `listeningPart`, `readingPart`, `currentSkill`

- [ ] **Step 1: Update footer to show current part question numbers**

Replace line 690 (question navigator buttons):
```html
<button v-for="n in totalQuestions" :key="n" class="grid size-9 shrink-0 place-items-center rounded-full border text-xs font-extrabold" :class="[reviewed.includes(n) ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200', (currentSkill === 'Listening' ? (listeningAnswers[listeningPart] || [])[n-1] : currentSkill === 'Reading' ? (readingAnswers[readingPart] || [])[n-1] : false) && 'bg-[#5b45f5] text-white']" @click="toggleReview(n)">{{ n }}</button>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/TestPrepView.vue
git commit -m "feat(ielts): update footer to show current part questions"
```

---

### Task 11: Update Practice Mode Part Selection

**Files:**
- Modify: `src/views/TestPrepView.vue:486-493`

**Interfaces:**
- Consumes: `selectedParts`, `currentSkill`, `listeningPart`, `readingPart`

- [ ] **Step 1: Initialize active part from selected parts when starting practice**

In the `beginTest` function (line 170-173), add part initialization:
```typescript
const beginTest = () => {
  if (currentSkill.value === 'Speaking' && !fullTest.value) stage.value = 'microphone'
  else {
    stage.value = 'exam'
    // Initialize active part from selected parts
    if (currentSkill.value === 'Listening') {
      const firstSelected = selectedParts.value.listening[0]
      if (firstSelected) listeningPart.value = firstSelected
    } else if (currentSkill.value === 'Reading') {
      const firstSelected = selectedParts.value.reading[0]
      if (firstSelected) readingPart.value = firstSelected
    }
    if (mode.value === 'simulation') startTimer()
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/TestPrepView.vue
git commit -m "feat(ielts): initialize active part from selected parts"
```

---

### Task 12: Update Full Test Tab Navigation

**Files:**
- Modify: `src/views/TestPrepView.vue:580-582`

**Interfaces:**
- Consumes: `currentSkill`, `listeningPart`, `readingPart`

- [ ] **Step 1: Reset part when switching skills in full test mode**

Replace line 581 (skill tab buttons):
```html
<button v-for="item in skills" :key="item.name" class="rounded-xl px-4 py-2 text-sm font-extrabold" :class="currentSkill === item.name ? 'bg-[#17136b] text-white' : 'text-slate-500'" :disabled="recording" @click="currentSkill = item.name; if(item.name === 'Listening') listeningPart = 1; if(item.name === 'Reading') readingPart = 1">{{ item.name }}</button>
```

- [ ] **Step 2: Commit**

```bash
git add src/views/TestPrepView.vue
git commit -m "feat(ielts): reset part when switching skills in full test"
```

---

### Task 13: Verify TypeScript Compilation

**Files:**
- Modify: None (verification only)

- [ ] **Step 1: Run TypeScript check**

Run: `npx vue-tsc --noEmit`
Expected: PASS (no type errors)

- [ ] **Step 2: Fix any type errors if found**

- [ ] **Step 3: Commit if fixes needed**

```bash
git add src/views/TestPrepView.vue src/services/ielts.ts
git commit -m "fix(ielts): resolve type errors for parts tab navigation"
```

---

### Task 14: Manual Testing

**Files:**
- None (testing only)

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Test listening practice mode**

- Navigate to IELTS Test Prep
- Click Practice on Listening
- Select Part 1 and Part 3 only
- Click Continue
- Verify only Part 1 and Part 3 tabs appear
- Answer questions in Part 1
- Switch to Part 3
- Verify Part 1 answers are preserved
- Switch back to Part 1
- Verify answers still there
- Submit

- [ ] **Step 3: Test reading practice mode**

- Navigate to IELTS Test Prep
- Click Practice on Reading
- Select Part 1 and Part 2 only
- Click Continue
- Verify only Part 1 and Part 2 tabs appear
- Answer questions in Part 1
- Switch to Part 2
- Verify Part 1 answers are preserved
- Submit

- [ ] **Step 4: Test simulation mode**

- Click Full Simulation
- Verify all 4 listening tabs appear
- Verify all 3 reading tabs appear
- Navigate between tabs
- Submit

- [ ] **Step 5: Final commit if any fixes**

```bash
git add -A
git commit -m "fix(ielts): manual testing fixes for parts tab navigation"
```

---

## Spec Coverage Check

| Requirement | Task |
|-------------|------|
| Add instruction field to interface | Task 1 |
| Add per-part answer tracking | Task 2 |
| Filter exercises by section/order | Task 3 |
| Update getters to use current exercise | Task 4 |
| Update count getters for per-part | Task 5 |
| Update reset and submission logic | Task 6 |
| Add tab navigation UI | Task 7 |
| Update listening section template | Task 8 |
| Update reading section template | Task 9 |
| Update footer navigator | Task 10 |
| Practice mode shows only selected parts | Task 7, 11 |
| Simulation mode shows all parts | Task 7 |
| Answers persist when switching tabs | Task 2, 8, 9 |
| Submit per-exercise, not per-section | Task 6 |

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  ArrowRight, BookOpen, BookOpenCheck, Check, CheckCircle2, ChevronLeft,
  ChevronRight, CircleAlert, Clock3, FilePenLine, Flag, Grid2X2, Headphones,
  ListChecks, LockKeyhole, Maximize2, Mic, Pause, Play, Send, Volume2,
} from 'lucide-vue-next'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'
import BaseModal from '../components/common/BaseModal.vue'
import { useAppState } from '../composables/useAppState'
import { apiRequest } from '../api'
import {
  evaluateIeltsSpeaking, evaluateIeltsWriting, getIeltsEvaluations, getIeltsSet,
  getIeltsSubmissions, mediaUrl, submitIeltsSet,
} from '../services/ielts'
import type {
  IeltsAiEvaluation, IeltsEvaluationHistoryItem, IeltsExercise, IeltsSubmissionResult,
} from '../services/ielts'

type Skill = 'Listening' | 'Reading' | 'Writing' | 'Speaking'
type Stage = 'catalog' | 'mode' | 'instructions' | 'microphone' | 'exam' | 'results'
type Mode = 'practice' | 'simulation'
interface TranscriptionHistoryItem {
  id: string
  kind: 'speaking'
  prompt: string
  transcript?: string
  durationSeconds?: number
  createdAt: string
}

const { practiceResult, toast, selectedId, syncAiTokenBalance, getScholarship } = useAppState()
const selected = computed(() => selectedId.value ? getScholarship(selectedId.value) : undefined)
const stage = ref<Stage>('catalog')
const currentSkill = ref<Skill>('Listening')
const mode = ref<Mode>('simulation')
const fullTest = ref(false)
const simulationSet = ref(1)
const completedSimulationSets = ref<number[]>(JSON.parse(localStorage.getItem('minerva-ielts-simulation-sets') || '[]'))
const selectedParts = ref({
  listening: [1, 2, 3, 4],
  reading: [1, 2, 3],
  writing: [1, 2],
  speaking: [1, 2, 3],
})
const timeLimit = ref(32)
const remaining = ref(32 * 60)
const playing = ref(false)
const audioProgress = ref(0)
const reviewed = ref<number[]>([])
const listeningAnswers = ref<Record<number, string[]>>({
  1: [], 2: [], 3: [], 4: []
})
const readingAnswers = ref<Record<number, string[]>>({
  1: [], 2: [], 3: []
})
const writingTask = ref<1 | 2>(1)
const writingAnswers = ref<Record<1 | 2, string>>({ 1: '', 2: '' })
const listeningPart = ref(1)
const readingPart = ref(1)
const speakingPart = ref(1)
const micStatus = ref<'idle' | 'testing' | 'ready' | 'blocked'>('idle')
const recording = ref(false)
const recordingSaved = ref(false)
const resultScore = ref(0)
const submitting = ref(false)
const aiError = ref('')
const showIeltsInfo = ref(false)
const estimatedBand = ref<number | null>(null)
const serverPercent = ref<number | null>(null)
const aiEvaluations = ref<IeltsAiEvaluation[]>([])
const speakingTranscripts = ref<Record<number, string>>({})
const transcriptionHistory = ref<TranscriptionHistoryItem[]>([])
const transcriptionHistoryLoading = ref(false)
const transcriptionHistoryError = ref('')
const speakingRecordings = new Map<number, Blob>()
const speakingDurations = new Map<number, number>()
const exercises = ref<IeltsExercise[]>([])
const loadingSet = ref(true)
const setError = ref('')
const submissionHistory = ref<IeltsSubmissionResult[]>([])
const aiHistory = ref<IeltsEvaluationHistoryItem[]>([])
let timer: number | undefined
let recorder: MediaRecorder | undefined
let micStream: MediaStream | undefined
let recordingChunks: Blob[] = []
let recordingStartedAt = 0
let stopRecordingPromise: Promise<void> | null = null
let resolveRecordingStop: (() => void) | null = null

const skills = [
  { name: 'Listening' as Skill, icon: Headphones, detail: '4 parts · 40 questions', time: '30 min' },
  { name: 'Reading' as Skill, icon: BookOpen, detail: '3 passages · 40 questions', time: '60 min' },
  { name: 'Writing' as Skill, icon: FilePenLine, detail: '2 writing tasks', time: '60 min' },
  { name: 'Speaking' as Skill, icon: Mic, detail: '3 interview parts', time: '11–14 min' },
]
const partsForSkill = (skill: Skill) => {
  const counts: Record<Skill, number> = { Listening: 4, Reading: 3, Writing: 2, Speaking: 3 }
  return Array.from({ length: counts[skill] }, (_, i) => i + 1)
}
const getSelectedParts = (skill: Skill) => {
  return selectedParts.value[skill.toLowerCase() as keyof typeof selectedParts.value]
}
const toggleSelectedPart = (part: number) => {
  const key = currentSkill.value.toLowerCase() as keyof typeof selectedParts.value
  const current = selectedParts.value[key]
  selectedParts.value[key] = current.includes(part)
    ? current.filter((value) => value !== part)
    : [...current, part].sort((a, b) => a - b)
}
const listeningExercises = computed(() =>
  exercises.value
    .filter(item => item.section === 'listening')
    .sort((a, b) => a.order - b.order)
    .map((exercise, i) => ({ ...exercise, part: i + 1 }))
)
const readingExercises = computed(() =>
  exercises.value
    .filter(item => item.section === 'reading')
    .sort((a, b) => a.order - b.order)
    .map((exercise, i) => ({ ...exercise, part: i + 1 }))
)
const currentListeningExercise = computed(() =>
  listeningExercises.value[listeningPart.value - 1]
)
const currentReadingExercise = computed(() =>
  readingExercises.value[readingPart.value - 1]
)
const writingExercises = computed(() => exercises.value.filter((item) => item.section === 'writing').sort((a, b) => a.order - b.order))
const speakingExercises = computed(() => exercises.value.filter((item) => item.section === 'speaking').sort((a, b) => a.order - b.order))
const listeningLabels = computed(() => currentListeningExercise.value?.questions.map((item) => item.questionText) || [])
const readingQuestionItems = computed(() => currentReadingExercise.value?.questions.map((item) => ({ text: item.questionText, type: item.type, options: item.options })) || [])
const readingParagraphs = computed(() => (currentReadingExercise.value?.content.split('\n').filter(Boolean) || []).map((line) => {
  const match = line.match(/^([A-E])\.\s*(.*)$/s)
  return match ? { letter: match[1], body: match[2] } : { letter: '', body: line }
}))
const listeningAudioUrl = computed(() => mediaUrl(currentListeningExercise.value?.audioUrl))
const writingPrompt = (task: 1 | 2) => writingExercises.value[task - 1]?.content || ''
const speakingPrompt = (part: number) => speakingExercises.value[part - 1]?.content || ''
const formatTime = computed(() => `${String(Math.floor(remaining.value / 60)).padStart(2, '0')}:${String(remaining.value % 60).padStart(2, '0')}`)
const wordCount = computed(() => writingAnswers.value[writingTask.value].trim() ? writingAnswers.value[writingTask.value].trim().split(/\s+/).length : 0)
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
const totalQuestions = computed(() => {
  if (currentSkill.value === 'Listening') return currentListeningExercise.value?.questions.length || 0
  if (currentSkill.value === 'Reading') return currentReadingExercise.value?.questions.length || 0
  if (currentSkill.value === 'Writing') return 2
  return 3
})
const combinedStrengths = computed(() => [...new Set(aiEvaluations.value.flatMap((item) => item.strengths || []))].slice(0, 5))
const combinedImprovements = computed(() => [...new Set(aiEvaluations.value.flatMap((item) => item.improvements || []))].slice(0, 5))

const formatHistoryDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const loadTranscriptionHistory = async () => {
  transcriptionHistoryLoading.value = true
  transcriptionHistoryError.value = ''
  try {
    const result = await apiRequest<{ evaluations?: TranscriptionHistoryItem[] }>('/api/ielts/evaluations?kind=speaking')
    transcriptionHistory.value = (result.evaluations || []).filter((item): item is TranscriptionHistoryItem => item.kind === 'speaking' && Boolean(item.transcript))
  } catch (error) {
    transcriptionHistoryError.value = error instanceof Error ? error.message : 'Could not load transcription history.'
  } finally {
    transcriptionHistoryLoading.value = false
  }
}

watch(completedSimulationSets, (sets) => localStorage.setItem('minerva-ielts-simulation-sets', JSON.stringify(sets)), { deep: true })
watch(speakingPart, (part) => { recordingSaved.value = speakingRecordings.has(part) })

const resetAttempt = () => {
  window.clearInterval(timer)
  speechSynthesis.cancel()
  micStream?.getTracks().forEach((track) => track.stop())
  recorder = undefined
  micStream = undefined
  recording.value = false
  recordingSaved.value = false
  recordingChunks = []
  stopRecordingPromise = null
  resolveRecordingStop = null
  listeningAnswers.value = { 1: [], 2: [], 3: [], 4: [] }
  readingAnswers.value = { 1: [], 2: [], 3: [] }
  writingAnswers.value = { 1: '', 2: '' }
  writingTask.value = 1
  listeningPart.value = 1
  readingPart.value = 1
  speakingPart.value = 1
  speakingRecordings.clear()
  speakingDurations.clear()
  speakingTranscripts.value = {}
  reviewed.value = []
  aiEvaluations.value = []
  estimatedBand.value = null
  serverPercent.value = null
  aiError.value = ''
}
const chooseSkill = (skill: Skill, requestedMode: Mode) => {
  resetAttempt()
  currentSkill.value = skill
  mode.value = requestedMode
  fullTest.value = false
  timeLimit.value = skill === 'Listening' ? 32 : skill === 'Speaking' ? 14 : 60
  stage.value = 'mode'
}
const chooseSimulationSet = (set: number) => {
  if (set > 1 && !completedSimulationSets.value.includes(set - 1)) { toast(`Complete Simulation Set ${set - 1} to unlock this set.`, 'info'); return }
  resetAttempt()
  currentSkill.value = 'Listening'; fullTest.value = true; simulationSet.value = set; mode.value = 'simulation'; timeLimit.value = 170; stage.value = 'mode'
}
const startTimer = () => {
  window.clearInterval(timer)
  remaining.value = timeLimit.value * 60
  timer = window.setInterval(() => {
    if (remaining.value > 0) remaining.value--
    else void submitTest(true)
  }, 1000)
}
const openInstructions = () => { stage.value = 'instructions' }
const beginTest = () => {
  if (mode.value === 'practice') {
    const first = getSelectedParts(currentSkill.value)[0] || 1
    if (currentSkill.value === 'Listening') listeningPart.value = first
    if (currentSkill.value === 'Reading') readingPart.value = first
    if (currentSkill.value === 'Writing') writingTask.value = first as 1 | 2
    if (currentSkill.value === 'Speaking') speakingPart.value = 1
  }
  if (currentSkill.value === 'Speaking' && !fullTest.value) stage.value = 'microphone'
  else { stage.value = 'exam'; if (mode.value === 'simulation') startTimer() }
}
const beginSpeaking = () => { stage.value = 'exam'; if (mode.value === 'simulation') startTimer() }
const exitTest = () => { window.clearInterval(timer); speechSynthesis.cancel(); stage.value = 'catalog'; playing.value = false }
const toggleReview = (number: number) => { reviewed.value = reviewed.value.includes(number) ? reviewed.value.filter((item) => item !== number) : [...reviewed.value, number] }

const playListening = () => {
  if (playing.value) { speechSynthesis.cancel(); playing.value = false; return }
  const script = currentListeningExercise.value?.content || ''
  const utterance = new SpeechSynthesisUtterance(script)
  utterance.rate = 0.86
  utterance.onend = () => { playing.value = false; audioProgress.value = 100 }
  playing.value = true
  audioProgress.value = 12
  speechSynthesis.speak(utterance)
}
const testMicrophone = async () => {
  micStatus.value = 'testing'
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
    micStatus.value = 'ready'
  } catch { micStatus.value = 'blocked' }
}
const stopActiveRecording = async () => {
  if (!recording.value || !recorder) return
  const activeRecorder = recorder
  stopRecordingPromise = new Promise<void>((resolve) => { resolveRecordingStop = resolve })
  activeRecorder.stop()
  micStream?.getTracks().forEach((track) => track.stop())
  recording.value = false
  await stopRecordingPromise
}
const toggleRecording = async () => {
  if (recording.value) {
    await stopActiveRecording()
    return
  }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const preferredType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
    const activePart = speakingPart.value
    const activeRecorder = preferredType ? new MediaRecorder(micStream, { mimeType: preferredType }) : new MediaRecorder(micStream)
    recorder = activeRecorder
    recordingChunks = []
    activeRecorder.ondataavailable = (event) => { if (event.data.size) recordingChunks.push(event.data) }
    activeRecorder.onstop = () => {
      const duration = Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000))
      speakingRecordings.set(activePart, new Blob(recordingChunks, { type: activeRecorder.mimeType || 'audio/webm' }))
      speakingDurations.set(activePart, duration)
      if (speakingPart.value === activePart) recordingSaved.value = true
      resolveRecordingStop?.()
      resolveRecordingStop = null
      stopRecordingPromise = null
    }
    recordingStartedAt = Date.now()
    activeRecorder.start()
    recording.value = true
  } catch { micStatus.value = 'blocked' }
}
const evaluateWriting = async () => {
  const tasks = ([1, 2] as const).filter((task) => writingAnswers.value[task].trim())
  return Promise.all(tasks.map(async (task) => {
    const result = await evaluateIeltsWriting({
      task: String(task),
      prompt: writingPrompt(task),
      response: writingAnswers.value[task],
    })
    syncAiTokenBalance(result)
    return result.evaluation
  }))
}
const evaluateSpeaking = async () => {
  const entries = [...speakingRecordings.entries()]
  return Promise.all(entries.map(async ([part, audio]) => {
    const form = new FormData()
    form.append('audio', audio, `ielts-speaking-part-${part}.webm`)
    form.append('prompt', speakingPrompt(part))
    form.append('durationSeconds', String(speakingDurations.get(part) || 1))
    const result = await evaluateIeltsSpeaking(form)
    syncAiTokenBalance(result)
    speakingTranscripts.value = { ...speakingTranscripts.value, [part]: result.transcript.text }
    void loadTranscriptionHistory()
    return result.evaluation
  }))
}
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
const submitTest = async (allowIncomplete = false) => {
  if (submitting.value) return
  speechSynthesis.cancel()
  if (recording.value) await stopActiveRecording()

  const incompleteSkill = fullTest.value ? firstIncompleteFullSkill() : null
  if (incompleteSkill && !allowIncomplete) {
    currentSkill.value = incompleteSkill
    aiError.value = `Complete every ${incompleteSkill.toLowerCase()} response before submitting the full simulation.`
    toast('The full simulation still has unanswered sections.', 'info')
    return
  }

  window.clearInterval(timer)
  submitting.value = true
  aiError.value = ''
  aiEvaluations.value = []
  estimatedBand.value = null
  serverPercent.value = null
  try {
    const submittedExercises = fullTest.value
      ? [...listeningExercises.value, ...readingExercises.value]
      : currentSkill.value === 'Listening' ? listeningExercises.value
      : currentSkill.value === 'Reading' ? readingExercises.value
      : []
    const autoScored = submittedExercises.map(exercise => ({
      exerciseId: exercise.id,
      answers: exercise.section === 'listening'
        ? listeningAnswers.value[exercise.part] || []
        : readingAnswers.value[exercise.part] || []
    }))
    if (autoScored.length) {
      const submissions = await submitIeltsSet(simulationSet.value, autoScored)
      const total = submissions.reduce((sum, item) => sum + item.totalQuestions, 0)
      const correct = submissions.reduce((sum, item) => sum + item.score, 0)
      if (total) serverPercent.value = Math.round((correct / total) * 100)
      submissionHistory.value = submissions
    }

    const evaluations: IeltsAiEvaluation[] = []
    if (fullTest.value || currentSkill.value === 'Writing') evaluations.push(...await evaluateWriting())
    if (fullTest.value || currentSkill.value === 'Speaking') evaluations.push(...await evaluateSpeaking())
    aiEvaluations.value = evaluations

    const bands = evaluations.map((item) => Number(item.estimatedBand)).filter((value) => Number.isFinite(value))
    if (bands.length) estimatedBand.value = Math.round((bands.reduce((total, value) => total + value, 0) / bands.length) * 2) / 2
    const raw = serverPercent.value !== null
      ? serverPercent.value
      : estimatedBand.value !== null
        ? Math.round((estimatedBand.value / 9) * 100)
        : Math.round((answeredCount.value / totalQuestions.value) * 100)
    resultScore.value = Math.max(0, raw)
    practiceResult.value = {
      type: `IELTS ${fullTest.value ? 'Full Test' : currentSkill.value}`,
      score: resultScore.value,
      completedAt: new Date().toISOString(),
      explanation: evaluations[0]?.summary || 'Unofficial simulation result. Review flagged questions and practise under timed conditions.',
    }
    if (fullTest.value && mode.value === 'simulation' && !completedSimulationSets.value.includes(simulationSet.value)) completedSimulationSets.value.push(simulationSet.value)
    toast(`IELTS ${mode.value} result saved to ${selected.value?.name}.`)
    stage.value = 'results'
  } catch (error) {
    syncAiTokenBalance(error)
    aiError.value = error instanceof Error ? error.message : 'Could not evaluate this IELTS response.'
  } finally {
    submitting.value = false
  }
}
const loadSet = async () => {
  loadingSet.value = true
  setError.value = ''
  try { exercises.value = await getIeltsSet(1) }
  catch (error) { setError.value = error instanceof Error ? error.message : 'Could not load the IELTS test set.' }
  finally { loadingSet.value = false }
}
const loadHistory = async () => {
  try {
    const [submissions, evaluations] = await Promise.all([getIeltsSubmissions(), getIeltsEvaluations()])
    submissionHistory.value = submissions
    aiHistory.value = evaluations
  } catch { /* history is best-effort; the exam still works without it */ }
}
onMounted(() => { void loadSet(); void loadHistory(); void loadTranscriptionHistory() })
onUnmounted(() => { window.clearInterval(timer); speechSynthesis.cancel(); micStream?.getTracks().forEach((track) => track.stop()) })
</script>

<template>
  <main v-if="stage === 'catalog' || stage === 'mode'" class="workspace-shell">
    <WorkspaceSidebar active="test" />
    <div class="workspace-main">
      <WorkspaceTopbar title="IELTS Test Prep" subtitle="Computer-delivered IELTS practice and realistic timed simulations." />
      <div class="workspace-content test-prep-content">
        <section v-if="false" class="notion-select-state">
<div class="notion-select-icon">
<BookOpenCheck :size="31" />
</div>
<p class="text-xs font-extrabold uppercase tracking-[.16em] text-[#5b45f5]">IELTS preparation</p>
<h1>Select a scholarship first</h1>
<p>Your IELTS study plan and results are saved per scholarship.</p>
<RouterLink to="/scholarships" class="btn-primary">Browse scholarships</RouterLink>
</section>
        <template v-else>
          <section class="rounded-[22px] border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-[#f4f2ff] p-5 shadow-[0_12px_30px_rgba(91,69,245,.06)] sm:p-6">
<div class="flex flex-wrap items-center justify-between gap-6">
<div>
<p class="text-xs font-extrabold uppercase tracking-[.16em] text-[#5b45f5]">Minerva test preparation</p>
<h1 class="mt-2 text-2xl font-extrabold text-[#17136b]">IELTS Test Prep</h1>
<p class="mt-2 max-w-2xl text-xs leading-5 text-slate-500">Choose a skill to practise at your own pace, or take a timed simulation when you are ready for a test-day style experience.</p>
</div>
<button type="button" class="grid size-16 place-items-center rounded-2xl bg-[#5b45f5] text-white shadow-[0_12px_24px_rgba(91,69,245,.22)] transition hover:bg-[#4232e2] hover:cursor-pointer" @click="showIeltsInfo = true" aria-label="What is IELTS?">
<BookOpenCheck :size="29" />
</button>
</div>
</section>

<BaseModal :open="showIeltsInfo" title="What is IELTS?" @close="showIeltsInfo = false">
  <div class="space-y-5 text-sm text-slate-600">
    <p>IELTS (International English Language Testing System) measures English proficiency for study, work, or migration. It includes Listening, Reading, Writing, and Speaking sections. This platform provides exercise for IELTS academic purpose only.</p>
    <div class="rounded-2xl bg-slate-50 p-4 text-slate-700">
      <h3 class="text-sm font-bold text-slate-900">General exam format</h3>
      <ul class="mt-3 space-y-2 list-disc pl-5 text-slate-600">
        <li><strong>Listening</strong>: 4 parts, about 30 minutes.</li>
        <li><strong>Reading</strong>: 3 passages, 40 questions, 60 minutes.</li>
        <li><strong>Writing</strong>: 2 tasks, 60 minutes.</li>
        <li><strong>Speaking</strong>: 3 parts, 11–14 minutes.</li>
      </ul>
    </div>
    <p>This app lets you practise each section individually or take a full, test-day style simulation when you are ready.</p>
    <div class="mt-6 text-right">
      <button type="button" class="rounded-lg bg-[#5b45f5] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#4232e2]" @click="showIeltsInfo = false">I'm ready</button>
    </div>
  </div>
</BaseModal>

          <section class="mt-5 rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
<div class="flex flex-wrap items-center justify-between gap-3">
<div>
<p class="text-xs font-extrabold uppercase tracking-[.14em] text-[#5b45f5]">Whisper records</p>
<h2 class="mt-2 text-2xl font-extrabold text-[#17136b]">Speaking transcription history</h2>
<p class="mt-2 text-sm text-slate-500">Your saved IELTS speaking transcripts are private to your account.</p>
</div>
<button class="btn-secondary text-sm" :disabled="transcriptionHistoryLoading" @click="loadTranscriptionHistory"><Clock3 :size="15" />Refresh</button>
</div>
<p v-if="transcriptionHistoryError" class="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{{ transcriptionHistoryError }}</p>
<p v-else-if="transcriptionHistoryLoading && !transcriptionHistory.length" class="mt-4 text-sm text-slate-500">Loading saved transcripts…</p>
<p v-else-if="!transcriptionHistory.length" class="mt-4 text-sm text-slate-500">Record and submit a speaking response to build your transcript history.</p>
<div v-else class="mt-5 grid gap-3 lg:grid-cols-2">
<details v-for="item in transcriptionHistory" :key="item.id" class="rounded-xl border border-slate-200 bg-slate-50 p-4">
<summary class="cursor-pointer text-sm font-extrabold text-[#17136b]">{{ formatHistoryDate(item.createdAt) }}<span v-if="item.durationSeconds" class="ml-2 text-xs text-slate-400">· {{ item.durationSeconds }}s</span></summary>
<p class="mt-3 text-xs font-bold text-slate-500">{{ item.prompt }}</p>
<p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{{ item.transcript }}</p>
</details>
</div>
</section>
          <section class="mt-5 rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
<div class="flex flex-wrap items-center justify-between gap-4">
<div>
<p class="text-xs font-extrabold uppercase tracking-[.14em] text-[#5b45f5]">Skill practice</p>
<h2 class="mt-2 text-2xl font-extrabold text-[#17136b]">Test Set 1</h2>
</div>
<span class="text-sm font-bold text-slate-400">Academic · Computer-delivered</span>
</div>
<p v-if="loadingSet" class="mt-4 rounded-xl bg-violet-50 px-4 py-3 text-sm font-bold text-[#5b45f5]">Loading test content…</p>
<p v-else-if="setError" role="alert" class="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{{ setError }}</p>
<div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
<article v-for="item in skills" :key="item.name" class="flex min-h-44 flex-col rounded-xl border border-slate-200 p-4">
<span class="grid size-9 place-items-center rounded-xl bg-violet-100 text-[#5b45f5]">
<component :is="item.icon" :size="18" />
</span>
<h3 class="mt-3 text-sm font-extrabold text-[#17136b]">{{ item.name }}</h3>
<p class="mt-1 text-xs text-slate-500">{{ item.detail }}</p>
<p class="mt-1 text-xs font-bold text-slate-400">{{ item.time }}</p>
<div class="mt-auto pt-4">
<button class="w-full rounded-lg border border-violet-200 px-3 py-2 text-xs font-extrabold text-[#5b45f5] disabled:opacity-50" :disabled="loadingSet || !!setError" @click="chooseSkill(item.name, 'practice')">Practice</button>
</div>
</article>
</div>
<button class="mt-3 w-full rounded-lg bg-[#251a88] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50" :disabled="loadingSet || !!setError" @click="chooseSimulationSet(1)">Full Simulation</button>
</section>

          <section v-if="submissionHistory.length || aiHistory.length" class="mt-5 rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
<h2 class="text-lg font-extrabold text-[#17136b]">Recent practice history</h2>
<div v-if="submissionHistory.length" class="mt-4">
<p class="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Auto-scored</p>
<ul class="mt-2 grid gap-1.5">
<li v-for="item in submissionHistory" :key="item.id" class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
<span class="capitalize text-slate-600">{{ item.section }}</span>
<span class="font-extrabold text-[#17136b]">{{ item.score }}/{{ item.totalQuestions }}</span>
</li>
</ul>
</div>
<div v-if="aiHistory.length" class="mt-4">
<p class="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">AI evaluations</p>
<ul class="mt-2 grid gap-1.5">
<li v-for="item in aiHistory" :key="item.id" class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
<span class="capitalize text-slate-600">{{ item.kind }}</span>
<span v-if="item.result.estimatedBand != null" class="font-extrabold text-[#5b45f5]">Band {{ item.result.estimatedBand }}</span>
<span v-else class="text-xs text-slate-400">{{ new Date(item.createdAt).toLocaleDateString() }}</span>
</li>
</ul>
</div>
</section>

          <section v-if="false" class="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
<div class="flex flex-wrap items-center justify-between gap-4">
<div>
<p class="text-xs font-extrabold uppercase tracking-[.14em] text-[#5b45f5]">IELTS simulation journey</p>
<h2 class="mt-2 text-2xl font-extrabold text-[#17136b]">Three full-test simulation sets</h2>
<p class="mt-2 text-sm text-slate-500">Finish each set to unlock the next realistic full IELTS simulation.</p>
</div>
<span class="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-extrabold text-[#5b45f5]">{{ completedSimulationSets.length }}/3 completed</span>
</div>
<div class="mt-6 grid gap-4 md:grid-cols-3">
<button v-for="set in [1, 2, 3]" :key="set" class="relative min-h-44 rounded-2xl border p-5 text-left" :class="set > 1 && !completedSimulationSets.includes(set - 1) ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400' : 'border-violet-200 bg-white text-[#17136b] hover:border-[#5b45f5]'" :disabled="set > 1 && !completedSimulationSets.includes(set - 1)" @click="chooseSimulationSet(set)">
<span class="grid size-10 place-items-center rounded-xl" :class="set > 1 && !completedSimulationSets.includes(set - 1) ? 'bg-slate-200' : 'bg-violet-100 text-[#5b45f5]'">
<LockKeyhole v-if="set > 1 && !completedSimulationSets.includes(set - 1)" :size="19" />
<Grid2X2 v-else :size="19" />
</span>
<p class="mt-5 text-lg font-extrabold">Simulation Set {{ set }}</p>
<p class="mt-2 text-sm" :class="set > 1 && !completedSimulationSets.includes(set - 1) ? 'text-slate-400' : 'text-slate-500'">{{ set > 1 && !completedSimulationSets.includes(set - 1) ? `Complete Set ${set - 1} to unlock` : completedSimulationSets.includes(set) ? 'Completed · take again anytime' : 'Full IELTS test · 170 minutes' }}</p>
<span v-if="completedSimulationSets.includes(set)" class="mt-4 inline-flex items-center gap-1 text-xs font-extrabold text-emerald-600">
<Check :size="15" />Completed</span>
</button>
</div>
</section>
        </template>
      </div>
    </div>

    <div v-if="stage === 'mode'" class="fixed inset-0 z-50 grid place-items-center overflow-auto bg-[#0b0a2d]/70 p-4 backdrop-blur-sm">
<section class="relative w-full max-w-2xl rounded-3xl bg-[#fbfbfe] p-6 shadow-2xl sm:p-9">
<button class="absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-white text-slate-500 shadow" aria-label="Close" @click="stage = 'catalog'">×</button>
<div class="text-center">
<p class="text-xs font-extrabold uppercase tracking-[.16em] text-[#5b45f5]">{{ fullTest ? `Simulation Set ${simulationSet}` : currentSkill }}</p>
<h2 class="mt-3 text-3xl font-extrabold text-[#17136b]">{{ mode === 'practice' ? 'Practice mode' : 'Simulation test mode' }}</h2>
<p class="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">{{ mode === 'practice' ? 'Build confidence at your own pace. Practice sessions have no timer and let you focus on the parts you need.' : 'Experience a realistic computer-delivered IELTS session with fixed timing, review flags, and final submission.' }}</p>
</div>
<div class="mt-7 rounded-3xl border border-violet-100 bg-white p-6">
<span class="grid size-12 place-items-center rounded-2xl bg-violet-100 text-[#5b45f5]">
<ListChecks v-if="mode === 'practice'" :size="25" />
<Clock3 v-else :size="25" />
</span>
<div v-if="mode === 'practice'" class="mt-5">
<h3 class="text-xl font-extrabold text-[#17136b]">{{ currentSkill === 'Speaking' ? 'Speaking practice' : 'Choose the parts to practise' }}</h3>
<div v-if="currentSkill === 'Speaking'" class="mt-5 rounded-xl bg-violet-50 p-4 text-sm font-bold text-[#5b45f5]">All 3 interview parts are included in every speaking session.</div>
<div v-else class="mt-5 grid gap-3 sm:grid-cols-2">
<label v-for="part in partsForSkill(currentSkill)" :key="part" class="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-bold text-[#17136b]">
<input type="checkbox" :checked="getSelectedParts(currentSkill).includes(part)" @change="toggleSelectedPart(part)" class="accent-[#5b45f5]" />Part {{ part }}
<span v-if="currentSkill === 'Listening' || currentSkill === 'Reading'" class="font-normal text-slate-400">(5 questions)</span>
</label>
</div>
<p class="mt-5 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">No timer is used in Practice mode. Submit whenever you are ready.</p>
</div>
<div v-else class="mt-5">
<h3 class="text-xl font-extrabold text-[#17136b]">Timed test information</h3>
<div class="mt-5 rounded-2xl bg-[#f7f6ff] p-5">
<p class="font-extrabold text-[#17136b]">{{ fullTest ? 'All four IELTS skills' : currentSkill }}</p>
<p class="mt-1 text-sm text-slate-500">{{ timeLimit }} minutes · timed environment</p>
</div>
<p class="mt-5 flex items-center gap-2 text-sm font-bold text-[#5b45f5]">
<CheckCircle2 :size="17" />Recommended for test-day readiness</p>
</div>
</div>
<button class="btn-primary mx-auto mt-7" @click="openInstructions">Continue <ArrowRight :size="16" />
</button>
</section>
</div>
  </main>

  <main v-else-if="stage === 'instructions'" class="min-h-screen bg-[#fbfbfe]">
<header class="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-10">
<img src="/minerva-logo.png" alt="Minerva" class="h-12 w-40 object-contain" />
<p v-if="mode === 'simulation'" class="flex items-center gap-2 font-extrabold text-[#17136b]">
<Clock3 :size="20" class="text-[#5b45f5]" />{{ timeLimit }} minutes</p>
<p v-else class="font-extrabold text-emerald-600">Untimed practice</p>
<button class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-extrabold text-slate-600" @click="exitTest">Exit {{ mode === 'practice' ? 'practice' : 'simulation' }}</button>
</header>
<section class="mx-auto max-w-3xl px-6 py-16">
<p class="text-center text-xs font-extrabold uppercase tracking-[.17em] text-[#5b45f5]">IELTS {{ currentSkill }} · {{ mode }}</p>
<h1 class="mt-3 text-center text-3xl font-extrabold text-[#17136b]">General instructions</h1>
<div class="mt-10 grid gap-4">
<div v-for="(item,index) in [mode === 'simulation' ? 'The test interface includes an active timer at the top of every page.' : 'Practice mode is untimed, so you can work through questions at your own pace.','Answer every question; unanswered questions are marked clearly in the navigator.','Use the flag control to mark questions you want to review before submission.','Your answers save automatically while this session remains open.','Submit only when you are finished. The result is an unofficial preparation score.']" :key="item" class="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5">
<span class="grid size-9 shrink-0 place-items-center rounded-full bg-violet-100 font-extrabold text-[#5b45f5]">{{ index + 1 }}</span>
<p class="text-sm leading-7 text-slate-600">{{ item }}</p>
</div>
</div>
<button class="btn-primary mx-auto mt-9" @click="beginTest">Begin {{ mode === 'practice' ? 'practice' : 'simulation' }} <ArrowRight :size="17" />
</button>
</section>
</main>

  <main v-else-if="stage === 'microphone'" class="min-h-screen bg-[#fbfbfe]">
<header class="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-10">
<img src="/minerva-logo.png" alt="Minerva" class="h-12 w-40 object-contain" />
<p class="font-extrabold text-[#17136b]">Speaking system check</p>
<button class="text-sm font-extrabold text-slate-500" @click="exitTest">Exit</button>
</header>
<section class="mx-auto mt-16 max-w-3xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
<span class="mx-auto grid size-20 place-items-center rounded-full bg-violet-100 text-[#5b45f5]">
<Mic :size="35" />
</span>
<h1 class="mt-7 text-3xl font-extrabold text-[#17136b]">Test your microphone</h1>
<p class="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">Allow microphone access so your speaking responses can be recorded during the simulation.</p>
<div class="mt-7 rounded-2xl bg-[#f7f7fc] p-5">
<p v-if="micStatus === 'idle'">Your microphone has not been tested.</p>
<p v-else-if="micStatus === 'testing'" class="text-[#5b45f5]">Checking microphone access…</p>
<p v-else-if="micStatus === 'ready'" class="font-extrabold text-emerald-600">Microphone is ready.</p>
<p v-else class="font-extrabold text-red-600">Microphone access was blocked. Update browser permissions or continue without recording.</p>
</div>
<div class="mt-8 flex flex-wrap justify-center gap-3">
<button class="btn-primary" @click="testMicrophone">
<Mic :size="17" />Test microphone</button>
<button class="btn-secondary" :disabled="micStatus === 'testing'" @click="beginSpeaking">{{ micStatus === 'ready' ? 'Continue' : 'Skip check' }} <ArrowRight :size="16" />
</button>
</div>
</section>
</main>

  <main v-else-if="stage === 'exam'" class="flex min-h-screen flex-col bg-white text-[#17136b]">
    <header class="sticky top-0 z-30 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 shadow-sm sm:px-8">
<img src="/minerva-logo.png" alt="Minerva" class="h-11 w-36 object-contain" />
<div v-if="mode === 'simulation'" class="flex items-center gap-2 text-lg font-extrabold">
<Clock3 :size="21" class="text-[#5b45f5]" />
<span :class="remaining < 300 && 'text-red-600'">{{ formatTime }}</span>
<span class="text-sm font-semibold text-slate-400">remaining</span>
</div>
<div v-else class="rounded-full bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-700">Untimed practice</div>
<div class="flex items-center gap-2">
<button class="hidden size-10 place-items-center rounded-xl border border-slate-200 sm:grid" title="Full screen">
<Maximize2 :size="18" />
</button>
<button class="hidden rounded-xl border border-slate-200 px-4 py-2 text-sm font-extrabold sm:block" @click="toggleReview(1)">
<Flag :size="16" class="inline" /> Review</button>
<button class="rounded-xl border border-red-200 px-4 py-2 text-sm font-extrabold text-red-600" @click="exitTest">Exit</button>
<button class="inline-flex items-center gap-2 rounded-xl bg-[#5b45f5] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-60" :disabled="submitting" @click="submitTest()">{{ submitting ? 'Evaluating…' : 'Submit' }} <Send :size="16" />
</button>
</div>
</header>
    <nav v-if="fullTest" class="flex gap-2 overflow-auto border-b border-slate-200 bg-[#fafafe] px-5 py-3">
<button v-for="item in skills" :key="item.name" class="rounded-xl px-4 py-2 text-sm font-extrabold" :class="currentSkill === item.name ? 'bg-[#17136b] text-white' : 'text-slate-500'" :disabled="recording" @click="currentSkill = item.name">{{ item.name }}</button>
</nav>
<p v-if="aiError && currentSkill !== 'Speaking'" role="alert" class="border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-700">{{ aiError }}</p>

    <section v-if="currentSkill === 'Listening'" class="flex flex-1 flex-col">
<div class="flex gap-2 border-b border-slate-200 bg-[#fafafe] px-6 py-3">
  <button
    v-for="exercise in listeningExercises"
    :key="exercise.order"
    class="rounded-xl px-4 py-2 text-sm font-extrabold transition-colors"
    :class="listeningPart === exercise.part ? 'bg-[#17136b] text-white' : 'text-slate-500 hover:bg-slate-100'"
    :disabled="mode === 'practice' && !selectedParts.listening.includes(exercise.part)"
    @click="listeningPart = exercise.part"
  >
    Part {{ exercise.part }}
  </button>
</div>
<div v-if="listeningAudioUrl" class="border-b border-slate-200 bg-[#fafafe] px-6 py-4">
<audio :src="listeningAudioUrl" controls class="w-full" />
</div>
<div v-else class="flex items-center gap-4 border-b border-slate-200 bg-[#fafafe] px-6 py-4">
<button class="grid size-10 place-items-center rounded-full bg-[#5b45f5] text-white" @click="playListening">
<Pause v-if="playing" :size="18" />
<Play v-else :size="18" />
</button>
<span class="text-xs font-bold text-slate-500">Audio source 1</span>
<div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
<div class="h-full bg-[#5b45f5] transition-all" :style="{ width: `${audioProgress}%` }" />
</div>
<Volume2 :size="18" class="text-[#5b45f5]" />
</div>
<div class="mx-auto w-full max-w-6xl flex-1 p-6 sm:p-9">
<p class="text-xs font-extrabold uppercase tracking-[.14em] text-[#5b45f5]">Part {{ listeningPart }} · Questions 1–{{ listeningLabels.length }}</p>
<h1 class="mt-3 text-2xl font-extrabold">{{ currentListeningExercise?.title }}</h1>
<p class="mt-5 text-sm italic text-slate-500">{{ currentListeningExercise?.instruction }}</p>
<div class="mt-7 overflow-hidden rounded-2xl border border-slate-200">
<div v-for="(label,index) in listeningLabels" :key="label" class="grid border-b border-slate-200 last:border-0 sm:grid-cols-[1fr_1.4fr]">
<span class="bg-[#fafafe] p-4 text-sm font-bold">{{ label }}</span>
<label class="flex items-center gap-3 p-3">
<span class="grid size-8 shrink-0 place-items-center rounded-full bg-[#5b45f5] text-xs font-extrabold text-white">{{ index + 1 }}</span>
<input v-model="listeningAnswers[listeningPart][index]" class="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#5b45f5]" />
</label>
</div>
</div>
</div>
</section>

    <section v-else-if="currentSkill === 'Reading'" class="flex min-h-0 flex-1 flex-col">
<div class="flex gap-2 border-b border-slate-200 bg-[#fafafe] px-6 py-3">
  <button
    v-for="exercise in readingExercises"
    :key="exercise.order"
    class="rounded-xl px-4 py-2 text-sm font-extrabold transition-colors"
    :class="readingPart === exercise.part ? 'bg-[#17136b] text-white' : 'text-slate-500 hover:bg-slate-100'"
    :disabled="mode === 'practice' && !selectedParts.reading.includes(exercise.part)"
    @click="readingPart = exercise.part"
  >
    Part {{ exercise.part }}
  </button>
</div>
<div class="grid min-h-0 flex-1 lg:grid-cols-2">
<article class="max-h-[calc(100vh-150px)] overflow-auto border-r border-slate-200 bg-[#f8f8ff] p-6 sm:p-9">
<p class="text-xs font-extrabold uppercase tracking-[.14em] text-[#5b45f5]">Part {{ readingPart }} · Reading passage {{ readingPart }}</p>
<h1 class="mt-3 text-3xl font-extrabold">{{ currentReadingExercise?.title }}</h1>
<p class="mt-2 text-sm italic text-slate-500">{{ currentReadingExercise?.instruction }}</p>
<div class="mt-7 space-y-6 text-sm leading-8 text-slate-700">
<p v-for="paragraph in readingParagraphs" :key="paragraph.letter">
<b>{{ paragraph.letter }}.</b> {{ paragraph.body }}</p>
</div>
</article>
<article class="max-h-[calc(100vh-150px)] overflow-auto p-6 sm:p-9">
<h2 class="text-xl font-extrabold text-[#5b45f5]">Questions 1–{{ readingQuestionItems.length }}</h2>
<p class="mt-3 text-sm text-slate-500">For Questions 1–4, choose the paragraph A–E. Complete the remaining questions using words from the passage.</p>
<div class="mt-7 grid gap-5">
<label v-for="(question,index) in readingQuestionItems" :key="question.text" class="flex items-center gap-3 text-sm">
<span class="grid size-8 shrink-0 place-items-center rounded-full bg-[#5b45f5] text-xs font-extrabold text-white">{{ index + 1 }}</span>
<select v-if="question.type === 'matching' || question.type === 'mcq'" v-model="readingAnswers[readingPart][index]" class="w-24 rounded-lg border border-slate-300 px-3 py-2">
<option value="">—</option>
<option v-for="option in question.options" :key="option" :value="option">{{ option }}</option>
</select>
<input v-else v-model="readingAnswers[readingPart][index]" class="w-40 rounded-lg border border-slate-300 px-3 py-2" />
<span>{{ question.text }}</span>
</label>
</div>
</article>
</div>
</section>

    <section v-else-if="currentSkill === 'Writing'" class="grid min-h-0 flex-1 lg:grid-cols-2">
<article class="max-h-[calc(100vh-150px)] overflow-auto border-r border-slate-200 bg-[#fafafe] p-6 sm:p-9">
<p class="text-xs font-extrabold uppercase tracking-[.14em] text-[#5b45f5]">Writing task {{ writingTask }}</p>
<h1 class="mt-3 text-2xl font-extrabold">{{ writingTask === 1 ? 'Academic Writing Task 1' : 'Academic Writing Task 2' }}</h1>
<p class="mt-5 leading-7 text-slate-600">{{ writingPrompt(writingTask) }}</p>
<template v-if="writingTask === 1">
<div class="mt-9 grid gap-3 sm:grid-cols-5">
<div v-for="(step,index) in ['Discover','Check fit','Prepare','Review','Submit']" :key="step" class="relative rounded-xl border border-violet-200 bg-white p-4 text-center text-sm font-extrabold text-[#17136b]">
<span class="mx-auto mb-2 grid size-7 place-items-center rounded-full bg-violet-100 text-xs text-[#5b45f5]">{{ index + 1 }}</span>{{ step }}<ArrowRight v-if="index < 4" :size="16" class="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-[#5b45f5] sm:block" />
</div>
</div>
</template>
</article>
<article class="flex min-h-[520px] flex-col p-6 sm:p-9">
<textarea v-model="writingAnswers[writingTask]" class="min-h-96 flex-1 resize-none rounded-2xl border border-slate-300 p-5 leading-7 outline-none focus:border-[#5b45f5]" placeholder="Type your response here…" />
<p class="mt-4 text-sm font-bold text-slate-500">Word count: {{ wordCount }}</p>
</article>
</section>

    <section v-else class="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center p-6 text-center">
<p class="text-xs font-extrabold uppercase tracking-[.14em] text-[#5b45f5]">Speaking part {{ speakingPart }}</p>
<h1 class="mt-4 text-3xl font-extrabold">{{ speakingPart === 1 ? 'Introduction and interview' : speakingPart === 2 ? 'Individual long turn' : 'Two-way discussion' }}</h1>
<p class="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{{ speakingPrompt(speakingPart) }}</p>
<div class="mt-9 flex h-20 items-center gap-2">
<i v-for="n in 16" :key="n" class="w-2 rounded-full bg-[#5b45f5]" :style="{ height: `${recording ? 18 + ((n * 17) % 54) : 10}px`, opacity: recording ? 1 : .25 }" />
</div>
<button class="mt-7 inline-flex items-center gap-3 rounded-2xl px-6 py-4 font-extrabold text-white" :class="recording ? 'bg-red-600' : 'bg-[#5b45f5]'" @click="toggleRecording">
<Pause v-if="recording" :size="20" />
<Mic v-else :size="20" />{{ recording ? 'Stop recording' : recordingSaved ? 'Record again' : 'Start recording' }}</button>
<p v-if="recordingSaved" class="mt-3 text-sm font-bold text-emerald-600">
<Check :size="15" class="inline" />Response saved</p>
<p v-if="speakingTranscripts[speakingPart]" class="mt-4 max-w-2xl rounded-xl bg-emerald-50 p-4 text-left text-sm leading-6 text-slate-700"><strong class="text-emerald-800">Transcript:</strong> {{ speakingTranscripts[speakingPart] }}</p>
<p v-if="aiError" class="mt-4 max-w-2xl rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{{ aiError }}</p>
<div class="mt-10 flex gap-3">
<button class="btn-secondary" :disabled="recording || speakingPart === 1" @click="speakingPart--">
<ChevronLeft :size="16" />Previous part</button>
<button class="btn-primary" :disabled="recording || speakingPart === 3" @click="speakingPart++">Next part <ChevronRight :size="16" />
</button>
</div>
</section>

    <footer class="sticky bottom-0 z-20 border-t border-slate-200 bg-white px-5 py-3 shadow-[0_-8px_22px_rgba(17,24,39,.06)]">
<div v-if="currentSkill === 'Writing'" class="grid grid-cols-2 gap-3">
<button v-for="task in [1,2]" :key="task" class="rounded-xl border px-4 py-3 text-sm font-extrabold" :class="writingTask === task ? 'border-[#5b45f5] text-[#5b45f5]' : 'border-slate-200 text-slate-500'" @click="writingTask = task as 1 | 2">Task {{ task }}</button>
</div>
<div v-else class="flex items-center gap-2 overflow-auto">
<span class="mr-2 whitespace-nowrap text-sm font-extrabold">{{ currentSkill }} · {{ answeredCount }}/{{ totalQuestions }}</span>
<button v-for="n in totalQuestions" :key="n" class="grid size-9 shrink-0 place-items-center rounded-full border text-xs font-extrabold" :class="[reviewed.includes(n) ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200', (currentSkill === 'Listening' ? (listeningAnswers[listeningPart] || [])[n-1] : currentSkill === 'Reading' ? (readingAnswers[readingPart] || [])[n-1] : false) && 'bg-[#5b45f5] text-white']" @click="toggleReview(n)">{{ n }}</button>
<span class="ml-auto hidden items-center gap-2 text-xs text-slate-400 sm:flex">
<CircleAlert :size="14" />Select a number to flag it for review.</span>
</div>
</footer>
  </main>

  <main v-else class="grid min-h-screen place-items-center bg-gradient-to-br from-[#f3f1ff] to-[#eff8ff] p-6">
<section class="w-full max-w-2xl rounded-3xl bg-white p-8 text-center shadow-xl sm:p-12">
<span class="mx-auto grid size-20 place-items-center rounded-full bg-emerald-100 text-emerald-600">
<CheckCircle2 :size="38" />
</span>
<p class="mt-7 text-xs font-extrabold uppercase tracking-[.16em] text-[#5b45f5]">{{ mode === 'practice' ? 'Practice complete' : 'Simulation complete' }}</p>
<h1 class="mt-3 text-3xl font-extrabold text-[#17136b]">Your responses were submitted</h1>
<div class="mx-auto mt-8 grid size-36 place-items-center rounded-full border-[10px] border-violet-100">
<div>
<strong class="text-4xl text-[#5b45f5]">{{ estimatedBand !== null ? estimatedBand : `${resultScore}%` }}</strong>
<span class="block text-xs font-bold text-slate-400">{{ estimatedBand !== null ? 'estimated band' : 'completion' }}</span>
</div>
</div>
<p class="mx-auto mt-7 max-w-xl text-sm leading-7 text-slate-500">This is an unofficial Minerva {{ mode }} result. Writing and speaking feedback is AI-assisted; pronunciation is not assessed from a transcript.</p>
<div v-if="combinedStrengths.length || combinedImprovements.length" class="mt-7 grid gap-4 text-left sm:grid-cols-2">
  <article class="rounded-2xl bg-emerald-50 p-5"><h2 class="font-extrabold text-emerald-800">Strengths</h2><ul class="mt-3 grid gap-2 text-sm text-slate-700"><li v-for="item in combinedStrengths" :key="item">• {{ item }}</li></ul></article>
  <article class="rounded-2xl bg-amber-50 p-5"><h2 class="font-extrabold text-amber-800">Next improvements</h2><ul class="mt-3 grid gap-2 text-sm text-slate-700"><li v-for="item in combinedImprovements" :key="item">• {{ item }}</li></ul></article>
</div>
<RouterLink to="/dashboard" class="btn-primary mt-8">Return to Dashboard <ArrowRight :size="16" />
</RouterLink>
</section>
</main>
</template>

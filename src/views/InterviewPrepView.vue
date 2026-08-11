<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowLeft, BarChart3, CheckCircle2, CircleStop, Clock3, Mic, Pause, Play, Sparkles, Trash2, Video, Volume2 } from 'lucide-vue-next'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'
import BaseSelect from '../components/common/BaseSelect.vue'
import { useAppState } from '../composables/useAppState'
import { apiRequest } from '../api'

type Stage = 'home' | 'setup' | 'history' | 'language' | 'ready' | 'live' | 'results'
interface InterviewQuestion { id: string; text: string }
interface AnswerEvaluation {
  relevance: number
  clarity: number
  structure: number
  specificity: number
  scholarshipAlignment: number
  highlights: string[]
  improvements: string[]
  strongerAnswerExample?: string
}
interface InterviewAudio { text: string; dataUrl: string; contentType: string }
interface InterviewAnswerResult {
  transcript: string
  evaluation: AnswerEvaluation
  durationSeconds: number
  reply?: string
}
interface InterviewAnswerResponse {
  transcript: string | { text: string }
  evaluation: AnswerEvaluation
  reply?: { text: string }
  followUp?: InterviewQuestion
  voice?: InterviewAudio
}
interface InterviewAggregate {
  clarity: number
  structure: number
  specificity: number
  highlights: string[]
  improvements: string[]
}
interface InterviewSummary {
  clarity: number
  confidence: number
  structure: number
  wordsPerMinute: number
  highlights: string[]
  improvements: string[]
}
interface InterviewHistoryItem {
  id: string
  scholarshipName: string
  provider: string
  country: string
  language: 'en' | 'id'
  status: 'active' | 'completed'
  questionCount: number
  answerCount: number
  overall?: number
  createdAt: string
  completedAt?: string
  updatedAt: string
}
interface InterviewHistorySession {
  id: string
  scholarshipName: string
  provider: string
  language: 'en' | 'id'
  status: 'active' | 'completed'
  questions: Array<{ id: string; text: string }>
  answers: Array<{ questionId: string; durationSeconds: number; transcript: { text: string }; evaluation: AnswerEvaluation; createdAt: string }>
  aggregate?: { overall?: number; clarity?: number; relevance?: number; structure?: number; specificity?: number; scholarshipAlignment?: number; highlights?: string[]; improvements?: string[] }
  createdAt: string
  completedAt?: string
}

const { applicationIds, documentsByScholarship, selectScholarship, syncAiTokenBalance, toast, getScholarship } = useAppState()
const stage = ref<Stage>('home')
const interviewScholarshipId = ref('')
const selectedDocumentTitle = ref('')
const context = ref('')
const language = ref<'Bahasa Indonesia' | 'English'>('Bahasa Indonesia')
const isPaused = ref(false)
const elapsed = ref(0)
const questionIndex = ref(0)
const cameraVideo = ref<HTMLVideoElement | null>(null)
const cameraEnabled = ref(false)
const cameraError = ref('')
const interviewId = ref('')
const generatedQuestions = ref<InterviewQuestion[]>([])
const answerResults = ref<Record<string, InterviewAnswerResult>>({})
const recording = ref(false)
const submittingAnswer = ref(false)
const generatingInterview = ref(false)
const completingInterview = ref(false)
const aiError = ref('')
const voiceNotice = ref('')
const aiSpeaking = ref(false)
const latestVoice = ref<InterviewAudio | null>(null)
const summary = ref<InterviewSummary | null>(null)
const interviewHistory = ref<InterviewHistoryItem[]>([])
const selectedHistorySession = ref<InterviewHistorySession | null>(null)
const historyLoading = ref(false)
const historyError = ref('')
let cameraStream: MediaStream | undefined
let microphoneStream: MediaStream | undefined
let recorder: MediaRecorder | undefined
let recordingChunks: Blob[] = []
let recordingStartedAt = 0
let stopRecordingPromise: Promise<void> | undefined
let resolveStopRecording: (() => void) | undefined
let timer: number | undefined
let aiAudio: HTMLAudioElement | undefined

const availableScholarships = computed(() => applicationIds.value
  .map((id) => getScholarship(id))
  .filter((item): item is NonNullable<typeof item> => Boolean(item)))
const selected = computed(() => interviewScholarshipId.value ? getScholarship(interviewScholarshipId.value) : undefined)
const selectedScholarshipName = computed({
  get: () => selected.value?.name || '',
  set: (name: string) => {
    const scholarship = availableScholarships.value.find((item) => item.name === name)
    if (!scholarship) return
    interviewScholarshipId.value = scholarship.id
    selectScholarship(scholarship.id)
    selectedDocumentTitle.value = ''
  },
})
const questions = computed<InterviewQuestion[]>(() => generatedQuestions.value.length
  ? generatedQuestions.value
  : selected.value ? [
      { id: 'motivation', text: `Tell us why ${selected.value.name} matches your academic and leadership goals.` },
      { id: 'readiness', text: `Describe a challenge that proves you are ready to study in ${selected.value.country}.` },
      { id: 'impact', text: 'How will you use this opportunity to create measurable impact after graduation?' },
    ] : [])
const question = computed(() => questions.value[questionIndex.value])
const currentAnswer = computed(() => question.value ? answerResults.value[question.value.id] : undefined)
const formatted = computed(() => `${String(Math.floor(elapsed.value / 60)).padStart(2, '0')}:${String(elapsed.value % 60).padStart(2, '0')}`)
const average = (values: number[]) => values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0
const fallbackSummary = computed<InterviewSummary>(() => {
  const answers = Object.values(answerResults.value)
  const evaluations = answers.map((item) => item.evaluation)
  const words = answers.reduce((total, item) => total + item.transcript.trim().split(/\s+/).filter(Boolean).length, 0)
  const seconds = answers.reduce((total, item) => total + item.durationSeconds, 0)
  return {
    clarity: average(evaluations.map((item) => item.clarity)),
    confidence: average(evaluations.map((item) => item.specificity)),
    structure: average(evaluations.map((item) => item.structure)),
    wordsPerMinute: seconds ? Math.round(words / (seconds / 60)) : 0,
    highlights: [...new Set(evaluations.flatMap((item) => item.highlights))].slice(0, 4),
    improvements: [...new Set(evaluations.flatMap((item) => item.improvements))].slice(0, 4),
  }
})
const displayedSummary = computed(() => summary.value || fallbackSummary.value)
const formatHistoryDate = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
const loadInterviewHistory = async () => {
  historyLoading.value = true
  historyError.value = ''
  try {
    const result = await apiRequest<{ sessions?: InterviewHistoryItem[] }>('/api/interviews')
    interviewHistory.value = result.sessions || []
  } catch (error) {
    historyError.value = error instanceof Error ? error.message : 'Could not load interview history.'
  } finally {
    historyLoading.value = false
  }
}
const openHistorySession = async (id: string) => {
  historyLoading.value = true
  historyError.value = ''
  try {
    const result = await apiRequest<{ session: InterviewHistorySession }>(`/api/interviews/${id}`)
    selectedHistorySession.value = result.session
  } catch (error) {
    historyError.value = error instanceof Error ? error.message : 'Could not load this interview.'
  } finally {
    historyLoading.value = false
  }
}
const historyQuestion = (session: InterviewHistorySession, questionId: string) => session.questions.find((item) => item.id === questionId)?.text || 'Interview question'
const deleteInterview = async (id: string) => {
  if (!window.confirm('Delete this interview and its saved transcript and AI analysis?')) return
  try {
    await apiRequest(`/api/interviews/${id}`, { method: 'DELETE' })
    interviewHistory.value = interviewHistory.value.filter((item) => item.id !== id)
    if (selectedHistorySession.value?.id === id) selectedHistorySession.value = null
    toast('Interview deleted.', 'info')
  } catch (error) { historyError.value = error instanceof Error ? error.message : 'Could not delete this interview.' }
}
const interviewDocuments = computed(() => interviewScholarshipId.value
  ? (documentsByScholarship.value[interviewScholarshipId.value] || []).filter((document) => document.content.trim())
  : [])
const selectedDocument = computed(() => interviewDocuments.value.find((document) => document.title === selectedDocumentTitle.value))
const documentText = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() || ''
const candidateContext = computed(() => {
  const draft = selectedDocument.value
  return [
    context.value.trim(),
    draft ? `Candidate document (${draft.title}):\n${documentText(draft.content).slice(0, 8_000)}` : '',
  ].filter(Boolean).join('\n\n').slice(0, 12_000)
})
const continueSetup = () => {
  if (!selected.value) return
  stage.value = 'language'
}
const stopCamera = () => {
  cameraStream?.getTracks().forEach((track) => track.stop())
  cameraStream = undefined
  cameraEnabled.value = false
}
const startCamera = async () => {
  cameraError.value = ''
  try {
    stopCamera()
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
    cameraEnabled.value = true
    await nextTick()
    if (cameraVideo.value) cameraVideo.value.srcObject = cameraStream
  } catch {
    cameraError.value = 'Camera access is unavailable. Check your browser permission and try again.'
    cameraEnabled.value = false
  }
}
const toggleCamera = () => cameraEnabled.value ? stopCamera() : startCamera()
const stopKokoroVoice = () => {
  aiAudio?.pause()
  aiAudio = undefined
  aiSpeaking.value = false
}
const playKokoroVoice = async (voice?: InterviewAudio) => {
  if (!voice?.dataUrl) return
  stopKokoroVoice()
  latestVoice.value = voice
  const audio = new Audio(voice.dataUrl)
  aiAudio = audio
  audio.onplay = () => { aiSpeaking.value = true }
  audio.onended = () => { if (aiAudio === audio) aiSpeaking.value = false }
  audio.onerror = () => { if (aiAudio === audio) aiSpeaking.value = false }
  try {
    await audio.play()
  } catch {
    aiError.value = 'Tap “Replay voice” to hear Minerva’s response.'
  }
}
const playQuestionVoice = async (questionId?: string) => {
  if (!interviewId.value || !questionId || language.value !== 'English') return
  voiceNotice.value = ''
  try {
    const result = await apiRequest<{ voice?: InterviewAudio | null; reason?: string }>(`/api/interviews/${interviewId.value}/question-voice`, {
      method: 'POST', body: { questionId },
    })
    if (result.voice) await playKokoroVoice(result.voice)
    else if (result.reason) voiceNotice.value = result.reason
  } catch {
    // Voice is an enhancement. The written question and interview remain usable
    // if the TTS provider is temporarily unavailable.
    voiceNotice.value = 'Minerva voice is temporarily unavailable. You can continue with the question on screen.'
  }
}
const start = async () => {
  if (!selected.value || generatingInterview.value) return
  generatingInterview.value = true
  aiError.value = ''
  voiceNotice.value = ''
  try {
    const result = await apiRequest<{
      sessionId?: string
      id?: string
      questions: Array<InterviewQuestion | string>
    }>('/api/interviews', {
      method: 'POST',
      body: {
        scholarshipId: selected.value.id,
        scholarshipName: selected.value.name,
        provider: selected.value.provider,
        country: selected.value.country,
        language: language.value === 'English' ? 'en' : 'id',
        context: candidateContext.value || undefined,
      },
    })
    syncAiTokenBalance(result)
    interviewId.value = result.sessionId || result.id || ''
    generatedQuestions.value = (result.questions || []).map((item, index) => typeof item === 'string'
      ? { id: `question-${index + 1}`, text: item }
      : { id: item.id || `question-${index + 1}`, text: item.text })
    void loadInterviewHistory()
    stage.value = 'live'
    isPaused.value = false
    elapsed.value = 0
    questionIndex.value = 0
    answerResults.value = {}
    summary.value = null
    await nextTick()
    void startCamera()
    void playQuestionVoice(generatedQuestions.value[0]?.id)
    timer = window.setInterval(() => {
      if (!isPaused.value) elapsed.value += 1
    }, 1000)
  } catch (error) {
    syncAiTokenBalance(error)
    aiError.value = error instanceof Error ? error.message : 'Could not start the AI interview.'
  } finally {
    generatingInterview.value = false
  }
}

const stopMicrophone = () => {
  microphoneStream?.getTracks().forEach((track) => track.stop())
  microphoneStream = undefined
}
const submitRecordedAnswer = async (audio: Blob, durationSeconds: number) => {
  if (!interviewId.value || !question.value) return
  submittingAnswer.value = true
  aiError.value = ''
  const activeQuestion = question.value
  try {
    const form = new FormData()
    form.append('questionId', activeQuestion.id)
    form.append('audio', audio, `interview-${activeQuestion.id}.webm`)
    form.append('durationSeconds', String(durationSeconds))
    const result = await apiRequest<InterviewAnswerResponse>(`/api/interviews/${interviewId.value}/answers`, {
      method: 'POST',
      body: form,
    })
    syncAiTokenBalance(result)
    const transcript = typeof result.transcript === 'string' ? result.transcript : result.transcript.text
    answerResults.value = {
      ...answerResults.value,
      [activeQuestion.id]: { transcript, evaluation: result.evaluation, durationSeconds, reply: result.reply?.text },
    }
    if (result.followUp && !generatedQuestions.value.some((item) => item.id === result.followUp?.id)) {
      generatedQuestions.value.splice(questionIndex.value + 1, 0, result.followUp)
    }
    if (result.voice) void playKokoroVoice(result.voice)
    toast(result.followUp ? 'Minerva has a follow-up question.' : 'Answer transcribed and reviewed.')
    if (questionIndex.value < questions.value.length - 1) window.setTimeout(() => { void nextQuestion() }, 650)  } catch (error) {
    syncAiTokenBalance(error)
    aiError.value = error instanceof Error ? error.message : 'Could not transcribe this answer.'
  } finally {
    submittingAnswer.value = false
    resolveStopRecording?.()
    resolveStopRecording = undefined
    stopRecordingPromise = undefined
  }
}
const toggleMicrophone = async () => {
  if (recording.value) {
    stopRecordingPromise = new Promise<void>((resolve) => { resolveStopRecording = resolve })
    recorder?.stop()
    recording.value = false
    stopMicrophone()
    await stopRecordingPromise
    return
  }
  if (submittingAnswer.value || isPaused.value) return
  aiError.value = ''
  try {
    microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const preferredType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
    recorder = preferredType ? new MediaRecorder(microphoneStream, { mimeType: preferredType }) : new MediaRecorder(microphoneStream)
    recordingChunks = []
    recorder.ondataavailable = (event) => { if (event.data.size) recordingChunks.push(event.data) }
    recorder.onstop = () => {
      const durationSeconds = Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000))
      const audio = new Blob(recordingChunks, { type: recorder?.mimeType || 'audio/webm' })
      void submitRecordedAnswer(audio, durationSeconds)
    }
    recordingStartedAt = Date.now()
    recorder.start()
    recording.value = true
  } catch {
    aiError.value = 'Microphone access is unavailable. Check browser permissions and try again.'
    stopMicrophone()
  }
}
const togglePause = () => {
  isPaused.value = !isPaused.value
  if (!recorder || recorder.state === 'inactive') return
  if (isPaused.value && recorder.state === 'recording') recorder.pause()
  if (!isPaused.value && recorder.state === 'paused') recorder.resume()
}
const finish = async () => {
  if (recording.value) await toggleMicrophone()
  if (timer) window.clearInterval(timer)
  timer = undefined
  stopCamera()
  completingInterview.value = true
  aiError.value = ''
  try {
    const result = interviewId.value
      ? await apiRequest<{ aggregate?: InterviewAggregate }>(`/api/interviews/${interviewId.value}/complete`, { method: 'POST', body: {} })
      : undefined
    summary.value = result?.aggregate ? {
      clarity: result.aggregate.clarity,
      confidence: result.aggregate.specificity,
      structure: result.aggregate.structure,
      wordsPerMinute: fallbackSummary.value.wordsPerMinute,
      highlights: result.aggregate.highlights,
      improvements: result.aggregate.improvements,
    } : null
    stage.value = 'results'
    void loadInterviewHistory()
    toast('Interview analysis is ready.')
  } catch (error) {
    aiError.value = error instanceof Error ? error.message : 'Could not complete the interview analysis.'
  } finally {
    completingInterview.value = false
  }
}
const nextQuestion = async () => {
  if (recording.value) await toggleMicrophone()
  const nextIndex = Math.min(questions.value.length - 1, questionIndex.value + 1)
  if (nextIndex === questionIndex.value) return
  questionIndex.value = nextIndex
  await nextTick()
  void playQuestionVoice(question.value?.id)
}

onMounted(() => { void loadInterviewHistory() })

onBeforeUnmount(() => {
  stopKokoroVoice()
  if (timer) window.clearInterval(timer)
  if (recorder?.state !== 'inactive') recorder?.stop()
  stopMicrophone()
  stopCamera()
})
</script>

<template>
  <main class="workspace-shell">
    <WorkspaceSidebar active="interview" />
    <div class="workspace-main">
      <WorkspaceTopbar title="Interview Prep" subtitle="Practice scholarship interviews with tailored questions and feedback." />
      <div class="workspace-content">
        <section v-if="stage === 'home'" class="mx-auto w-full max-w-5xl py-4 sm:py-8">
          <p class="eyebrow">AI interview practice</p>
          <h1 class="mt-2 text-3xl font-extrabold text-[#17136b]">What would you like to do?</h1>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Start a tailored scholarship interview or review your saved transcripts and AI feedback.</p>
          <div class="mt-7 grid gap-5 md:grid-cols-2">
            <button class="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-7 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#5b45f5] hover:shadow-md" @click="stage = 'setup'">
              <span class="grid size-12 place-items-center rounded-2xl bg-[#5b45f5] text-white"><Play :size="22" /></span>
              <h2 class="mt-5 text-xl font-extrabold text-[#17136b]">Start new interview</h2>
              <p class="mt-2 text-sm leading-6 text-slate-500">Choose a scholarship, add optional context, and practise with Minerva AI.</p>
            </button>
            <button class="rounded-3xl border border-slate-200 bg-white p-7 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#5b45f5] hover:shadow-md" @click="stage = 'history'; void loadInterviewHistory()">
              <span class="grid size-12 place-items-center rounded-2xl bg-violet-100 text-[#5b45f5]"><Clock3 :size="22" /></span>
              <h2 class="mt-5 text-xl font-extrabold text-[#17136b]">Check interview history</h2>
              <p class="mt-2 text-sm leading-6 text-slate-500">Read saved transcripts and revisit AI analysis from earlier interview sessions.</p>
            </button>
          </div>
          <p class="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">Your camera stays on your device. Recorded audio is sent only to create a transcript and AI feedback; Minerva never stores your MP3, WebM, or other audio file.</p>
        </section>

        <section v-else-if="stage === 'setup'" class="interview-setup">
          <div class="interview-step">
<span>1</span>
<i />
<span>2</span>
</div>
          <p class="eyebrow">Interview setup</p>
          <h2>Prepare your interview</h2>
          <p>Select a scholarship first. You can then add a document and context to make your practice more personal.</p>

          <div class="interview-setup-grid">
            <div class="workspace-card p-6">
              <p class="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Scholarship</p>
              <BaseSelect v-model="selectedScholarshipName" class="interview-scholarship-select mt-4" :options="availableScholarships.map((item) => item.name)" placeholder="Select a scholarship" />
              <template v-if="selected">
                <p class="mt-3 text-sm text-slate-500">{{ selected.provider }} · {{ selected.country }}</p>
                <div class="interview-upload text-left">
                  <strong>Use a workspace draft (optional)</strong>
                  <span v-if="interviewDocuments.length">Choose a saved draft to personalize the generated questions.</span>
                  <span v-else>Write or import a document in your workspace first, or continue with the context box.</span>
                  <BaseSelect v-if="interviewDocuments.length" v-model="selectedDocumentTitle" class="mt-3 w-full" :options="interviewDocuments.map((document) => document.title)" placeholder="Choose a saved document" />
                </div>
              </template>
              <div v-else class="mt-4 rounded-xl bg-violet-50 px-4 py-3 text-sm leading-6 text-slate-600">
                Select a scholarship to unlock your tailored interview setup.
              </div>
              <RouterLink v-if="!availableScholarships.length" to="/scholarships" class="btn-secondary mt-4">Browse scholarships</RouterLink>
            </div>

            <div class="workspace-card p-6">
              <p class="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Additional context <span class="normal-case tracking-normal text-slate-400">(optional)</span>
</p>
              <textarea v-model="context" class="field mt-4 min-h-56" placeholder="Add goals, focus areas, or context the interviewer should know…" />
              <div class="mt-5 rounded-xl bg-emerald-50 p-4 text-xs leading-5 text-emerald-800">Camera video stays on this device. Selected draft text, added context, and recorded answers are sent securely for question generation, transcription, and feedback.</div>
            </div>
          </div>

          <button class="btn-primary ml-auto mt-6" :disabled="!selected" @click="continueSetup">Continue <Play :size="16" />
</button>
        </section>

        <section v-else-if="stage === 'history'" class="mx-auto w-full max-w-5xl py-4 sm:py-8">
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div><p class="eyebrow">Saved practice</p><h2 class="mt-2 text-3xl font-extrabold text-[#17136b]">Interview history</h2><p class="mt-2 text-sm text-slate-500">Select a session to read the transcript and AI analysis.</p></div>
            <div class="flex gap-2"><button class="btn-secondary" :disabled="historyLoading" @click="loadInterviewHistory"><Clock3 :size="16" />Refresh</button><button class="btn-secondary" @click="stage = 'home'"><ArrowLeft :size="16" />Back</button></div>
          </div>
          <p v-if="historyError" class="mt-5 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{{ historyError }}</p>
          <p v-else-if="historyLoading && !interviewHistory.length" class="mt-5 text-sm text-slate-500">Loading saved interviews…</p>
          <p v-else-if="!interviewHistory.length" class="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No saved interviews yet. Finish an interview with at least one recorded answer and it will appear here.</p>
          <div v-else class="mt-5 grid gap-3 lg:grid-cols-2">
            <div v-for="item in interviewHistory" :key="item.id" class="relative"><button class="w-full rounded-xl border border-slate-200 bg-white p-4 pr-12 text-left transition hover:border-violet-300 hover:bg-violet-50" :class="selectedHistorySession?.id === item.id ? 'border-violet-400 bg-violet-50' : ''" @click="openHistorySession(item.id)">
              <p class="font-extrabold text-[#17136b]">{{ item.scholarshipName }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ item.answerCount }}/{{ item.questionCount }} answers · {{ item.status }}</p>
              <p class="mt-2 text-xs font-bold text-slate-400">{{ formatHistoryDate(item.updatedAt) }}<span v-if="item.overall !== undefined"> · AI score {{ item.overall }}/100</span></p>
            </button><button type="button" class="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete interview" @click.stop="deleteInterview(item.id)"><Trash2 :size="16" /></button>
          </div>
          </div>
          <article v-if="selectedHistorySession" class="mt-5 rounded-2xl border border-violet-100 bg-violet-50/60 p-5">
            <div class="flex flex-wrap items-center justify-between gap-2"><div><p class="text-lg font-extrabold text-[#17136b]">{{ selectedHistorySession.scholarshipName }}</p><p class="text-xs text-slate-500">{{ formatHistoryDate(selectedHistorySession.completedAt || selectedHistorySession.createdAt) }}</p></div><span class="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-[#5b45f5]">{{ selectedHistorySession.status }}</span></div>
            <div v-if="selectedHistorySession.aggregate" class="mt-5 grid gap-3 sm:grid-cols-3"><div class="rounded-xl bg-white p-4"><p class="text-xs font-bold text-slate-400">AI overall score</p><strong class="mt-1 block text-2xl text-[#5b45f5]">{{ selectedHistorySession.aggregate.overall ?? '—' }}</strong></div><div class="rounded-xl bg-white p-4 sm:col-span-2"><p class="text-xs font-bold text-slate-400">AI analysis</p><p class="mt-2 text-sm text-slate-600">{{ (selectedHistorySession.aggregate.highlights || []).join(' · ') || 'Review each answer below for detailed feedback.' }}</p></div></div>
            <p v-if="!selectedHistorySession.answers.length" class="mt-5 text-sm text-slate-500">No recorded answers in this session yet.</p>
            <details v-for="answer in selectedHistorySession.answers" :key="answer.questionId" class="mt-4 rounded-xl bg-white p-4" open>
              <summary class="cursor-pointer text-sm font-extrabold text-[#17136b]">{{ historyQuestion(selectedHistorySession, answer.questionId) }}</summary>
              <p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{{ answer.transcript.text }}</p>
              <p class="mt-3 text-xs font-bold text-slate-500">{{ answer.durationSeconds }}s · AI clarity {{ answer.evaluation.clarity }} · relevance {{ answer.evaluation.relevance }} · structure {{ answer.evaluation.structure }}</p>
              <p v-if="answer.evaluation.improvements.length" class="mt-2 text-sm leading-6 text-amber-800"><strong>Improve:</strong> {{ answer.evaluation.improvements.join(' · ') }}</p>
            </details>
          </article>
        </section>

        <section v-else-if="stage === 'language'" class="interview-language">
          <div class="interview-step">
<span>1</span>
<i class="active" />
<span>2</span>
</div>
          <p class="eyebrow">Interview language</p>
          <h2>Choose the language you will use</h2>
          <label v-for="item in ['Bahasa Indonesia', 'English']" :key="item" class="interview-language-option" :class="language === item && 'active'">
            <input v-model="language" type="radio" :value="item" />
            <div>
<strong>{{ item }}</strong>
<p>{{ item === 'Bahasa Indonesia' ? 'Interview questions and guidance in Indonesian.' : 'Interview questions and guidance in English.' }}</p>
</div>
          </label>
          <div class="mt-7 flex justify-between">
<button class="btn-secondary" @click="stage = 'setup'">
<ArrowLeft :size="16" />Back</button>
<button class="btn-primary" @click="stage = 'ready'">Continue <Play :size="16" />
</button>
</div>
          <p v-if="aiError" class="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{{ aiError }}</p>
        </section>

        <section v-else-if="stage === 'ready'" class="mx-auto w-full max-w-3xl py-5 sm:py-10">
          <div class="rounded-[28px] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-[#edf8ff] p-7 text-center shadow-[0_24px_70px_rgba(47,35,140,.12)] sm:p-10">
            <span class="mx-auto grid size-14 place-items-center rounded-2xl bg-[#5b45f5] text-white"><Sparkles :size="26" /></span>
            <p class="mt-6 text-xs font-extrabold uppercase tracking-[.16em] text-[#5b45f5]">Interview room ready</p>
            <h2 class="mt-3 text-3xl font-extrabold text-[#17136b]">Start when you are ready</h2>
            <p class="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">Your tailored {{ language === 'English' ? 'English' : 'Bahasa Indonesia' }} interview for <strong>{{ selected?.name }}</strong> is ready to begin. Questions are generated only after you choose to start.</p>
            <div class="mx-auto mt-7 grid max-w-xl gap-3 text-left text-sm sm:grid-cols-3">
              <div class="rounded-xl bg-white p-4 shadow-sm"><strong class="block text-[#17136b]">Questions</strong><span class="mt-1 block text-slate-500">Generated after you start</span></div>
              <div class="rounded-xl bg-white p-4 shadow-sm"><strong class="block text-[#17136b]">Camera</strong><span class="mt-1 block text-slate-500">Optional and local only</span></div>
              <div class="rounded-xl bg-white p-4 shadow-sm"><strong class="block text-[#17136b]">Microphone</strong><span class="mt-1 block text-slate-500">Requested when you record</span></div>
            </div>
            <p class="mx-auto mt-6 max-w-xl rounded-xl bg-emerald-50 p-4 text-left text-xs leading-5 text-emerald-800">No camera or microphone permission is requested on this screen. Your audio is never stored; only the transcript and AI feedback can appear in your private history.</p>
            <div class="mt-7 flex flex-wrap justify-center gap-3"><button class="btn-secondary" @click="stage = 'language'"><ArrowLeft :size="16" />Change language</button><button class="btn-primary" :disabled="generatingInterview" @click="start"><Play :size="16" />{{ generatingInterview ? 'Preparing interview…' : 'Start interview when ready' }}</button></div>
            <p v-if="aiError" class="mt-5 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{{ aiError }}</p>
          </div>
        </section>

        <section v-else-if="stage === 'live'" class="overflow-hidden rounded-[28px] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-[#edf8ff] text-[#17136b] shadow-[0_24px_70px_rgba(47,35,140,.14)]">
          <header class="flex flex-wrap items-center justify-between gap-4 border-b border-violet-100 bg-white/90 px-5 py-4 sm:px-7">
            <div>
<p class="flex items-center gap-2 text-sm font-black sm:text-base">
<span class="grid size-8 place-items-center rounded-xl bg-violet-100 text-[#5b45f5]">
<Sparkles :size="16" />
</span>{{ selected?.name }}</p>
<span class="mt-1 block text-[.7rem] font-bold text-slate-400">{{ language }} · tailored question {{ questionIndex + 1 }}/{{ questions.length }}</span>
</div>
            <div class="flex items-center gap-2.5">
<span class="rounded-full bg-emerald-50 px-3 py-2 text-[.68rem] font-black uppercase tracking-[.08em] text-emerald-700">{{ isPaused ? 'Paused' : 'Connected' }}</span>
<strong class="rounded-xl bg-violet-50 px-3.5 py-2 text-sm tabular-nums text-[#5b45f5]">{{ formatted }}</strong>
</div>
          </header>
          <div class="grid gap-5 p-4 sm:p-6 lg:grid-cols-2">
            <div class="relative grid min-h-[320px] place-items-center overflow-hidden rounded-[22px] border border-violet-200 bg-[radial-gradient(circle_at_center,#fff_0%,#f3f0ff_58%,#ebe7ff_100%)]">
              <video v-if="cameraEnabled" ref="cameraVideo" autoplay muted playsinline class="absolute inset-0 size-full object-cover [transform:scaleX(-1)]" />
              <span class="absolute left-4 top-4 z-10 rounded-full bg-white px-3 py-1.5 text-[.66rem] font-black text-[#5b45f5]">Your camera</span>
              <div v-if="!cameraEnabled" class="h-40 w-32 rounded-[48%_48%_44%_44%] border-2 border-[#8b7cf6] bg-white/70" />
              <button v-if="!cameraEnabled" type="button" class="absolute inset-0 grid place-items-center" @click="startCamera"><span class="rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-[#5b45f5] shadow-sm">Turn on camera</span></button>
              <p v-if="cameraError" class="absolute bottom-10 right-4 z-10 max-w-[230px] rounded-lg bg-white/90 px-3 py-2 text-right text-[.68rem] font-bold leading-4 text-rose-600">{{ cameraError }}</p>
              <small class="absolute bottom-4 left-4 z-10 font-bold text-slate-500">Your local camera preview · video is not uploaded</small>
            </div>
            <div class="relative grid min-h-[320px] place-items-center overflow-hidden rounded-[22px] border border-violet-200 bg-[radial-gradient(circle_at_center,#fff_0%,#f5f2ff_55%,#ebe7ff_100%)] p-5 text-center">
              <div class="flex h-full flex-col items-center justify-center">
                <img src="/ai-interviewer.gif" alt="Animated Minerva AI interviewer" class="h-52 max-w-full object-contain mix-blend-multiply drop-shadow-[0_16px_22px_rgba(64,48,180,.22)] transition" :class="aiSpeaking ? 'scale-105' : ''" />
                <div class="mt-2 flex items-center justify-center gap-2"><span class="text-lg font-black">Minerva AI interviewer</span><span v-if="aiSpeaking" class="rounded-full bg-violet-100 px-2 py-1 text-[.65rem] font-black uppercase tracking-wide text-[#5b45f5]">Speaking</span></div>
                
                <p v-if="voiceNotice" class="mt-2 max-w-sm text-xs font-bold leading-5 text-amber-700">{{ voiceNotice }}</p>
                <div class="mt-4 flex items-center justify-center gap-2"><button type="button" class="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-extrabold text-[#5b45f5]" :disabled="!latestVoice" @click="playKokoroVoice(latestVoice || undefined)"><Volume2 :size="15" />Replay voice</button></div>
              </div>
            </div>
          </div>
          <div class="mx-4 mb-4 flex flex-col justify-between gap-4 rounded-2xl border border-violet-100 bg-white px-5 py-4 sm:mx-6 sm:mb-6 sm:flex-row sm:items-center">
<div class="flex gap-3">
<span class="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-sm font-black text-[#5b45f5]">{{ questionIndex + 1 }}</span>
<p class="max-w-3xl text-sm font-bold leading-6 text-slate-700">{{ question?.text }}</p>
</div>
<button v-if="questionIndex < questions.length - 1" class="shrink-0 rounded-xl bg-violet-50 px-4 py-2.5 text-xs font-black text-[#5b45f5]" :disabled="submittingAnswer" @click="nextQuestion">Next question</button>
</div>
          <div v-if="currentAnswer" class="mx-4 mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm sm:mx-6 sm:mb-6">
            <p class="font-black text-emerald-800">Answer reviewed</p>
            <p class="mt-2 leading-6 text-slate-700">{{ currentAnswer.transcript }}</p>
            <p v-if="currentAnswer.reply" class="mt-3 rounded-xl bg-white p-3 leading-6 text-[#17136b]"><strong>Minerva:</strong> {{ currentAnswer.reply }}</p>
            <p class="mt-2 text-xs font-bold text-emerald-700">Clarity {{ currentAnswer.evaluation.clarity }} · Relevance {{ currentAnswer.evaluation.relevance }} · Structure {{ currentAnswer.evaluation.structure }}</p>
          </div>
          <p v-if="aiError" class="mx-4 mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700 sm:mx-6">{{ aiError }}</p>
          <footer class="flex flex-wrap items-center justify-center gap-2.5 border-t border-violet-100 bg-white/85 px-4 py-4">
<button class="grid size-11 place-items-center rounded-xl border text-white disabled:opacity-50" :class="recording ? 'border-red-500 bg-red-600' : 'border-violet-200 bg-[#5b45f5]'" :disabled="submittingAnswer || isPaused" :aria-label="recording ? 'Stop recording' : 'Record answer'" @click="toggleMicrophone">
<Pause v-if="recording" :size="18" /><Mic v-else :size="18" />
</button>
<button class="grid size-11 place-items-center rounded-xl border border-violet-200 bg-white text-[#5b45f5]" :aria-label="cameraEnabled ? 'Turn off camera' : 'Turn on camera'" :title="cameraEnabled ? 'Turn off camera' : 'Turn on camera'" @click="toggleCamera">
<Video :size="18" />
</button>
<button class="grid size-11 place-items-center rounded-xl border border-violet-200 bg-white text-[#5b45f5]" @click="togglePause">
<Play v-if="isPaused" :size="18" />
<Pause v-else :size="18" />
</button>
<span v-if="submittingAnswer" class="text-xs font-bold text-[#5b45f5]">Transcribing answer…</span>
<button class="btn-primary ml-1" :disabled="submittingAnswer || completingInterview" @click="finish">
<CircleStop :size="16" />{{ completingInterview ? 'Preparing results…' : 'Finish interview' }}</button>
</footer>
        </section>

        <section v-else class="interview-results">
          <header>
<div>
<p class="eyebrow">Interview results</p>
<h2>{{ selected?.name }}</h2>
</div>
<button class="btn-secondary" @click="stage = 'home'; elapsed = 0; questionIndex = 0">
<ArrowLeft :size="16" />Practice again</button>
</header>
          <div class="workspace-card p-6">
<p class="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">
<BarChart3 :size="16" />Detailed performance analysis</p>
<div class="results-metrics">
<div>
<strong>{{ displayedSummary.clarity }}</strong>
<span>Clarity score</span>
</div>
<div>
<strong>{{ displayedSummary.confidence }}</strong>
<span>Confidence</span>
</div>
<div>
<strong>{{ displayedSummary.structure }}</strong>
<span>Structure</span>
</div>
<div>
<strong>{{ displayedSummary.wordsPerMinute }}</strong>
<span>Words/min</span>
</div>
</div>
</div>
          <div class="mt-5 grid gap-5 md:grid-cols-2">
<article class="workspace-card p-6">
<CheckCircle2 class="text-emerald-500" />
<h3>Key highlights</h3>
<ul>
<li v-for="item in displayedSummary.highlights" :key="item">{{ item }}</li>
<li v-if="!displayedSummary.highlights.length">Complete at least one recorded answer to receive tailored highlights.</li>
</ul>
</article>
<article class="workspace-card p-6">
<Clock3 class="text-amber-500" />
<h3>Improvement recommendations</h3>
<ul>
<li v-for="item in displayedSummary.improvements" :key="item">{{ item }}</li>
<li v-if="!displayedSummary.improvements.length">No recommendations were generated yet.</li>
</ul>
</article>
</div>
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
.interview-scholarship-select :deep(.base-select-trigger) {
  min-height: 58px;
  border-color: #ddd6fe;
  background: linear-gradient(90deg, rgb(245 243 255 / .8), #fff);
  padding-inline: 1rem;
  font-weight: 800;
}
.interview-scholarship-select :deep(.base-select-menu) {
  border-color: #ddd6fe;
  box-shadow: 0 18px 35px rgb(55 38 160 / .16);
}
</style>

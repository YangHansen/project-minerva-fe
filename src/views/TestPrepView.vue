<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import {
  ArrowRight, BookOpen, BookOpenCheck, Check, CheckCircle2, ChevronLeft,
  ChevronRight, CircleAlert, Clock3, FilePenLine, Flag, Grid2X2, Headphones,
  ListChecks, Maximize2, Mic, Pause, Play, RotateCcw, Send, Sparkles, Volume2,
} from 'lucide-vue-next'
import WorkspaceSidebar from '../components/dashboard/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/dashboard/WorkspaceTopbar.vue'
import { useAppState } from '../composables/useAppState'
import { getScholarship } from '../data/scholarships'

type Skill = 'Listening' | 'Reading' | 'Writing' | 'Speaking'
type Stage = 'catalog' | 'mode' | 'instructions' | 'microphone' | 'exam' | 'results'
type Mode = 'practice' | 'simulation'

const { practiceResult, toast, selectedId } = useAppState()
const selected = computed(() => selectedId.value ? getScholarship(selectedId.value) : undefined)
const stage = ref<Stage>('catalog')
const currentSkill = ref<Skill>('Listening')
const mode = ref<Mode>('simulation')
const fullTest = ref(false)
const selectedParts = ref([1, 2, 3, 4])
const timeLimit = ref(32)
const remaining = ref(32 * 60)
const playing = ref(false)
const audioProgress = ref(0)
const reviewed = ref<number[]>([])
const listeningAnswers = ref(['', '', '', '', ''])
const readingAnswers = ref(['', '', '', '', '', '', '', ''])
const writingTask = ref<1 | 2>(1)
const writingAnswers = ref<Record<1 | 2, string>>({ 1: '', 2: '' })
const speakingPart = ref(1)
const micStatus = ref<'idle' | 'testing' | 'ready' | 'blocked'>('idle')
const recording = ref(false)
const recordingSaved = ref(false)
const resultScore = ref(0)
let timer: number | undefined
let recorder: MediaRecorder | undefined
let micStream: MediaStream | undefined

const skills = [
  { name: 'Listening' as Skill, icon: Headphones, detail: '4 parts · 40 questions', time: '30 min' },
  { name: 'Reading' as Skill, icon: BookOpen, detail: '3 passages · 40 questions', time: '60 min' },
  { name: 'Writing' as Skill, icon: FilePenLine, detail: '2 writing tasks', time: '60 min' },
  { name: 'Speaking' as Skill, icon: Mic, detail: '3 interview parts', time: '11–14 min' },
]
const readingQuestions = [
  'A challenge caused by limited infrastructure', 'A benefit for people outside major cities',
  'A comparison with an older service', 'Evidence of rapid adoption',
  'The largest', 'a local agent', 'Small businesses', 'reduced the cost of',
]
const formatTime = computed(() => `${String(Math.floor(remaining.value / 60)).padStart(2, '0')}:${String(remaining.value % 60).padStart(2, '0')}`)
const wordCount = computed(() => writingAnswers.value[writingTask.value].trim() ? writingAnswers.value[writingTask.value].trim().split(/\s+/).length : 0)
const answeredCount = computed(() => {
  if (currentSkill.value === 'Listening') return listeningAnswers.value.filter(Boolean).length
  if (currentSkill.value === 'Reading') return readingAnswers.value.filter(Boolean).length
  if (currentSkill.value === 'Writing') return Number(Boolean(writingAnswers.value[1].trim())) + Number(Boolean(writingAnswers.value[2].trim()))
  return Number(recordingSaved.value)
})
const totalQuestions = computed(() => currentSkill.value === 'Listening' ? 5 : currentSkill.value === 'Reading' ? 8 : currentSkill.value === 'Writing' ? 2 : 3)

const chooseSkill = (skill: Skill) => {
  currentSkill.value = skill
  fullTest.value = false
  timeLimit.value = skill === 'Listening' ? 32 : skill === 'Speaking' ? 14 : 60
  stage.value = 'mode'
}
const chooseFullTest = () => { currentSkill.value = 'Listening'; fullTest.value = true; timeLimit.value = 170; stage.value = 'mode' }
const startTimer = () => {
  window.clearInterval(timer)
  remaining.value = timeLimit.value * 60
  timer = window.setInterval(() => {
    if (remaining.value > 0) remaining.value--
    else submitTest()
  }, 1000)
}
const openInstructions = () => { stage.value = 'instructions' }
const beginTest = () => {
  if (currentSkill.value === 'Speaking' && !fullTest.value) stage.value = 'microphone'
  else { stage.value = 'exam'; startTimer() }
}
const beginSpeaking = () => { stage.value = 'exam'; startTimer() }
const exitTest = () => { window.clearInterval(timer); speechSynthesis.cancel(); stage.value = 'catalog'; playing.value = false }
const toggleReview = (number: number) => { reviewed.value = reviewed.value.includes(number) ? reviewed.value.filter((item) => item !== number) : [...reviewed.value, number] }

const playListening = () => {
  if (playing.value) { speechSynthesis.cancel(); playing.value = false; return }
  const script = 'You will hear a university accommodation officer speaking with a student. The student name is Maya Chen. Her passport number is K L 4729. She enrolled in Environmental Policy. The course lasts eighteen months, and she prefers a quiet room near the library.'
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
const toggleRecording = async () => {
  if (recording.value) {
    recorder?.stop(); micStream?.getTracks().forEach((track) => track.stop()); recording.value = false; recordingSaved.value = true; return
  }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    recorder = new MediaRecorder(micStream)
    recorder.start(); recording.value = true
  } catch { micStatus.value = 'blocked' }
}
const submitTest = () => {
  window.clearInterval(timer)
  speechSynthesis.cancel()
  const raw = Math.round((answeredCount.value / totalQuestions.value) * 100)
  resultScore.value = Math.max(0, raw)
  practiceResult.value = {
    type: `IELTS ${fullTest.value ? 'Full Test' : currentSkill.value}`,
    score: resultScore.value,
    completedAt: new Date().toISOString(),
    explanation: 'Unofficial simulation result based on completed responses. Review flagged questions and practise under timed conditions.',
  }
  toast(`IELTS simulation saved to ${selected.value?.name}.`)
  stage.value = 'results'
}
const resetSimulation = () => {
  listeningAnswers.value = ['', '', '', '', '']; readingAnswers.value = ['', '', '', '', '', '', '', '']
  writingAnswers.value = { 1: '', 2: '' }; reviewed.value = []; recordingSaved.value = false; speakingPart.value = 1
  stage.value = 'catalog'
}
onUnmounted(() => { window.clearInterval(timer); speechSynthesis.cancel(); micStream?.getTracks().forEach((track) => track.stop()) })
</script>

<template>
  <main v-if="stage === 'catalog' || stage === 'mode'" class="workspace-shell">
    <WorkspaceSidebar active="test" />
    <div class="workspace-main">
      <WorkspaceTopbar title="IELTS Test Prep" subtitle="Computer-delivered IELTS practice and realistic timed simulations." />
      <div class="workspace-content">
        <section v-if="!selected" class="notion-select-state"><div class="notion-select-icon"><BookOpenCheck :size="31" /></div><p class="text-xs font-extrabold uppercase tracking-[.16em] text-[#5b45f5]">IELTS preparation</p><h1>Select a scholarship first</h1><p>Your IELTS study plan and results are saved per scholarship.</p><RouterLink to="/scholarships" class="btn-primary">Browse scholarships</RouterLink></section>
        <template v-else>
          <section class="overflow-hidden rounded-3xl bg-gradient-to-r from-[#17136b] via-[#4c35d9] to-[#2aa8f7] p-7 text-white sm:p-9"><div class="flex flex-wrap items-center justify-between gap-7"><div><p class="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.16em] text-violet-200"><Sparkles :size="15" />Minerva IELTS Simulation</p><h1 class="mt-4 text-3xl font-extrabold sm:text-4xl">IELTS Academic Mock Test</h1><p class="mt-3 max-w-2xl text-sm leading-6 text-violet-100">A realistic computer-based environment with official-style timing, navigation, review flags, and all four skills.</p><div class="mt-5 flex flex-wrap gap-2"><span class="rounded-full bg-white/12 px-3 py-1.5 text-xs font-bold">For {{ selected.name }}</span><span class="rounded-full bg-white/12 px-3 py-1.5 text-xs font-bold">Unofficial simulation</span></div></div><div class="grid size-32 place-items-center rounded-3xl bg-white/12 text-center"><strong class="text-4xl">{{ practiceResult?.score ?? '—' }}</strong><span class="-mt-7 text-xs text-violet-100">latest score</span></div></div></section>

          <section class="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div class="flex flex-wrap items-center justify-between gap-4"><div><p class="text-xs font-extrabold uppercase tracking-[.14em] text-[#5b45f5]">Practice test 1</p><h2 class="mt-2 text-2xl font-extrabold text-[#17136b]">Choose a test section</h2></div><span class="text-sm font-bold text-slate-400">Academic · Computer-delivered</span></div><div class="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><button v-for="item in skills" :key="item.name" class="group flex min-h-64 flex-col rounded-2xl border border-slate-200 p-5 text-left transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg" @click="chooseSkill(item.name)"><span class="grid size-12 place-items-center rounded-2xl bg-violet-100 text-[#5b45f5]"><component :is="item.icon" :size="23" /></span><h3 class="mt-5 text-xl font-extrabold text-[#17136b]">{{ item.name }}</h3><p class="mt-2 text-sm text-slate-500">{{ item.detail }}</p><p class="mt-1 text-xs font-bold text-slate-400">{{ item.time }}</p><span class="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#5b45f5] px-4 py-3 text-sm font-extrabold text-white">Take test <ArrowRight :size="16" /></span></button></div><button class="mt-5 flex w-full flex-wrap items-center gap-4 rounded-2xl bg-[#17136b] p-5 text-left text-white" @click="chooseFullTest"><span class="grid size-12 place-items-center rounded-xl bg-white/12"><Grid2X2 :size="22" /></span><span><b class="block text-lg">Full IELTS simulation</b><span class="text-sm text-violet-200">Listening, Reading, Writing and Speaking · complete test journey</span></span><span class="ml-auto inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-[#17136b]">Start full test <ArrowRight :size="16" /></span></button></section>
        </template>
      </div>
    </div>

    <div v-if="stage === 'mode'" class="fixed inset-0 z-50 grid place-items-center overflow-auto bg-[#0b0a2d]/70 p-4 backdrop-blur-sm"><section class="relative w-full max-w-5xl rounded-3xl bg-[#fbfbfe] p-6 shadow-2xl sm:p-9"><button class="absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-white text-slate-500 shadow" aria-label="Close" @click="stage = 'catalog'">×</button><div class="text-center"><p class="text-xs font-extrabold uppercase tracking-[.16em] text-[#5b45f5]">{{ fullTest ? 'Full IELTS test' : currentSkill }}</p><h2 class="mt-3 text-3xl font-extrabold text-[#17136b]">Choose a mode</h2></div><div class="mt-7 grid gap-5 lg:grid-cols-2"><button class="flex min-h-96 flex-col rounded-3xl border-2 p-7 text-left" :class="mode === 'practice' ? 'border-[#5b45f5] bg-violet-50' : 'border-slate-200 bg-white'" @click="mode = 'practice'"><span class="grid size-13 place-items-center rounded-2xl bg-violet-100 text-[#5b45f5]"><ListChecks :size="25" /></span><h3 class="mt-5 text-2xl font-extrabold text-[#17136b]">Practice mode</h3><p class="mt-2 text-sm leading-6 text-slate-500">Choose parts and practise accuracy without the pressure of the official timing.</p><div class="mt-6 grid gap-3"><label v-for="part in 4" :key="part" class="flex items-center gap-3 text-sm font-bold text-[#17136b]"><input v-model="selectedParts" type="checkbox" :value="part" class="accent-[#5b45f5]" />Part {{ part }} <span class="font-normal text-slate-400">(10 questions)</span></label></div><label class="mt-6 text-sm font-bold text-[#17136b]">Time limit<select v-model="timeLimit" class="field mt-2"><option :value="20">20 minutes</option><option :value="32">32 minutes</option><option :value="60">60 minutes</option></select></label></button><button class="flex min-h-96 flex-col rounded-3xl border-2 p-7 text-left" :class="mode === 'simulation' ? 'border-[#5b45f5] bg-violet-50' : 'border-slate-200 bg-white'" @click="mode = 'simulation'"><span class="grid size-13 place-items-center rounded-2xl bg-violet-100 text-[#5b45f5]"><Clock3 :size="25" /></span><h3 class="mt-5 text-2xl font-extrabold text-[#17136b]">Simulation test mode</h3><p class="mt-2 text-sm leading-6 text-slate-500">Experience the real computer-delivered flow with a fixed timer, review flags, and final submission.</p><div class="mt-7 rounded-2xl bg-white p-5"><p class="text-xs font-extrabold uppercase tracking-[.12em] text-slate-400">Test information</p><p class="mt-3 font-extrabold text-[#17136b]">{{ fullTest ? 'All four skills' : currentSkill }}</p><p class="mt-1 text-sm text-slate-500">{{ timeLimit }} minutes · timed environment</p></div><span class="mt-auto flex items-center gap-2 text-sm font-bold text-[#5b45f5]"><CheckCircle2 :size="17" />Recommended for test-day readiness</span></button></div><button class="btn-primary mx-auto mt-7" @click="openInstructions">Continue <ArrowRight :size="16" /></button></section></div>
  </main>

  <main v-else-if="stage === 'instructions'" class="min-h-screen bg-[#fbfbfe]"><header class="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-10"><img src="/minerva-logo.png" alt="Minerva" class="h-12 w-40 object-contain" /><p class="flex items-center gap-2 font-extrabold text-[#17136b]"><Clock3 :size="20" class="text-[#5b45f5]" />{{ timeLimit }} minutes</p><button class="text-sm font-extrabold text-slate-500" @click="exitTest">Exit</button></header><section class="mx-auto max-w-3xl px-6 py-16"><p class="text-center text-xs font-extrabold uppercase tracking-[.17em] text-[#5b45f5]">IELTS {{ currentSkill }}</p><h1 class="mt-3 text-center text-3xl font-extrabold text-[#17136b]">General instructions</h1><div class="mt-10 grid gap-4"><div v-for="(item,index) in ['The test interface includes an active timer at the top of every page.','Answer every question; unanswered questions are marked clearly in the navigator.','Use the flag control to mark questions you want to review before submission.','Your answers save automatically while this simulation remains open.','Submit only when you are finished. The result is an unofficial preparation score.']" :key="item" class="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5"><span class="grid size-9 shrink-0 place-items-center rounded-full bg-violet-100 font-extrabold text-[#5b45f5]">{{ index + 1 }}</span><p class="text-sm leading-7 text-slate-600">{{ item }}</p></div></div><button class="btn-primary mx-auto mt-9" @click="beginTest">Begin test <ArrowRight :size="17" /></button></section></main>

  <main v-else-if="stage === 'microphone'" class="min-h-screen bg-[#fbfbfe]"><header class="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-10"><img src="/minerva-logo.png" alt="Minerva" class="h-12 w-40 object-contain" /><p class="font-extrabold text-[#17136b]">Speaking system check</p><button class="text-sm font-extrabold text-slate-500" @click="exitTest">Exit</button></header><section class="mx-auto mt-16 max-w-3xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm"><span class="mx-auto grid size-20 place-items-center rounded-full bg-violet-100 text-[#5b45f5]"><Mic :size="35" /></span><h1 class="mt-7 text-3xl font-extrabold text-[#17136b]">Test your microphone</h1><p class="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">Allow microphone access so your speaking responses can be recorded during the simulation.</p><div class="mt-7 rounded-2xl bg-[#f7f7fc] p-5"><p v-if="micStatus === 'idle'">Your microphone has not been tested.</p><p v-else-if="micStatus === 'testing'" class="text-[#5b45f5]">Checking microphone access…</p><p v-else-if="micStatus === 'ready'" class="font-extrabold text-emerald-600">Microphone is ready.</p><p v-else class="font-extrabold text-red-600">Microphone access was blocked. Update browser permissions or continue without recording.</p></div><div class="mt-8 flex flex-wrap justify-center gap-3"><button class="btn-primary" @click="testMicrophone"><Mic :size="17" />Test microphone</button><button class="btn-secondary" :disabled="micStatus === 'testing'" @click="beginSpeaking">{{ micStatus === 'ready' ? 'Continue' : 'Skip check' }} <ArrowRight :size="16" /></button></div></section></main>

  <main v-else-if="stage === 'exam'" class="flex min-h-screen flex-col bg-white text-[#17136b]">
    <header class="sticky top-0 z-30 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 shadow-sm sm:px-8"><img src="/minerva-logo.png" alt="Minerva" class="h-11 w-36 object-contain" /><div class="flex items-center gap-2 text-lg font-extrabold"><Clock3 :size="21" class="text-[#5b45f5]" /><span :class="remaining < 300 && 'text-red-600'">{{ formatTime }}</span><span class="text-sm font-semibold text-slate-400">remaining</span></div><div class="flex items-center gap-2"><button class="grid size-10 place-items-center rounded-xl border border-slate-200" title="Full screen"><Maximize2 :size="18" /></button><button class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-extrabold" @click="toggleReview(1)"><Flag :size="16" class="inline" /> Review</button><button class="inline-flex items-center gap-2 rounded-xl bg-[#5b45f5] px-5 py-2.5 text-sm font-extrabold text-white" @click="submitTest">Submit <Send :size="16" /></button></div></header>
    <nav v-if="fullTest" class="flex gap-2 overflow-auto border-b border-slate-200 bg-[#fafafe] px-5 py-3"><button v-for="item in skills" :key="item.name" class="rounded-xl px-4 py-2 text-sm font-extrabold" :class="currentSkill === item.name ? 'bg-[#17136b] text-white' : 'text-slate-500'" @click="currentSkill = item.name">{{ item.name }}</button></nav>

    <section v-if="currentSkill === 'Listening'" class="flex flex-1 flex-col"><div class="flex items-center gap-4 border-b border-slate-200 bg-[#fafafe] px-6 py-4"><button class="grid size-10 place-items-center rounded-full bg-[#5b45f5] text-white" @click="playListening"><Pause v-if="playing" :size="18" /><Play v-else :size="18" /></button><span class="text-xs font-bold text-slate-500">Audio source 1</span><div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div class="h-full bg-[#5b45f5] transition-all" :style="{ width: `${audioProgress}%` }" /></div><Volume2 :size="18" class="text-[#5b45f5]" /></div><div class="mx-auto w-full max-w-6xl flex-1 p-6 sm:p-9"><p class="text-xs font-extrabold uppercase tracking-[.14em] text-[#5b45f5]">Part 1 · Questions 1–5</p><h1 class="mt-3 text-2xl font-extrabold">Student accommodation application</h1><p class="mt-5 text-sm italic text-slate-500">Complete the form. Write NO MORE THAN THREE WORDS AND/OR A NUMBER for each answer.</p><div class="mt-7 overflow-hidden rounded-2xl border border-slate-200"><div v-for="(label,index) in ['Student name','Passport number','Course enrolled','Course duration','Room preference']" :key="label" class="grid border-b border-slate-200 last:border-0 sm:grid-cols-[1fr_1.4fr]"><span class="bg-[#fafafe] p-4 text-sm font-bold">{{ label }}</span><label class="flex items-center gap-3 p-3"><span class="grid size-8 shrink-0 place-items-center rounded-full bg-[#5b45f5] text-xs font-extrabold text-white">{{ index + 1 }}</span><input v-model="listeningAnswers[index]" class="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#5b45f5]" /></label></div></div></div></section>

    <section v-else-if="currentSkill === 'Reading'" class="grid min-h-0 flex-1 lg:grid-cols-2"><article class="max-h-[calc(100vh-150px)] overflow-auto border-r border-slate-200 bg-[#f8f8ff] p-6 sm:p-9"><p class="text-xs font-extrabold uppercase tracking-[.14em] text-[#5b45f5]">Part 1 · Reading passage 1</p><h1 class="mt-3 text-3xl font-extrabold">Connected communities</h1><p class="mt-2 text-sm italic text-slate-500">Spend about 20 minutes on Questions 1–13.</p><div class="mt-7 space-y-6 text-sm leading-8 text-slate-700"><p><b>A.</b> Digital payment services have changed daily life in regions where conventional banking is difficult to access. A mobile phone can now serve as a simple account, allowing users to send small amounts safely across long distances.</p><p><b>B.</b> The strongest early growth came from rural communities. Local shop owners became authorised agents, accepting deposits and paying withdrawals. This network reduced the need for expensive journeys to a city branch.</p><p><b>C.</b> Researchers initially expected young professionals to dominate adoption. Instead, small businesses and families used the service most frequently because transactions were faster and easier to document.</p><p><b>D.</b> Similar systems existed before, but the new platform expanded much more quickly. Within two years, registrations exceeded the provider’s original five-year forecast.</p><p><b>E.</b> Security remains important. Users must protect personal codes, while providers continue to improve identity checks and fraud monitoring.</p></div></article><article class="max-h-[calc(100vh-150px)] overflow-auto p-6 sm:p-9"><h2 class="text-xl font-extrabold text-[#5b45f5]">Questions 1–8</h2><p class="mt-3 text-sm text-slate-500">For Questions 1–4, choose the paragraph A–E. Complete Questions 5–8 using words from the passage.</p><div class="mt-7 grid gap-5"><label v-for="(question,index) in readingQuestions" :key="question" class="flex items-center gap-3 text-sm"><span class="grid size-8 shrink-0 place-items-center rounded-full bg-[#5b45f5] text-xs font-extrabold text-white">{{ index + 1 }}</span><select v-if="index < 4" v-model="readingAnswers[index]" class="w-24 rounded-lg border border-slate-300 px-3 py-2"><option value="">—</option><option v-for="letter in ['A','B','C','D','E']" :key="letter">{{ letter }}</option></select><input v-else v-model="readingAnswers[index]" class="w-40 rounded-lg border border-slate-300 px-3 py-2" /><span>{{ question }}</span></label></div></article></section>

    <section v-else-if="currentSkill === 'Writing'" class="grid min-h-0 flex-1 lg:grid-cols-2"><article class="max-h-[calc(100vh-150px)] overflow-auto border-r border-slate-200 bg-[#fafafe] p-6 sm:p-9"><p class="text-xs font-extrabold uppercase tracking-[.14em] text-[#5b45f5]">Writing task {{ writingTask }}</p><h1 class="mt-3 text-2xl font-extrabold">{{ writingTask === 1 ? 'Academic Writing Task 1' : 'Academic Writing Task 2' }}</h1><template v-if="writingTask === 1"><p class="mt-5 leading-7 text-slate-600">The process below shows how scholarship applications move from discovery to final submission.</p><p class="mt-4 leading-7 text-slate-600">Summarise the information by selecting and reporting the main features. Write at least 150 words.</p><div class="mt-9 grid gap-3 sm:grid-cols-5"><div v-for="(step,index) in ['Discover','Check fit','Prepare','Review','Submit']" :key="step" class="relative rounded-xl border border-violet-200 bg-white p-4 text-center text-sm font-extrabold text-[#17136b]"><span class="mx-auto mb-2 grid size-7 place-items-center rounded-full bg-violet-100 text-xs text-[#5b45f5]">{{ index + 1 }}</span>{{ step }}<ArrowRight v-if="index < 4" :size="16" class="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-[#5b45f5] sm:block" /></div></div></template><template v-else><p class="mt-5 leading-8 text-slate-600">Some people believe universities should prioritise academic achievement when awarding scholarships, while others think leadership and community impact are equally important.</p><p class="mt-4 leading-8 text-slate-600">Discuss both views and give your own opinion. Write at least 250 words.</p></template></article><article class="flex min-h-[520px] flex-col p-6 sm:p-9"><textarea v-model="writingAnswers[writingTask]" class="min-h-96 flex-1 resize-none rounded-2xl border border-slate-300 p-5 leading-7 outline-none focus:border-[#5b45f5]" placeholder="Type your response here…" /><p class="mt-4 text-sm font-bold text-slate-500">Word count: {{ wordCount }}</p></article></section>

    <section v-else class="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center p-6 text-center"><p class="text-xs font-extrabold uppercase tracking-[.14em] text-[#5b45f5]">Speaking part {{ speakingPart }}</p><h1 class="mt-4 text-3xl font-extrabold">{{ speakingPart === 1 ? 'Introduction and interview' : speakingPart === 2 ? 'Individual long turn' : 'Two-way discussion' }}</h1><p class="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{{ speakingPart === 1 ? 'Tell me about the place where you live and what you enjoy most about it.' : speakingPart === 2 ? 'Describe an educational opportunity that changed your plans. You should say what it was, how you found it, and why it mattered.' : 'How can governments make international education more accessible to students from different backgrounds?' }}</p><div class="mt-9 flex h-20 items-center gap-2"><i v-for="n in 16" :key="n" class="w-2 rounded-full bg-[#5b45f5]" :style="{ height: `${recording ? 18 + ((n * 17) % 54) : 10}px`, opacity: recording ? 1 : .25 }" /></div><button class="mt-7 inline-flex items-center gap-3 rounded-2xl px-6 py-4 font-extrabold text-white" :class="recording ? 'bg-red-600' : 'bg-[#5b45f5]'" @click="toggleRecording"><Pause v-if="recording" :size="20" /><Mic v-else :size="20" />{{ recording ? 'Stop recording' : recordingSaved ? 'Record again' : 'Start recording' }}</button><p v-if="recordingSaved" class="mt-3 text-sm font-bold text-emerald-600"><Check :size="15" class="inline" />Response saved</p><div class="mt-10 flex gap-3"><button class="btn-secondary" :disabled="speakingPart === 1" @click="speakingPart--"><ChevronLeft :size="16" />Previous part</button><button class="btn-primary" :disabled="speakingPart === 3" @click="speakingPart++">Next part <ChevronRight :size="16" /></button></div></section>

    <footer class="sticky bottom-0 z-20 border-t border-slate-200 bg-white px-5 py-3 shadow-[0_-8px_22px_rgba(17,24,39,.06)]"><div v-if="currentSkill === 'Writing'" class="grid grid-cols-2 gap-3"><button v-for="task in [1,2]" :key="task" class="rounded-xl border px-4 py-3 text-sm font-extrabold" :class="writingTask === task ? 'border-[#5b45f5] text-[#5b45f5]' : 'border-slate-200 text-slate-500'" @click="writingTask = task as 1 | 2">Task {{ task }}</button></div><div v-else class="flex items-center gap-2 overflow-auto"><span class="mr-2 whitespace-nowrap text-sm font-extrabold">{{ currentSkill }} · {{ answeredCount }}/{{ totalQuestions }}</span><button v-for="n in totalQuestions" :key="n" class="grid size-9 shrink-0 place-items-center rounded-full border text-xs font-extrabold" :class="[reviewed.includes(n) ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200', (currentSkill === 'Listening' ? listeningAnswers[n-1] : currentSkill === 'Reading' ? readingAnswers[n-1] : false) && 'bg-[#5b45f5] text-white']" @click="toggleReview(n)">{{ n }}</button><span class="ml-auto hidden items-center gap-2 text-xs text-slate-400 sm:flex"><CircleAlert :size="14" />Select a number to flag it for review.</span></div></footer>
  </main>

  <main v-else class="grid min-h-screen place-items-center bg-gradient-to-br from-[#f3f1ff] to-[#eff8ff] p-6"><section class="w-full max-w-2xl rounded-3xl bg-white p-8 text-center shadow-xl sm:p-12"><span class="mx-auto grid size-20 place-items-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 :size="38" /></span><p class="mt-7 text-xs font-extrabold uppercase tracking-[.16em] text-[#5b45f5]">Simulation complete</p><h1 class="mt-3 text-3xl font-extrabold text-[#17136b]">Your responses were submitted</h1><div class="mx-auto mt-8 grid size-36 place-items-center rounded-full border-[10px] border-violet-100"><div><strong class="text-4xl text-[#5b45f5]">{{ resultScore }}%</strong><span class="block text-xs font-bold text-slate-400">completion</span></div></div><p class="mx-auto mt-7 max-w-xl text-sm leading-7 text-slate-500">This is an unofficial Minerva simulation result. It measures completed responses, not an official IELTS band score.</p><div class="mt-8 flex flex-wrap justify-center gap-3"><button class="btn-primary" @click="resetSimulation"><RotateCcw :size="16" />Try another test</button><RouterLink to="/dashboard" class="btn-secondary">Return to scholarships</RouterLink></div></section></main>
</template>

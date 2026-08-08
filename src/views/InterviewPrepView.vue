<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { ArrowLeft, BarChart3, CheckCircle2, CircleStop, Clock3, Mic, Pause, Play, Sparkles, UploadCloud, Video } from 'lucide-vue-next'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'
import BaseSelect from '../components/common/BaseSelect.vue'
import { getScholarship } from '../data/scholarships'
import { useAppState } from '../composables/useAppState'

type Stage = 'setup' | 'language' | 'live' | 'results'

const { applicationIds, selectScholarship, toast } = useAppState()
const stage = ref<Stage>('setup')
const interviewScholarshipId = ref('')
const fileName = ref('')
const context = ref('')
const language = ref<'Bahasa Indonesia' | 'English'>('Bahasa Indonesia')
const isPaused = ref(false)
const elapsed = ref(0)
const questionIndex = ref(0)
const cameraVideo = ref<HTMLVideoElement | null>(null)
const cameraEnabled = ref(false)
const cameraError = ref('')
let cameraStream: MediaStream | undefined
let timer: number | undefined

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
  },
})
const questions = computed(() => selected.value ? [
  `Tell us why ${selected.value.name} matches your academic and leadership goals.`,
  `Describe a challenge that proves you are ready to study in ${selected.value.country}.`,
  'How will you use this opportunity to create measurable impact after graduation?',
] : [])
const question = computed(() => questions.value[questionIndex.value] || '')
const formatted = computed(() => `${String(Math.floor(elapsed.value / 60)).padStart(2, '0')}:${String(elapsed.value % 60).padStart(2, '0')}`)

const upload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) fileName.value = file.name
}
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
const start = async () => {
  stage.value = 'live'
  isPaused.value = false
  await nextTick()
  void startCamera()
  timer = window.setInterval(() => {
    if (!isPaused.value) elapsed.value += 1
  }, 1000)
}
const finish = () => {
  if (timer) window.clearInterval(timer)
  timer = undefined
  stopCamera()
  stage.value = 'results'
  toast('Interview analysis is ready.')
}
const nextQuestion = () => { questionIndex.value = Math.min(questions.value.length - 1, questionIndex.value + 1) }

onBeforeUnmount(() => { if (timer) window.clearInterval(timer); stopCamera() })
</script>

<template>
  <main class="workspace-shell">
    <WorkspaceSidebar active="interview" />
    <div class="workspace-main">
      <WorkspaceTopbar title="Interview Prep" subtitle="Practice scholarship interviews with tailored questions and feedback." />
      <div class="workspace-content">
        <section v-if="stage === 'setup'" class="interview-setup">
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
                <label class="interview-upload">
                  <UploadCloud :size="30" />
                  <strong>{{ fileName || 'Add a document (optional)' }}</strong>
                  <span>CV, personal statement, essay, study plan, or research plan</span>
                  <input type="file" class="sr-only" accept=".pdf,.doc,.docx" @change="upload" />
                </label>
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
              <div class="mt-5 rounded-xl bg-emerald-50 p-4 text-xs leading-5 text-emerald-800">Any imported file stays on this device in this frontend simulation.</div>
            </div>
          </div>
          <button class="btn-primary ml-auto mt-6" :disabled="!selected" @click="continueSetup">Continue <Play :size="16" />
</button>
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
<button class="btn-primary" @click="start">Start interview <Play :size="16" />
</button>
</div>
        </section>

        <section v-else-if="stage === 'live'" class="overflow-hidden rounded-[28px] border border-violet-200 bg-gradient-to-br from-[#f7f5ff] via-white to-[#edf8ff] text-[#17136b] shadow-[0_24px_70px_rgba(47,35,140,.14)]">
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
<span class="absolute left-4 top-4 rounded-full bg-white px-3 py-1.5 text-[.66rem] font-black text-[#5b45f5]">Your camera</span>
<div class="h-40 w-32 rounded-[48%_48%_44%_44%] border-2 border-[#8b7cf6] bg-white/70" />
<button v-if="!cameraEnabled" class="absolute inset-0 grid place-items-center" @click="startCamera"><span class="rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-[#5b45f5] shadow-sm">Turn on camera</span></button>
<p v-if="cameraError" class="absolute bottom-4 right-4 max-w-[230px] rounded-lg bg-white/90 px-3 py-2 text-right text-[.68rem] font-bold leading-4 text-rose-600">{{ cameraError }}</p>
<small class="absolute bottom-4 left-4 font-bold text-slate-500">You · Face Mimic Analyzer</small>
</div>
            <div class="grid min-h-[320px] place-items-center rounded-[22px] border border-violet-200 bg-[radial-gradient(circle_at_center,#fff_0%,#f5f2ff_55%,#ebe7ff_100%)] text-center">
<div>
<Sparkles class="mx-auto text-[#5b45f5]" :size="48" />
<p class="mt-6 text-lg font-black">Minerva AI interviewer</p>
<span class="mt-1 block text-xs font-bold text-slate-400">Tailored to {{ selected?.provider }}</span>
</div>
</div>
          </div>
          <div class="mx-4 mb-4 flex flex-col justify-between gap-4 rounded-2xl border border-violet-100 bg-white px-5 py-4 sm:mx-6 sm:mb-6 sm:flex-row sm:items-center">
<div class="flex gap-3">
<span class="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-sm font-black text-[#5b45f5]">{{ questionIndex + 1 }}</span>
<p class="max-w-3xl text-sm font-bold leading-6 text-slate-700">{{ question }}</p>
</div>
<button v-if="questionIndex < questions.length - 1" class="shrink-0 rounded-xl bg-violet-50 px-4 py-2.5 text-xs font-black text-[#5b45f5]" @click="nextQuestion">Next question</button>
</div>
          <footer class="flex flex-wrap items-center justify-center gap-2.5 border-t border-violet-100 bg-white/85 px-4 py-4">
<button class="grid size-11 place-items-center rounded-xl border border-violet-200 bg-white text-[#5b45f5]" aria-label="Toggle microphone">
<Mic :size="18" />
</button>
<button class="grid size-11 place-items-center rounded-xl border border-violet-200 bg-white text-[#5b45f5]" :aria-label="cameraEnabled ? 'Turn off camera' : 'Turn on camera'" :title="cameraEnabled ? 'Turn off camera' : 'Turn on camera'" @click="toggleCamera">
<Video :size="18" />
</button>
<button class="grid size-11 place-items-center rounded-xl border border-violet-200 bg-white text-[#5b45f5]" @click="isPaused = !isPaused">
<Play v-if="isPaused" :size="18" />
<Pause v-else :size="18" />
</button>
<button class="btn-primary ml-1" @click="finish">
<CircleStop :size="16" />Finish interview</button>
</footer>
        </section>

        <section v-else class="interview-results">
          <header>
<div>
<p class="eyebrow">Interview results</p>
<h2>{{ selected?.name }}</h2>
</div>
<button class="btn-secondary" @click="stage = 'language'; elapsed = 0; questionIndex = 0">
<ArrowLeft :size="16" />Practice again</button>
</header>
          <div class="workspace-card p-6">
<p class="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">
<BarChart3 :size="16" />Detailed performance analysis</p>
<div class="results-metrics">
<div>
<strong>82</strong>
<span>Clarity score</span>
</div>
<div>
<strong>78</strong>
<span>Confidence</span>
</div>
<div>
<strong>86</strong>
<span>Structure</span>
</div>
<div>
<strong>142</strong>
<span>Words/min</span>
</div>
</div>
</div>
          <div class="mt-5 grid gap-5 md:grid-cols-2">
<article class="workspace-card p-6">
<CheckCircle2 class="text-emerald-500" />
<h3>Key highlights</h3>
<ul>
<li>Clear scholarship motivation</li>
<li>Strong connection to {{ selected?.provider }}</li>
<li>Specific post-study direction</li>
</ul>
</article>
<article class="workspace-card p-6">
<Clock3 class="text-amber-500" />
<h3>Improvement recommendations</h3>
<ul>
<li>Add a measurable impact outcome</li>
<li>Slow down before important examples</li>
<li>Use a shorter conclusion</li>
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

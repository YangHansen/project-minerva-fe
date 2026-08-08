<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { ArrowLeft, BarChart3, CheckCircle2, CircleStop, Clock3, Mic, Pause, Play, Sparkles, UploadCloud, Video } from 'lucide-vue-next'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'
import { getScholarship } from '../data/scholarships'
import { useAppState } from '../composables/useAppState'
type Stage='setup'|'language'|'live'|'results'
const { selectedId, toast }=useAppState();const selected=computed(()=>selectedId.value?getScholarship(selectedId.value):undefined);const stage=ref<Stage>('setup'),fileName=ref(''),context=ref(''),language=ref<'Bahasa Indonesia'|'English'>('Bahasa Indonesia'),isPaused=ref(false),elapsed=ref(0),questionIndex=ref(0);let timer:number|undefined
const questions=computed(()=>selected.value?[`Tell us why ${selected.value.name} matches your academic and leadership goals.`,`Describe a challenge that proves you are ready to study in ${selected.value.country}.`,`How will you use this opportunity to create measurable impact after graduation?`]:[]);const question=computed(()=>questions.value[questionIndex.value]||'');const formatted=computed(()=>`${String(Math.floor(elapsed.value/60)).padStart(2,'0')}:${String(elapsed.value%60).padStart(2,'0')}`);const upload=(e:Event)=>{const f=(e.target as HTMLInputElement).files?.[0];if(f)fileName.value=f.name};const continueSetup=()=>{if(!selected.value){toast('Select a scholarship before interview preparation.','info');return}if(!fileName.value){toast('Import a CV, personal statement, or application document first.','info');return}stage.value='language'};const start=()=>{stage.value='live';isPaused.value=false;timer=window.setInterval(()=>{if(!isPaused.value)elapsed.value++},1000)};const finish=()=>{if(timer)window.clearInterval(timer);timer=undefined;stage.value='results';toast('Interview analysis is ready.')};const nextQuestion=()=>questionIndex.value=Math.min(questions.value.length-1,questionIndex.value+1);onBeforeUnmount(()=>{if(timer)window.clearInterval(timer)})
</script>
<template><main class="workspace-shell"><WorkspaceSidebar active="interview"/><div class="workspace-main"><WorkspaceTopbar title="Interview Prep" subtitle="Scholarship-specific setup, live practice, and performance analysis."/><div class="workspace-content">
  <section v-if="stage==='setup'" class="interview-setup"><div class="interview-step"><span>1</span><i/><span>2</span></div><p class="eyebrow">Personal background</p><h2>Prepare a tailored interview</h2><p>Selecting a scholarship and importing a document lets Minerva tailor questions to your goals and experience.</p><div class="interview-setup-grid"><div class="workspace-card p-6"><p class="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Selected scholarship</p><div v-if="selected" class="mt-4"><h3 class="text-xl font-extrabold text-[#17136b]">{{ selected.name }}</h3><p class="mt-2 text-sm text-slate-500">{{ selected.provider }} · {{ selected.country }}</p></div><div v-else class="mt-4"><p class="text-sm text-slate-500">Choose a scholarship before continuing.</p><RouterLink to="/scholarships" class="btn-secondary mt-4">Select scholarship</RouterLink></div><label class="interview-upload"><UploadCloud :size="30"/><strong>{{ fileName||'Import your document' }}</strong><span>CV, personal statement, essay, study plan, or research plan</span><input type="file" class="sr-only" accept=".pdf,.doc,.docx" @change="upload"></label></div><div class="workspace-card p-6"><p class="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Additional context</p><textarea v-model="context" class="field mt-4 min-h-56" placeholder="Add goals, focus areas, or context the interviewer should know…"/><div class="mt-5 rounded-xl bg-emerald-50 p-4 text-xs leading-5 text-emerald-800">Your imported file stays on this device in this frontend simulation.</div></div></div><button class="btn-primary ml-auto mt-6" @click="continueSetup">Continue to language<Play :size="16"/></button></section>
  <section v-else-if="stage==='language'" class="interview-language"><div class="interview-step"><span>1</span><i class="active"/><span>2</span></div><p class="eyebrow">Interview language</p><h2>Choose the language you will use</h2><label v-for="item in ['Bahasa Indonesia','English']" :key="item" class="interview-language-option" :class="language===item&&'active'"><input v-model="language" type="radio" :value="item"><div><strong>{{ item }}</strong><p>{{ item==='Bahasa Indonesia'?'Interview questions and guidance in Indonesian.':'Interview questions and guidance in English.' }}</p></div></label><div class="mt-7 flex justify-between"><button class="btn-secondary" @click="stage='setup'"><ArrowLeft :size="16"/>Back</button><button class="btn-primary" @click="start">Start interview<Play :size="16"/></button></div></section>
  <section v-else-if="stage==='live'" class="overflow-hidden rounded-[28px] border border-violet-200 bg-gradient-to-br from-[#f7f5ff] via-white to-[#edf8ff] text-[#17136b] shadow-[0_24px_70px_rgba(47,35,140,.14)]">
    <header class="flex flex-wrap items-center justify-between gap-4 border-b border-violet-100 bg-white/90 px-5 py-4 sm:px-7">
      <div class="min-w-0">
        <div class="flex items-center gap-2 text-sm font-black sm:text-base"><span class="grid size-8 shrink-0 place-items-center rounded-xl bg-violet-100 text-[#5b45f5]"><Sparkles :size="16"/></span><p class="truncate">{{ selected?.name }}</p></div>
        <span class="mt-1 block text-[.7rem] font-bold text-slate-400">{{ language }} · tailored question {{ questionIndex+1 }}/{{ questions.length }}</span>
      </div>
      <div class="flex items-center gap-2.5">
        <span class="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-[.68rem] font-black uppercase tracking-[.08em] text-emerald-700"><i class="size-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,.14)]"/>{{ isPaused?'Paused':'Connected' }}</span>
        <strong class="rounded-xl border border-violet-100 bg-violet-50 px-3.5 py-2 text-sm tabular-nums text-[#5b45f5]">{{ formatted }}</strong>
      </div>
    </header>

    <div class="grid gap-5 p-4 sm:p-6 lg:grid-cols-2">
      <div class="relative grid min-h-[320px] place-items-center overflow-hidden rounded-[22px] border border-violet-200 bg-[radial-gradient(circle_at_center,#ffffff_0%,#f3f0ff_58%,#ebe7ff_100%)] shadow-[0_14px_36px_rgba(91,69,245,.09)]">
        <span class="absolute left-4 top-4 rounded-full border border-white bg-white/85 px-3 py-1.5 text-[.66rem] font-black text-[#5b45f5] shadow-sm">Your camera</span>
        <div class="relative h-40 w-32 rounded-[48%_48%_44%_44%] border-2 border-[#8b7cf6] bg-white/70 shadow-[0_0_45px_rgba(91,69,245,.2)]">
          <div class="absolute inset-x-0 top-14 flex justify-center gap-9"><span class="h-2.5 w-3.5 rounded-full bg-[#5b45f5]"/><span class="h-2.5 w-3.5 rounded-full bg-[#5b45f5]"/></div>
          <span class="absolute bottom-8 left-1/2 h-3 w-10 -translate-x-1/2 rounded-full border-b-2 border-[#8b7cf6]"/>
        </div>
        <small class="absolute bottom-4 left-4 font-bold text-slate-500">You · Face Mimic Analyzer</small>
      </div>

      <div class="relative grid min-h-[320px] place-items-center overflow-hidden rounded-[22px] border border-violet-200 bg-[radial-gradient(circle_at_center,#ffffff_0%,#f5f2ff_55%,#ebe7ff_100%)] text-center shadow-[0_14px_36px_rgba(91,69,245,.09)]">
        <span class="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-white/90 px-3 py-1.5 text-[.66rem] font-black text-[#5b45f5] shadow-sm"><Sparkles :size="13"/>Minerva AI</span>
        <div>
          <div class="mx-auto grid size-16 place-items-center rounded-[22px] bg-gradient-to-br from-[#17136b] to-[#5b45f5] text-white shadow-[0_14px_30px_rgba(91,69,245,.25)]"><Sparkles :size="28"/></div>
          <div class="mt-7 flex items-center justify-center gap-2">
            <i v-for="n in 7" :key="n" class="w-3 rounded-full bg-gradient-to-b from-violet-300 to-[#5b45f5]" :style="{height:`${22+n%3*14}px`}"/>
          </div>
          <p class="mt-6 text-lg font-black">Minerva AI interviewer</p>
          <span class="mt-1 block text-xs font-bold text-slate-400">Tailored to {{ selected?.provider }}</span>
        </div>
      </div>
    </div>

    <div class="mx-4 mb-4 flex flex-col items-start justify-between gap-4 rounded-2xl border border-violet-100 bg-white px-5 py-4 shadow-sm sm:mx-6 sm:mb-6 sm:flex-row sm:items-center">
      <div class="flex gap-3"><span class="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-sm font-black text-[#5b45f5]">{{ questionIndex+1 }}</span><p class="max-w-3xl text-sm font-bold leading-6 text-slate-700">{{ question }}</p></div>
      <button v-if="questionIndex<questions.length-1" class="shrink-0 rounded-xl bg-violet-50 px-4 py-2.5 text-xs font-black text-[#5b45f5] transition hover:bg-violet-100" @click="nextQuestion">Next question</button>
    </div>

    <footer class="flex flex-wrap items-center justify-center gap-2.5 border-t border-violet-100 bg-white/85 px-4 py-4">
      <button class="grid size-11 place-items-center rounded-xl border border-violet-200 bg-white text-[#5b45f5] shadow-sm transition hover:bg-violet-50" aria-label="Toggle microphone" title="Microphone"><Mic :size="18"/></button>
      <button class="grid size-11 place-items-center rounded-xl border border-violet-200 bg-white text-[#5b45f5] shadow-sm transition hover:bg-violet-50" aria-label="Toggle camera" title="Camera"><Video :size="18"/></button>
      <button class="grid size-11 place-items-center rounded-xl border border-violet-200 bg-white text-[#5b45f5] shadow-sm transition hover:bg-violet-50" :aria-label="isPaused?'Resume interview':'Pause interview'" :title="isPaused?'Resume':'Pause'" @click="isPaused=!isPaused"><Play v-if="isPaused" :size="18"/><Pause v-else :size="18"/></button>
      <button class="btn-primary ml-1 !bg-[#5b45f5]" @click="finish"><CircleStop :size="16"/>Finish interview</button>
    </footer>
  </section>
  <section v-else class="interview-results"><header><div><p class="eyebrow">Interview results</p><h2>{{ selected?.name }}</h2></div><button class="btn-secondary" @click="stage='language';elapsed=0;questionIndex=0"><ArrowLeft :size="16"/>Practice again</button></header><div class="workspace-card p-6"><p class="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.14em] text-slate-400"><BarChart3 :size="16"/>Detailed performance analysis</p><div class="results-metrics"><div><strong>82</strong><span>Clarity score</span></div><div><strong>78</strong><span>Confidence</span></div><div><strong>86</strong><span>Structure</span></div><div><strong>142</strong><span>Words/min</span></div></div></div><div class="grid gap-5 mt-5 md:grid-cols-2"><article class="workspace-card p-6"><CheckCircle2 class="text-emerald-500"/><h3>Key highlights</h3><ul><li>Clear scholarship motivation</li><li>Strong connection to {{ selected?.provider }}</li><li>Specific post-study direction</li></ul></article><article class="workspace-card p-6"><Clock3 class="text-amber-500"/><h3>Improvement recommendations</h3><ul><li>Add a measurable impact outcome</li><li>Slow down before important examples</li><li>Use a shorter conclusion</li></ul></article></div></section>
</div></div></main></template>

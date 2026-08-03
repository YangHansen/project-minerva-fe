<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, BookOpenCheck, CalendarDays, CheckCircle2, ChevronRight, Clock3, Sparkles, Target, Users } from 'lucide-vue-next'
import { scholarships, getScholarship } from '../data/scholarships'
import { useAppState } from '../composables/useAppState'
import WorkspaceSidebar from '../components/dashboard/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/dashboard/WorkspaceTopbar.vue'
import BaseProgress from '../components/common/BaseProgress.vue'

const { profile, session, selectedId, savedIds, progress, checklist, booking, practiceResult } = useAppState()
const selected = computed(() => selectedId.value ? getScholarship(selectedId.value) : undefined)
const saved = computed(() => scholarships.filter((item) => savedIds.value.includes(item.id)))
const checklistReady = computed(() => checklist.value.filter((item) => item.completed).length)
const nextTask = computed(() => checklist.value.find((item) => !item.completed))
const days = computed(() => selected.value ? Math.max(0, Math.ceil((new Date(selected.value.deadline).getTime() - Date.now()) / 86400000)) : 0)
</script>

<template>
  <main class="workspace-shell">
    <WorkspaceSidebar active="overview" />
    <div class="workspace-main">
      <WorkspaceTopbar title="Your command center" subtitle="A calm view of your scholarship work, all in one place." />
      <div class="workspace-content">
        <section class="report-banner"><p class="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.15em] text-violet-100"><Sparkles :size="15"/>This week in Minerva</p><div class="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><h2 class="max-w-xl text-2xl font-extrabold tracking-tight sm:text-3xl">You’re building steady momentum, {{ profile?.name || session?.name || 'scholar' }}.</h2><p class="mt-2 max-w-xl text-sm leading-6 text-violet-100">{{ nextTask ? `Your next focus: ${nextTask.title}.` : 'Your checklist is complete—take a final look at official requirements.' }}</p></div><RouterLink :to="nextTask ? '/checklist' : '/scholarships'" class="btn-secondary shrink-0 !border-white/30 !bg-white !text-[#17136b]">{{ nextTask ? 'Continue checklist' : 'Explore scholarships' }}<ArrowRight :size="16"/></RouterLink></div></section>

        <section class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div class="metric-tile"><p class="text-xs font-bold text-slate-400">Application readiness</p><p class="mt-3 text-3xl font-extrabold text-[#17136b]">{{ progress }}%</p><BaseProgress class="mt-3" :value="progress"/></div><div class="metric-tile"><p class="text-xs font-bold text-slate-400">Checklist items</p><p class="mt-3 text-3xl font-extrabold text-[#17136b]">{{ checklistReady }}<span class="text-base text-slate-400">/{{ checklist.length }}</span></p><p class="mt-3 text-xs font-semibold text-emerald-600">On track for your deadline</p></div><div class="metric-tile"><p class="text-xs font-bold text-slate-400">Saved opportunities</p><p class="mt-3 text-3xl font-extrabold text-[#17136b]">{{ saved.length }}</p><RouterLink to="/scholarships" class="mt-3 inline-flex text-xs font-extrabold text-[#5b45f5]">Review shortlist <ChevronRight :size="14"/></RouterLink></div><div class="metric-tile"><p class="text-xs font-bold text-slate-400">Practice status</p><p class="mt-3 text-3xl font-extrabold text-[#17136b]">{{ practiceResult ? `${practiceResult.score}%` : 'Ready' }}</p><RouterLink to="/test-prep" class="mt-3 inline-flex text-xs font-extrabold text-[#5b45f5]">Open test prep <ChevronRight :size="14"/></RouterLink></div></section>

        <section class="mt-6 grid gap-6 xl:grid-cols-[1.4fr_.9fr]">
          <div class="workspace-card p-5 sm:p-6"><div class="flex items-center justify-between"><div><p class="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Active application</p><h2 class="mt-2 text-xl font-extrabold text-[#17136b]">{{ selected?.name || 'Choose a scholarship to focus your workspace' }}</h2></div><span v-if="selected" class="badge">{{ selected.matchPercentage }}% match</span></div>
            <div v-if="selected" class="mt-6 grid gap-5 sm:grid-cols-[1fr_180px]"><div><p class="text-sm text-slate-500">{{ selected.provider }} · {{ selected.country }}</p><div class="mt-5"><BaseProgress :value="progress" label="Application plan"/></div><div class="mt-5 flex flex-wrap gap-2"><span class="tag"><CalendarDays :size="14"/>{{ days }} days left</span><span class="tag"><Target :size="14"/>{{ selected.fundingType }}</span></div></div><div class="rounded-2xl bg-[#f4f2ff] p-5"><p class="text-xs font-bold text-[#5b45f5]">Next action</p><p class="mt-3 text-sm font-extrabold leading-6 text-[#17136b]">{{ nextTask?.title || 'Review final submission details' }}</p><RouterLink to="/checklist" class="mt-5 inline-flex text-xs font-extrabold text-[#5b45f5]">Open checklist <ArrowRight :size="13"/></RouterLink></div></div>
            <div v-else class="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-dashed border-slate-300 p-6 sm:flex-row sm:items-center sm:justify-between"><p class="max-w-md text-sm leading-6 text-slate-500">Selecting an opportunity tailors your checklist and interview questions to its provider, destination, and requirements.</p><RouterLink to="/scholarships" class="btn-primary shrink-0">Find a match</RouterLink></div>
          </div>
          <div class="workspace-card p-5 sm:p-6"><div class="flex items-center justify-between"><h2 class="font-extrabold text-[#17136b]">Upcoming</h2><CalendarDays :size="18" class="text-[#5b45f5]"/></div><div class="mt-5 grid gap-4"><div v-for="item in scholarships.slice(0,3)" :key="item.id" class="flex items-start gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-xs font-extrabold text-[#5b45f5]">{{ new Date(item.deadline).getDate() }}</span><div class="min-w-0"><p class="truncate text-sm font-extrabold text-[#17136b]">{{ item.name }}</p><p class="mt-1 text-xs text-slate-400">{{ item.deadline }} · {{ item.country }}</p></div></div></div></div>
        </section>

        <section class="mt-6 grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
          <div class="workspace-card p-5 sm:p-6"><div class="flex items-center justify-between"><div><p class="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Preparation hub</p><h2 class="mt-2 text-xl font-extrabold text-[#17136b]">Practice with purpose</h2></div><BookOpenCheck :size="21" class="text-[#5b45f5]"/></div><div class="mt-5 grid gap-3"><RouterLink to="/test-prep" class="flex items-center justify-between rounded-2xl border border-slate-200 p-4 hover:border-violet-300"><span><span class="block font-extrabold text-[#17136b]">Test Prep</span><span class="mt-1 block text-xs text-slate-500">TOPIK, IELTS and TOEFL</span></span><ChevronRight :size="18" class="text-[#5b45f5]"/></RouterLink><RouterLink to="/interview-prep" class="flex items-center justify-between rounded-2xl border border-slate-200 p-4 hover:border-violet-300"><span><span class="block font-extrabold text-[#17136b]">Interview Prep</span><span class="mt-1 block text-xs text-slate-500">Live controls and face mimic demo</span></span><ChevronRight :size="18" class="text-[#5b45f5]"/></RouterLink></div></div>
          <div class="workspace-card p-5 sm:p-6"><div class="flex items-center justify-between"><div><p class="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Recent activity</p><h2 class="mt-2 text-xl font-extrabold text-[#17136b]">Your workspace timeline</h2></div><Clock3 :size="20" class="text-[#5b45f5]"/></div><div class="mt-6 grid gap-5"><div v-for="item in [{title:'Checklist progress updated',detail:`${checklistReady} requirements are marked ready`,icon:CheckCircle2},{title:'Practice workspace available',detail:'Choose TOPIK, IELTS, TOEFL, or tailored interview prep',icon:BookOpenCheck},{title:booking ? 'Mentor session scheduled' : 'Mentor support is available',detail:booking ? `${booking.mentorName} · ${booking.date} at ${booking.time}` : 'Browse alumni with relevant scholarship experience',icon:Users}]" :key="item.title" class="flex gap-4"><span class="activity-dot mt-1.5"/><div><p class="text-sm font-extrabold text-[#17136b]">{{ item.title }}</p><p class="mt-1 text-xs leading-5 text-slate-500">{{ item.detail }}</p></div><component :is="item.icon" :size="17" class="ml-auto shrink-0 text-slate-300"/></div></div></div>
        </section>
      </div>
    </div>
  </main>
</template>

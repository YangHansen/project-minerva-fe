<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight, FileText, FolderOpen, Plus, Sparkles } from 'lucide-vue-next'
import { getScholarship, scholarships } from '../data/scholarships'
import { useAppState } from '../composables/useAppState'
import WorkspaceSidebar from '../components/dashboard/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/dashboard/WorkspaceTopbar.vue'
import BaseProgress from '../components/common/BaseProgress.vue'

const { selectedId, savedIds, progress, checklist, selectScholarship } = useAppState()
const folders = computed(() => {
  const ids = [...new Set([selectedId.value, ...savedIds.value].filter((id): id is string => Boolean(id)))]
  return scholarships.filter((item) => ids.includes(item.id)).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
})
const selected = computed(() => selectedId.value ? getScholarship(selectedId.value) : folders.value[0])
const complete = computed(() => checklist.value.filter((item) => item.completed).length)
const nextTask = computed(() => checklist.value.find((item) => !item.completed))
const selectFolder = (id: string) => { selectScholarship(id) }
</script>

<template>
  <main class="workspace-shell">
    <WorkspaceSidebar active="overview" />
    <div class="workspace-main">
      <WorkspaceTopbar title="My scholarships" subtitle="Every application lives in its own folder." />
      <div class="workspace-content">
        <section class="flex flex-wrap items-end justify-between gap-5 border-b border-slate-200 pb-6">
          <div><p class="text-xs font-extrabold uppercase tracking-[.16em] text-[#5b45f5]">Scholarship folders</p><h1 class="mt-2 text-3xl font-extrabold text-[#17136b]">Keep each application organised.</h1><p class="mt-2 text-sm text-slate-500">Open a folder to work on its checklist, documents, preparation, and deadline.</p></div>
          <RouterLink to="/scholarships" class="btn-primary"><Plus :size="17" />Add scholarship</RouterLink>
        </section>

        <section v-if="folders.length" class="mt-7 grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)]">
          <aside class="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div class="flex items-center justify-between px-2 pb-3"><p class="text-xs font-extrabold uppercase tracking-[.13em] text-slate-400">Folders</p><span class="rounded-full bg-violet-50 px-2 py-1 text-xs font-extrabold text-[#5b45f5]">{{ folders.length }}</span></div>
            <div class="grid gap-1">
              <button v-for="item in folders" :key="item.id" class="group rounded-xl p-3 text-left transition" :class="selected?.id === item.id ? 'bg-[#17136b] text-white shadow-lg' : 'hover:bg-violet-50'" @click="selectFolder(item.id)">
                <span class="flex items-start gap-3"><span class="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg" :class="selected?.id === item.id ? 'bg-white/15 text-white' : 'bg-violet-100 text-[#5b45f5]'"><FolderOpen :size="18" /></span><span class="min-w-0"><b class="block truncate text-sm">{{ item.name }}</b><span class="mt-1 block truncate text-xs" :class="selected?.id === item.id ? 'text-violet-200' : 'text-slate-500'">{{ item.country }} · {{ item.deadline }}</span></span></span>
              </button>
            </div>
          </aside>

          <article v-if="selected" class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <header class="flex flex-wrap items-start justify-between gap-5 border-b border-slate-100 bg-gradient-to-r from-violet-50 via-white to-sky-50 p-7">
              <div class="flex gap-4"><span class="grid size-13 shrink-0 place-items-center rounded-2xl bg-[#17136b] text-white"><FolderOpen :size="27" /></span><div><p class="text-xs font-extrabold uppercase tracking-[.15em] text-[#5b45f5]">Scholarship folder</p><h2 class="mt-2 text-2xl font-extrabold text-[#17136b]">{{ selected.name }}</h2><p class="mt-1 text-sm text-slate-500">{{ selected.provider }} · {{ selected.country }}</p></div></div>
              <div class="rounded-xl border border-violet-100 bg-white px-4 py-3 text-right"><p class="text-xs font-bold text-slate-400">Deadline</p><p class="mt-1 flex items-center gap-2 text-sm font-extrabold text-[#17136b]"><CalendarDays :size="15" class="text-[#5b45f5]" />{{ selected.deadline }}</p></div>
            </header>
            <div class="grid gap-7 p-7 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <div class="flex items-center justify-between"><div><p class="text-xs font-extrabold uppercase tracking-[.14em] text-slate-400">Application readiness</p><p class="mt-2 text-xl font-extrabold text-[#17136b]">{{ complete }} of {{ checklist.length }} requirements ready</p></div><span class="text-2xl font-extrabold text-[#5b45f5]">{{ progress }}%</span></div>
                <BaseProgress class="mt-4" :value="progress" />
                <div class="mt-7 grid gap-3 sm:grid-cols-2">
                  <RouterLink to="/checklist" class="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-violet-300 hover:bg-violet-50"><span class="grid size-10 place-items-center rounded-xl bg-violet-100 text-[#5b45f5]"><CheckCircle2 :size="19" /></span><span><b class="block text-sm text-[#17136b]">Checklist</b><span class="text-xs text-slate-500">{{ nextTask?.title || 'All tasks complete' }}</span></span><ChevronRight :size="17" class="ml-auto text-slate-400" /></RouterLink>
                  <RouterLink to="/documents" class="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-violet-300 hover:bg-violet-50"><span class="grid size-10 place-items-center rounded-xl bg-violet-100 text-[#5b45f5]"><FileText :size="19" /></span><span><b class="block text-sm text-[#17136b]">Documents</b><span class="text-xs text-slate-500">Open tailored files</span></span><ChevronRight :size="17" class="ml-auto text-slate-400" /></RouterLink>
                </div>
              </div>
              <aside class="rounded-2xl bg-[#17136b] p-5 text-white"><p class="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.13em] text-violet-200"><Sparkles :size="15" />Next focus</p><h3 class="mt-4 text-lg font-extrabold">{{ nextTask?.title || 'Ready to submit' }}</h3><p class="mt-2 text-sm leading-6 text-violet-200">{{ nextTask ? 'Complete this item to move your application forward.' : 'Review the official application portal before submitting.' }}</p><RouterLink to="/checklist" class="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-white underline decoration-violet-300 underline-offset-4">Open checklist <ArrowRight :size="16" /></RouterLink></aside>
            </div>
          </article>
        </section>

        <section v-else class="notion-select-state mt-7"><div class="notion-select-icon"><FolderOpen :size="31" /></div><p class="text-xs font-extrabold uppercase tracking-[.16em] text-[#5b45f5]">My scholarships</p><h1>Start your first scholarship folder</h1><p>Save a scholarship to create one organised home for every requirement and document.</p><RouterLink to="/scholarships" class="btn-primary">Discover scholarships</RouterLink></section>
      </div>
    </div>
  </main>
</template>

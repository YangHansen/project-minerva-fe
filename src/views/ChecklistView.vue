<script setup lang="ts">
import { computed, ref } from 'vue'
import { CheckCircle2, ChevronDown, ChevronRight, ExternalLink, FileText, Folder, FolderOpen, MoreHorizontal, Sparkles } from 'lucide-vue-next'
import { getScholarship } from '../data/scholarships'
import { useAppState } from '../composables/useAppState'
import WorkspaceSidebar from '../components/dashboard/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/dashboard/WorkspaceTopbar.vue'

type ViewMode = 'all' | 'open' | 'done'
const view = ref<ViewMode>('all')
const { checklist, progress, selectedId, toast } = useAppState()
const selected = computed(() => selectedId.value ? getScholarship(selectedId.value) : undefined)
const days = computed(() => selected.value ? Math.max(0, Math.ceil((new Date(selected.value.deadline).getTime() - Date.now()) / 86400000)) : 0)
const categories = computed(() => [...new Set(checklist.value.map((item) => item.category))])
const collapsedCategories = ref<string[]>([])
const visibleItems = (category: string) => checklist.value.filter((item) => item.category === category && (
  view.value === 'all' || (view.value === 'open' && !item.completed) || (view.value === 'done' && item.completed)
))
const toggleCategory = (category: string) => {
  collapsedCategories.value = collapsedCategories.value.includes(category)
    ? collapsedCategories.value.filter((item) => item !== category)
    : [...collapsedCategories.value, category]
}
const isOpen = (category: string) => !collapsedCategories.value.includes(category)
const markHave = (id: string) => {
  const item = checklist.value.find((entry) => entry.id === id)
  if (item) { item.completed = true; toast(`Marked ${item.title} as ready.`) }
}
const completeCount = computed(() => checklist.value.filter((item) => item.completed).length)
</script>

<template>
  <main class="workspace-shell">
    <WorkspaceSidebar active="checklist"/>
    <div class="workspace-main">
      <WorkspaceTopbar title="Application checklist" subtitle="Every scholarship keeps its own requirements folder."/>
      <div class="workspace-content">
        <section v-if="!selected" class="notion-select-state">
          <div class="notion-select-icon"><Folder :size="31"/></div>
          <p class="text-xs font-extrabold uppercase tracking-[.16em] text-[#5b45f5]">Application workspace</p>
          <h1>Select a scholarship first</h1>
          <p>Each saved scholarship opens a separate checklist folder, so documents and progress never blend together.</p>
          <RouterLink to="/scholarships" class="btn-primary">Browse scholarships</RouterLink>
        </section>

        <article v-else class="notion-canvas notion-folder-canvas">
          <div class="notion-cover"><div class="notion-page-icon"><FileText :size="30"/></div></div>
          <div class="px-5 pb-8 sm:px-10">
            <div class="notion-folder-breadcrumb">
              <span>Scholarships</span><ChevronRight :size="14"/><strong>{{ selected.name }}</strong><ChevronRight :size="14"/><span>Checklist</span>
            </div>
            <div class="mt-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p class="text-xs font-extrabold uppercase tracking-[.16em] text-[#5b45f5]">Scholarship folder</p>
                <h1 class="mt-3 text-4xl font-extrabold tracking-[-.045em] text-[#17136b]">{{ selected.name }} checklist</h1>
                <p class="mt-3 max-w-2xl text-sm leading-7 text-slate-500">{{ selected.provider }} · {{ selected.country }} · {{ days }} days left · {{ progress }}% complete</p>
              </div>
              <button class="notion-more" aria-label="Checklist options"><MoreHorizontal :size="20"/></button>
            </div>

            <div v-if="progress===100" class="notion-callout mt-7 bg-emerald-50 text-emerald-950">
              <CheckCircle2 :size="20" class="text-emerald-500"/><div><p class="font-extrabold">Application-ready checklist</p><p class="mt-1 text-xs leading-5 text-emerald-800">Every item is marked done. Review the official provider requirements before submitting.</p></div>
            </div>
            <div v-else class="notion-callout mt-7">
              <Sparkles :size="20" class="text-[#5b45f5]"/><div><p class="font-extrabold text-[#17136b]">{{ completeCount }} of {{ checklist.length }} tasks are ready</p><p class="mt-1 text-xs leading-5 text-slate-500">Your progress is saved only inside this scholarship folder.</p></div>
            </div>

            <div class="mt-8 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
              <button v-for="item in [{id:'all',label:'All tasks'},{id:'open',label:'To do'},{id:'done',label:'Complete'}]" :key="item.id" class="notion-view" :class="view===item.id&&'active'" @click="view=item.id as ViewMode">{{ item.label }}</button>
              <span class="ml-auto text-xs font-semibold text-slate-400">{{ completeCount }}/{{ checklist.length }} complete</span>
            </div>

            <div class="mt-5">
              <section v-for="category in categories" :key="category" class="notion-folder-section">
                <button class="notion-folder-row" :aria-expanded="isOpen(category)" @click="toggleCategory(category)">
                  <ChevronDown :size="16" :class="!isOpen(category)&&'-rotate-90'"/>
                  <FolderOpen v-if="isOpen(category)" :size="19" class="text-[#5b45f5]"/><Folder v-else :size="19" class="text-[#5b45f5]"/>
                  <span class="notion-folder-name">{{ category }}</span><span class="ml-auto text-xs font-semibold text-slate-400">{{ visibleItems(category).length }} tasks</span>
                </button>
                <div v-if="isOpen(category)" class="notion-db">
                  <article v-for="item in visibleItems(category)" :key="item.id" class="notion-db-row">
                    <label class="flex min-w-0 flex-1 cursor-pointer items-start gap-3"><input v-model="item.completed" type="checkbox" class="notion-checkbox mt-0.5" :aria-label="`Mark ${item.title} complete`"><span class="min-w-0"><span class="block text-sm font-bold text-[#17136b]" :class="item.completed&&'line-through text-slate-400'">{{ item.title }}</span><span class="mt-1 flex flex-wrap gap-2"><span class="notion-pill" :class="item.required?'required':'optional'">{{ item.required ? 'Required' : 'Optional' }}</span><RouterLink v-if="['cv','essay','ielts'].includes(item.id)" :to="item.id==='ielts'?'/test-prep':'/documents'" class="inline-flex items-center gap-1 text-[11px] font-bold text-[#5b45f5]">Preparation help <ExternalLink :size="11"/></RouterLink></span></span></label>
                    <div class="flex items-center gap-2"><button v-if="!item.completed" class="notion-inline-action" @click="markHave(item.id)">I have this</button><CheckCircle2 v-else :size="18" class="text-emerald-500"/></div>
                    <textarea v-model="item.notes" class="notion-note" :aria-label="`Notes for ${item.title}`" placeholder="Add a note…"/>
                  </article>
                  <div v-if="!visibleItems(category).length" class="px-3 py-5 text-center text-xs text-slate-400">No {{ view==='open' ? 'open' : 'completed' }} tasks in this folder.</div>
                </div>
              </section>
            </div>
          </div>
        </article>
      </div>
    </div>
  </main>
</template>

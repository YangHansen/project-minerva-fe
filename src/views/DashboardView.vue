<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, CalendarDays, CheckCircle2, FileText, FolderOpen, Globe2, MoreVertical, Trash2, UserRoundCheck } from 'lucide-vue-next'
import { useAppState } from '../composables/useAppState'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'
import BaseProgress from '../components/common/BaseProgress.vue'
import BaseModal from '../components/common/BaseModal.vue'

const route = useRoute()
const router = useRouter()
const { selectedId, applicationIds, hydrateWorkspace, getChecklist, getProgress, getDocuments, selectScholarship, removeApplication, booking, scholarships, getScholarship } = useAppState()
const pendingDeleteId = ref('')

const folders = computed(() => {
  const ids = [...new Set([selectedId.value, ...applicationIds.value].filter((id): id is string => Boolean(id)))]
  return scholarships.value
    .filter((item) => ids.includes(item.id))
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
})
const routeFolderId = computed(() => typeof route.params.id === 'string' ? route.params.id : '')
const selected = computed(() => {
  const requested = routeFolderId.value && folders.value.some((item) => item.id === routeFolderId.value) ? routeFolderId.value : ''
  const preferred = selectedId.value && folders.value.some((item) => item.id === selectedId.value) ? selectedId.value : ''
  return getScholarship(requested || preferred || folders.value[0]?.id || '')
})
const selectedChecklist = computed(() => selected.value ? getChecklist(selected.value.id) : [])
const selectedDocuments = computed(() => selected.value ? getDocuments(selected.value.id) : [])
const progress = computed(() => selected.value ? getProgress(selected.value.id) : 0)
const completeCount = computed(() => selectedChecklist.value.filter((item) => item.status === 'done').length)
const readyDocuments = computed(() => selectedDocuments.value.filter((item) => item.status === 'ready').length)
const recentReview = computed(() => selectedDocuments.value
  .filter((item) => item.review)
  .sort((a, b) => new Date(b.review!.reviewedAt).getTime() - new Date(a.review!.reviewedAt).getTime())[0])
const daysLeft = computed(() => selected.value ? Math.max(0, Math.ceil((new Date(selected.value.deadline).getTime() - Date.now()) / 86400000)) : 0)
const statusLabel = (status: string) => status === 'done' || status === 'ready' ? 'Completed' : status === 'in_progress' || status === 'draft' ? 'In progress' : 'Pending'
const statusTone = (status: string) => status === 'done' || status === 'ready' ? 'done' : status === 'in_progress' || status === 'draft' ? 'progress' : 'pending'
const formatDeadline = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(date)
}

const openFolder = (id: string) => {
  if (selectedId.value !== id) selectScholarship(id)
  router.push(`/dashboard/${id}`)
}
const pendingDelete = computed(() => folders.value.find((item) => item.id === pendingDeleteId.value))
const confirmDelete = () => {
  if (!pendingDeleteId.value) return
  const deletedId = pendingDeleteId.value
  pendingDeleteId.value = ''
  removeApplication(deletedId)
  const next = folders.value[0]
  router.push(next ? `/dashboard/${next.id}` : '/scholarships?recommended=1')
}

watch(selected, (scholarship) => { if (scholarship && selectedId.value !== scholarship.id) selectedId.value = scholarship.id }, { immediate: true })
onMounted(async () => { await hydrateWorkspace(); if (!folders.value.length) await router.replace('/scholarships?recommended=1') })
</script>

<template>
  <main class="workspace-shell">
    <WorkspaceSidebar active="overview" />
    <div class="workspace-main">
      <WorkspaceTopbar title="My scholarships" subtitle="Open a folder to work on its checklist, documents, preparation, and deadline." />
      <div class="workspace-content workspace-content-dashboard">
        <section v-if="selected" class="scholar-workspace-grid">
          <aside class="folder-rail">
            <div class="folder-rail-heading"><h2>Folders</h2><span>{{ folders.length }}</span></div>
            <div class="folder-rail-list">
              <div v-for="item in folders" :key="item.id" class="folder-rail-card relative" :class="item.id === selected.id && 'active'">
                <button class="flex min-w-0 flex-1 items-start gap-3 text-left" @click="openFolder(item.id)">
                  <span class="folder-rail-icon"><FolderOpen :size="21" /></span>
                  <span class="min-w-0 flex-1"><strong>{{ item.name }}</strong><small>{{ item.provider }} · {{ item.country }}</small><span class="folder-date inline-flex w-fit items-center gap-1 whitespace-nowrap"><CalendarDays :size="14" class="shrink-0" /><time :datetime="item.deadline">{{ formatDeadline(item.deadline) }}</time></span></span>
                </button>
                <button type="button" class="folder-more grid size-8 shrink-0 place-items-center rounded-lg transition hover:bg-red-50 hover:text-red-500" :aria-label="`Remove ${item.name} from My Scholarships`" @click="pendingDeleteId = item.id"><MoreVertical :size="17" /></button>
              </div>
            </div>
          </aside>

          <article class="active-scholarship-panel">
            <header class="active-scholarship-head">
              <div>
                <p class="workspace-kicker">Active scholarship</p>
                <h1>{{ selected.name }}</h1>
                <p>{{ selected.provider }} · {{ selected.country }}</p>
                <div class="scholarship-tags"><span><Globe2 :size="13" />{{ selected.country }}</span><span>{{ selected.fundingType }}</span></div>
              </div>
              <div class="deadline-card"><span>Deadline</span><strong><CalendarDays :size="17" />{{ formatDeadline(selected.deadline) }}</strong><small>{{ daysLeft }} days left</small></div>
            </header>

            <div class="active-scholarship-body">
              <section class="readiness-block">
                <div><p class="workspace-muted-label">Application readiness</p><h2>{{ completeCount }} of {{ selectedChecklist.length }} requirements ready</h2></div>
                <strong>{{ progress }}%</strong>
                <BaseProgress class="col-span-full" :value="progress" />
              </section>

              <div class="workspace-preview-grid">
                <section class="workspace-preview-card">
                  <div class="preview-card-title"><span><CheckCircle2 :size="18" />Checklist</span><RouterLink to="/checklist">View all <ArrowRight :size="15" /></RouterLink></div>
                  <p class="preview-summary">{{ completeCount }} of {{ selectedChecklist.length }} tasks completed</p>
                  <div class="preview-rows">
                    <div v-for="item in selectedChecklist.slice(0, 4)" :key="item.id"><span>{{ item.title }}</span><em :class="statusTone(item.status)">{{ statusLabel(item.status) }}</em></div>
                  </div>
                  <RouterLink v-if="selectedChecklist.length > 4" to="/checklist" class="preview-more">+{{ selectedChecklist.length - 4 }} more tasks</RouterLink>
                </section>

                <section class="workspace-preview-card">
                  <div class="preview-card-title"><span><FileText :size="18" />Documents</span><RouterLink to="/documents">View all <ArrowRight :size="15" /></RouterLink></div>
                  <p class="preview-summary">{{ readyDocuments }} of {{ selectedDocuments.length }} documents ready</p>
                  <div class="preview-rows">
                    <div v-for="doc in selectedDocuments.slice(0, 4)" :key="doc.id"><span>{{ doc.title }}</span><em :class="statusTone(doc.status)">{{ statusLabel(doc.status) }}</em></div>
                  </div>
                </section>
              </div>

              <section class="recent-feedback">
                <div><p>Recent review feedback</p><span v-if="recentReview">{{ recentReview.review?.summary }}</span><span v-else>Open a document and run AI Review to see focused feedback here.</span></div>
                <RouterLink :to="recentReview ? `/documents/${recentReview.id}` : '/documents'">{{ recentReview ? 'View feedback' : 'Review a document' }} <ArrowRight :size="15" /></RouterLink>
              </section>
              <section v-if="booking" class="mentor-booking-strip">
                <span class="mentor-booking-icon"><UserRoundCheck :size="22" /></span>
                <div><p>Upcoming mentor session</p><strong>{{ booking.mentorName }} · {{ booking.service }}</strong><span>{{ booking.date }} at {{ booking.time }}<template v-if="booking.notes"> · {{ booking.notes }}</template></span></div>
                <RouterLink to="/mentors">Manage booking <ArrowRight :size="15" /></RouterLink>
              </section>
            </div>
          </article>
        </section>
      </div>
    </div>
    <BaseModal :open="Boolean(pendingDeleteId)" title="Remove scholarship?" @close="pendingDeleteId = ''">
      <div class="flex items-start gap-4 rounded-2xl bg-red-50 p-4"><span class="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-red-500"><Trash2 :size="20" /></span><div><p class="font-bold text-[#17136b]">{{ pendingDelete?.name }}</p><p class="mt-1 text-sm leading-6 text-slate-500">This removes its checklist, documents, notes, and progress from My Scholarships. The scholarship will remain available in Discover.</p></div></div>
      <div class="mt-6 flex justify-end gap-3"><button class="btn-secondary" @click="pendingDeleteId = ''">Cancel</button><button class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-5 text-sm font-bold text-white hover:bg-red-600" @click="confirmDelete"><Trash2 :size="16" />Remove scholarship</button></div>
    </BaseModal>
  </main>
</template>

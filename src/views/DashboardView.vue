<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, CalendarDays, CheckCircle2, FileText, FolderOpen, Globe2, MoreVertical, UserRoundCheck } from 'lucide-vue-next'
import { getScholarship, scholarships } from '../data/scholarships'
import { useAppState } from '../composables/useAppState'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'
import BaseProgress from '../components/common/BaseProgress.vue'

const route = useRoute()
const router = useRouter()
const { selectedId, applicationIds, getChecklist, getProgress, getDocuments, selectScholarship, booking } = useAppState()

const folders = computed(() => {
  const ids = [...new Set([selectedId.value, ...applicationIds.value].filter((id): id is string => Boolean(id)))]
  return scholarships
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

const openFolder = (id: string) => {
  if (selectedId.value !== id) selectScholarship(id)
  router.push(`/dashboard/${id}`)
}

watch(selected, (scholarship) => { if (scholarship && selectedId.value !== scholarship.id) selectedId.value = scholarship.id }, { immediate: true })
onMounted(() => { if (!folders.value.length) router.replace('/scholarships?recommended=1') })
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
              <button v-for="item in folders" :key="item.id" class="folder-rail-card" :class="item.id === selected.id && 'active'" @click="openFolder(item.id)">
                <span class="folder-rail-icon"><FolderOpen :size="21" /></span>
                <span class="min-w-0 flex-1"><strong>{{ item.name }}</strong><small>{{ item.provider }} · {{ item.country }}</small><span class="folder-date inline-flex w-fit items-center gap-1 whitespace-nowrap"><CalendarDays :size="14" class="shrink-0" /><time>{{ item.deadline }}</time></span></span>
                <MoreVertical :size="17" class="folder-more" />
              </button>
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
              <div class="deadline-card"><span>Deadline</span><strong><CalendarDays :size="17" />{{ selected.deadline }}</strong><small>{{ daysLeft }} days left</small></div>
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
  </main>
</template>

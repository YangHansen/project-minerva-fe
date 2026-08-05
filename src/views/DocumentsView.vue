<script setup lang="ts">
import { computed, ref } from 'vue'
import { Edit3, FilePlus2, FileText, Folder, Grid2X2, List, MoreVertical, Search, UploadCloud } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import type { ScholarshipDocument } from '../types'
import { getScholarship } from '../data/scholarships'
import { useAppState } from '../composables/useAppState'
import WorkspaceSidebar from '../components/dashboard/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/dashboard/WorkspaceTopbar.vue'

const router = useRouter()
const { selectedId, documents, addDocument, toast } = useAppState()
const selected = computed(() => selectedId.value ? getScholarship(selectedId.value) : undefined)
const query = ref('')
const activeCategory = ref('All documents')
const sort = ref<'newest' | 'oldest' | 'title'>('newest')
const view = ref<'grid' | 'list'>('grid')
const categories = computed(() => ['All documents', ...new Set(documents.value.map((item) => item.category))])
const filtered = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  const result = documents.value.filter((item) => (activeCategory.value === 'All documents' || item.category === activeCategory.value)
    && (!normalized || `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(normalized)))
  return [...result].sort((a, b) => sort.value === 'title'
    ? a.title.localeCompare(b.title)
    : sort.value === 'oldest'
      ? new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
})
const statusLabel = (status: ScholarshipDocument['status']) => status === 'ready' ? 'Ready' : status === 'draft' ? 'Draft' : 'Not started'
const editedLabel = (date: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000))
  if (minutes < 2) return 'Edited just now'
  if (minutes < 60) return `Edited ${minutes} minutes ago`
  if (minutes < 1440) return `Edited ${Math.floor(minutes / 60)} hours ago`
  return `Edited ${Math.floor(minutes / 1440)} days ago`
}
const openEditor = (doc: ScholarshipDocument) => router.push(`/documents/${doc.id}`)
const createDocument = () => {
  if (!selectedId.value) return
  const title = window.prompt('Name your new scholarship document')?.trim()
  if (!title) return
  const doc = addDocument(selectedId.value, title)
  router.push(`/documents/${doc.id}`)
}
const upload = (doc: ScholarshipDocument, event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  doc.uploadName = file.name
  doc.status = 'ready'
  doc.updatedAt = new Date().toISOString()
  toast(`${file.name} added to ${selected.value?.name || 'this scholarship'}.`)
  input.value = ''
}
</script>

<template>
  <main class="workspace-shell">
    <WorkspaceSidebar active="documents" />
    <div class="workspace-main">
      <WorkspaceTopbar title="Documents" :subtitle="selected ? `Create, edit, and organize documents for ${selected.name}.` : 'Create, edit, and organize your application documents.'" />
      <div class="workspace-content">
        <section v-if="!selected" class="notion-select-state"><div class="notion-select-icon"><Folder :size="31" /></div><h1>Select a scholarship first</h1><p>Documents are stored inside the scholarship they belong to.</p><RouterLink to="/scholarships" class="btn-primary">Browse scholarships</RouterLink></section>

        <section v-else class="documents-library">
          <div class="documents-scholarship-context"><span>Active scholarship</span><strong>{{ selected.name }}</strong><small>{{ selected.provider }} · {{ selected.country }}</small></div>
          <div class="documents-tools">
            <div class="document-category-tabs"><button v-for="category in categories" :key="category" :class="activeCategory === category && 'active'" @click="activeCategory = category">{{ category }}</button></div>
            <div class="document-tool-actions">
              <label class="document-search"><Search :size="16" /><input v-model="query" placeholder="Search documents..." /></label>
              <select v-model="sort" aria-label="Sort documents"><option value="newest">Last modified</option><option value="oldest">Oldest modified</option><option value="title">Document title</option></select>
              <div class="view-toggle"><button :class="view === 'grid' && 'active'" aria-label="Grid view" @click="view = 'grid'"><Grid2X2 :size="17" /></button><button :class="view === 'list' && 'active'" aria-label="List view" @click="view = 'list'"><List :size="18" /></button></div>
              <button class="btn-primary" @click="createDocument"><FilePlus2 :size="17" />New document</button>
            </div>
          </div>

          <div v-if="filtered.length" class="document-card-grid" :class="view === 'list' && 'list-view'">
            <article v-for="doc in filtered" :key="doc.id" class="library-document-card">
              <div class="library-card-top"><span class="library-document-icon"><FileText :size="22" /></span><div class="library-card-actions"><button @click="openEditor(doc)"><Edit3 :size="15" />Edit</button><label title="Upload a file"><UploadCloud :size="16" /><input type="file" class="sr-only" accept=".pdf,.doc,.docx,.txt" @change="upload(doc, $event)" /></label><button aria-label="Document options"><MoreVertical :size="17" /></button></div></div>
              <div class="library-card-copy"><h2>{{ doc.title }}</h2><p>{{ doc.description }}</p><small>{{ editedLabel(doc.updatedAt) }}</small></div>
              <div class="library-card-footer"><span>{{ doc.category }}</span><em :class="doc.status">{{ statusLabel(doc.status) }}</em></div>
            </article>
          </div>
          <div v-else class="documents-empty"><FileText :size="28" /><h2>No documents found</h2><p>Try another category or search phrase.</p></div>
        </section>
      </div>
    </div>
  </main>
</template>

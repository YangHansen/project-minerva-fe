<script setup lang="ts">
import { computed, ref } from 'vue'
import { Edit3, FilePlus2, FileText, Folder, MoreVertical, Search, X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import type { DocumentKind, ScholarshipDocument } from '../types'
import { getScholarship } from '../data/scholarships'
import { useAppState } from '../composables/useAppState'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'

const router = useRouter()
const { selectedId, applicationIds, documents, addDocument, selectScholarship } = useAppState()
const selected = computed(() => selectedId.value ? getScholarship(selectedId.value) : undefined)
const availableScholarships = computed(() => applicationIds.value.map((id) => getScholarship(id)).filter((item): item is NonNullable<typeof item> => Boolean(item)))
const query = ref('')
const activeCategory = ref('All documents')
const sort = ref<'newest' | 'oldest' | 'title'>('newest')
const isCreateOpen = ref(false)
const newDocumentTitle = ref('')
const newDocumentKind = ref<DocumentKind>('essay')

const documentTypes: { kind: DocumentKind; label: string; description: string }[] = [
  { kind: 'essay', label: 'Essay', description: 'A prompt-specific scholarship response' },
  { kind: 'cv', label: 'CV / Resume', description: 'Experience, leadership, and measurable outcomes' },
  { kind: 'personal', label: 'Personal Statement', description: 'Motivation, background, and long-term impact' },
  { kind: 'purpose', label: 'Statement of Purpose', description: 'Academic direction and program fit' },
  { kind: 'study', label: 'Study Plan', description: 'Academic goals and learning pathway' },
  { kind: 'research', label: 'Research Plan', description: 'Research question, methods, and contribution' },
  { kind: 'transcript', label: 'Academic Transcript', description: 'Official academic record and supporting notes' },
  { kind: 'custom', label: 'Custom document', description: 'A document tailored to this scholarship' },
]

const switchScholarship = (event: Event) => {
  const id = (event.target as HTMLSelectElement).value
  if (!id || id === selectedId.value) return
  selectScholarship(id)
  activeCategory.value = 'All documents'
  query.value = ''
}

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

const selectedDocumentType = computed(() => documentTypes.find((item) => item.kind === newDocumentKind.value) ?? documentTypes.at(-1)!)
const statusLabel = (status: ScholarshipDocument['status']) => status === 'ready' ? 'Ready' : status === 'draft' ? 'Draft' : 'Not started'
const editedLabel = (date: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000))
  if (minutes < 2) return 'Edited just now'
  if (minutes < 60) return `Edited ${minutes} minutes ago`
  if (minutes < 1440) return `Edited ${Math.floor(minutes / 60)} hours ago`
  return `Edited ${Math.floor(minutes / 1440)} days ago`
}

const openEditor = (doc: ScholarshipDocument) => router.push(`/documents/${doc.id}`)
const openCreateDocument = () => {
  newDocumentTitle.value = ''
  newDocumentKind.value = 'essay'
  isCreateOpen.value = true
}
const createDocument = () => {
  if (!selectedId.value || !newDocumentTitle.value.trim()) return
  const type = selectedDocumentType.value
  const doc = addDocument(selectedId.value, newDocumentTitle.value.trim(), type.kind)
  doc.category = type.label
  doc.description = type.description
  isCreateOpen.value = false
  router.push(`/documents/${doc.id}`)
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
          <div class="documents-tools">
            <div class="documents-library-heading">
              <div class="min-w-0">
                <p class="text-[.67rem] font-black uppercase tracking-[.13em] text-[#5b45f5]">Active scholarship</p>
                <div class="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1"><strong class="text-lg font-black text-[#17136b]">{{ selected.name }}</strong><span class="text-xs text-slate-400">{{ selected.provider }} · {{ selected.country }}</span></div>
              </div>
              <label class="documents-scholarship-select"><span>Scholarship</span><select :value="selectedId || ''" aria-label="Choose scholarship documents" @change="switchScholarship"><option v-for="scholarship in availableScholarships" :key="scholarship.id" :value="scholarship.id">{{ scholarship.name }}</option></select></label>
            </div>
            <div class="document-category-tabs"><button v-for="category in categories" :key="category" :class="activeCategory === category && 'active'" @click="activeCategory = category">{{ category }}</button></div>
            <div class="document-tool-actions">
              <label class="document-search"><Search :size="16" /><input v-model="query" placeholder="Search this scholarship's documents" /><button v-if="query" type="button" aria-label="Clear document search" @click="query = ''"><X :size="15" /></button></label>
              <select v-model="sort" aria-label="Sort documents"><option value="newest">Last modified</option><option value="oldest">Oldest modified</option><option value="title">Document title</option></select>
              <button class="btn-primary" @click="openCreateDocument"><FilePlus2 :size="17" />New document</button>
            </div>
          </div>

          <div v-if="filtered.length" class="document-card-grid">
            <article v-for="doc in filtered" :key="doc.id" class="library-document-card">
              <div class="library-card-top"><span class="library-document-icon"><FileText :size="22" /></span><div class="library-card-actions"><button @click="openEditor(doc)"><Edit3 :size="15" />Edit</button><button aria-label="Document options"><MoreVertical :size="17" /></button></div></div>
              <div class="library-card-copy"><h2>{{ doc.title }}</h2><p>{{ doc.description }}</p><small>{{ editedLabel(doc.updatedAt) }}</small></div>
              <div class="library-card-footer"><span>{{ doc.category }}</span><em :class="doc.status">{{ statusLabel(doc.status) }}</em></div>
            </article>
          </div>
          <div v-else class="documents-empty"><FileText :size="28" /><h2>No documents found</h2><p>Try another category or search phrase.</p></div>
        </section>
      </div>
    </div>

    <div v-if="isCreateOpen" class="document-create-backdrop" @click.self="isCreateOpen = false">
      <form class="document-create-modal" @submit.prevent="createDocument">
        <div class="document-create-heading"><div><p>New scholarship document</p><h2>Create a tailored draft</h2><span>It will be saved inside {{ selected?.name }}.</span></div><button type="button" aria-label="Close new document dialog" @click="isCreateOpen = false"><X :size="19" /></button></div>
        <label>Document type<select v-model="newDocumentKind"><option v-for="type in documentTypes" :key="type.kind" :value="type.kind">{{ type.label }}</option></select></label>
        <label>Document title<input v-model="newDocumentTitle" :placeholder="selectedDocumentType.label" autofocus /></label>
        <p class="document-create-hint">{{ selectedDocumentType.description }}</p>
        <div class="document-create-actions"><button type="button" class="btn-secondary" @click="isCreateOpen = false">Cancel</button><button type="submit" class="btn-primary" :disabled="!newDocumentTitle.trim()">Create & edit</button></div>
      </form>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Edit3, FilePlus2, FileText, Folder, MoreVertical, Search, X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import type { DocumentKind, ScholarshipDocument } from '../types'
import { getScholarship } from '../data/scholarships'
import { useAppState } from '../composables/useAppState'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'
import BaseSelect from '../components/common/BaseSelect.vue'

const router = useRouter()
const { selectedId, applicationIds, documents, addDocument, selectScholarship } = useAppState()
const selected = computed(() => selectedId.value ? getScholarship(selectedId.value) : undefined)
const availableScholarships = computed(() => applicationIds.value.map((id) => getScholarship(id)).filter((item): item is NonNullable<typeof item> => Boolean(item)))
const query = ref('')
const sort = ref<'newest' | 'oldest' | 'title'>('newest')
const sortOptions = ['Last modified', 'Oldest modified', 'Document title']
const isCreateOpen = ref(false)
const newDocumentTitle = ref('')
const newDocumentKind = ref<DocumentKind>('essay')
const creatingDocument = ref(false)
const createError = ref('')

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

const selectedScholarshipName = computed({
  get: () => selected.value?.name || '',
  set: (name: string) => {
    const id = availableScholarships.value.find((item) => item.name === name)?.id
    if (!id || id === selectedId.value) return
    selectScholarship(id)
    query.value = ''
  },
})
const sortLabel = computed({
  get: () => sort.value === 'oldest' ? 'Oldest modified' : sort.value === 'title' ? 'Document title' : 'Last modified',
  set: (label: string) => { sort.value = label === 'Oldest modified' ? 'oldest' : label === 'Document title' ? 'title' : 'newest' },
})

const filtered = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  const result = documents.value.filter((item) => !normalized || `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(normalized))
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
  createError.value = ''
  isCreateOpen.value = true
}
const createDocument = async () => {
  if (!selectedId.value || !newDocumentTitle.value.trim() || creatingDocument.value) return
  const type = selectedDocumentType.value
  creatingDocument.value = true
  createError.value = ''
  try {
    const doc = await addDocument(selectedId.value, newDocumentTitle.value.trim(), type.kind, {
      category: type.label,
      description: type.description,
    })
    isCreateOpen.value = false
    await router.push(`/documents/${doc.id}`)
  } catch (caught) {
    createError.value = caught instanceof Error ? caught.message : 'Unable to create the document.'
  } finally {
    creatingDocument.value = false
  }
}
</script>

<template>
  <main class="workspace-shell">
    <WorkspaceSidebar active="documents" />
    <div class="workspace-main">
      <WorkspaceTopbar title="Documents" :subtitle="selected ? `Create, edit, and organize documents for ${selected.name}.` : 'Create, edit, and organize your application documents.'" />
      <div class="workspace-content">
        <section v-if="!selected" class="notion-select-state">
<div class="notion-select-icon">
<Folder :size="31" />
</div>
<h1>Select a scholarship first</h1>
<p>Documents are stored inside the scholarship they belong to.</p>
<RouterLink to="/scholarships" class="btn-primary">Browse scholarships</RouterLink>
</section>

        <section v-else class="documents-library">
          <div class="documents-tools">
            <div class="documents-library-heading">
              <div class="min-w-0">
                <p class="text-[.67rem] font-black uppercase tracking-[.13em] text-[#5b45f5]">Active scholarship</p>
                <div class="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
<BaseSelect v-model="selectedScholarshipName" class="document-heading-select" :options="availableScholarships.map((item) => item.name)" placeholder="Choose scholarship" />
<span class="text-xs text-slate-400">{{ selected.provider }} · {{ selected.country }}</span>
</div>
              </div>
            </div>
            <div class="document-tool-actions">
              <label class="document-search">
<Search :size="16" />
<input v-model="query" placeholder="Search this scholarship's documents" />
<button v-if="query" type="button" aria-label="Clear document search" @click="query = ''">
<X :size="15" />
</button>
</label>
              <label class="document-sort-control"><span>Sort by</span><BaseSelect v-model="sortLabel" class="document-sort-select" :options="sortOptions" placeholder="Sort documents" /></label>
              <button class="btn-primary document-new-button" @click="openCreateDocument">
<FilePlus2 :size="17" />New document</button>
            </div>
          </div>

          <div v-if="filtered.length" class="document-card-grid">
            <article v-for="doc in filtered" :key="doc.id" class="library-document-card">
              <div class="library-card-top">
<span class="library-document-icon">
<FileText :size="22" />
</span>
<div class="library-card-actions">
<button @click="openEditor(doc)">
<Edit3 :size="15" />Edit</button>
<button aria-label="Document options">
<MoreVertical :size="17" />
</button>
</div>
</div>
              <div class="library-card-copy">
<h2>{{ doc.title }}</h2>
<p>{{ doc.description }}</p>
<small>{{ editedLabel(doc.updatedAt) }}</small>
</div>
              <div class="library-card-footer">
<span>{{ doc.category }}</span>
<em :class="doc.status">{{ statusLabel(doc.status) }}</em>
</div>
            </article>
          </div>
          <div v-else class="documents-empty">
<FileText :size="28" />
<h2>No documents found</h2>
<p>Try another search phrase.</p>
</div>
        </section>
      </div>
    </div>

    <div v-if="isCreateOpen" class="document-create-backdrop" @click.self="isCreateOpen = false">
      <form class="document-create-modal" @submit.prevent="createDocument">
        <div class="document-create-heading">
<div>
<p>New scholarship document</p>
<h2>Create a tailored draft</h2>
<span>It will be saved inside {{ selected?.name }}.</span>
</div>
<button type="button" aria-label="Close new document dialog" @click="isCreateOpen = false">
<X :size="19" />
</button>
</div>
        <label>Document type<select v-model="newDocumentKind">
<option v-for="type in documentTypes" :key="type.kind" :value="type.kind">{{ type.label }}</option>
</select>
</label>
        <label>Document title<input v-model="newDocumentTitle" :placeholder="selectedDocumentType.label" autofocus />
</label>
        <p class="document-create-hint">{{ selectedDocumentType.description }}</p>
        <p v-if="createError" class="error">{{ createError }}</p>
        <div class="document-create-actions">
<button type="button" class="btn-secondary" :disabled="creatingDocument" @click="isCreateOpen = false">Cancel</button>
<button type="submit" class="btn-primary" :disabled="creatingDocument || !newDocumentTitle.trim()">{{ creatingDocument ? 'Creating...' : 'Create & edit' }}</button>
</div>
      </form>
    </div>
  </main>
</template>

<style scoped>
.documents-library-heading { min-height: 70px; }
.document-heading-select { width: min(330px, 100%); }
.document-heading-select :deep(.base-select-trigger) { min-height: 38px; border-color: transparent; background: transparent; padding: .1rem 0; font-size: 1rem; font-weight: 900; }
.document-heading-select :deep(.base-select-trigger:hover) { border-color: transparent; color: #5b45f5; }
.document-heading-select :deep(.base-select-menu) { min-width: 300px; border-color: #ddd6fe; box-shadow: 0 18px 35px rgb(55 38 160 / .16); }
.documents-scholarship-select { min-width: min(390px, 100%); }
.documents-scholarship-select :deep(.base-select-trigger) { min-height: 48px; border-color: #e0e7ff; background: #fff; }
.documents-scholarship-select :deep(.base-select-menu) { border-color: #ddd6fe; box-shadow: 0 18px 35px rgb(55 38 160 / .16); }
.document-sort-control { display: flex; align-items: center; gap: .65rem; }
.document-sort-control > span { color: #94a3b8; font-size: .66rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; }
.document-sort-select { width: 165px; }
.document-sort-select :deep(.base-select-trigger) { min-height: 46px; padding-inline: .85rem; font-size: .75rem; font-weight: 800; }
.document-new-button { min-width: 164px; padding-inline: 1rem; white-space: nowrap; }
@media (max-width: 640px) { .document-sort-control { width: 100%; align-items: flex-start; flex-direction: column; gap: .35rem; } .document-sort-select, .document-new-button { width: 100%; } }
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Edit3, FilePlus2, FileText, Folder, Search, Trash2, Upload, X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import type { DocumentKind, ScholarshipDocument } from '../types'
import { documentTemplates, type DocumentTemplate } from '../data/documentTemplates'
import { useAppState } from '../composables/useAppState'
import { useScholarJourneyPage } from '../composables/useProductTour'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'
import BaseSelect from '../components/common/BaseSelect.vue'
import BaseModal from '../components/common/BaseModal.vue'

useScholarJourneyPage('documents')
const router = useRouter()
const { selectedId, applicationIds, documents, addDocument, uploadDocument, deleteDocument, selectScholarship, toast, getScholarship } = useAppState()
const selected = computed(() => selectedId.value ? getScholarship(selectedId.value) : undefined)
const availableScholarships = computed(() => applicationIds.value.map((id) => getScholarship(id)).filter((item): item is NonNullable<typeof item> => Boolean(item)))
const query = ref('')
const sort = ref<'newest' | 'oldest' | 'title'>('newest')
const sortOptions = ['Last modified', 'Oldest modified', 'Document title']
const isCreateOpen = ref(false)
const newDocumentTitle = ref('')
const newDocumentKind = ref<DocumentKind>('essay')
const newDocumentFile = ref<File | null>(null)
const selectedTemplateId = ref('scholarship-essay')
const templateSearch = ref('')
const creatingDocument = ref(false)
const deletingDocumentId = ref<string | null>(null)
const pendingDeleteDocument = ref<ScholarshipDocument | null>(null)
const createError = ref('')

const documentTypes: { kind: DocumentKind; label: string; description: string }[] = [
  { kind: 'cv', label: 'CV / Resume', description: 'Experience, leadership, and measurable outcomes' },
  { kind: 'essay', label: 'Essay', description: 'A prompt-specific scholarship response' },
  { kind: 'study', label: 'Study Plan', description: 'Academic goals and learning pathway' },
  { kind: 'research', label: 'Research Plan', description: 'Research question, methods, and contribution' },
  { kind: 'custom', label: 'Empty document', description: 'Start from a blank page with no preset structure' },
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
const selectedTemplate = computed(() => documentTemplates.find((item) => item.id === selectedTemplateId.value) ?? documentTemplates[0]!)
const filteredTemplates = computed(() => {
  const normalized = templateSearch.value.trim().toLowerCase()
  return normalized
    ? documentTemplates.filter((template) => `${template.name} ${template.description}`.toLowerCase().includes(normalized))
    : documentTemplates
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
const removeDocument = (doc: ScholarshipDocument) => {
  if (deletingDocumentId.value) return
  pendingDeleteDocument.value = doc
}
const confirmDeleteDocument = async () => {
  const doc = pendingDeleteDocument.value
  if (!doc || deletingDocumentId.value) return
  deletingDocumentId.value = doc.id
  try {
    await deleteDocument(doc)
    toast('Document deleted.', 'info')
  } catch (caught) {
    toast(caught instanceof Error ? caught.message : 'Unable to delete the document.', 'info')
  } finally {
    deletingDocumentId.value = null
    pendingDeleteDocument.value = null
  }
}
const cancelDeleteDocument = () => {
  if (deletingDocumentId.value) return
  pendingDeleteDocument.value = null
}
const openCreateDocument = () => {
  newDocumentTitle.value = 'CV / Resume'
  newDocumentKind.value = 'cv'
  newDocumentFile.value = null
  selectedTemplateId.value = 'cv-profile'
  templateSearch.value = ''
  createError.value = ''
  isCreateOpen.value = true
}
const chooseTemplate = (template: DocumentTemplate) => {
  selectedTemplateId.value = template.id
  newDocumentFile.value = null
  if (template.kind) newDocumentKind.value = template.kind
  const titleMatchesPreset = documentTemplates.some((item) => item.name === newDocumentTitle.value.trim())
  if (!newDocumentTitle.value.trim() || titleMatchesPreset) {
    newDocumentTitle.value = template.id === 'blank' ? '' : template.name
  }
}
const clearUpload = () => {
  newDocumentFile.value = null
}
const onUploadSelected = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] || null
  newDocumentFile.value = file
  if (file && (!newDocumentTitle.value.trim() || documentTemplates.some((item) => item.name === newDocumentTitle.value.trim()))) {
    newDocumentTitle.value = file.name.replace(/\.docx$/i, '')
  }
}
const createDocument = async () => {
  if (!selectedId.value || creatingDocument.value) return
  const type = selectedDocumentType.value
  const template = selectedTemplate.value
  const canCreateBlank = !newDocumentFile.value && template.id === 'blank'
  if (!newDocumentFile.value && !newDocumentTitle.value.trim() && !canCreateBlank) return
  creatingDocument.value = true
  createError.value = ''
  try {
    if (newDocumentFile.value) {
      const doc = await uploadDocument(selectedId.value, newDocumentFile.value, newDocumentTitle.value, type.kind, {
        category: type.label,
        description: type.description,
      })
      isCreateOpen.value = false
      toast('DOCX uploaded and ready to edit.')
      await router.push(`/documents/${doc.id}`)
    } else {
      const title = newDocumentTitle.value.trim() || (template.id === 'blank' ? 'Untitled document' : template.name)
      const content = template.content
      const doc = await addDocument(selectedId.value, title, type.kind, {
        category: type.label,
        description: type.description,
        content,
        pages: [{ id: 'page-1', title: 'Page 1', content }],
      })
      isCreateOpen.value = false
      toast(`${template.id === 'blank' ? 'Empty document' : template.name} ready to edit.`)
      await router.push(`/documents/${doc.id}`)
    }
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
      <div data-tour="page-documents" class="workspace-content">
        <section v-if="!selected" class="notion-select-state">
          <div class="notion-select-icon"><Folder :size="31" /></div>
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
                <button v-if="query" type="button" aria-label="Clear document search" @click="query = ''"><X :size="15" /></button>
              </label>
              <label class="document-sort-control"><span>Sort by</span><BaseSelect v-model="sortLabel" class="document-sort-select" :options="sortOptions" placeholder="Sort documents" /></label>
              <button class="btn-primary document-new-button" @click="openCreateDocument"><FilePlus2 :size="17" />New document</button>
            </div>
          </div>

          <div v-if="filtered.length" class="document-card-grid">
            <article v-for="doc in filtered" :key="doc.id" class="library-document-card">
              <div class="library-card-top">
                <span class="library-document-icon"><FileText :size="22" /></span>
                <div class="library-card-actions">
                  <button @click="openEditor(doc)"><Edit3 :size="15" />Edit</button>
                  <button :disabled="deletingDocumentId === doc.id" :aria-label="`Delete ${doc.title}`" class="text-rose-600" @click="removeDocument(doc)">
                    <Trash2 :size="16" />{{ deletingDocumentId === doc.id ? 'Deleting…' : 'Delete' }}
                  </button>
                </div>
              </div>
              <div class="library-card-copy">
                <h2>{{ doc.title }}</h2>
                <p>{{ doc.description }}</p>
                <small>{{ doc.uploadName ? `Uploaded: ${doc.uploadName}` : editedLabel(doc.updatedAt) }}</small>
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
      <form class="document-create-modal document-create-modal-wide" @submit.prevent="createDocument">
        <div class="document-create-heading">
          <div>
            <p>New scholarship document</p>
            <h2>Start a document</h2>
            <span>Pick a template or upload a DOCX. Saved inside {{ selected?.name }}.</span>
          </div>
          <button type="button" aria-label="Close new document dialog" @click="isCreateOpen = false"><X :size="19" /></button>
        </div>

        <label class="create-title-field">
          <span>Document title</span>
          <input
            v-model="newDocumentTitle"
            :placeholder="newDocumentFile ? 'Optional — filename will be used' : (selectedTemplate.id === 'blank' ? 'Untitled document' : selectedTemplate.name)"
            autofocus
          />
        </label>

        <div class="create-template-block" :class="{ muted: Boolean(newDocumentFile) }">
          <div class="create-section-label">
            <strong>Choose a template</strong>
            <small>{{ selectedTemplate.description }}</small>
          </div>
          <label class="create-template-search">
            <Search :size="15" />
            <input v-model="templateSearch" type="search" placeholder="Search CV, essay, study plan..." :disabled="Boolean(newDocumentFile)" />
          </label>
          <div class="create-template-grid">
            <button
              v-for="template in filteredTemplates"
              :key="template.id"
              type="button"
              class="template-card"
              :class="{ selected: !newDocumentFile && selectedTemplateId === template.id }"
              :disabled="Boolean(newDocumentFile)"
              @click="chooseTemplate(template)"
            >
              <span :class="['template-preview', `tone-${template.tone}`]">
                <em>{{ template.previewTitle }}</em>
                <i class="wide" /><i /><i /><i class="short" />
              </span>
              <span class="template-card-copy">
                <strong>{{ template.name }}</strong>
                <small>{{ template.description }}</small>
              </span>
            </button>
            <p v-if="!filteredTemplates.length" class="template-empty">No matching templates.</p>
          </div>
        </div>

        <div class="create-or-divider" role="separator" aria-label="Or">
          <span>or upload your document</span>
        </div>

        <label class="document-upload-field" :class="{ active: Boolean(newDocumentFile) }">
          <span class="document-upload-picker">
            <Upload :size="18" />
            <span>
              <strong>{{ newDocumentFile?.name || 'Upload a Word document' }}</strong>
              <small>{{ newDocumentFile ? 'DOCX selected · template will be skipped' : 'Optional · DOCX only' }}</small>
            </span>
          </span>
          <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" @change="onUploadSelected" />
        </label>
        <button v-if="newDocumentFile" type="button" class="clear-upload-btn" @click="clearUpload">Remove file and use a template instead</button>

        <p v-if="createError" class="error">{{ createError }}</p>
        <div class="document-create-actions">
          <button type="button" class="btn-secondary" :disabled="creatingDocument" @click="isCreateOpen = false">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="creatingDocument || (!newDocumentFile && !newDocumentTitle.trim() && selectedTemplate.id !== 'blank')">
            {{ creatingDocument ? (newDocumentFile ? 'Uploading...' : 'Creating...') : (newDocumentFile ? 'Upload & edit' : 'Create & edit') }}
          </button>
        </div>
      </form>
    </div>
    <BaseModal :open="Boolean(pendingDeleteDocument)" title="Delete document?" @close="cancelDeleteDocument">
      <p class="mb-6 text-sm leading-6 text-slate-600">Are you sure you want to permanently delete <strong>{{ pendingDeleteDocument?.title }}</strong>? This will remove the document along with its saved versions and AI reviews.</p>
      <div class="flex items-center justify-end gap-3">
        <button type="button" class="btn-secondary" @click="cancelDeleteDocument">Cancel</button>
        <button type="button" class="btn-primary" :disabled="Boolean(deletingDocumentId)" @click="confirmDeleteDocument">{{ deletingDocumentId ? 'Deleting…' : 'Delete document' }}</button>
      </div>
    </BaseModal>
  </main>
</template>

<style scoped>
.documents-library-heading { min-height: 70px; }
.document-heading-select { width: min(330px, 100%); }
.document-heading-select :deep(.base-select-trigger) { min-height: 38px; border-color: transparent; background: transparent; padding: .1rem 0; font-size: 1rem; font-weight: 900; }
.document-heading-select :deep(.base-select-trigger:hover) { border-color: transparent; color: #5b45f5; }
.document-heading-select :deep(.base-select-menu) { min-width: 300px; border-color: #ddd6fe; box-shadow: 0 18px 35px rgb(55 38 160 / .16); }
.document-sort-control { display: flex; align-items: center; gap: .65rem; }
.document-sort-control > span { color: #94a3b8; font-size: .66rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; }
.document-sort-select { width: 165px; }
.document-sort-select :deep(.base-select-trigger) { min-height: 46px; padding-inline: .85rem; font-size: .75rem; font-weight: 800; }
.document-new-button { min-width: 164px; padding-inline: 1rem; white-space: nowrap; }
@media (max-width: 640px) { .document-sort-control { width: 100%; align-items: flex-start; flex-direction: column; gap: .35rem; } .document-sort-select, .document-new-button { width: 100%; } }
.document-upload-field { display: block; position: relative; cursor: pointer; }
.document-upload-field > input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.document-upload-picker {
  display: flex;
  align-items: center;
  gap: .75rem;
  min-height: 64px;
  padding: .9rem 1rem;
  border: 1.5px dashed #c4b5fd;
  border-radius: 1rem;
  color: #5b45f5;
  background: linear-gradient(180deg, #faf8ff, #f5f3ff);
}
.document-upload-field.active .document-upload-picker {
  border-color: #8b5cf6;
  background: #f5f3ff;
  box-shadow: 0 0 0 2px rgb(139 92 246 / .14);
}
.document-upload-picker strong { display: block; color: #17136b; font-size: .82rem; font-weight: 900; }
.document-upload-picker small { display: block; margin-top: .15rem; color: #64748b; font-size: .68rem; font-weight: 700; }
.clear-upload-btn {
  margin-top: .55rem;
  color: #5b45f5;
  font-size: .72rem;
  font-weight: 800;
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
}
.clear-upload-btn:hover { text-decoration: underline; }
.document-create-modal-wide { width: min(720px, calc(100vw - 2rem)); max-width: min(720px, calc(100vw - 2rem)); max-height: min(90vh, 900px); overflow: auto; }
.create-title-field { display: grid; gap: .4rem; margin: .15rem 0 .95rem; }
.create-title-field > span { color: #64748b; font-size: .72rem; font-weight: 800; }
.create-title-field input {
  width: 100%;
  min-height: 46px;
  border: 1px solid #e2e8f0;
  border-radius: .85rem;
  background: #fff;
  padding: .7rem .9rem;
  color: #17136b;
  font-size: .88rem;
  font-weight: 700;
  outline: none;
}
.create-title-field input:focus { border-color: #a78bfa; box-shadow: 0 0 0 3px rgb(167 139 250 / .18); }
.create-section-label { display: grid; gap: .2rem; margin-bottom: .65rem; }
.create-section-label strong { color: #17136b; font-size: .78rem; font-weight: 900; }
.create-section-label small { color: #64748b; font-size: .7rem; line-height: 1.4; }
.create-template-block { margin-bottom: .15rem; }
.create-template-block.muted { opacity: .5; }
.create-template-search {
  display: flex;
  align-items: center;
  gap: .55rem;
  min-height: 42px;
  border: 1px solid #e2e8f0;
  border-radius: .8rem;
  background: #f8fafc;
  padding: 0 .85rem;
  color: #94a3b8;
}
.create-template-search input {
  width: 100%;
  border: 0;
  background: transparent;
  color: #0f172a;
  font-size: .78rem;
  outline: none;
}
.create-template-search:focus-within { border-color: #a78bfa; background: #fff; }
.create-or-divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: .75rem;
  margin: 1rem 0 .85rem;
  color: #94a3b8;
  font-size: .68rem;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.create-or-divider::before,
.create-or-divider::after {
  content: '';
  height: 1px;
  background: #e2e8f0;
}
.create-template-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .7rem; margin-top: .75rem; max-height: 260px; overflow: auto; padding-right: .15rem; }
.template-card { display: grid; grid-template-columns: 88px minmax(0, 1fr); overflow: hidden; border: 1px solid #e2e8f0; border-radius: .9rem; background: #fff; text-align: left; box-shadow: 0 1px 2px rgb(15 23 42 / .04); }
.template-card.selected { border-color: #8b5cf6; box-shadow: 0 0 0 2px rgb(139 92 246 / .18); }
.template-card:disabled { cursor: not-allowed; }
.template-preview { display: grid; gap: .28rem; place-content: start center; min-height: 92px; padding: .7rem .55rem; background: linear-gradient(160deg, #f5f3ff, #ede9fe); }
.template-preview em { display: block; width: 100%; overflow: hidden; color: #312e81; font-size: .58rem; font-style: normal; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
.template-preview i { display: block; height: 4px; border-radius: 999px; background: rgb(91 69 245 / .28); }
.template-preview i.wide { width: 100%; }
.template-preview i.short { width: 55%; }
.template-preview.tone-blue { background: linear-gradient(160deg, #eff6ff, #dbeafe); }
.template-preview.tone-emerald { background: linear-gradient(160deg, #ecfdf5, #d1fae5); }
.template-preview.tone-amber { background: linear-gradient(160deg, #fffbeb, #fef3c7); }
.template-preview.tone-slate { background: linear-gradient(160deg, #f8fafc, #e2e8f0); }
.template-card-copy { display: grid; align-content: center; gap: .25rem; padding: .7rem .75rem; }
.template-card-copy strong { color: #17136b; font-size: .74rem; font-weight: 900; }
.template-card-copy small { color: #64748b; font-size: .66rem; line-height: 1.35; }
.template-empty { grid-column: 1 / -1; border-radius: .9rem; background: #f8fafc; padding: 1rem; text-align: center; color: #64748b; font-size: .75rem; }
@media (max-width: 640px) { .create-template-grid { grid-template-columns: 1fr; } }
</style>

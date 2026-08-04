<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, FileText, Folder, FolderOpen, Sparkles, UploadCloud, WandSparkles } from 'lucide-vue-next'
import { getScholarship, scholarships } from '../data/scholarships'
import { useAppState } from '../composables/useAppState'
import WorkspaceSidebar from '../components/dashboard/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/dashboard/WorkspaceTopbar.vue'

type DocumentKind = 'cv' | 'essay' | 'personal' | 'study' | 'research' | 'transcript'
type Drafts = Record<string, Partial<Record<DocumentKind, string>>>

const documentTypes: { id: DocumentKind; label: string; description: string }[] = [
  { id: 'cv', label: 'CV / Resume', description: 'Experience, leadership, and measurable outcomes' },
  { id: 'essay', label: 'Scholarship essay', description: 'Prompt-specific written response' },
  { id: 'personal', label: 'Personal statement', description: 'Motivation, background, and long-term impact' },
  { id: 'study', label: 'Study plan', description: 'Academic goals and learning pathway' },
  { id: 'research', label: 'Research plan', description: 'Research question, methods, and expected contribution' },
  { id: 'transcript', label: 'Academic transcript', description: 'Base academic record and supporting notes' },
]

const { selectedId, savedIds, selectScholarship, toast } = useAppState()
const openedFolderId = ref<string | null>(null)
const active = ref<DocumentKind | null>(null)
const drafts = ref<Drafts>(JSON.parse(localStorage.getItem('minerva-document-drafts') || '{}'))
const uploads = ref<Record<string, Record<string, string>>>(JSON.parse(localStorage.getItem('minerva-document-uploads') || '{}'))

const folders = computed(() => {
  const ids = [...new Set([selectedId.value, ...savedIds.value].filter((id): id is string => Boolean(id)))]
  return scholarships.filter((item) => ids.includes(item.id))
})
const folder = computed(() => openedFolderId.value ? getScholarship(openedFolderId.value) : undefined)
const activeMeta = computed(() => documentTypes.find((item) => item.id === active.value))
const draft = computed({
  get: () => folder.value && active.value ? drafts.value[folder.value.id]?.[active.value] || '' : '',
  set: (value: string) => {
    if (!folder.value || !active.value) return
    drafts.value[folder.value.id] ||= {}
    drafts.value[folder.value.id][active.value] = value
  },
})
const wordCount = computed(() => draft.value.trim() ? draft.value.trim().split(/\s+/).length : 0)
const suggestions = computed(() => [
  ['Scholarship alignment', `Connect this version directly to ${folder.value?.provider}'s selection priorities.`],
  ['Evidence and impact', 'Use one concrete result, number, or outcome instead of a general claim.'],
  ['Clear next step', `Show how studying in ${folder.value?.country} supports your return and impact plan.`],
])

watch(drafts, (value) => localStorage.setItem('minerva-document-drafts', JSON.stringify(value)), { deep: true })
watch(uploads, (value) => localStorage.setItem('minerva-document-uploads', JSON.stringify(value)), { deep: true })

const openFolder = (id: string) => {
  openedFolderId.value = id
  active.value = null
  selectScholarship(id)
}
const openDocument = (id: DocumentKind) => { active.value = id }
const upload = (id: DocumentKind, event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !folder.value) return
  uploads.value[folder.value.id] ||= {}
  uploads.value[folder.value.id][id] = file.name
  toast(`${file.name} saved to this scholarship folder.`)
}
</script>

<template>
  <main class="workspace-shell">
    <WorkspaceSidebar active="documents" />
    <div class="workspace-main">
      <WorkspaceTopbar title="Document workspace" subtitle="Choose a scholarship folder, then work on its tailored documents." />
      <div class="workspace-content">
        <section v-if="!openedFolderId" class="document-library">
          <header class="document-studio-head">
            <div>
              <p class="text-xs font-extrabold uppercase tracking-[.16em] text-[#5b45f5]">Scholarship folders</p>
              <h2>Your scholarship documents</h2>
              <p>Each scholarship has its own tailored documents, uploads, and writing guidance.</p>
            </div>
            <RouterLink to="/scholarships" class="btn-secondary">Add scholarship</RouterLink>
          </header>
          <div v-if="folders.length" class="scholarship-folder-grid">
            <button v-for="item in folders" :key="item.id" class="scholarship-folder-card" @click="openFolder(item.id)">
              <div class="document-folder-icon"><Folder :size="24" /></div>
              <div>
                <p class="text-xs font-extrabold uppercase tracking-[.13em] text-[#5b45f5]">Scholarship folder</p>
                <h3>{{ item.name }}</h3>
                <p>{{ item.provider }} · {{ item.country }}</p>
              </div>
              <span>Open folder →</span>
            </button>
          </div>
          <div v-else class="notion-select-state">
            <div class="notion-select-icon"><Folder :size="31" /></div>
            <h1>Add a scholarship first</h1>
            <p>Once you save a scholarship, its document folder will appear here.</p>
            <RouterLink to="/scholarships" class="btn-primary">Browse scholarships</RouterLink>
          </div>
        </section>

        <section v-else-if="folder && !active" class="document-library">
          <button class="document-back" @click="openedFolderId = null"><ArrowLeft :size="16" />All scholarship folders</button>
          <header class="document-studio-head">
            <div>
              <p class="text-xs font-extrabold uppercase tracking-[.16em] text-[#5b45f5]">Scholarship folder</p>
              <h2>{{ folder.name }}</h2>
              <p>{{ folder.provider }} · {{ folder.country }} · choose a document to upload or tailor.</p>
            </div>
            <RouterLink to="/checklist" class="btn-secondary">Open checklist</RouterLink>
          </header>
          <div class="document-folder-grid">
            <article v-for="doc in documentTypes" :key="doc.id" class="document-folder-card">
              <div class="document-folder-icon"><FolderOpen :size="22" /></div>
              <div class="min-w-0">
                <h3>{{ doc.label }}</h3><p>{{ doc.description }}</p>
                <span v-if="uploads[folder.id]?.[doc.id]">{{ uploads[folder.id][doc.id] }}</span>
              </div>
              <div class="document-folder-actions">
                <button @click="openDocument(doc.id)">Open</button>
                <label><UploadCloud :size="14" />Upload<input type="file" class="sr-only" accept=".pdf,.doc,.docx" @change="upload(doc.id, $event)"></label>
              </div>
            </article>
          </div>
        </section>

        <section v-else-if="folder && active" class="document-studio">
          <button class="document-back" @click="active = null"><ArrowLeft :size="16" />Back to {{ folder.name }} folder</button>
          <header class="document-studio-head">
            <div>
              <p class="text-xs font-extrabold uppercase tracking-[.16em] text-[#5b45f5]">Tailored document</p>
              <h2>{{ activeMeta?.label }}</h2>
              <p>Editing the {{ folder.name }} version. Your master document remains separate.</p>
            </div>
            <button class="btn-secondary" @click="toast('Guidance refreshed for this scholarship.', 'info')"><WandSparkles :size="16" />Refresh guidance</button>
          </header>
          <div class="document-tabs"><span>{{ uploads[folder.id]?.[active] || 'No file uploaded' }}</span><span class="ml-auto">{{ wordCount }} words</span></div>
          <div class="document-workspace">
            <div class="document-editor"><div class="document-editor-title"><FileText :size="18" /><input :value="activeMeta?.label" readonly></div><textarea v-model="draft" :placeholder="`Write or paste the ${activeMeta?.label?.toLowerCase()} tailored for ${folder.name}…`" /></div>
            <aside class="document-guidance"><p class="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.15em] text-[#5b45f5]"><Sparkles :size="15" />Scholarship guidance</p><div v-for="suggestion in suggestions" :key="suggestion[0]" class="document-suggestion"><strong>{{ suggestion[0] }}</strong><p>{{ suggestion[1] }}</p></div><p class="document-disclaimer">Frontend preparation guidance only; no external analysis is performed.</p></aside>
          </div>
        </section>
      </div>
    </div>
  </main>
</template>

import { computed, ref, watch } from 'vue'
import type { ChecklistItem, ChecklistStatus, DocumentKind, MentorBooking, MockSession, PracticeResult, ScholarshipDocument, UserProfile } from '../types'

function read<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback }
}
function persist<T>(key: string, state: { value: T }) { watch(state, (value) => localStorage.setItem(key, JSON.stringify(value)), { deep: true }) }

const defaultChecklist: ChecklistItem[] = [
  ['cv', 'Update CV', 'Tailored CV uploaded and ready for review', 'Core documents', true],
  ['essay', 'Draft leadership essay', 'Write the first draft for the leadership and influence prompt', 'Written materials', true],
  ['study-plan', 'Prepare study plan', 'Outline academic goals and post-study impact', 'Written materials', true],
  ['recommendation', 'Request recommendation letter', 'Ask your referee and send submission instructions', 'References', true],
  ['transcript', 'Upload academic transcript', 'Add your latest official academic record', 'Core documents', true],
  ['ielts', 'Add English test certificate', 'Upload IELTS, TOEFL, or another accepted result if required', 'Language', false],
  ['passport', 'Upload passport copy', 'Identity document required for application submission', 'Core documents', true],
  ['application', 'Complete application form', 'Review every response before the official submission', 'Submission', true],
].map(([id, title, description, category, required]) => ({
  id: String(id), title: String(title), description: String(description), category: String(category),
  required: Boolean(required), status: 'pending' as ChecklistStatus, notes: '',
}))

const documentBlueprints: Array<Pick<ScholarshipDocument, 'id' | 'kind' | 'title' | 'description' | 'category' | 'prompt'>> = [
  { id: 'cv', kind: 'cv', title: 'CV / Resume', description: 'Experience, leadership, and measurable outcomes', category: 'CV', prompt: 'Present the experience, leadership, and measurable outcomes most relevant to this scholarship.' },
  { id: 'leadership-essay', kind: 'essay', title: 'Leadership Essay', description: 'A prompt-specific scholarship response', category: 'Essay', prompt: 'Describe a time when you took the lead in a challenging situation. What was the impact and what did you learn?' },
  { id: 'personal-statement', kind: 'personal', title: 'Personal Statement', description: 'Motivation, background, and long-term impact', category: 'Personal Statement', prompt: 'Connect your background, motivation, and future contribution to this scholarship.' },
  { id: 'statement-of-purpose', kind: 'purpose', title: 'Statement of Purpose', description: 'Academic direction and program fit', category: 'Statement of Purpose', prompt: 'Explain your academic direction, program fit, and the change you intend to create.' },
  { id: 'study-plan', kind: 'study', title: 'Study Plan', description: 'Academic goals and learning pathway', category: 'Study Plan', prompt: 'Outline what you will study, why it matters, and how you will apply it after graduation.' },
  { id: 'research-plan', kind: 'research', title: 'Research Plan', description: 'Research question, methods, and expected contribution', category: 'Research Plan', prompt: 'Define the research question, method, feasibility, and expected contribution.' },
  { id: 'academic-transcript', kind: 'transcript', title: 'Academic Transcript', description: 'Official academic record and supporting notes', category: 'Transcript', prompt: 'Upload your official transcript and record any translation or certification requirements.' },
]

function normalizeChecklist(items: unknown): ChecklistItem[] {
  if (!Array.isArray(items)) return defaultChecklist.map((item) => ({ ...item }))
  return items.map((raw, index) => {
    const item = (raw || {}) as Record<string, unknown>
    const status: ChecklistStatus = item.status === 'in_progress' || item.status === 'done'
      ? item.status
      : item.completed === true ? 'done' : 'pending'
    const fallback = defaultChecklist[index]
    return {
      id: String(item.id || fallback?.id || `task-${index + 1}`),
      title: String(item.title || fallback?.title || 'Untitled task'),
      description: String(item.description || item.notes || fallback?.description || ''),
      category: String(item.category || fallback?.category || 'Other'),
      required: item.required !== false,
      status,
      notes: String(item.notes || ''),
    }
  })
}

const savedIds = ref<string[]>(read('minerva-saved', []))
const selectedId = ref<string | null>(read('minerva-selected', null))
const legacyChecklist = normalizeChecklist(read('minerva-checklist', defaultChecklist))
const storedChecklists = read<Record<string, unknown>>('minerva-checklists', {})
const checklistsByScholarship = ref<Record<string, ChecklistItem[]>>(Object.fromEntries(Object.entries(storedChecklists).map(([id, items]) => [id, normalizeChecklist(items)])))
if (selectedId.value && !checklistsByScholarship.value[selectedId.value]) checklistsByScholarship.value[selectedId.value] = legacyChecklist
const scholarshipNotes = ref<Record<string, string>>(read('minerva-scholarship-notes', {}))

const legacyDrafts = read<Record<string, Record<string, string>>>('minerva-document-drafts', {})
const legacyUploads = read<Record<string, Record<string, string>>>('minerva-document-uploads', {})
const documentsByScholarship = ref<Record<string, ScholarshipDocument[]>>(read('minerva-documents', {}))

function createDocuments(scholarshipId: string): ScholarshipDocument[] {
  const now = new Date().toISOString()
  return documentBlueprints.map((blueprint) => {
    const content = legacyDrafts[scholarshipId]?.[blueprint.kind] || ''
    const uploadName = legacyUploads[scholarshipId]?.[blueprint.kind] || ''
    return { ...blueprint, content, uploadName, status: uploadName ? 'ready' : content ? 'draft' : 'missing', updatedAt: now, versions: [] }
  })
}

function ensureChecklist(scholarshipId: string) {
  if (!checklistsByScholarship.value[scholarshipId]) checklistsByScholarship.value[scholarshipId] = defaultChecklist.map((item) => ({ ...item }))
  return checklistsByScholarship.value[scholarshipId]
}

function ensureDocuments(scholarshipId: string) {
  if (!documentsByScholarship.value[scholarshipId]) documentsByScholarship.value[scholarshipId] = createDocuments(scholarshipId)
  return documentsByScholarship.value[scholarshipId]
}
const checklist = computed(() => {
  const scholarshipId = selectedId.value
  if (!scholarshipId) return []
  return ensureChecklist(scholarshipId)
})
const documents = computed(() => selectedId.value ? ensureDocuments(selectedId.value) : [])
const profile = ref<UserProfile | null>(read('minerva-profile', null))
const session = ref<MockSession | null>(read('minerva-session', null))
const booking = ref<MentorBooking | null>(read('minerva-booking', null))
const legacyPracticeResult = read<PracticeResult | null>('minerva-practice', null)
const practiceByScholarship = ref<Record<string, PracticeResult>>(read('minerva-practice-by-scholarship', {}))
if (selectedId.value && legacyPracticeResult && !practiceByScholarship.value[selectedId.value]) practiceByScholarship.value[selectedId.value] = legacyPracticeResult
const practiceResult = computed<PracticeResult | null>({
  get: () => selectedId.value ? practiceByScholarship.value[selectedId.value] || null : null,
  set: (value) => { if (selectedId.value && value) practiceByScholarship.value[selectedId.value] = value },
})
persist('minerva-saved', savedIds); persist('minerva-selected', selectedId); persist('minerva-checklists', checklistsByScholarship)
persist('minerva-scholarship-notes', scholarshipNotes); persist('minerva-documents', documentsByScholarship)
persist('minerva-profile', profile); persist('minerva-session', session); persist('minerva-booking', booking); persist('minerva-practice-by-scholarship', practiceByScholarship)

const toasts = ref<{ id: number; message: string; tone: 'success' | 'info' }[]>([])
let toastId = 0
function toast(message: string, tone: 'success' | 'info' = 'success') {
  const id = ++toastId; toasts.value.push({ id, message, tone }); window.setTimeout(() => { toasts.value = toasts.value.filter((item) => item.id !== id) }, 3200)
}

export function useAppState() {
  const progress = computed(() => checklist.value.length ? Math.round((checklist.value.filter((item) => item.status === 'done').length / checklist.value.length) * 100) : 0)
  const documentProgress = computed(() => documents.value.length ? Math.round((documents.value.filter((item) => item.status === 'ready').length / documents.value.length) * 100) : 0)
  const getChecklist = (scholarshipId: string) => ensureChecklist(scholarshipId)
  const getProgress = (scholarshipId: string) => {
    const items = ensureChecklist(scholarshipId)
    return items.length ? Math.round((items.filter((item) => item.status === 'done').length / items.length) * 100) : 0
  }
  const getDocuments = (scholarshipId: string) => ensureDocuments(scholarshipId)
  const getDocument = (scholarshipId: string, documentId: string) => ensureDocuments(scholarshipId).find((item) => item.id === documentId)
  const addChecklistItem = (scholarshipId: string, item: Omit<ChecklistItem, 'id'>) => ensureChecklist(scholarshipId).push({ ...item, id: `task-${Date.now()}` })
  const deleteChecklistItem = (scholarshipId: string, itemId: string) => { checklistsByScholarship.value[scholarshipId] = ensureChecklist(scholarshipId).filter((item) => item.id !== itemId) }
  const addDocument = (scholarshipId: string, title: string, kind: DocumentKind = 'custom') => {
    const document: ScholarshipDocument = { id: `document-${Date.now()}`, kind, title, description: 'Custom scholarship document', category: 'Other', prompt: 'Tailor this document to the scholarship requirements.', content: '', uploadName: '', status: 'missing', updatedAt: new Date().toISOString(), versions: [] }
    ensureDocuments(scholarshipId).push(document)
    return document
  }
  const toggleSaved = (id: string) => {
    savedIds.value = savedIds.value.includes(id) ? savedIds.value.filter((item) => item !== id) : [...savedIds.value, id]
    toast(savedIds.value.includes(id) ? 'Scholarship saved to your shortlist.' : 'Scholarship removed from saved items.', 'info')
  }
  const selectScholarship = (id: string) => { selectedId.value = id; toast('Scholarship selected for preparation.') }
  return {
    savedIds, selectedId, checklist, checklistsByScholarship, scholarshipNotes, documents, documentsByScholarship,
    profile, session, booking, practiceResult, progress, documentProgress, toasts, toast, toggleSaved, selectScholarship,
    getChecklist, getProgress, getDocuments, getDocument, addChecklistItem, deleteChecklistItem, addDocument,
  }
}

export const useSavedScholarships = useAppState
export const useSelectedScholarship = useAppState
export const useChecklist = useAppState
export const useAuth = useAppState
export const useToast = useAppState

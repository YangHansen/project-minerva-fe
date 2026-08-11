import { computed, ref, watch } from 'vue'
import type { ChecklistItem, ChecklistStatus, DocumentKind, DocumentVersion, MentorBooking, MockSession, PracticeResult, Scholarship, ScholarshipDocument, UserProfile } from '../types'
import { apiRequest } from '../api'
import { scholarships as staticScholarships } from '../data/scholarships'

function read<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback }
}
function persist<T>(key: string, state: { value: T }) { watch(state, (value) => localStorage.setItem(key, JSON.stringify(value)), { deep: true }) }

export function normalizeUserProfile(value: unknown): UserProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const text = (key: string) => raw[key] == null ? '' : String(raw[key])
  const ageValue = Number(raw.age)
  const languageCertificates = Array.isArray(raw.languageCertificates)
    ? raw.languageCertificates
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        .map((item) => ({ type: item.type == null ? '' : String(item.type), score: item.score == null ? '' : String(item.score) }))
    : []
  return {
    name: text('name'),
    age: Number.isFinite(ageValue) && ageValue > 0 ? ageValue : null,
    country: text('country'),
    destinationCountry: text('destinationCountry'),
    currentEducationLevel: text('currentEducationLevel'),
    targetEducationLevel: text('targetEducationLevel'),
    gpa: text('gpa'),
    fieldOfStudy: text('fieldOfStudy'),
    scholarshipType: text('scholarshipType'),
    fundingPreference: text('fundingPreference'),
    englishLevel: text('englishLevel'),
    ieltsScore: text('ieltsScore'),
    languageCertificate: text('languageCertificate'),
    languageScore: text('languageScore'),
    languageCertificates,
    availableDocuments: Array.isArray(raw.availableDocuments)
      ? raw.availableDocuments.filter((item): item is string => typeof item === 'string')
      : [],
    enrollmentYear: text('enrollmentYear'),
  }
}

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
const applicationIds = ref<string[]>(read('minerva-applications', [...new Set([selectedId.value, ...savedIds.value].filter((id): id is string => Boolean(id)))]))
const backendApplicationIds = ref<Record<string, string>>({})
const backendApplicationStatuses = ref<Record<string, string>>({})
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
const profile = ref<UserProfile | null>(normalizeUserProfile(read<unknown>('minerva-profile', null)))
const session = ref<MockSession | null>(read('minerva-session', null))

const scholarshipCatalog = ref<Scholarship[]>([])
const catalogLoading = ref(false)
const catalogError = ref('')
let catalogPromise: Promise<void> | null = null
function loadScholarshipCatalog(): Promise<void> {
  if (catalogPromise) return catalogPromise
  catalogLoading.value = true
  catalogError.value = ''
  catalogPromise = (async () => {
    try {
      const result = await apiRequest<{ scholarships: Scholarship[] }>('/api/scholarships?pageSize=100')
      scholarshipCatalog.value = Array.isArray(result.scholarships) ? result.scholarships : []
    } catch (error) {
      catalogError.value = error instanceof Error ? error.message : 'Could not load the scholarship catalog.'
    } finally {
      catalogLoading.value = false
      catalogPromise = null
    }
  })()
  return catalogPromise
}
const scholarships = computed(() => {
  const byId = new Map(scholarshipCatalog.value.map((item) => [item.id, true]))
  return [...scholarshipCatalog.value, ...staticScholarships.filter((item) => !byId.has(item.id))]
})
const getScholarship = (id: string) => scholarships.value.find((item) => item.id === id)
const booking = ref<MentorBooking | null>(read('minerva-booking', null))
const tokenBalance = ref(Math.max(0, Number(read<number>('minerva-token-balance', 0)) || 0))
const legacyPracticeResult = read<PracticeResult | null>('minerva-practice', null)
const practiceByScholarship = ref<Record<string, PracticeResult>>(read('minerva-practice-by-scholarship', {}))
if (selectedId.value && legacyPracticeResult && !practiceByScholarship.value[selectedId.value]) practiceByScholarship.value[selectedId.value] = legacyPracticeResult
const practiceResult = computed<PracticeResult | null>({
  get: () => selectedId.value ? practiceByScholarship.value[selectedId.value] || null : null,
  set: (value) => { if (selectedId.value && value) practiceByScholarship.value[selectedId.value] = value },
})
const completedIeltsSimulationSets = ref<number[]>(read<number[]>('minerva-ielts-simulation-sets', []))
persist('minerva-saved', savedIds); persist('minerva-selected', selectedId); persist('minerva-applications', applicationIds); persist('minerva-checklists', checklistsByScholarship)
persist('minerva-scholarship-notes', scholarshipNotes); persist('minerva-documents', documentsByScholarship)
persist('minerva-profile', profile); persist('minerva-session', session); persist('minerva-booking', booking); persist('minerva-token-balance', tokenBalance); persist('minerva-practice-by-scholarship', practiceByScholarship)
persist('minerva-ielts-simulation-sets', completedIeltsSimulationSets)

let ieltsSyncTimer: number | null = null
let ieltsSyncInFlight = false
const syncIeltsProgress = () => {
  if (ieltsSyncTimer !== null) window.clearTimeout(ieltsSyncTimer)
  ieltsSyncTimer = window.setTimeout(async () => {
    ieltsSyncTimer = null
    if (ieltsSyncInFlight) return
    ieltsSyncInFlight = true
    try {
      await apiRequest('/api/ielts/progress', {
        method: 'PUT',
        body: {
          completedIeltsSimulationSets: completedIeltsSimulationSets.value,
          ieltsPracticeResults: Object.entries(practiceByScholarship.value).map(([scholarshipId, item]) => ({ ...item, scholarshipId })),
        },
      })
    } catch {
      // ponytail: retry on next state change; unsynced local data survives as fallback
    } finally {
      ieltsSyncInFlight = false
    }
  }, 800)
}
watch([completedIeltsSimulationSets, practiceByScholarship], syncIeltsProgress, { deep: true })

// ponytail: server is source of truth on login; on failure keep the local snapshot
const loadIeltsProgress = async () => {
  try {
    const result = await apiRequest<{ completedIeltsSimulationSets?: number[]; ieltsPracticeResults?: PracticeResult[] }>('/api/ielts/progress')
    if (Array.isArray(result.completedIeltsSimulationSets)) completedIeltsSimulationSets.value = result.completedIeltsSimulationSets
    for (const item of result.ieltsPracticeResults || []) {
      const entry = item as PracticeResult & { scholarshipId?: string }
      if (entry?.scholarshipId) practiceByScholarship.value[entry.scholarshipId] = { type: entry.type, score: entry.score, completedAt: entry.completedAt, explanation: entry.explanation }
    }
  } catch {
    // non-fatal; local values kept
  }
}

const toasts = ref<{ id: number; message: string; tone: 'success' | 'info' }[]>([])
let toastId = 0
function toast(message: string, tone: 'success' | 'info' = 'success') {
  const id = ++toastId; toasts.value.push({ id, message, tone }); window.setTimeout(() => { toasts.value = toasts.value.filter((item) => item.id !== id) }, 3200)
}

type UnknownRecord = Record<string, unknown>
const asRecord = (value: unknown): UnknownRecord => value && typeof value === 'object' ? value as UnknownRecord : {}
const remoteId = (value: UnknownRecord) => String(value.id || value._id || '')
const applicationSlug = (value: UnknownRecord) => {
  const scholarship = asRecord(value.scholarship)
  return String(scholarship.slug || scholarship.id || value.scholarshipSlug || value.scholarshipId || '')
}
const normalizeRemoteVersion = (value: unknown, index = 0): DocumentVersion => {
  const version = asRecord(value)
  return {
    id: remoteId(version) || `version-${index + 1}`,
    label: String(version.label || `Version ${index + 1}`),
    content: String(version.content || version.contentHtml || ''),
    createdAt: String(version.createdAt || new Date().toISOString()),
  }
}
const normalizeRemoteDocument = (value: unknown): ScholarshipDocument => {
  const document = asRecord(value)
  const upload = asRecord(document.upload)
  const kind = String(document.kind || 'custom') as DocumentKind
  const versions = Array.isArray(document.versions) ? document.versions.map(normalizeRemoteVersion) : []
  return {
    id: remoteId(document),
    kind,
    title: String(document.title || 'Untitled document'),
    description: String(document.description || ''),
    category: String(document.category || 'Other'),
    prompt: String(document.prompt || ''),
    content: String(document.content || document.contentHtml || ''),
    uploadName: String(upload.originalName || ''),
    status: document.status === 'ready' || document.status === 'draft' ? document.status : 'missing',
    updatedAt: String(document.updatedAt || new Date().toISOString()),
    versions,
  }
}

const workspaceHydrating = ref(false)
const workspaceError = ref('')
let workspaceGeneration = 0
let workspaceHydrationPromise: Promise<void> | null = null

class StaleWorkspaceRequest extends Error {
  constructor() {
    super('The signed-in account changed before the request completed.')
    this.name = 'StaleWorkspaceRequest'
  }
}
const assertWorkspaceGeneration = (generation: number) => {
  if (generation !== workspaceGeneration) throw new StaleWorkspaceRequest()
}

async function ensureRemoteApplication(scholarshipId: string, status: 'saved' | 'preparing' = 'preparing') {
  const generation = workspaceGeneration
  if (backendApplicationIds.value[scholarshipId]) {
    const applicationId = backendApplicationIds.value[scholarshipId]
    if (backendApplicationStatuses.value[scholarshipId] !== status) {
      await apiRequest(`/api/applications/${encodeURIComponent(applicationId)}`, { method: 'PATCH', body: { status } })
      assertWorkspaceGeneration(generation)
      backendApplicationStatuses.value[scholarshipId] = status
    }
    return applicationId
  }
  const result = await apiRequest<{ application: UnknownRecord }>('/api/applications', {
    method: 'POST',
    body: { scholarshipId, status },
  })
  assertWorkspaceGeneration(generation)
  const applicationId = remoteId(asRecord(result.application))
  if (applicationId) backendApplicationIds.value = { ...backendApplicationIds.value, [scholarshipId]: applicationId }
  backendApplicationStatuses.value = { ...backendApplicationStatuses.value, [scholarshipId]: status }
  return applicationId
}

function hydrateWorkspace(): Promise<void> {
  if (workspaceHydrationPromise) return workspaceHydrationPromise
  const generation = workspaceGeneration
  workspaceHydrating.value = true
  workspaceError.value = ''

  let task!: Promise<void>
  task = (async () => {
    try {
      const result = await apiRequest<{ applications: UnknownRecord[] }>('/api/applications')
      const applications = Array.isArray(result.applications) ? result.applications : []
      const mappings: Record<string, string> = {}
      const statuses: Record<string, string> = {}
      const notes: Record<string, string> = {}
      for (const application of applications) {
        const slug = applicationSlug(application)
        if (!slug) continue
        mappings[slug] = remoteId(application)
        statuses[slug] = String(application.status || 'preparing')
        notes[slug] = String(application.notes || '')
      }

      const preparing = Object.keys(mappings).filter((slug) => statuses[slug] !== 'saved')
      const hydrated = await Promise.all(preparing.map(async (slug) => {
        const applicationId = mappings[slug]
        const [checklistResult, documentResult] = await Promise.all([
          apiRequest<{ items: unknown[] }>(`/api/applications/${encodeURIComponent(applicationId)}/checklist`),
          apiRequest<{ documents: unknown[] }>(`/api/applications/${encodeURIComponent(applicationId)}/documents`),
        ])
        return {
          slug,
          checklist: normalizeChecklist(checklistResult.items),
          documents: (documentResult.documents || []).map(normalizeRemoteDocument),
        }
      }))

      if (generation !== workspaceGeneration) return
      backendApplicationIds.value = mappings
      backendApplicationStatuses.value = statuses
      scholarshipNotes.value = notes
      applicationIds.value = preparing
      savedIds.value = Object.keys(mappings)
      checklistsByScholarship.value = Object.fromEntries(hydrated.map((item) => [item.slug, item.checklist]))
      documentsByScholarship.value = Object.fromEntries(hydrated.map((item) => [item.slug, item.documents]))
      if (!selectedId.value || !preparing.includes(selectedId.value)) selectedId.value = preparing[0] || null
    } catch (error) {
      if (generation === workspaceGeneration) {
        workspaceError.value = error instanceof Error ? error.message : 'Unable to load your workspace.'
      }
    } finally {
      if (workspaceHydrationPromise === task) {
        workspaceHydrationPromise = null
        workspaceHydrating.value = false
      }
    }
  })()

  workspaceHydrationPromise = task
  return task
}

async function refreshWorkspace() {
  const generation = workspaceGeneration
  const pending = workspaceHydrationPromise
  if (pending) await pending
  assertWorkspaceGeneration(generation)
  await hydrateWorkspace()
}

const syncAiTokenBalance = (payload: unknown) => {
  const root = asRecord(payload)
  const data = asRecord(root.data)
  const errorPayload = asRecord(root.details)
  const errorEnvelope = asRecord(errorPayload.error)
  const errorDetails = asRecord(errorEnvelope.details)
  const candidate = root.tokenBalance ?? data.tokenBalance ?? errorDetails.tokenBalance
  const balance = Number(candidate)
  if (!Number.isFinite(balance) || balance < 0) return
  // Paid requests can finish out of order, so keep the lowest returned
  // reservation balance until the next authoritative auth refresh.
  tokenBalance.value = Math.min(tokenBalance.value, Math.floor(balance))
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
  const addChecklistItem = (scholarshipId: string, item: Omit<ChecklistItem, 'id'>) => {
    const generation = workspaceGeneration
    const temporary: ChecklistItem = { ...item, id: `task-${Date.now()}` }
    ensureChecklist(scholarshipId).push(temporary)
    void ensureRemoteApplication(scholarshipId).then(async (applicationId) => {
      assertWorkspaceGeneration(generation)
      const result = await apiRequest<{ item: UnknownRecord }>(`/api/applications/${encodeURIComponent(applicationId)}/checklist`, { method: 'POST', body: item })
      assertWorkspaceGeneration(generation)
      Object.assign(temporary, normalizeChecklist([result.item])[0])
    }).catch((error) => {
      if (!(error instanceof StaleWorkspaceRequest)) workspaceError.value = error instanceof Error ? error.message : 'Unable to save the checklist item.'
    })
  }
  const updateChecklistItem = (item: ChecklistItem) => {
    if (item.id.startsWith('task-')) return
    void apiRequest(`/api/checklist/${encodeURIComponent(item.id)}`, {
      method: 'PATCH',
      body: {
        title: item.title,
        description: item.description,
        category: item.category,
        required: item.required,
        status: item.status,
        notes: item.notes,
      },
    })
      .catch((error) => { workspaceError.value = error instanceof Error ? error.message : 'Unable to update the checklist item.' })
  }
  const deleteChecklistItem = (scholarshipId: string, itemId: string) => {
    checklistsByScholarship.value[scholarshipId] = ensureChecklist(scholarshipId).filter((item) => item.id !== itemId)
    if (!itemId.startsWith('task-')) void apiRequest(`/api/checklist/${encodeURIComponent(itemId)}`, { method: 'DELETE' })
      .catch((error) => { workspaceError.value = error instanceof Error ? error.message : 'Unable to delete the checklist item.' })
  }
  const addDocument = async (
    scholarshipId: string,
    title: string,
    kind: DocumentKind = 'custom',
    details: Partial<Pick<ScholarshipDocument, 'description' | 'category' | 'prompt'>> = {},
  ) => {
    const generation = workspaceGeneration
    try {
      const applicationId = await ensureRemoteApplication(scholarshipId)
      assertWorkspaceGeneration(generation)
      const draft = {
        kind,
        title,
        description: details.description || 'Custom scholarship document',
        category: details.category || 'Other',
        prompt: details.prompt || 'Tailor this document to the scholarship requirements.',
        content: '',
        status: 'missing' as const,
      }
      const result = await apiRequest<{ document: unknown }>(`/api/applications/${encodeURIComponent(applicationId)}/documents`, {
        method: 'POST',
        body: draft,
      })
      assertWorkspaceGeneration(generation)
      const document = normalizeRemoteDocument(result.document)
      ensureDocuments(scholarshipId).push(document)
      return document
    } catch (error) {
      if (!(error instanceof StaleWorkspaceRequest)) {
        workspaceError.value = error instanceof Error ? error.message : 'Unable to create the document.'
      }
      throw error
    }
  }
  const saveDocument = async (document: ScholarshipDocument) => {
    if (document.id.startsWith('document-')) return
    await apiRequest(`/api/documents/${encodeURIComponent(document.id)}`, {
      method: 'PATCH',
      body: { title: document.title, content: document.content, status: document.status, prompt: document.prompt },
    })
  }
  const deleteDocument = async (document: ScholarshipDocument) => {
    const generation = workspaceGeneration
    if (!document.id.startsWith('document-')) {
      await apiRequest(`/api/documents/${encodeURIComponent(document.id)}`, { method: 'DELETE' })
    }
    assertWorkspaceGeneration(generation)
    for (const scholarshipId of Object.keys(documentsByScholarship.value)) {
      documentsByScholarship.value[scholarshipId] = ensureDocuments(scholarshipId)
        .filter((item) => item.id !== document.id)
    }
  }
  const createDocumentVersion = async (
    document: ScholarshipDocument,
    label?: string,
    source: 'manual' | 'autosave' | 'review' = 'manual',
  ) => {
    if (document.id.startsWith('document-')) throw new Error('This document is still being created. Try again in a moment.')
    await saveDocument(document)
    const result = await apiRequest<{ version: unknown }>(`/api/documents/${encodeURIComponent(document.id)}/versions`, {
      method: 'POST',
      body: { ...(label ? { label } : {}), source },
    })
    const version = normalizeRemoteVersion(result.version, document.versions.length)
    document.versions = [version, ...document.versions.filter((item) => item.id !== version.id)]
    return version
  }
  const restoreDocumentVersion = async (document: ScholarshipDocument, versionId: string) => {
    if (document.id.startsWith('document-')) throw new Error('This document is still being created. Try again in a moment.')
    const result = await apiRequest<{ document: unknown }>(
      `/api/documents/${encodeURIComponent(document.id)}/versions/${encodeURIComponent(versionId)}/restore`,
      { method: 'POST', body: {} },
    )
    Object.assign(document, normalizeRemoteDocument(result.document))
    return document
  }
  const saveScholarshipNotes = (scholarshipId: string, notes: string) => {
    scholarshipNotes.value[scholarshipId] = notes
    const applicationId = backendApplicationIds.value[scholarshipId]
    if (applicationId) void apiRequest(`/api/applications/${encodeURIComponent(applicationId)}`, { method: 'PATCH', body: { notes } })
      .catch((error) => { workspaceError.value = error instanceof Error ? error.message : 'Unable to save application notes.' })
  }

  const resetUserState = () => {
    workspaceGeneration += 1
    workspaceHydrationPromise = null
    workspaceHydrating.value = false
    savedIds.value = []
    selectedId.value = null
    applicationIds.value = []
    backendApplicationIds.value = {}
    backendApplicationStatuses.value = {}
    checklistsByScholarship.value = {}
    scholarshipNotes.value = {}
    documentsByScholarship.value = {}
    profile.value = null
    session.value = null
    scholarshipCatalog.value = []
    catalogError.value = ''
    catalogLoading.value = false
    catalogPromise = null
    booking.value = null
    tokenBalance.value = 0
    practiceByScholarship.value = {}
    completedIeltsSimulationSets.value = []
    workspaceError.value = ''
    for (const key of [
      'minerva-saved', 'minerva-selected', 'minerva-applications', 'minerva-checklists',
      'minerva-scholarship-notes', 'minerva-documents', 'minerva-profile', 'minerva-session',
      'minerva-booking', 'minerva-token-balance', 'minerva-practice-by-scholarship',
      'minerva-onboarding-draft', 'minerva-onboarding-step', 'minerva-ielts-simulation-sets',
      'minerva-checklist', 'minerva-document-drafts', 'minerva-document-uploads', 'minerva-practice',
    ]) localStorage.removeItem(key)
  }
  const addTokens = (amount: number) => {
    tokenBalance.value += Math.max(0, amount)
    toast(`${amount} tokens were added to your account.`)
  }
  const toggleSaved = (id: string) => {
    const adding = !savedIds.value.includes(id)
    const status = backendApplicationStatuses.value[id]
    if (!adding && status && status !== 'saved') {
      toast('This scholarship has an active application. Remove its folder from My Scholarships first.', 'info')
      return
    }

    const generation = workspaceGeneration
    savedIds.value = adding ? [...savedIds.value, id] : savedIds.value.filter((item) => item !== id)
    if (adding) {
      void ensureRemoteApplication(id, status === 'preparing' ? 'preparing' : 'saved').catch((error) => {
        if (generation !== workspaceGeneration || error instanceof StaleWorkspaceRequest) return
        savedIds.value = savedIds.value.filter((item) => item !== id)
        workspaceError.value = error instanceof Error ? error.message : 'Unable to save the scholarship.'
      })
    } else {
      const applicationId = backendApplicationIds.value[id]
      if (applicationId) {
        void apiRequest(`/api/applications/${encodeURIComponent(applicationId)}`, { method: 'DELETE' })
          .then(() => {
            if (generation !== workspaceGeneration) return
            const nextIds = { ...backendApplicationIds.value }
            const nextStatuses = { ...backendApplicationStatuses.value }
            delete nextIds[id]
            delete nextStatuses[id]
            backendApplicationIds.value = nextIds
            backendApplicationStatuses.value = nextStatuses
          })
          .catch((error) => {
            if (generation !== workspaceGeneration) return
            if (!savedIds.value.includes(id)) savedIds.value = [...savedIds.value, id]
            workspaceError.value = error instanceof Error ? error.message : 'Unable to remove the saved scholarship.'
          })
      }
    }
    toast(adding ? 'Scholarship saved to your shortlist.' : 'Scholarship removed from saved items.', 'info')
  }
  const startApplication = (id: string) => {
    if (!applicationIds.value.includes(id)) applicationIds.value = [...applicationIds.value, id]
    selectedId.value = id
    ensureChecklist(id)
    ensureDocuments(id)
    void ensureRemoteApplication(id, 'preparing').then(() => refreshWorkspace())
      .catch((error) => { workspaceError.value = error instanceof Error ? error.message : 'Unable to create the application workspace.' })
    toast('Scholarship application folder created.')
  }
  const removeApplication = (id: string) => {
    const generation = workspaceGeneration
    applicationIds.value = applicationIds.value.filter((item) => item !== id)
    savedIds.value = savedIds.value.filter((item) => item !== id)
    delete checklistsByScholarship.value[id]
    delete documentsByScholarship.value[id]
    delete scholarshipNotes.value[id]
    delete practiceByScholarship.value[id]
    if (selectedId.value === id) selectedId.value = applicationIds.value[0] || null
    const applicationId = backendApplicationIds.value[id]
    if (applicationId) void apiRequest(`/api/applications/${encodeURIComponent(applicationId)}`, { method: 'DELETE' })
      .catch((error) => {
        if (generation !== workspaceGeneration) return
        workspaceError.value = error instanceof Error ? error.message : 'Unable to remove the application.'
      })
    delete backendApplicationIds.value[id]
    delete backendApplicationStatuses.value[id]
    toast('Scholarship removed from My Scholarships.', 'info')
  }
  const selectScholarship = (id: string) => { selectedId.value = id; toast('Scholarship selected for preparation.') }
  return {
    savedIds, applicationIds, selectedId, checklist, checklistsByScholarship, scholarshipNotes, documents, documentsByScholarship,
    backendApplicationIds, workspaceHydrating, workspaceError, hydrateWorkspace,
    profile, session, booking, tokenBalance, practiceResult, progress, documentProgress, toasts, toast, syncAiTokenBalance, resetUserState, toggleSaved, startApplication, removeApplication, selectScholarship,
    scholarships, getScholarship, loadScholarshipCatalog, catalogLoading, catalogError,
    completedIeltsSimulationSets, loadIeltsProgress,
    getChecklist, getProgress, getDocuments, getDocument, addChecklistItem, updateChecklistItem, deleteChecklistItem, addDocument, saveDocument, deleteDocument, createDocumentVersion, restoreDocumentVersion, saveScholarshipNotes, addTokens,
  }
}

export const useSavedScholarships = useAppState
export const useSelectedScholarship = useAppState
export const useChecklist = useAppState
export const useAuth = useAppState
export const useToast = useAppState

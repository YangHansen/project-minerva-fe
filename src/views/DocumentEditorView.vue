<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, AlignLeft, ArrowLeft, ArrowRight, Bold, Check, ChevronDown, Download, Edit3, Eraser, Highlighter, History, Italic, Link2, List, ListOrdered, LoaderCircle, MessageSquare, Plus, Redo2, Sparkles, Strikethrough, Trash2, Underline, Undo2 } from 'lucide-vue-next'
import type { DocumentReview, DocumentSuggestion } from '../types'
import { ApiError, apiRequest } from '../api'
import { chooseRewriteCandidate } from '../lib/documentRewrite'
import { decideHighlightAction, preferEditorSelection } from '../lib/documentHighlight'
import { exportAsDocx, exportAsPdf } from '../lib/documentExport'
import { useAppState } from '../composables/useAppState'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'

type UnknownRecord = Record<string, unknown>

const route = useRoute()
const router = useRouter()
const { selectedId, documentsByScholarship, hydrateWorkspace, saveDocument, createDocumentVersion, restoreDocumentVersion, syncAiTokenBalance, toast, getScholarship } = useAppState()
const documentLocation = computed(() => {
  const documentId = String(route.params.documentId || '')
  for (const [scholarshipId, records] of Object.entries(documentsByScholarship.value)) {
    const document = records.find((item) => item.id === documentId)
    if (document) return { scholarshipId, document }
  }
  return undefined
})
const selected = computed(() => getScholarship(documentLocation.value?.scholarshipId || selectedId.value || ''))
const documentRecord = computed(() => documentLocation.value?.document)
const editor = ref<HTMLElement | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)
const editTitle = async () => {
  await nextTick()
  titleInput.value?.focus()
  titleInput.value?.select()
}
const returnToDocuments = async () => {
  const document = documentRecord.value
  if (document) {
    syncEditor()
    window.clearTimeout(saveTimer)
    document.status = document.content.replace(/<[^>]+>/g, '').trim() ? 'ready' : 'missing'
    document.updatedAt = new Date().toISOString()
    await saveDocument(document).catch(() => undefined)
  }
  await router.push('/documents')
}
const activePageId = ref('')
const documentPages = computed(() => documentRecord.value?.pages || [])
const activePage = computed(() => documentPages.value.find((page) => page.id === activePageId.value) || documentPages.value[0])
const hasActiveHighlights = computed(() => (activePage.value?.content || '').includes('<mark'))
type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple'
const highlightColor = ref<HighlightColor>('yellow')
const highlightColorHex = computed(() => ({
  yellow: '#d9a800',
  green: '#22a06b',
  blue: '#3182ce',
  pink: '#db4b8c',
  purple: '#7c5cff',
})[highlightColor.value])
const pagePreview = (content: string) => content.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || 'Blank page'
const pageTabLabel = (content: string, index: number) => {
  const heading = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(content)?.[1]
  return (heading ? pagePreview(heading) : '').slice(0, 34) || `Tab ${index + 1}`
}
const paperZoom = ref(1)
const fontFamily = ref('Calibri')
const paperZoomPercent = computed(() => Math.round(paperZoom.value * 100))
const onPaperWheel = (event: WheelEvent) => {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  paperZoom.value = Math.min(1.25, Math.max(0.65, Math.round((paperZoom.value + (event.deltaY < 0 ? 0.05 : -0.05)) * 100) / 100))
}
const ensurePages = () => {
  const doc = documentRecord.value
  if (!doc) return
  if (!doc.pages?.length) doc.pages = [{ id: 'page-1', title: 'Page 1', content: doc.content || '' }]
  if (!activePageId.value || !doc.pages.some((page) => page.id === activePageId.value)) activePageId.value = doc.pages[0].id
}
const loadActivePage = async () => {
  ensurePages()
  await nextTick()
  if (editor.value) editor.value.innerHTML = activePage.value?.content || '<p>Start writing on this page.</p>'
}
const selectPage = async (pageId: string) => {
  syncEditor()
  activePageId.value = pageId
  await loadActivePage()
}
const addPage = async () => {
  const doc = documentRecord.value
  if (!doc) return
  syncEditor()
  const number = doc.pages.length + 1
  const page = { id: `page-${crypto.randomUUID()}`, title: `Page ${number}`, content: '' }
  doc.pages.push(page)
  activePageId.value = page.id
  doc.updatedAt = new Date().toISOString()
  await loadActivePage()
  syncEditor()
}
const autosaveState = ref('All changes saved')
const selectedVersion = ref('current')
const expandedSuggestion = ref<string | null>(null)
const previewSuggestion = ref<string | null>(null)
const aiPrompt = ref('')
const aiPanel = ref<'consultation' | 'proofreader'>('consultation')
const expandedReviewSummary = ref(false)
const reviewLoading = ref(false)
const aiBusyKind = ref<'review' | 'refine' | 'consult' | ''>('')
const reviewError = ref('')
const versionSaving = ref(false)
const suggestionSaving = ref('')
const exportMenuOpen = ref(false)
const exporting = ref<'docx' | 'pdf' | ''>('')
type ConsultMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  intent?: 'advise' | 'refine'
  refineInstruction?: string
  applied?: number
  skipped?: number
}
type ConsultSession = {
  id: string
  title: string
  updatedAt: string
  messages: ConsultMessage[]
  pendingRefineInstruction: string
}

const consultMessages = ref<ConsultMessage[]>([])
const pendingRefineInstruction = ref('')
const consultSessions = ref<ConsultSession[]>([])
const activeConsultId = ref('')
const consultHistoryOpen = ref(false)
let rewriteMarkerSequence = 0
let savedEditorRange: Range | null = null
let saveTimer = 0
let consultMessageId = 0
let consultSessionSequence = 0

const consultStorageKey = (documentId: string) => `minerva-consult:${documentId}`

const pendingFromHistory = (messages: ConsultMessage[]) => {
  const last = [...messages].reverse().find((entry) => entry.role === 'assistant' && entry.refineInstruction)
  if (!last || last.applied != null || last.intent === 'refine') return ''
  return last.refineInstruction || ''
}

const parseConsultMessage = (item: unknown, index: number): ConsultMessage | null => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null
  const entry = item as Record<string, unknown>
  const role = entry.role === 'assistant' ? 'assistant' as const : entry.role === 'user' ? 'user' as const : null
  const text = entry.text == null ? '' : String(entry.text).trim()
  if (!role || !text) return null
  return {
    id: entry.id == null ? `consult-restored-${index + 1}` : String(entry.id),
    role,
    text,
    intent: entry.intent === 'refine' ? 'refine' as const : entry.intent === 'advise' ? 'advise' as const : undefined,
    refineInstruction: entry.refineInstruction == null ? undefined : String(entry.refineInstruction),
    applied: typeof entry.applied === 'number' ? entry.applied : undefined,
    skipped: typeof entry.skipped === 'number' ? entry.skipped : undefined,
  }
}

const sessionTitleFromMessages = (messages: ConsultMessage[]) => {
  const firstUser = messages.find((entry) => entry.role === 'user')
  return (firstUser?.text || 'New consultation').replace(/\s+/g, ' ').trim().slice(0, 56)
}

const syncMessageCounter = (messages: ConsultMessage[]) => {
  const maxId = messages.reduce((max, entry) => {
    const match = /^consult-(\d+)$/.exec(entry.id)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  consultMessageId = Math.max(consultMessageId, maxId)
}

const createEmptyConsultSession = (): ConsultSession => {
  consultSessionSequence += 1
  return {
    id: `session-${Date.now()}-${consultSessionSequence}`,
    title: 'New consultation',
    updatedAt: new Date().toISOString(),
    messages: [],
    pendingRefineInstruction: '',
  }
}

const loadConsultStore = (documentId: string) => {
  try {
    const raw = localStorage.getItem(consultStorageKey(documentId))
    if (!raw) {
      const session = createEmptyConsultSession()
      consultSessions.value = [session]
      activeConsultId.value = session.id
      consultMessages.value = []
      pendingRefineInstruction.value = ''
      return
    }
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      const messages = parsed
        .map((item, index) => parseConsultMessage(item, index))
        .filter((entry): entry is ConsultMessage => Boolean(entry))
        .slice(-60)
      const session = {
        ...createEmptyConsultSession(),
        title: sessionTitleFromMessages(messages) || 'Consultation',
        messages,
        pendingRefineInstruction: pendingFromHistory(messages),
      }
      consultSessions.value = [session]
      activeConsultId.value = session.id
      consultMessages.value = messages
      pendingRefineInstruction.value = session.pendingRefineInstruction
      syncMessageCounter(messages)
      return
    }
    if (!parsed || typeof parsed !== 'object') throw new Error('invalid consult store')
    const root = parsed as Record<string, unknown>
    const sessionsRaw = Array.isArray(root.sessions) ? root.sessions : []
    const sessions = sessionsRaw
      .map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null
        const entry = item as Record<string, unknown>
        const messages = (Array.isArray(entry.messages) ? entry.messages : [])
          .map((message, messageIndex) => parseConsultMessage(message, messageIndex))
          .filter((message): message is ConsultMessage => Boolean(message))
          .slice(-60)
        const id = entry.id == null ? `session-restored-${index + 1}` : String(entry.id)
        return {
          id,
          title: entry.title == null ? sessionTitleFromMessages(messages) || 'Consultation' : String(entry.title),
          updatedAt: entry.updatedAt == null ? new Date().toISOString() : String(entry.updatedAt),
          messages,
          pendingRefineInstruction: entry.pendingRefineInstruction == null
            ? pendingFromHistory(messages)
            : String(entry.pendingRefineInstruction),
        } satisfies ConsultSession
      })
      .filter((entry): entry is ConsultSession => Boolean(entry))
      .slice(0, 20)

    if (!sessions.length) {
      const session = createEmptyConsultSession()
      consultSessions.value = [session]
      activeConsultId.value = session.id
      consultMessages.value = []
      pendingRefineInstruction.value = ''
      return
    }

    const requestedId = root.activeId == null ? '' : String(root.activeId)
    const active = sessions.find((session) => session.id === requestedId) || sessions[0]
    consultSessions.value = sessions
    activeConsultId.value = active.id
    consultMessages.value = active.messages
    pendingRefineInstruction.value = active.pendingRefineInstruction
    syncMessageCounter(sessions.flatMap((session) => session.messages))
  } catch {
    const session = createEmptyConsultSession()
    consultSessions.value = [session]
    activeConsultId.value = session.id
    consultMessages.value = []
    pendingRefineInstruction.value = ''
  }
}

const persistConsultHistory = () => {
  const documentId = documentRecord.value?.id
  if (!documentId || !activeConsultId.value) return
  const currentIndex = consultSessions.value.findIndex((session) => session.id === activeConsultId.value)
  if (currentIndex < 0) return
  const current = consultSessions.value[currentIndex]
  const nextCurrent: ConsultSession = {
    ...current,
    title: consultMessages.value.length ? sessionTitleFromMessages(consultMessages.value) : current.title || 'New consultation',
    updatedAt: new Date().toISOString(),
    messages: consultMessages.value.slice(-60),
    pendingRefineInstruction: pendingRefineInstruction.value,
  }
  const sessions = [...consultSessions.value]
  sessions[currentIndex] = nextCurrent
  consultSessions.value = sessions
  try {
    localStorage.setItem(consultStorageKey(documentId), JSON.stringify({
      activeId: activeConsultId.value,
      sessions: sessions.slice(0, 20),
    }))
  } catch {
    // Ignore quota / private-mode failures.
  }
}

const openConsultSession = (sessionId: string) => {
  if (reviewLoading.value || sessionId === activeConsultId.value) {
    consultHistoryOpen.value = false
    return
  }
  persistConsultHistory()
  const session = consultSessions.value.find((entry) => entry.id === sessionId)
  if (!session) return
  activeConsultId.value = session.id
  consultMessages.value = [...session.messages]
  pendingRefineInstruction.value = session.pendingRefineInstruction
  reviewError.value = ''
  consultHistoryOpen.value = false
  syncMessageCounter(session.messages)
}

const startNewConsult = () => {
  if (reviewLoading.value) return
  persistConsultHistory()
  const current = consultSessions.value.find((session) => session.id === activeConsultId.value)
  if (current && !current.messages.length && !consultMessages.value.length) {
    consultHistoryOpen.value = false
    toast('Already in a new consultation.', 'info')
    return
  }
  const session = createEmptyConsultSession()
  consultSessions.value = [session, ...consultSessions.value].slice(0, 20)
  activeConsultId.value = session.id
  consultMessages.value = []
  pendingRefineInstruction.value = ''
  reviewError.value = ''
  consultHistoryOpen.value = false
  persistConsultHistory()
  toast('Started a new consultation.', 'info')
}

const deleteConsultSession = (sessionId: string) => {
  if (reviewLoading.value) return
  const remaining = consultSessions.value.filter((session) => session.id !== sessionId)
  if (!remaining.length) {
    const session = createEmptyConsultSession()
    consultSessions.value = [session]
    activeConsultId.value = session.id
    consultMessages.value = []
    pendingRefineInstruction.value = ''
    reviewError.value = ''
    consultHistoryOpen.value = false
    persistConsultHistory()
    toast('Consultation history deleted.', 'info')
    return
  }
  consultSessions.value = remaining
  if (activeConsultId.value === sessionId) {
    const next = remaining[0]
    activeConsultId.value = next.id
    consultMessages.value = [...next.messages]
    pendingRefineInstruction.value = next.pendingRefineInstruction
    reviewError.value = ''
  }
  persistConsultHistory()
  toast('Consultation deleted.', 'info')
}

const toggleConsultHistory = () => {
  if (reviewLoading.value) return
  persistConsultHistory()
  consultHistoryOpen.value = !consultHistoryOpen.value
}

watch(() => documentRecord.value?.id, (documentId) => {
  consultHistoryOpen.value = false
  if (!documentId) {
    consultSessions.value = []
    activeConsultId.value = ''
    consultMessages.value = []
    pendingRefineInstruction.value = ''
    return
  }
  loadConsultStore(documentId)
}, { immediate: true })

watch([consultMessages, pendingRefineInstruction], () => {
  persistConsultHistory()
}, { deep: true })

const plainText = computed(() => documentRecord.value?.content.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || '')
const wordCount = computed(() => plainText.value ? plainText.value.split(/\s+/).length : 0)
const target = computed(() => documentRecord.value?.kind === 'cv' || documentRecord.value?.kind === 'transcript' ? 'Concise and relevant' : documentRecord.value?.kind === 'essay' ? '500-650' : '400-700')
const readability = computed(() => wordCount.value < 80 ? 'Developing' : wordCount.value > 800 ? 'Dense' : 'Good')
const modifiedLabel = computed(() => {
  if (!documentRecord.value) return ''
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(documentRecord.value.updatedAt).getTime()) / 60000))
  return minutes < 2 ? 'Last edited just now' : minutes < 60 ? `Last edited ${minutes} minutes ago` : `Last edited ${Math.floor(minutes / 60)} hours ago`
})

const fingerprint = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${value.length}:${(hash >>> 0).toString(16)}`
}

const canonicalReviewText = (value: string) => value
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ')
  .trim()
const sha256Text = async (value: string) => {
  if (!crypto.subtle) return ''
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const reviewOutdated = computed(() => {
  const review = documentRecord.value?.review
  return Boolean(review?.sourceFingerprint && documentRecord.value && review.sourceFingerprint !== fingerprint(documentRecord.value.content))
})

const asRecord = (value: unknown): UnknownRecord | null => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null
)

const textValue = (...values: unknown[]) => {
  const value = values.find((item) => typeof item === 'string' && item.trim())
  return typeof value === 'string' ? value : ''
}

const scoreValue = (value: unknown, fallback = 0) => {
  const score = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(score)) return fallback
  return Math.max(0, Math.min(100, Math.round(score)))
}

const reviewRecord = (payload: unknown) => {
  const raw = asRecord(payload)
  if (!raw) return null
  const review = asRecord(raw.review)
  if (review) return review
  const data = asRecord(raw.data)
  return data ? asRecord(data.review) || data : raw
}

const normalizeReview = (payload: unknown, sourceContent: string): DocumentReview | null => {
  const raw = reviewRecord(payload)
  if (!raw) return null
  const scores = asRecord(raw.scores) || asRecord(raw.metrics) || raw
  const tones: DocumentSuggestion['tone'][] = ['purple', 'yellow', 'blue', 'green']
  const suggestions = (Array.isArray(raw.suggestions) ? raw.suggestions : [])
    .map((value, index): DocumentSuggestion | null => {
      const suggestion = asRecord(value)
      if (!suggestion) return null
      const detail = textValue(suggestion.detail, suggestion.explanation, suggestion.feedback)
      const replacement = textValue(suggestion.replacement, suggestion.replacementText, suggestion.suggestedText, suggestion.rewrite)
      const title = textValue(suggestion.title, suggestion.category) || `Suggestion ${index + 1}`
      if (!detail && !replacement) return null
      const priority = suggestion.priority === 'high' || suggestion.priority === 'low' ? suggestion.priority : 'medium'
      const tone = suggestion.tone === 'purple' || suggestion.tone === 'yellow' || suggestion.tone === 'blue' || suggestion.tone === 'green'
        ? suggestion.tone
        : tones[index % tones.length]
      return {
        id: textValue(suggestion.id, suggestion._id) || `suggestion-${index + 1}`,
        title,
        detail: detail || 'Review this section and consider the suggested rewrite.',
        replacement,
        originalText: textValue(suggestion.originalText, suggestion.original, suggestion.currentText) || undefined,
        category: textValue(suggestion.category) || undefined,
        priority,
        tone,
        dismissed: suggestion.dismissed === true,
        accepted: suggestion.accepted === true,
      }
    })
    .filter((suggestion): suggestion is DocumentSuggestion => Boolean(suggestion))

  const clarity = scoreValue(scores.clarity)
  const grammar = scoreValue(scores.grammar)
  const structure = scoreValue(scores.structure)
  const impact = scoreValue(scores.impact)
  const calculatedOverall = Math.round((clarity + grammar + structure + impact) / 4)
  return {
    id: textValue(raw.id, raw._id) || undefined,
    overall: scoreValue(raw.overall ?? scores.overall, calculatedOverall),
    clarity,
    grammar,
    structure,
    impact,
    scholarshipAlignment: scoreValue(raw.scholarshipAlignment ?? scores.scholarshipAlignment),
    summary: textValue(raw.summary, raw.feedback) || 'Review complete. Work through the suggestions below to strengthen your draft.',
    strengths: Array.isArray(raw.strengths) ? raw.strengths.filter((item): item is string => typeof item === 'string') : [],
    suggestions,
    reviewedAt: textValue(raw.reviewedAt, raw.createdAt) || new Date().toISOString(),
    sourceFingerprint: fingerprint(sourceContent),
  }
}

const reviewMessage = (caught: unknown) => {
  if (caught instanceof ApiError) return caught.message
  if (caught instanceof Error && caught.message === 'Invalid document review response') {
    return 'Minerva completed the review, but its response could not be displayed. Please try again.'
  }
  return caught instanceof Error && caught.message
    ? caught.message
    : 'The AI request could not be completed. Please try again.'
}

const runReview = async (focus = '') => {
  const doc = documentRecord.value
  if (!doc || reviewLoading.value) return
  if (wordCount.value < 5) {
    reviewError.value = 'Add a little more content before requesting an AI review.'
    return
  }

  syncEditor()
  const sourceContent = doc.pages?.length
    ? doc.pages.map((page) => page.content).join('<p><br></p>')
    : doc.content
  doc.content = sourceContent
  reviewLoading.value = true
  aiBusyKind.value = 'review'
  aiPanel.value = 'proofreader'
  reviewError.value = ''
  previewSuggestion.value = null

  try {
    const payload = await apiRequest<unknown>(`/api/documents/${encodeURIComponent(doc.id)}/reviews`, {
      method: 'POST',
      body: {
        content: sourceContent,
        title: doc.title,
        prompt: doc.prompt,
        ...(selectedId.value ? { scholarshipId: selectedId.value } : {}),
        ...(focus.trim() ? { focus: focus.trim() } : {}),
      },
    })
    syncAiTokenBalance(payload)
    const review = normalizeReview(payload, sourceContent)
    if (!review) throw new Error('Invalid document review response')
    doc.review = review
    expandedReviewSummary.value = false
    expandedSuggestion.value = review.suggestions[0]?.id || null
    aiPrompt.value = ''
    toast(focus ? 'Focused AI review completed.' : 'AI review completed.')
  } catch (caught) {
    syncAiTokenBalance(caught)
    // A review can be saved even when the browser loses or cannot normalize
    // the POST response. Recover that result instead of reporting a false
    // provider failure.
    const recovered = !(caught instanceof ApiError) && await loadLatestReview(false)
    if (recovered) {
      aiPrompt.value = ''
      toast(focus ? 'Focused AI review completed.' : 'AI review completed.')
    } else {
      reviewError.value = reviewMessage(caught)
    }
  } finally {
    reviewLoading.value = false
    aiBusyKind.value = ''
  }
}

const loadLatestReview = async (surfaceError = true): Promise<boolean> => {
  const doc = documentRecord.value
  if (!doc || doc.id.startsWith('document-')) return false
  try {
    const payload = await apiRequest<unknown>(`/api/documents/${encodeURIComponent(doc.id)}/reviews`)
    const root = asRecord(payload)
    const reviews = root && Array.isArray(root.reviews) ? root.reviews : []
    const rawReview = reviews[0]
    const review = rawReview ? normalizeReview(rawReview, doc.content) : null
    if (review) {
      const reviewedHash = textValue(asRecord(rawReview)?.reviewedContentHash)
      const currentHash = await sha256Text(canonicalReviewText(doc.content))
      review.sourceFingerprint = reviewedHash && currentHash && reviewedHash === currentHash
        ? fingerprint(doc.content)
        : `stale:${reviewedHash || 'unknown'}`
      doc.review = review
      expandedReviewSummary.value = false
      expandedSuggestion.value = review.suggestions[0]?.id || null
      reviewError.value = ''
      return true
    }
    return false
  } catch (caught) {
    if (surfaceError) reviewError.value = reviewMessage(caught)
    return false
  }
}

const syncEditor = () => {
  const doc = documentRecord.value
  if (!doc || !editor.value) return
  ensurePages()
  const page = activePage.value
  if (!page) return
  page.content = editor.value.innerHTML
  doc.content = doc.pages.map((item) => item.content).join('<p><br></p>')
  doc.status = doc.content.replace(/<[^>]+>/g, '').trim() ? 'draft' : 'missing'
  doc.updatedAt = new Date().toISOString()
  autosaveState.value = 'Saving...'
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(async () => {
    try {
      await saveDocument(doc)
      autosaveState.value = 'All changes saved'
    } catch {
      autosaveState.value = 'Save failed - retry on the next edit'
    }
  }, 650)
}

const restoreEditorSelection = () => {
  const root = editor.value
  if (!root) return
  const range = editorSelectionRange()
  root.focus()
  if (!range) return
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}
const preserveToolbarSelection = (event: MouseEvent) => {
  if ((event.target as Element).closest('button')) event.preventDefault()
}
const command = (name: string, value?: string) => {
  restoreEditorSelection()
  document.execCommand(name, false, value)
  rememberEditorSelection()
  syncEditor()
}
const chooseBlock = (event: Event) => command('formatBlock', (event.target as HTMLSelectElement).value)
const chooseFont = (event: Event) => command('fontName', (event.target as HTMLSelectElement).value)
const addLink = () => { const url = window.prompt('Paste a link'); if (url) command('createLink', url) }

const createVersion = async () => {
  const doc = documentRecord.value
  if (!doc || versionSaving.value) return
  syncEditor()
  window.clearTimeout(saveTimer)
  versionSaving.value = true
  autosaveState.value = 'Saving...'
  try {
    const version = await createDocumentVersion(doc, undefined, 'manual')
    autosaveState.value = 'All changes saved'
    toast(`${version.label} created.`)
  } catch (caught) {
    autosaveState.value = 'Save failed - retry on the next edit'
    reviewError.value = reviewMessage(caught)
  } finally {
    versionSaving.value = false
  }
}

const restoreVersion = async () => {
  const doc = documentRecord.value
  if (!doc || selectedVersion.value === 'current' || versionSaving.value) return
  const version = doc.versions.find((item) => item.id === selectedVersion.value)
  if (!version || !window.confirm(`Restore ${version.label}? Your current draft will remain available as a new version.`)) return
  versionSaving.value = true
  autosaveState.value = 'Saving...'
  try {
    await restoreDocumentVersion(doc, version.id)
    await nextTick()
    await loadActivePage()
    selectedVersion.value = 'current'
    autosaveState.value = 'All changes saved'
    toast(`${version.label} restored.`)
  } catch (caught) {
    selectedVersion.value = 'current'
    autosaveState.value = 'Restore failed'
    reviewError.value = reviewMessage(caught)
  } finally {
    versionSaving.value = false
  }
}

const exportDocument = async (format: 'docx' | 'pdf') => {
  const doc = documentRecord.value
  if (!doc || exporting.value) return
  syncEditor()
  exportMenuOpen.value = false
  exporting.value = format
  try {
    const source = {
      title: doc.title,
      pages: doc.pages.map((page) => ({ title: page.title, content: page.content })),
    }
    if (format === 'docx') await exportAsDocx(source)
    else await exportAsPdf(source)
    toast(`${format.toUpperCase()} downloaded.`)
  } catch (caught) {
    console.error('Document export failed', caught)
    toast(`The ${format.toUpperCase()} export could not be created. Please try again.`, 'info')
  } finally {
    exporting.value = ''
  }
}

const saveReady = () => {
  const document = documentRecord.value
  if (!document) return
  syncEditor()
  window.clearTimeout(saveTimer)
  document.status = document.content.replace(/<[^>]+>/g, '').trim() ? 'ready' : 'missing'
  document.updatedAt = new Date().toISOString()
  autosaveState.value = 'Saving...'
  void saveDocument(document).then(() => { autosaveState.value = 'All changes saved'; toast('Document marked ready.') })
    .catch(() => { autosaveState.value = 'Save failed - retry on the next edit' })
}

const textMatchesInRoot = (root: HTMLElement, originalText: string) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Array<{ node: Text; start: number; end: number }> = []
  const blockTags = new Set(['BLOCKQUOTE', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'OL', 'P', 'PRE', 'UL'])
  const blockContainer = (node: Text) => {
    let element = node.parentElement
    while (element && element !== root) {
      if (blockTags.has(element.tagName)) return element
      element = element.parentElement
    }
    return root
  }
  let combined = ''
  let previousBlock: HTMLElement | null = null
  let current = walker.nextNode()
  while (current) {
    const node = current as Text
    const currentBlock = blockContainer(node)
    if (
      combined
      && previousBlock
      && previousBlock !== currentBlock
      && !/\s$/.test(combined)
      && !/^\s/.test(node.data)
    ) combined += ' '
    const start = combined.length
    combined += node.data
    nodes.push({ node, start, end: combined.length })
    previousBlock = currentBlock
    current = walker.nextNode()
  }

  const matches: Array<{ start: number; end: number }> = []
  let exactStart = combined.indexOf(originalText)
  while (exactStart >= 0) {
    matches.push({ start: exactStart, end: exactStart + originalText.length })
    exactStart = combined.indexOf(originalText, exactStart + originalText.length)
  }

  if (!matches.length) {
    const escapedParts = originalText.trim().split(/\s+/).filter(Boolean)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    if (escapedParts.length) {
      const flexibleWhitespace = new RegExp(escapedParts.join('\\s+'), 'g')
      for (const match of combined.matchAll(flexibleWhitespace)) {
        if (match.index !== undefined) matches.push({ start: match.index, end: match.index + match[0].length })
      }
    }
  }

  return { matches, nodes }
}

const applyRewriteAcrossPages = async (originalText: string, replacementText: string) => {
  const doc = documentRecord.value
  if (!doc || !editor.value || !originalText.trim() || !replacementText.trim()) return false
  syncEditor()

  const candidates: Array<{
    page: (typeof doc.pages)[number]
    root: HTMLElement
    match: { start: number; end: number }
    nodes: Array<{ node: Text; start: number; end: number }>
  }> = []

  for (const page of doc.pages) {
    const root: HTMLElement = page.id === activePage.value?.id ? editor.value : document.createElement('div')
    if (root !== editor.value) root.innerHTML = page.content
    const result = textMatchesInRoot(root, originalText)
    for (const match of result.matches) candidates.push({ page, root, match, nodes: result.nodes })
  }

  const candidate = chooseRewriteCandidate(
    candidates.map((value) => ({ pageId: value.page.id, value })),
    activePage.value?.id || '',
  )
  if (!candidate) return false
  const { page, root, match, nodes } = candidate
  const first = nodes.find((entry) => entry.end > match.start)
  const last = nodes.find((entry) => entry.end >= match.end)
  if (!first || !last) return false

  const range = document.createRange()
  range.setStart(first.node, match.start - first.start)
  range.setEnd(last.node, match.end - last.start)
  range.deleteContents()
  const highlight = document.createElement('mark')
  const markerId = `ai-rewrite-${++rewriteMarkerSequence}`
  highlight.dataset.aiRewrite = markerId
  highlight.dataset.highlight = 'yellow'
  highlight.textContent = replacementText
  range.insertNode(highlight)
  root.normalize()
  page.content = root.innerHTML
  doc.content = doc.pages.map((item) => item.content).join('<p><br></p>')

  if (page.id !== activePage.value?.id) {
    activePageId.value = page.id
    await loadActivePage()
  }
  await nextTick()
  editor.value?.querySelector<HTMLElement>(`[data-ai-rewrite="${markerId}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return true
}

const liveEditorSelectionRange = () => {
  const root = editor.value
  const selection = window.getSelection()
  if (!root || !selection?.rangeCount) return null
  const range = selection.getRangeAt(0)
  return !range.collapsed && root.contains(range.commonAncestorContainer) ? range.cloneRange() : null
}

const editorSelectionRange = () => {
  const root = editor.value
  if (!root) return null
  const savedRange = savedEditorRange && !savedEditorRange.collapsed && root.contains(savedEditorRange.commonAncestorContainer)
    ? savedEditorRange.cloneRange()
    : null
  return preferEditorSelection(liveEditorSelectionRange(), savedRange)
}

const rememberEditorSelection = () => {
  savedEditorRange = liveEditorSelectionRange()
}

const highlightsInRange = (root: HTMLElement, range: Range) => [...root.querySelectorAll<HTMLElement>('mark')]
  .filter((mark) => {
    try {
      return range.intersectsNode(mark)
    } catch {
      return false
    }
  })

const unwrapHighlights = (highlights: HTMLElement[]) => {
  for (const highlight of highlights) {
    const parent = highlight.parentNode
    if (!parent) continue
    while (highlight.firstChild) parent.insertBefore(highlight.firstChild, highlight)
    highlight.remove()
  }
  editor.value?.normalize()
  savedEditorRange = null
}

const applyTextHighlight = () => {
  const root = editor.value
  const range = editorSelectionRange()
  if (!root || !range) {
    toast('Select text on the page before highlighting.', 'info')
    return
  }

  try {
    const selectedHighlights = highlightsInRange(root, range)
    const action = decideHighlightAction(
      selectedHighlights.map((mark) => mark.dataset.highlight || 'yellow'),
      highlightColor.value,
    )
    if (action === 'remove') {
      unwrapHighlights(selectedHighlights)
      syncEditor()
      toast('Highlight removed.')
      return
    }
    if (action === 'recolor') {
      selectedHighlights.forEach((mark) => { mark.dataset.highlight = highlightColor.value })
      savedEditorRange = null
      syncEditor()
      toast('Highlight color updated.')
      return
    }

    const mark = document.createElement('mark')
    mark.dataset.highlight = highlightColor.value
    mark.appendChild(range.extractContents())
    range.insertNode(mark)
    root.normalize()

    const selection = window.getSelection()
    const highlightedRange = document.createRange()
    highlightedRange.selectNodeContents(mark)
    selection?.removeAllRanges()
    selection?.addRange(highlightedRange)
    savedEditorRange = null
    syncEditor()
  } catch {
    toast('That selection could not be highlighted. Try selecting the text again.', 'info')
  }
}

const removeHighlights = async () => {
  const doc = documentRecord.value
  const root = editor.value
  if (!doc || !root) return

  const range = editorSelectionRange()
  const allHighlights = [...root.querySelectorAll<HTMLElement>('mark')]
  const highlights = range ? highlightsInRange(root, range) : allHighlights
  if (!highlights.length) {
    toast(range ? 'The selected text is not highlighted.' : 'There are no highlights on this page.', 'info')
    return
  }

  unwrapHighlights(highlights)
  syncEditor()
  window.clearTimeout(saveTimer)
  try {
    await saveDocument(doc)
    autosaveState.value = 'All changes saved'
    toast(range ? 'Selected highlight removed.' : 'All highlights removed. The text was kept.')
  } catch (caught) {
    autosaveState.value = 'Save failed - retry on the next edit'
    reviewError.value = reviewMessage(caught)
  }
}
const acceptSuggestion = async (suggestion: DocumentSuggestion) => {
  const doc = documentRecord.value
  if (!doc || !editor.value || suggestionSaving.value) return

  if (!suggestion.originalText || !suggestion.replacement) {
    reviewError.value = 'This suggestion has no exact source passage, so Minerva will not modify your draft automatically.'
    return
  }

  suggestionSaving.value = suggestion.id
  reviewError.value = ''
  try {
    await createDocumentVersion(doc, 'Before AI rewrite', 'review')
    if (!await applyRewriteAcrossPages(suggestion.originalText, suggestion.replacement)) {
      throw new Error('The source passage is missing or appears more than once. Run the review again so the rewrite can be applied safely.')
    }
    syncEditor()
    window.clearTimeout(saveTimer)
    await saveDocument(doc)
    await apiRequest(`/api/documents/${encodeURIComponent(doc.id)}/suggestions/${encodeURIComponent(suggestion.id)}/accept`, {
      method: 'POST',
      body: {},
    })
    suggestion.accepted = true
    previewSuggestion.value = null
    autosaveState.value = 'All changes saved'
    if (doc.review) doc.review.sourceFingerprint = fingerprint(doc.content)
    toast('Rewrite applied. The previous draft was saved as a version.')
  } catch (caught) {
    reviewError.value = reviewMessage(caught)
  } finally {
    suggestionSaving.value = ''
  }
}

const dismissSuggestion = async (suggestion: DocumentSuggestion) => {
  const doc = documentRecord.value
  if (!doc || suggestionSaving.value) return
  suggestionSaving.value = suggestion.id
  reviewError.value = ''
  try {
    await apiRequest(`/api/documents/${encodeURIComponent(doc.id)}/suggestions/${encodeURIComponent(suggestion.id)}/dismiss`, {
      method: 'POST',
      body: {},
    })
    suggestion.dismissed = true
    previewSuggestion.value = null
    toast('Suggestion dismissed.', 'info')
  } catch (caught) {
    reviewError.value = reviewMessage(caught)
  } finally {
    suggestionSaving.value = ''
  }
}
const askAi = () => {
  if (!aiPrompt.value.trim()) return
  void runConsult(aiPrompt.value.trim())
}

const runConsult = async (message: string) => {
  const doc = documentRecord.value
  if (!doc || reviewLoading.value) return
  if (wordCount.value < 5) {
    reviewError.value = 'Add a little more content before asking the AI.'
    return
  }

  syncEditor()
  const sourceContent = doc.pages?.length
    ? doc.pages.map((page) => page.content).join('<p><br></p>')
    : doc.content
  doc.content = sourceContent
  const userText = message.trim()
  reviewLoading.value = true
  aiBusyKind.value = 'consult'
  aiPanel.value = 'consultation'
  reviewError.value = ''
  consultMessages.value = [
    ...consultMessages.value,
    { id: `consult-${++consultMessageId}`, role: 'user', text: userText },
  ]
  aiPrompt.value = ''

  try {
    const history = consultMessages.value
      .slice(0, -1)
      .slice(-20)
      .map((entry) => ({ role: entry.role, content: entry.text }))
    const payload = await apiRequest<unknown>(`/api/documents/${encodeURIComponent(doc.id)}/consult`, {
      method: 'POST',
      body: {
        content: sourceContent,
        title: doc.title,
        message: userText,
        prompt: doc.prompt,
        history,
        ...(selectedId.value ? { scholarshipId: selectedId.value } : {}),
      },
    })
    syncAiTokenBalance(payload)
    const root = asRecord(payload)
    const consult = asRecord(root?.consult)
    const reply = textValue(consult?.reply) || 'I can help improve this draft. What would you like to focus on?'
    const intent = consult?.intent === 'refine' ? 'refine' as const : 'advise' as const
    const refineInstruction = textValue(consult?.refineInstruction) || userText
    consultMessages.value = [
      ...consultMessages.value,
      {
        id: `consult-${++consultMessageId}`,
        role: 'assistant',
        text: reply,
        intent,
        refineInstruction,
      },
    ]

    if (intent === 'refine') {
      pendingRefineInstruction.value = ''
      await runRefine(refineInstruction, { fromConsult: true })
    } else {
      pendingRefineInstruction.value = refineInstruction
    }
  } catch (caught) {
    syncAiTokenBalance(caught)
    reviewError.value = reviewMessage(caught)
  } finally {
    if (aiBusyKind.value === 'consult') {
      reviewLoading.value = false
      aiBusyKind.value = ''
    }
  }
}

const runRefine = async (
  instruction: string,
  options: { fromConsult?: boolean } = {},
) => {
  const doc = documentRecord.value
  if (!doc || (reviewLoading.value && aiBusyKind.value !== 'consult')) return
  if (wordCount.value < 5) {
    reviewError.value = 'Add a little more content before asking the AI.'
    return
  }

  syncEditor()
  const sourceContent = doc.pages?.length
    ? doc.pages.map((page) => page.content).join('<p><br></p>')
    : doc.content
  doc.content = sourceContent
  reviewLoading.value = true
  aiBusyKind.value = 'refine'
  aiPanel.value = 'consultation'
  reviewError.value = ''

  try {
    try {
      await createDocumentVersion(doc, 'Before AI refine', 'review')
    } catch {
      // Versioning is helpful but must not block the real LLM refine call.
    }

    const payload = await apiRequest<unknown>(`/api/documents/${encodeURIComponent(doc.id)}/refine`, {
      method: 'POST',
      body: {
        content: sourceContent,
        title: doc.title,
        instruction,
        prompt: doc.prompt,
        ...(selectedId.value ? { scholarshipId: selectedId.value } : {}),
      },
    })
    syncAiTokenBalance(payload)
    const root = asRecord(payload)
    const refine = asRecord(root?.refine)
    const summary = textValue(refine?.summary) || 'Applied refine changes to your draft.'
    const changes = (Array.isArray(refine?.changes) ? refine.changes : [])
      .map((value) => {
        const change = asRecord(value)
        if (!change) return null
        const originalText = textValue(change.originalText)
        const replacement = textValue(change.replacement)
        if (!originalText || !replacement || originalText === replacement) return null
        return {
          originalText,
          replacement,
          reason: textValue(change.reason),
        }
      })
      .filter((change): change is { originalText: string; replacement: string; reason: string } => Boolean(change))

    const plain = canonicalReviewText(sourceContent)
    const ordered = [...changes].sort((left, right) => {
      const leftIndex = plain.indexOf(left.originalText)
      const rightIndex = plain.indexOf(right.originalText)
      if (leftIndex >= 0 && rightIndex >= 0 && leftIndex !== rightIndex) return rightIndex - leftIndex
      return right.originalText.length - left.originalText.length
    })

    let applied = 0
    let skipped = 0
    for (const change of ordered) {
      if (await applyRewriteAcrossPages(change.originalText, change.replacement)) applied += 1
      else skipped += 1
    }

    syncEditor()
    await loadActivePage()
    window.clearTimeout(saveTimer)
    await saveDocument(doc)
    if (doc.review) doc.review.sourceFingerprint = `stale:${fingerprint(doc.content)}`

    const refineNote = options.fromConsult
      ? `${summary}${applied ? ` I applied ${applied} change${applied === 1 ? '' : 's'} to your draft.` : ''}`
      : summary
    const last = consultMessages.value[consultMessages.value.length - 1]
    if (options.fromConsult && last?.role === 'assistant' && last.intent === 'refine') {
      last.text = refineNote
      last.applied = applied
      last.skipped = skipped
      last.refineInstruction = instruction
      consultMessages.value = [...consultMessages.value]
    } else {
      consultMessages.value = [
        ...consultMessages.value,
        {
          id: `consult-${++consultMessageId}`,
          role: 'assistant',
          text: refineNote,
          intent: 'refine',
          refineInstruction: instruction,
          applied,
          skipped,
        },
      ]
    }
    pendingRefineInstruction.value = ''

    if (!applied) {
      reviewError.value = skipped
        ? 'The AI returned passages that could not be matched in the editor. Try a narrower request.'
        : 'The AI returned no usable changes.'
      return
    }
    toast(skipped ? `Applied ${applied} change${applied === 1 ? '' : 's'} (${skipped} skipped).` : `Applied ${applied} change${applied === 1 ? '' : 's'}.`)
  } catch (caught) {
    syncAiTokenBalance(caught)
    reviewError.value = reviewMessage(caught)
  } finally {
    reviewLoading.value = false
    aiBusyKind.value = ''
  }
}

const applyPendingRefine = () => {
  if (reviewLoading.value) return
  const instruction = pendingRefineInstruction.value.trim()
    || [...consultMessages.value].reverse().find((entry) => entry.role === 'assistant' && entry.refineInstruction)?.refineInstruction
    || ''
  if (!instruction) {
    reviewError.value = 'Ask for advice first, then apply the suggested refine to your draft.'
    return
  }
  consultMessages.value = [
    ...consultMessages.value,
    {
      id: `consult-${++consultMessageId}`,
      role: 'user',
      text: 'Please apply these improvements to my draft.',
    },
  ]
  void runRefine(instruction, { fromConsult: true })
}

onMounted(async () => {
  if (!documentRecord.value) await hydrateWorkspace()
  if (documentLocation.value && selectedId.value !== documentLocation.value.scholarshipId) {
    selectedId.value = documentLocation.value.scholarshipId
  }
  if (!selected.value || !documentRecord.value) { await router.replace('/documents'); return }
  await nextTick()
  await loadActivePage()
  await loadLatestReview()
})
onBeforeUnmount(() => {
  window.clearTimeout(saveTimer)
  const doc = documentRecord.value
  if (doc && autosaveState.value.startsWith('Saving')) {
    void saveDocument(doc).catch(() => undefined)
  }
})
</script>

<template>
  <main class="workspace-shell document-editor-shell">
    <WorkspaceSidebar active="documents" />
    <div v-if="documentRecord && selected" class="workspace-main document-editor-main">
      <header class="editor-topbar">
        <button type="button" class="editor-back-button" title="Back to documents" aria-label="Back to documents" @click="returnToDocuments"><ArrowLeft :size="18" /><span>Documents</span></button>
        <div class="editor-heading"><p class="workspace-kicker">AI writing editor</p><div><input ref="titleInput" v-model="documentRecord.title" class="editor-heading_input" :size="Math.max(5, Math.min(32, documentRecord.title.length + 1))" aria-label="Document title" @input="syncEditor" @blur="syncEditor" @keydown.enter.prevent="titleInput?.blur()" /><button type="button" class="editor-title-edit" aria-label="Edit document title" @click="editTitle"><Edit3 :size="17" /></button></div><p><span><Check :size="15" />{{ autosaveState }}</span><i />{{ modifiedLabel }}<i /><select v-model="selectedVersion" aria-label="Document version" @change="restoreVersion"><option value="current">Current draft</option><option v-for="version in documentRecord.versions" :key="version.id" :value="version.id">{{ version.label }}</option></select><ChevronDown :size="14" /></p></div>
        <div class="editor-head-actions"><button class="btn-primary" @click="saveReady">Save</button><button class="btn-secondary" :disabled="versionSaving" @click="createVersion">{{ versionSaving ? 'Saving version...' : 'Create new version' }}</button><div class="export-menu"><button type="button" class="btn-secondary export-trigger" :disabled="Boolean(exporting)" aria-haspopup="menu" :aria-expanded="exportMenuOpen" @click="exportMenuOpen = !exportMenuOpen"><Download :size="16" />{{ exporting ? `Exporting ${exporting.toUpperCase()}...` : 'Export' }}<ChevronDown :size="14" /></button><div v-if="exportMenuOpen" class="export-popover" role="menu"><button type="button" role="menuitem" @click="exportDocument('docx')"><strong>Word document</strong><small>.docx - editable</small></button><button type="button" role="menuitem" @click="exportDocument('pdf')"><strong>PDF document</strong><small>.pdf - ready to share</small></button></div></div></div>
      </header>

      <div class="editor-layout">
        <aside class="document-tabs-panel hidden w-52 shrink-0 border-l border-slate-200 bg-slate-50 p-3 lg:block">
          <div class="mb-3 flex items-center justify-between px-2"><strong class="text-sm text-[#17136b]">Document tabs</strong><button type="button" class="text-xl font-bold text-[#5b45f5]" aria-label="Add page" @click="addPage">+</button></div>
          <button v-for="(page, index) in documentPages" :key="page.id" type="button" class="mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-semibold" :class="page.id === activePage?.id ? 'bg-violet-100 text-[#3127b8]' : 'text-slate-600 hover:bg-white'" @click="selectPage(page.id)"><span class="grid size-5 place-items-center rounded border border-current text-[10px]">{{ index + 1 }}</span><span class="truncate">{{ pageTabLabel(page.content, index) }}</span></button>
        </aside>
        <section class="writing-column min-w-0">
          <div class="rich-toolbar" @mousedown="preserveToolbarSelection">
            <select v-model="fontFamily" class="font-family-select" aria-label="Font family" @change="chooseFont"><option>Calibri</option><option>Times New Roman</option><option>Arial</option><option>Cambria</option><option>Georgia</option><option>Garamond</option><option>Verdana</option><option>Courier New</option></select><i /><select aria-label="Text style" @change="chooseBlock"><option value="p">Paragraph</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option></select><i />
            <button aria-label="Bold" @click="command('bold')"><Bold :size="18" /></button><button aria-label="Italic" @click="command('italic')"><Italic :size="18" /></button><button aria-label="Underline" @click="command('underline')"><Underline :size="18" /></button><button aria-label="Strikethrough" @click="command('strikeThrough')"><Strikethrough :size="18" /></button><i />
            <button aria-label="Align left" @click="command('justifyLeft')"><AlignLeft :size="18" /></button><button aria-label="Bulleted list" @click="command('insertUnorderedList')"><List :size="18" /></button><button aria-label="Numbered list" @click="command('insertOrderedList')"><ListOrdered :size="18" /></button><button aria-label="Add link" @click="addLink"><Link2 :size="18" /></button><button aria-label="Add comment"><MessageSquare :size="18" /></button><i />
            <div class="highlight-tools"><button type="button" aria-label="Highlight selected text" title="Highlight selected text" :style="{ color: highlightColorHex }" @mousedown.prevent @click="applyTextHighlight"><Highlighter :size="18" /></button><select v-model="highlightColor" aria-label="Highlight color" title="Highlight color"><option value="yellow">Yellow</option><option value="green">Green</option><option value="blue">Blue</option><option value="pink">Pink</option><option value="purple">Purple</option></select><button v-if="hasActiveHighlights" type="button" aria-label="Remove highlights" title="Remove highlights" @mousedown.prevent @click="removeHighlights"><Eraser :size="18" /></button></div><i />
            <button aria-label="Undo" @click="command('undo')"><Undo2 :size="18" /></button><button aria-label="Redo" @click="command('redo')"><Redo2 :size="18" /></button>
          </div>

          <div class="paper-viewport rounded-2xl bg-slate-100 p-6" @wheel="onPaperWheel">
            <div class="mx-auto origin-top transition-transform" :style="{ transform: `scale(${paperZoom})`, width: `${100 / paperZoom}%` }">
              <div class="writing-page min-h-[820px]">
                <div ref="editor" class="rich-editor min-h-[620px]" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true" @input="syncEditor" @mouseup="rememberEditorSelection" @keyup="rememberEditorSelection" />
              </div>
            </div>
          </div>
          <div class="page-strip"><span class="page-strip-label">Pages</span><button v-for="(page, index) in documentPages" :key="page.id" type="button" class="page-thumbnail" :class="page.id === activePage?.id && 'active'" @click="selectPage(page.id)"><span class="page-thumbnail-sheet"><strong>{{ pageTabLabel(page.content, index) }}</strong><small>{{ pagePreview(page.content) }}</small><i /><i /><i /></span><b>{{ index + 1 }}</b></button><button type="button" class="add-page-thumbnail" aria-label="Add page" @click="addPage">+</button></div>
          <footer class="editor-statusbar"><button type="button" class="text-xs font-bold text-[#5b45f5]" @click="paperZoom = Math.max(0.65, paperZoom - 0.1)">&minus;</button><span class="text-xs font-bold text-slate-500">{{ paperZoomPercent }}%</span><button type="button" class="text-xs font-bold text-[#5b45f5]" @click="paperZoom = Math.min(1.25, paperZoom + 0.1)">+</button><span>Words: <strong>{{ wordCount }}</strong></span><i /><span>Target: <strong>{{ target }}</strong></span><i /><span>Readability: <strong :class="readability === 'Good' ? 'text-emerald-600' : 'text-amber-600'">{{ readability }}</strong></span><span class="ml-auto"><Check :size="15" />{{ autosaveState }}</span></footer>
        </section>

        <aside class="review-assistant editor-left-panel">
          <div class="editor-panel-tabs">
            <button type="button" :class="aiPanel === 'consultation' ? '!bg-[#5b45f5] !text-white shadow-sm' : '!text-slate-600 hover:!bg-[#5b45f5] hover:!text-white'" @click="aiPanel = 'consultation'">AI Consultation</button>
            <button type="button" :class="aiPanel === 'proofreader' ? '!bg-[#5b45f5] !text-white shadow-sm' : '!text-slate-600 hover:!bg-[#5b45f5] hover:!text-white'" @click="aiPanel = 'proofreader'">AI Proofreader</button>
          </div>

          <div v-show="aiPanel === 'consultation'" class="ai-consultation-panel">
            <div class="ai-review-scroll">
              <div class="relative mt-1 flex items-center justify-between gap-2">
                <h3 class="text-xs font-black uppercase tracking-wide text-slate-400">Conversation</h3>
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    class="consult-icon-btn"
                    :disabled="reviewLoading"
                    title="Chat history"
                    aria-label="Open chat history"
                    :aria-expanded="consultHistoryOpen"
                    @click="toggleConsultHistory"
                  >
                    <History :size="15" stroke-width="2.25" />
                  </button>
                  <button
                    type="button"
                    class="consult-icon-btn"
                    :disabled="reviewLoading"
                    title="New chat"
                    aria-label="Start a new chat"
                    @click="startNewConsult"
                  >
                    <Plus :size="16" stroke-width="2.25" />
                  </button>
                </div>
                <div v-if="consultHistoryOpen" class="consult-history-popover" role="dialog" aria-label="Consultation history">
                  <div class="mb-2 flex items-center justify-between gap-2">
                    <strong class="text-xs font-black uppercase tracking-wide text-slate-400">History</strong>
                    <button type="button" class="text-[11px] font-bold text-slate-400 hover:text-slate-600" @click="consultHistoryOpen = false">Close</button>
                  </div>
                  <p v-if="!consultSessions.some((session) => session.messages.length)" class="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">No saved consultations yet.</p>
                  <ul v-else class="max-h-56 space-y-1 overflow-y-auto">
                    <li v-for="session in consultSessions.filter((entry) => entry.messages.length || entry.id === activeConsultId)" :key="session.id">
                      <div
                        class="group flex items-start gap-2 rounded-xl px-2.5 py-2"
                        :class="session.id === activeConsultId ? 'bg-violet-50' : 'hover:bg-slate-50'"
                      >
                        <button type="button" class="min-w-0 flex-1 text-left" @click="openConsultSession(session.id)">
                          <strong class="block truncate text-xs font-bold text-[#17136b]">{{ session.title || 'Consultation' }}</strong>
                          <small class="mt-0.5 block text-[11px] text-slate-400">{{ new Date(session.updatedAt).toLocaleString() }} · {{ session.messages.length }} messages</small>
                        </button>
                        <button
                          type="button"
                          class="mt-0.5 rounded-md p-1 text-slate-400 opacity-70 hover:bg-white hover:text-red-500"
                          title="Delete consultation"
                          aria-label="Delete consultation"
                          @click.stop="deleteConsultSession(session.id)"
                        >
                          <Trash2 :size="13" />
                        </button>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
              <div v-if="reviewError && aiBusyKind !== 'review'" class="mt-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-5 text-red-700" role="alert"><AlertCircle class="mt-0.5 shrink-0" :size="15" /><span>{{ reviewError }}</span></div>
              <section v-if="aiBusyKind === 'consult'" class="mt-3 rounded-xl border border-violet-100 bg-violet-50 p-3 text-center"><LoaderCircle class="mx-auto animate-spin text-[#5b45f5]" :size="22" /><p class="mt-2 text-xs font-bold text-[#3127b8]">Minerva is thinking...</p></section>
              <section v-else-if="aiBusyKind === 'refine'" class="mt-3 rounded-xl border border-violet-100 bg-violet-50 p-3 text-center"><LoaderCircle class="mx-auto animate-spin text-[#5b45f5]" :size="22" /><p class="mt-2 text-xs font-bold text-[#3127b8]">Applying refinements to your draft...</p></section>

              <section v-if="consultMessages.length" class="mt-4 space-y-2">
                <article v-for="entry in consultMessages" :key="entry.id" class="rounded-xl p-3" :class="entry.role === 'user' ? 'bg-violet-50' : 'bg-slate-50'">
                  <strong class="text-xs" :class="entry.role === 'user' ? 'text-[#3127b8]' : 'text-[#17136b]'">{{ entry.role === 'user' ? 'You' : 'AI' }}</strong>
                  <p class="mt-1 text-xs leading-5 text-slate-600">{{ entry.text }}</p>
                  <small v-if="entry.applied != null" class="mt-2 block text-[11px] font-bold text-slate-400">Applied {{ entry.applied }}{{ entry.skipped ? ` · skipped ${entry.skipped}` : '' }}</small>
                </article>
              </section>
              <section v-else-if="aiBusyKind !== 'consult' && aiBusyKind !== 'refine'" class="review-score-card mt-3 text-center">
                <span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-[#5b45f5]"><Sparkles :size="22" /></span>
                <h2 class="mt-3 text-sm font-bold text-[#17136b]">Talk through your draft</h2>
                <p class="mt-2 text-xs leading-5 text-slate-500">Ask for advice first. Use history to reopen past chats, or plus to start a new one.</p>
              </section>
            </div>
            <section class="ask-ai-card">
              <button
                v-if="pendingRefineInstruction"
                type="button"
                class="btn-primary mb-3 !w-full !px-3 !py-2 text-xs"
                :disabled="reviewLoading"
                @click="applyPendingRefine"
              >
                <Sparkles :size="15" />Apply to draft
              </button>
              <form @submit.prevent="askAi">
                <input v-model="aiPrompt" placeholder="Ask about your draft..." :disabled="reviewLoading" />
                <button :disabled="reviewLoading || !aiPrompt.trim()" aria-label="Send consultation message">
                  <LoaderCircle v-if="aiBusyKind === 'consult' || aiBusyKind === 'refine'" class="animate-spin" :size="17" /><ArrowRight v-else :size="17" />
                </button>
              </form>
              <div>
                <button :disabled="reviewLoading" @click="runConsult('How can I improve clarity without changing my voice?')">Improve clarity</button>
                <button :disabled="reviewLoading" @click="runConsult('How can I make the evidence and measurable impact stronger?')">Stronger impact</button>
                <button :disabled="reviewLoading" @click="runConsult('How can I make this draft more concise?')">Shorten</button>
              </div>
            </section>
          </div>

          <div v-show="aiPanel === 'proofreader'" class="ai-consultation-panel">
            <div class="ai-review-scroll">
              <div v-if="reviewError && aiBusyKind !== 'refine'" class="mt-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-5 text-red-700" role="alert"><AlertCircle class="mt-0.5 shrink-0" :size="15" /><span>{{ reviewError }}</span></div>
              <div v-if="reviewOutdated" class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">Your draft changed after this review. Rewrites can still be applied when the exact source passage remains on the selected page.</div>

              <section v-if="aiBusyKind === 'review' && !documentRecord.review" class="review-score-card grid min-h-48 place-content-center text-center">
                <LoaderCircle class="mx-auto animate-spin text-[#5b45f5]" :size="30" />
                <strong class="mt-3 text-sm text-[#17136b]">Minerva is reviewing your draft</strong>
                <p class="mt-1 text-xs text-slate-500">Checking clarity, structure, grammar, and impact...</p>
              </section>
              <section v-else-if="documentRecord.review" class="review-score-card">
                <div class="mb-4">
                  <button type="button" class="btn-primary !w-full !px-3 !py-2 text-xs" :disabled="reviewLoading" @click="runReview()">
                    <LoaderCircle v-if="aiBusyKind === 'review'" class="animate-spin" :size="15" /><Sparkles v-else :size="15" />
                    {{ aiBusyKind === 'review' ? 'Reviewing...' : 'Review draft' }}
                  </button>
                </div>
                <div class="overall-row">
                  <div class="score-ring" :style="{ '--score': `${documentRecord.review.overall * 3.6}deg` }"><span>{{ documentRecord.review.overall }}</span></div>
                  <div>
                    <h2>{{ documentRecord.review.overall >= 82 ? 'Strong draft' : 'Promising draft' }}</h2>
                    <span class="review-score-label">Overall review score</span>
                  </div>
                </div>
                <p class="review-summary" :class="!expandedReviewSummary && 'clamped'">{{ documentRecord.review.summary }}</p>
                <button v-if="documentRecord.review.summary.length > 220" type="button" class="review-summary-toggle" @click="expandedReviewSummary = !expandedReviewSummary">{{ expandedReviewSummary ? 'Show less' : 'Show more' }}</button>
                <div class="review-metrics">
                  <div><span>Clarity</span><strong>{{ documentRecord.review.clarity }}</strong></div>
                  <div><span>Grammar</span><strong>{{ documentRecord.review.grammar }}</strong></div>
                  <div><span>Structure</span><strong>{{ documentRecord.review.structure }}</strong></div>
                  <div><span>Impact</span><strong>{{ documentRecord.review.impact }}</strong></div>
                </div>
                <div v-if="documentRecord.review.strengths?.length" class="mt-4 rounded-xl bg-emerald-50 p-3">
                  <strong class="text-xs text-emerald-800">What already works</strong>
                  <ul class="mt-2 space-y-1 text-xs leading-5 text-emerald-700">
                    <li v-for="strength in documentRecord.review.strengths.slice(0, 3)" :key="strength">{{ strength }}</li>
                  </ul>
                </div>
                <h3 class="suggestions-title">Top suggestions <span>{{ documentRecord.review.suggestions.filter((item) => !item.dismissed && !item.accepted).length }}</span></h3>
                <div class="review-suggestions">
                  <article v-for="suggestion in documentRecord.review.suggestions.filter((item) => !item.dismissed && !item.accepted)" :key="suggestion.id" :class="['review-suggestion', suggestion.tone, expandedSuggestion === suggestion.id && 'expanded']">
                    <button class="suggestion-heading" @click="expandedSuggestion = expandedSuggestion === suggestion.id ? null : suggestion.id"><span>{{ suggestion.title }}</span><ChevronDown :size="16" /></button>
                    <div v-if="expandedSuggestion === suggestion.id">
                      <p>{{ suggestion.detail }}</p>
                      <button v-if="suggestion.replacement" class="rewrite-button" :disabled="Boolean(suggestionSaving)" @click="acceptSuggestion(suggestion)">{{ suggestionSaving === suggestion.id ? 'Applying...' : 'Apply rewrite' }}</button>
                      <button v-if="suggestion.replacement" :disabled="Boolean(suggestionSaving)" @click="previewSuggestion = previewSuggestion === suggestion.id ? null : suggestion.id">{{ previewSuggestion === suggestion.id ? 'Hide preview' : 'Preview' }}</button>
                      <button :disabled="Boolean(suggestionSaving)" @click="dismissSuggestion(suggestion)">Dismiss</button>
                    </div>
                    <div v-if="previewSuggestion === suggestion.id" class="rewrite-preview"><span>Suggested rewrite</span><p>{{ suggestion.replacement }}</p></div>
                  </article>
                  <p v-if="!documentRecord.review.suggestions.some((item) => !item.dismissed && !item.accepted)" class="rounded-xl bg-emerald-50 p-4 text-center text-xs text-emerald-700">You have worked through every suggestion in this review.</p>
                </div>
              </section>
              <section v-else class="review-score-card text-center">
                <span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-[#5b45f5]"><Sparkles :size="22" /></span>
                <h2 class="mt-3 text-sm font-bold text-[#17136b]">Proofread this draft</h2>
                <p class="mt-2 text-xs leading-5 text-slate-500">Get scores for clarity, grammar, structure, and impact, plus suggestions you can apply.</p>
                <button type="button" class="btn-primary mt-4" :disabled="reviewLoading" @click="runReview()">
                  <LoaderCircle v-if="aiBusyKind === 'review'" class="animate-spin" :size="15" /><Sparkles v-else :size="15" />
                  {{ aiBusyKind === 'review' ? 'Reviewing...' : 'Review this draft' }}
                </button>
              </section>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </main>
</template>
<style scoped>
.paper-viewport,
.page-strip {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.paper-viewport::-webkit-scrollbar,
.page-strip::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.consult-icon-btn {
  display: inline-grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.65rem;
  background: #5b45f5;
  color: #fff;
  transition: background-color 0.15s ease, opacity 0.15s ease;
}

.consult-icon-btn:hover:not(:disabled) {
  background: #4a36e0;
}

.consult-icon-btn:disabled {
  opacity: 0.45;
}

.consult-history-popover {
  position: absolute;
  top: calc(100% + 0.4rem);
  right: 0;
  z-index: 20;
  width: min(100%, 17.5rem);
  border: 1px solid #e2e8f0;
  border-radius: 0.9rem;
  background: #fff;
  padding: 0.75rem;
  box-shadow: 0 12px 28px rgba(23, 19, 107, 0.12);
}
</style>

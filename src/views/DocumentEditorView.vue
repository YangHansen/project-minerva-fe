<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, AlignLeft, ArrowRight, Bold, Check, ChevronDown, Download, Edit3, Eraser, Highlighter, Italic, Link2, List, ListOrdered, LoaderCircle, MessageSquare, Redo2, Sparkles, Strikethrough, Underline, Undo2 } from 'lucide-vue-next'
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
const editorPanel = ref<'template' | 'ai'>('template')
const templateSearch = ref('')
const documentTemplates = [
  { id: 'scholarship-essay', name: 'Scholarship essay', description: 'Motivation, evidence, and future contribution.', previewTitle: 'My scholarship journey', tone: 'violet', content: '<h2>Why I am applying</h2><p>Explain your motivation and the opportunity you hope to create.</p><h2>Experience and impact</h2><p>Use one clear example with the actions you took and the result.</p><h2>Future contribution</h2><p>Connect your study plan to the community you will support.</p>' },
  { id: 'personal-statement', name: 'Personal statement', description: 'A clear story about your growth and direction.', previewTitle: 'Purpose & potential', tone: 'blue', content: '<h2>My story</h2><p>Introduce the experience that shaped your direction.</p><h2>What I learned</h2><p>Explain the values and skills you developed.</p><h2>Where I am going</h2><p>Connect your next step to a meaningful long-term goal.</p>' },
  { id: 'study-plan', name: 'Study plan', description: 'Goals, learning plan, and expected outcomes.', previewTitle: 'Study roadmap', tone: 'emerald', content: '<h2>Academic goal</h2><p>State the knowledge or capability you want to develop.</p><h2>Learning plan</h2><p>Describe the programme, activities, and timeline.</p><h2>Expected outcome</h2><p>Show how you will use the learning after graduation.</p>' },
    { id: 'cv-profile', name: 'CV profile', description: 'A concise profile, experience, and achievements.', previewTitle: 'Professional profile', tone: 'amber', content: '<h2>Profile</h2><p>Summarise your focus, strengths, and goal in three to four sentences.</p><h2>Selected experience</h2><p>Role - Organisation - Dates</p><ul><li>Describe a measurable contribution or result.</li></ul><h2>Education and achievements</h2><p>Add the most relevant qualifications and recognition.</p>' },
  { id: 'blank', name: 'Blank page', description: 'Start a clean page from scratch.', previewTitle: 'Untitled document', tone: 'slate', content: '<p>Start writing here.</p>' },
]
const filteredDocumentTemplates = computed(() => {
  const query = templateSearch.value.trim().toLowerCase()
  return query ? documentTemplates.filter((template) => `${template.name} ${template.description}`.toLowerCase().includes(query)) : documentTemplates
})
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
const applyTemplate = async (template: typeof documentTemplates[number]) => {
  const page = activePage.value
  if (!page) return
  const currentText = pagePreview(page.content)
  if (currentText !== 'Blank page' && !window.confirm(`Replace the content of ${page.title} with the ${template.name} template?`)) return
  page.content = template.content
  await loadActivePage()
  syncEditor()
  toast(`${template.name} applied to ${page.title}.`)
}
const autosaveState = ref('All changes saved')
const selectedVersion = ref('current')
const expandedSuggestion = ref<string | null>(null)
const previewSuggestion = ref<string | null>(null)
const aiPrompt = ref('')
const expandedReviewSummary = ref(false)
const reviewLoading = ref(false)
const reviewError = ref('')
const versionSaving = ref(false)
const suggestionSaving = ref('')
const exportMenuOpen = ref(false)
const exporting = ref<'docx' | 'pdf' | ''>('')
let rewriteMarkerSequence = 0
let savedEditorRange: Range | null = null
let saveTimer = 0

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
    : 'The AI review could not be completed. Please try again.'
}

const runReview = async (focus = '') => {
  const doc = documentRecord.value
  if (!doc || reviewLoading.value) return
  if (wordCount.value < 5) {
    reviewError.value = 'Add a little more content before requesting an AI review.'
    return
  }

  syncEditor()
  const sourceContent = doc.content
  reviewLoading.value = true
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
  if (!documentRecord.value) return
  documentRecord.value.status = 'ready'
  documentRecord.value.updatedAt = new Date().toISOString()
  autosaveState.value = 'Saving...'
  void saveDocument(documentRecord.value).then(() => { autosaveState.value = 'All changes saved'; toast('Document marked ready.') })
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
      && !/s$/.test(combined)
      && !/^s/.test(node.data)
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
const askAi = () => { if (aiPrompt.value.trim()) void runReview(aiPrompt.value) }

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
        <div class="editor-heading"><p class="workspace-kicker">AI writing editor</p><div><input v-model="documentRecord.title" :size="Math.max(5, Math.min(32, documentRecord.title.length + 1))" aria-label="Document title" @input="syncEditor" /><Edit3 :size="17" /></div><p><span><Check :size="15" />{{ autosaveState }}</span><i />{{ modifiedLabel }}<i /><select v-model="selectedVersion" aria-label="Document version" @change="restoreVersion"><option value="current">Current draft</option><option v-for="version in documentRecord.versions" :key="version.id" :value="version.id">{{ version.label }}</option></select><ChevronDown :size="14" /></p></div>
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
          <div class="editor-panel-tabs"><button type="button" :class="editorPanel === 'template' ? '!bg-[#5b45f5] !text-white shadow-sm' : '!text-slate-600 hover:!bg-[#5b45f5] hover:!text-white'" @click="editorPanel = 'template'">Template</button><button type="button" :class="editorPanel === 'ai' ? '!bg-[#5b45f5] !text-white shadow-sm' : '!text-slate-600 hover:!bg-[#5b45f5] hover:!text-white'" @click="editorPanel = 'ai'">AI consultation</button></div>
          <section v-if="editorPanel === 'template'" class="template-panel"><div class="template-heading"><span class="workspace-kicker">Writing starter</span><h2>Choose a template</h2><p>Preview a structure, then apply it to the selected page.</p></div><label class="template-search"><span>Search templates</span><input v-model="templateSearch" type="search" placeholder="Essay, study plan, CV..." /></label><div class="template-grid"><button v-for="template in filteredDocumentTemplates" :key="template.id" type="button" class="template-card" @click="applyTemplate(template)"><span :class="['template-preview', `tone-${template.tone}`]"><em>{{ template.previewTitle }}</em><i class="wide" /><i /><i /><i class="short" /></span><span class="template-card-copy"><strong>{{ template.name }}</strong><small>{{ template.description }}</small></span></button><p v-if="!filteredDocumentTemplates.length" class="template-empty">No matching templates.</p></div><button type="button" class="btn-secondary template-add-page" @click="addPage">+ Add blank page</button></section>
          <div v-show="editorPanel === 'ai'" class="ai-consultation-panel">
          <div class="review-title"><span><Sparkles :size="18" />AI consultation</span><button type="button" class="btn-primary !px-3 !py-2 text-xs" :disabled="reviewLoading" @click="runReview()"><LoaderCircle v-if="reviewLoading" class="animate-spin" :size="15" /><Sparkles v-else :size="15" />{{ reviewLoading ? 'Reviewing...' : 'Review draft' }}</button></div>
          <div class='ai-review-scroll'>

          <div v-if="reviewError" class="mt-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-5 text-red-700" role="alert"><AlertCircle class="mt-0.5 shrink-0" :size="15" /><span>{{ reviewError }}</span></div>
          <div v-if="reviewOutdated" class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">Your draft changed after this review. Rewrites can still be applied when the exact source passage remains on the selected page.</div>
          <section v-if="reviewLoading && !documentRecord.review" class="review-score-card grid min-h-48 place-content-center text-center"><LoaderCircle class="mx-auto animate-spin text-[#5b45f5]" :size="30" /><strong class="mt-3 text-sm text-[#17136b]">Minerva is reviewing your draft</strong><p class="mt-1 text-xs text-slate-500">Checking clarity, structure, grammar, and impact...</p></section>
          <section v-else-if="documentRecord.review" class="review-score-card">
            <div class="overall-row"><div class="score-ring" :style="{ '--score': `${documentRecord.review.overall * 3.6}deg` }"><span>{{ documentRecord.review.overall }}</span></div><div><h2>{{ documentRecord.review.overall >= 82 ? 'Strong draft' : 'Promising draft' }}</h2><span class="review-score-label">Overall review score</span></div></div><p class="review-summary" :class="!expandedReviewSummary && 'clamped'">{{ documentRecord.review.summary }}</p><button v-if="documentRecord.review.summary.length > 220" type="button" class="review-summary-toggle" @click="expandedReviewSummary = !expandedReviewSummary">{{ expandedReviewSummary ? 'Show less' : 'Show more' }}</button>
            <div class="review-metrics"><div><span>Clarity</span><strong>{{ documentRecord.review.clarity }}</strong></div><div><span>Grammar</span><strong>{{ documentRecord.review.grammar }}</strong></div><div><span>Structure</span><strong>{{ documentRecord.review.structure }}</strong></div><div><span>Impact</span><strong>{{ documentRecord.review.impact }}</strong></div></div>
            <div v-if="documentRecord.review.strengths?.length" class="mt-4 rounded-xl bg-emerald-50 p-3"><strong class="text-xs text-emerald-800">What already works</strong><ul class="mt-2 space-y-1 text-xs leading-5 text-emerald-700"><li v-for="strength in documentRecord.review.strengths.slice(0, 3)" :key="strength">{{ strength }}</li></ul></div>
            <h3 class="suggestions-title">Top suggestions <span>{{ documentRecord.review.suggestions.filter((item) => !item.dismissed && !item.accepted).length }}</span></h3>
            <div class="review-suggestions">
              <article v-for="suggestion in documentRecord.review.suggestions.filter((item) => !item.dismissed && !item.accepted)" :key="suggestion.id" :class="['review-suggestion', suggestion.tone, expandedSuggestion === suggestion.id && 'expanded']">
                <button class="suggestion-heading" @click="expandedSuggestion = expandedSuggestion === suggestion.id ? null : suggestion.id"><span>{{ suggestion.title }}</span><ChevronDown :size="16" /></button>
                <div v-if="expandedSuggestion === suggestion.id"><p>{{ suggestion.detail }}</p><button v-if="suggestion.replacement" class="rewrite-button" :disabled="Boolean(suggestionSaving)" @click="acceptSuggestion(suggestion)">{{ suggestionSaving === suggestion.id ? 'Applying...' : 'Apply rewrite' }}</button><button v-if="suggestion.replacement" :disabled="Boolean(suggestionSaving)" @click="previewSuggestion = previewSuggestion === suggestion.id ? null : suggestion.id">{{ previewSuggestion === suggestion.id ? 'Hide preview' : 'Preview' }}</button><button :disabled="Boolean(suggestionSaving)" @click="dismissSuggestion(suggestion)">Dismiss</button></div>
                <div v-if="previewSuggestion === suggestion.id" class="rewrite-preview"><span>Suggested rewrite</span><p>{{ suggestion.replacement }}</p></div>
              </article>
              <p v-if="!documentRecord.review.suggestions.some((item) => !item.dismissed && !item.accepted)" class="rounded-xl bg-emerald-50 p-4 text-center text-xs text-emerald-700">You have worked through every suggestion in this review.</p>
            </div>
          </section>
          <section v-else class="review-score-card text-center"><span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-[#5b45f5]"><Sparkles :size="22" /></span><h2 class="mt-3 text-sm font-bold text-[#17136b]">Get focused feedback</h2><p class="mt-2 text-xs leading-5 text-slate-500">Reviews run only when you request them, so editing never triggers an AI charge.</p><button type="button" class="btn-primary mt-4" @click="runReview()">Review this draft</button></section>
          </div>
          <section class="ask-ai-card"><form @submit.prevent="askAi"><input v-model="aiPrompt" placeholder="Ask AI to focus on something..." :disabled="reviewLoading" /><button :disabled="reviewLoading || !aiPrompt.trim()" aria-label="Send focused review request"><LoaderCircle v-if="reviewLoading" class="animate-spin" :size="17" /><ArrowRight v-else :size="17" /></button></form><div><button :disabled="reviewLoading" @click="runReview('Improve clarity without changing my voice.')">Improve clarity</button><button :disabled="reviewLoading" @click="runReview('Make the evidence and measurable impact stronger.')">Stronger impact</button><button :disabled="reviewLoading" @click="runReview('Make the draft more concise and remove repetition.')">Shorten</button></div></section>
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
</style>

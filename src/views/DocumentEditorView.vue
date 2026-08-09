<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, AlignLeft, ArrowRight, Bold, Check, ChevronDown, Edit3, Italic, Link2, List, ListOrdered, LoaderCircle, MessageSquare, MoreVertical, Redo2, Share2, Sparkles, Strikethrough, Underline, Undo2 } from 'lucide-vue-next'
import type { DocumentReview, DocumentSuggestion } from '../types'
import { ApiError, apiRequest } from '../api'
import { getScholarship } from '../data/scholarships'
import { useAppState } from '../composables/useAppState'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'

type UnknownRecord = Record<string, unknown>

const route = useRoute()
const router = useRouter()
const { selectedId, documentsByScholarship, hydrateWorkspace, saveDocument, createDocumentVersion, restoreDocumentVersion, syncAiTokenBalance, toast } = useAppState()
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
const autosaveState = ref('All changes saved')
const selectedVersion = ref('current')
const expandedSuggestion = ref<string | null>(null)
const previewSuggestion = ref<string | null>(null)
const aiPrompt = ref('')
const reviewLoading = ref(false)
const reviewError = ref('')
const versionSaving = ref(false)
const suggestionSaving = ref('')
let saveTimer = 0

const plainText = computed(() => documentRecord.value?.content.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || '')
const wordCount = computed(() => plainText.value ? plainText.value.split(/\s+/).length : 0)
const target = computed(() => documentRecord.value?.kind === 'cv' || documentRecord.value?.kind === 'transcript' ? 'Concise and relevant' : documentRecord.value?.kind === 'essay' ? '500–650' : '400–700')
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
        id: textValue(suggestion.id, suggestion._id) || `suggestion-${crypto.randomUUID()}`,
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

const reviewMessage = (caught: unknown) => caught instanceof ApiError
  ? caught.message
  : 'The AI review could not be completed. Please try again.'

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
    expandedSuggestion.value = review.suggestions[0]?.id || null
    aiPrompt.value = ''
    toast(focus ? 'Focused AI review completed.' : 'AI review completed.')
  } catch (caught) {
    syncAiTokenBalance(caught)
    reviewError.value = reviewMessage(caught)
  } finally {
    reviewLoading.value = false
  }
}

const loadLatestReview = async () => {
  const doc = documentRecord.value
  if (!doc || doc.id.startsWith('document-')) return
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
    }
  } catch (caught) {
    reviewError.value = reviewMessage(caught)
  }
}

const syncEditor = () => {
  const doc = documentRecord.value
  if (!doc || !editor.value) return
  doc.content = editor.value.innerHTML
  doc.status = doc.content.replace(/<[^>]+>/g, '').trim() ? 'draft' : 'missing'
  doc.updatedAt = new Date().toISOString()
  autosaveState.value = 'Saving…'
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(async () => {
    try {
      await saveDocument(doc)
      autosaveState.value = 'All changes saved'
    } catch {
      autosaveState.value = 'Save failed — retrying on the next edit'
    }
  }, 650)
}

const command = (name: string, value?: string) => { editor.value?.focus(); document.execCommand(name, false, value); syncEditor() }
const chooseBlock = (event: Event) => command('formatBlock', (event.target as HTMLSelectElement).value)
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
    autosaveState.value = 'Save failed'
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
    if (editor.value) editor.value.innerHTML = doc.content
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

const share = async () => {
  try { await navigator.clipboard.writeText(plainText.value); toast('Document text copied to your clipboard.') }
  catch { toast('Select the document text and copy it manually.', 'info') }
}

const saveReady = () => {
  if (!documentRecord.value) return
  documentRecord.value.status = 'ready'
  documentRecord.value.updatedAt = new Date().toISOString()
  autosaveState.value = 'Saving…'
  void saveDocument(documentRecord.value).then(() => { autosaveState.value = 'All changes saved'; toast('Document marked ready.') })
    .catch(() => { autosaveState.value = 'Save failed — retry on the next edit' })
}

const replaceExactText = (originalText: string, replacementText: string) => {
  const root = editor.value
  if (!root || !originalText || !replacementText) return false
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Array<{ node: Text; start: number; end: number }> = []
  let combined = ''
  let current = walker.nextNode()
  while (current) {
    const node = current as Text
    const start = combined.length
    combined += node.data
    nodes.push({ node, start, end: combined.length })
    current = walker.nextNode()
  }

  const matchStart = combined.indexOf(originalText)
  if (matchStart < 0 || combined.indexOf(originalText, matchStart + originalText.length) >= 0) return false
  const matchEnd = matchStart + originalText.length
  const first = nodes.find((entry) => entry.end > matchStart)
  const last = nodes.find((entry) => entry.end >= matchEnd)
  if (!first || !last) return false

  const range = document.createRange()
  range.setStart(first.node, matchStart - first.start)
  range.setEnd(last.node, matchEnd - last.start)
  range.deleteContents()
  range.insertNode(document.createTextNode(replacementText))
  root.normalize()
  return true
}

const acceptSuggestion = async (suggestion: DocumentSuggestion) => {
  const doc = documentRecord.value
  if (!doc || !editor.value || suggestionSaving.value) return
  if (reviewOutdated.value) {
    reviewError.value = 'This draft changed after the review. Run the AI review again before applying a rewrite.'
    return
  }
  if (!suggestion.originalText || !suggestion.replacement) {
    reviewError.value = 'This suggestion has no exact source passage, so Minerva will not modify your draft automatically.'
    return
  }

  suggestionSaving.value = suggestion.id
  reviewError.value = ''
  try {
    await createDocumentVersion(doc, 'Before AI rewrite', 'review')
    if (!replaceExactText(suggestion.originalText, suggestion.replacement)) {
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
  if (editor.value) editor.value.innerHTML = documentRecord.value.content || '<p>Start writing your scholarship-specific document here.</p>'
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
        <div class="editor-heading"><p class="workspace-kicker">AI writing editor</p><div><input v-model="documentRecord.title" aria-label="Document title" @input="syncEditor" /><Edit3 :size="18" /></div><p><span><Check :size="15" />{{ autosaveState }}</span><i />{{ modifiedLabel }}<i /><select v-model="selectedVersion" aria-label="Document version" @change="restoreVersion"><option value="current">Current draft</option><option v-for="version in documentRecord.versions" :key="version.id" :value="version.id">{{ version.label }}</option></select><ChevronDown :size="14" /></p></div>
        <div class="editor-head-actions"><button class="btn-secondary" :disabled="versionSaving" @click="createVersion">{{ versionSaving ? 'Saving version...' : 'Create new version' }}</button><button class="btn-primary" @click="share"><Share2 :size="16" />Share</button><button class="icon-button" aria-label="More document options"><MoreVertical :size="19" /></button></div>
      </header>

      <div class="editor-layout">
        <section class="writing-column">
          <div class="rich-toolbar">
            <select aria-label="Text style" @change="chooseBlock"><option value="p">Paragraph</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option></select><i />
            <button aria-label="Bold" @click="command('bold')"><Bold :size="18" /></button><button aria-label="Italic" @click="command('italic')"><Italic :size="18" /></button><button aria-label="Underline" @click="command('underline')"><Underline :size="18" /></button><button aria-label="Strikethrough" @click="command('strikeThrough')"><Strikethrough :size="18" /></button><i />
            <button aria-label="Align left" @click="command('justifyLeft')"><AlignLeft :size="18" /></button><button aria-label="Bulleted list" @click="command('insertUnorderedList')"><List :size="18" /></button><button aria-label="Numbered list" @click="command('insertOrderedList')"><ListOrdered :size="18" /></button><button aria-label="Add link" @click="addLink"><Link2 :size="18" /></button><button aria-label="Add comment"><MessageSquare :size="18" /></button><i />
            <button aria-label="Undo" @click="command('undo')"><Undo2 :size="18" /></button><button aria-label="Redo" @click="command('redo')"><Redo2 :size="18" /></button>
          </div>

          <div class="writing-page">
            <div class="essay-prompt"><Sparkles :size="19" /><div><strong>{{ documentRecord.category }} prompt</strong><p>{{ documentRecord.prompt }}</p></div></div>
            <div ref="editor" class="rich-editor" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true" @input="syncEditor" />
          </div>
          <footer class="editor-statusbar"><span>Words: <strong>{{ wordCount }}</strong></span><i /><span>Target: <strong>{{ target }}</strong></span><i /><span>Readability: <strong :class="readability === 'Good' ? 'text-emerald-600' : 'text-amber-600'">{{ readability }}</strong></span><span class="ml-auto"><Check :size="15" />{{ autosaveState }}</span><button class="btn-primary" @click="saveReady">Save <ChevronDown :size="15" /></button></footer>
        </section>

        <aside class="review-assistant">
          <div class="review-title"><span><Sparkles :size="18" />AI Review Assistant</span><button type="button" class="btn-primary !px-3 !py-2 text-xs" :disabled="reviewLoading" @click="runReview()"><LoaderCircle v-if="reviewLoading" class="animate-spin" :size="15" /><Sparkles v-else :size="15" />{{ reviewLoading ? 'Reviewing…' : 'Review draft' }}</button></div>

          <div v-if="reviewError" class="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-5 text-red-700" role="alert"><AlertCircle class="mt-0.5 shrink-0" :size="15" /><span>{{ reviewError }}</span></div>
          <div v-if="reviewOutdated" class="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">Your draft changed after this review. Run a new review before applying its rewrites.</div>
          <section v-if="reviewLoading && !documentRecord.review" class="review-score-card grid min-h-48 place-content-center text-center"><LoaderCircle class="mx-auto animate-spin text-[#5b45f5]" :size="30" /><strong class="mt-3 text-sm text-[#17136b]">Terra is reviewing your draft</strong><p class="mt-1 text-xs text-slate-500">Checking clarity, structure, grammar, and impact…</p></section>
          <section v-else-if="documentRecord.review" class="review-score-card">
            <div class="overall-row"><div class="score-ring" :style="{ '--score': `${documentRecord.review.overall * 3.6}deg` }"><span>{{ documentRecord.review.overall }}</span></div><div><h2>{{ documentRecord.review.overall >= 82 ? 'Strong draft' : 'Promising draft' }}</h2><p>{{ documentRecord.review.summary }}</p></div></div>
            <div class="review-metrics"><div><span>Clarity</span><strong>{{ documentRecord.review.clarity }}</strong></div><div><span>Grammar</span><strong>{{ documentRecord.review.grammar }}</strong></div><div><span>Structure</span><strong>{{ documentRecord.review.structure }}</strong></div><div><span>Impact</span><strong>{{ documentRecord.review.impact }}</strong></div></div>
            <div v-if="documentRecord.review.strengths?.length" class="mt-4 rounded-xl bg-emerald-50 p-3"><strong class="text-xs text-emerald-800">What already works</strong><ul class="mt-2 space-y-1 text-xs leading-5 text-emerald-700"><li v-for="strength in documentRecord.review.strengths" :key="strength">• {{ strength }}</li></ul></div>
            <h3 class="suggestions-title">Top suggestions <span>{{ documentRecord.review.suggestions.filter((item) => !item.dismissed && !item.accepted).length }}</span></h3>
            <div class="review-suggestions">
              <article v-for="suggestion in documentRecord.review.suggestions.filter((item) => !item.dismissed && !item.accepted)" :key="suggestion.id" :class="['review-suggestion', suggestion.tone, expandedSuggestion === suggestion.id && 'expanded']">
                <button class="suggestion-heading" @click="expandedSuggestion = expandedSuggestion === suggestion.id ? null : suggestion.id"><span>{{ suggestion.title }}</span><ChevronDown :size="16" /></button>
                <div v-if="expandedSuggestion === suggestion.id"><p>{{ suggestion.detail }}</p><button v-if="suggestion.replacement" class="rewrite-button" :disabled="reviewOutdated" @click="previewSuggestion = suggestion.id">Apply rewrite</button><button :disabled="Boolean(suggestionSaving)" @click="dismissSuggestion(suggestion)">Dismiss</button></div>
                <div v-if="previewSuggestion === suggestion.id" class="rewrite-preview"><span>Suggested rewrite</span><p>{{ suggestion.replacement }}</p><div><button class="btn-primary" :disabled="Boolean(suggestionSaving)" @click="acceptSuggestion(suggestion)">{{ suggestionSaving === suggestion.id ? 'Applying...' : 'Accept' }}</button><button class="btn-secondary" :disabled="Boolean(suggestionSaving)" @click="previewSuggestion = null">Cancel</button></div></div>
              </article>
              <p v-if="!documentRecord.review.suggestions.some((item) => !item.dismissed && !item.accepted)" class="rounded-xl bg-emerald-50 p-4 text-center text-xs text-emerald-700">You have worked through every suggestion in this review.</p>
            </div>
          </section>
          <section v-else class="review-score-card text-center"><span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-[#5b45f5]"><Sparkles :size="22" /></span><h2 class="mt-3 text-sm font-bold text-[#17136b]">Get focused feedback</h2><p class="mt-2 text-xs leading-5 text-slate-500">Reviews run only when you request them, so editing never triggers an AI charge.</p><button type="button" class="btn-primary mt-4" @click="runReview()">Review this draft</button></section>
          <section class="ask-ai-card"><form @submit.prevent="askAi"><input v-model="aiPrompt" placeholder="Ask AI to focus on something…" :disabled="reviewLoading" /><button :disabled="reviewLoading || !aiPrompt.trim()" aria-label="Send focused review request"><LoaderCircle v-if="reviewLoading" class="animate-spin" :size="17" /><ArrowRight v-else :size="17" /></button></form><div><button :disabled="reviewLoading" @click="runReview('Improve clarity without changing my voice.')">Improve clarity</button><button :disabled="reviewLoading" @click="runReview('Make the evidence and measurable impact stronger.')">Stronger impact</button><button :disabled="reviewLoading" @click="runReview('Make the draft more concise and remove repetition.')">Shorten</button></div></section>
        </aside>
      </div>
    </div>
  </main>
</template>

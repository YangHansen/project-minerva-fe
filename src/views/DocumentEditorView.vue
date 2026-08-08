<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlignLeft, ArrowRight, Bold, Check, ChevronDown, Edit3, Italic, Link2, List, ListOrdered, MessageSquare, MoreVertical, Redo2, Share2, Sparkles, Strikethrough, Underline, Undo2 } from 'lucide-vue-next'
import type { DocumentSuggestion } from '../types'
import { getScholarship } from '../data/scholarships'
import { useAppState } from '../composables/useAppState'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'

const route = useRoute()
const router = useRouter()
const { selectedId, getDocument, toast } = useAppState()
const selected = computed(() => selectedId.value ? getScholarship(selectedId.value) : undefined)
const documentRecord = computed(() => selectedId.value ? getDocument(selectedId.value, String(route.params.documentId || '')) : undefined)
const editor = ref<HTMLElement | null>(null)
const autosaveState = ref('All changes saved')
const selectedVersion = ref('current')
const expandedSuggestion = ref<string | null>('opening')
const previewSuggestion = ref<string | null>(null)
const aiPrompt = ref('')
let saveTimer = 0
let reviewTimer = 0

const plainText = computed(() => documentRecord.value?.content.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || '')
const wordCount = computed(() => plainText.value ? plainText.value.split(/\s+/).length : 0)
const target = computed(() => documentRecord.value?.kind === 'cv' || documentRecord.value?.kind === 'transcript' ? 'Concise and relevant' : documentRecord.value?.kind === 'essay' ? '500–650' : '400–700')
const readability = computed(() => wordCount.value < 80 ? 'Developing' : wordCount.value > 800 ? 'Dense' : 'Good')
const modifiedLabel = computed(() => {
  if (!documentRecord.value) return ''
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(documentRecord.value.updatedAt).getTime()) / 60000))
  return minutes < 2 ? 'Last edited just now' : minutes < 60 ? `Last edited ${minutes} minutes ago` : `Last edited ${Math.floor(minutes / 60)} hours ago`
})

const clamp = (value: number) => Math.min(96, Math.max(55, Math.round(value)))
const buildSuggestions = (): DocumentSuggestion[] => {
  const provider = selected.value?.provider || 'the scholarship provider'
  return [
    { id: 'opening', title: 'Tighten opening sentence', detail: 'Open with a specific situation and responsibility instead of a general claim.', replacement: `When I saw a challenge my community could not solve alone, I organized a focused response and took responsibility for its outcome—an approach that reflects ${provider}'s leadership values.`, tone: 'purple' },
    { id: 'impact', title: 'Replace vague claims with measurable impact', detail: 'Add one concrete result, number, or observable outcome.', replacement: 'The initiative reached more than 300 people, mobilized 24 volunteers, and created a process the team still uses today.', tone: 'yellow' },
    { id: 'shorten', title: 'Shorten the longest paragraph', detail: 'Keep one idea per paragraph and remove repeated setup.', replacement: 'I clarified the goal, assigned responsibilities, and measured progress weekly so the team could adapt quickly.', tone: 'blue' },
    { id: 'alignment', title: 'Strengthen scholarship alignment', detail: `Connect the lesson directly to ${provider}'s priorities and your return plan.`, replacement: `This experience prepared me to use the opportunity from ${provider} to build practical capacity and bring the learning back to my community.`, tone: 'green' },
  ]
}
const updateReview = () => {
  const doc = documentRecord.value
  if (!doc) return
  const lengthScore = Math.min(22, wordCount.value / 18)
  const evidenceScore = /\d|percent|people|team|result|impact/i.test(plainText.value) ? 12 : 4
  const clarity = clamp(62 + lengthScore + (/\b(because|therefore|which)\b/i.test(plainText.value) ? 5 : 1))
  const impact = clamp(62 + lengthScore + evidenceScore)
  const structure = clamp(65 + lengthScore + (doc.content.match(/<p|\n\n/g)?.length || 0) * 2)
  const grammar = clamp(72 + Math.min(14, wordCount.value / 35))
  const old = new Map((doc.review?.suggestions || []).map((item) => [item.id, item]))
  const suggestions = buildSuggestions().map((item) => ({ ...item, dismissed: old.get(item.id)?.dismissed, accepted: old.get(item.id)?.accepted }))
  const overall = Math.round((clarity + grammar + structure + impact) / 4)
  doc.review = { overall, clarity, grammar, structure, impact, summary: overall >= 82 ? 'Strong draft. A few focused refinements will make the evidence even more compelling.' : 'Promising foundation. Add specific evidence and tighten the connection to the scholarship.', suggestions, reviewedAt: new Date().toISOString() }
}

const syncEditor = () => {
  const doc = documentRecord.value
  if (!doc || !editor.value) return
  doc.content = editor.value.innerHTML
  doc.status = doc.content.replace(/<[^>]+>/g, '').trim() ? 'draft' : 'missing'
  doc.updatedAt = new Date().toISOString()
  autosaveState.value = 'Saving…'
  window.clearTimeout(saveTimer)
  window.clearTimeout(reviewTimer)
  saveTimer = window.setTimeout(() => { autosaveState.value = 'All changes saved' }, 650)
  reviewTimer = window.setTimeout(updateReview, 800)
}
const command = (name: string, value?: string) => { editor.value?.focus(); document.execCommand(name, false, value); syncEditor() }
const chooseBlock = (event: Event) => command('formatBlock', (event.target as HTMLSelectElement).value)
const addLink = () => { const url = window.prompt('Paste a link'); if (url) command('createLink', url) }
const createVersion = () => {
  const doc = documentRecord.value
  if (!doc) return
  doc.versions.push({ id: `version-${Date.now()}`, label: `Version ${doc.versions.length + 1}`, content: doc.content, createdAt: new Date().toISOString() })
  doc.updatedAt = new Date().toISOString()
  toast(`Version ${doc.versions.length} created.`)
}
const restoreVersion = async () => {
  const doc = documentRecord.value
  if (!doc || selectedVersion.value === 'current') return
  const version = doc.versions.find((item) => item.id === selectedVersion.value)
  if (!version || !window.confirm(`Restore ${version.label}? Your current draft will remain available as a new version.`)) return
  doc.versions.push({ id: `version-${Date.now()}`, label: `Version ${doc.versions.length + 1}`, content: doc.content, createdAt: new Date().toISOString() })
  doc.content = version.content
  await nextTick()
  if (editor.value) editor.value.innerHTML = version.content
  selectedVersion.value = 'current'
  syncEditor()
  toast(`${version.label} restored.`)
}
const share = async () => {
  try { await navigator.clipboard.writeText(plainText.value); toast('Document text copied to your clipboard.') }
  catch { toast('Select the document text and copy it manually.', 'info') }
}
const saveReady = () => { if (!documentRecord.value) return; documentRecord.value.status = 'ready'; documentRecord.value.updatedAt = new Date().toISOString(); autosaveState.value = 'All changes saved'; toast('Document marked ready.') }
const acceptSuggestion = (suggestion: DocumentSuggestion) => {
  if (!documentRecord.value || !editor.value) return
  editor.value.insertAdjacentHTML('beforeend', `<p>${suggestion.replacement}</p>`)
  suggestion.accepted = true
  previewSuggestion.value = null
  syncEditor()
  toast('Rewrite added to the draft.')
}
const dismissSuggestion = (suggestion: DocumentSuggestion) => { suggestion.dismissed = true; previewSuggestion.value = null; toast('Suggestion dismissed.', 'info') }
const quickReview = (id: string) => { const suggestion = documentRecord.value?.review?.suggestions.find((item) => item.id === id); if (suggestion) { suggestion.dismissed = false; expandedSuggestion.value = id; previewSuggestion.value = id } }
const askAi = () => { if (!aiPrompt.value.trim()) return; quickReview('alignment'); aiPrompt.value = ''; toast('A focused scholarship-alignment suggestion is ready.', 'info') }

onMounted(async () => {
  if (!selected.value || !documentRecord.value) { router.replace('/documents'); return }
  await nextTick()
  if (editor.value) editor.value.innerHTML = documentRecord.value.content || '<p>Start writing your scholarship-specific document here.</p>'
  updateReview()
})
onBeforeUnmount(() => { window.clearTimeout(saveTimer); window.clearTimeout(reviewTimer) })
</script>

<template>
  <main class="workspace-shell document-editor-shell">
    <WorkspaceSidebar active="documents" />
    <div v-if="documentRecord && selected" class="workspace-main document-editor-main">
      <header class="editor-topbar">
        <div class="editor-heading"><p class="workspace-kicker">AI writing editor</p><div><input v-model="documentRecord.title" aria-label="Document title" @input="syncEditor" /><Edit3 :size="18" /></div><p><span><Check :size="15" />{{ autosaveState }}</span><i />{{ modifiedLabel }}<i /><select v-model="selectedVersion" aria-label="Document version" @change="restoreVersion"><option value="current">Current draft</option><option v-for="version in documentRecord.versions" :key="version.id" :value="version.id">{{ version.label }}</option></select><ChevronDown :size="14" /></p></div>
        <div class="editor-head-actions"><button class="btn-secondary" @click="createVersion">Create new version</button><button class="btn-primary" @click="share"><Share2 :size="16" />Share</button><button class="icon-button" aria-label="More document options"><MoreVertical :size="19" /></button></div>
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
          <div class="review-title"><span><Sparkles :size="18" />AI Review Assistant</span><ChevronDown :size="17" /></div>
          <section v-if="documentRecord.review" class="review-score-card">
            <div class="overall-row"><div class="score-ring" :style="{ '--score': `${documentRecord.review.overall * 3.6}deg` }"><span>{{ documentRecord.review.overall }}</span></div><div><h2>{{ documentRecord.review.overall >= 82 ? 'Strong draft' : 'Promising draft' }}</h2><p>{{ documentRecord.review.summary }}</p></div></div>
            <div class="review-metrics"><div><span>Clarity</span><strong>{{ documentRecord.review.clarity }}</strong></div><div><span>Grammar</span><strong>{{ documentRecord.review.grammar }}</strong></div><div><span>Structure</span><strong>{{ documentRecord.review.structure }}</strong></div><div><span>Impact</span><strong>{{ documentRecord.review.impact }}</strong></div></div>
            <h3 class="suggestions-title">Top suggestions <span>{{ documentRecord.review.suggestions.filter((item) => !item.dismissed && !item.accepted).length }}</span></h3>
            <div class="review-suggestions">
              <article v-for="suggestion in documentRecord.review.suggestions.filter((item) => !item.dismissed && !item.accepted)" :key="suggestion.id" :class="['review-suggestion', suggestion.tone, expandedSuggestion === suggestion.id && 'expanded']">
                <button class="suggestion-heading" @click="expandedSuggestion = expandedSuggestion === suggestion.id ? null : suggestion.id"><span>{{ suggestion.title }}</span><ChevronDown :size="16" /></button>
                <div v-if="expandedSuggestion === suggestion.id"><p>{{ suggestion.detail }}</p><button class="rewrite-button" @click="previewSuggestion = suggestion.id">Apply rewrite</button><button @click="dismissSuggestion(suggestion)">Dismiss</button></div>
                <div v-if="previewSuggestion === suggestion.id" class="rewrite-preview"><span>Suggested rewrite</span><p>{{ suggestion.replacement }}</p><div><button class="btn-primary" @click="acceptSuggestion(suggestion)">Accept</button><button class="btn-secondary" @click="previewSuggestion = null">Cancel</button></div></div>
              </article>
            </div>
          </section>
          <section class="ask-ai-card"><form @submit.prevent="askAi"><input v-model="aiPrompt" placeholder="Ask AI to improve this section..." /><button aria-label="Send request"><ArrowRight :size="17" /></button></form><div><button @click="quickReview('opening')">Improve clarity</button><button @click="quickReview('impact')">Stronger impact</button><button @click="quickReview('shorten')">Shorten</button></div></section>
        </aside>
      </div>
    </div>
  </main>
</template>

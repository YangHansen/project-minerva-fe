<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FileText, Folder, Sparkles, WandSparkles } from 'lucide-vue-next'
import { getScholarship } from '../data/scholarships'
import { useAppState } from '../composables/useAppState'
import WorkspaceSidebar from '../components/dashboard/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/dashboard/WorkspaceTopbar.vue'

type DocumentKind = 'cv' | 'essay'
type Drafts = Record<string, Partial<Record<DocumentKind, string>>>
const active = ref<DocumentKind>('essay')
const { selectedId, toast } = useAppState()
const selected = computed(() => selectedId.value ? getScholarship(selectedId.value) : undefined)
const drafts = ref<Drafts>(JSON.parse(localStorage.getItem('minerva-document-drafts') || '{}'))
const draft = computed({ get: () => selectedId.value ? drafts.value[selectedId.value]?.[active.value] || '' : '', set: (value: string) => { if (selectedId.value) { drafts.value[selectedId.value] ||= {}; drafts.value[selectedId.value][active.value] = value } } })
watch(drafts, (value) => localStorage.setItem('minerva-document-drafts', JSON.stringify(value)), { deep: true })
const wordCount = computed(() => draft.value.trim() ? draft.value.trim().split(/\s+/).length : 0)
const suggestions = computed(() => active.value === 'essay' ? [
  ['Clarify your opening', 'Name the community problem you want to solve in the first two sentences.'],
  ['Show scholarship fit', `Connect your return plan to ${selected.value?.provider || 'the scholarship provider'}’s purpose.`],
  ['Make impact measurable', 'Add one outcome, number, or concrete change you plan to deliver.'],
] : [
  ['Lead with outcomes', 'Move your most relevant leadership or impact achievement near the top.'],
  ['Keep it scannable', 'Use short, action-led bullets and quantify two results.'],
  ['Match the opportunity', `Surface experience that supports ${selected.value?.name || 'this scholarship'}.`],
])
const review = () => toast('Writing guidance refreshed for this scholarship.', 'info')
</script>

<template>
  <main class="workspace-shell"><WorkspaceSidebar active="documents"/><div class="workspace-main"><WorkspaceTopbar title="Document studio" subtitle="Scholarship-specific writing guidance, saved on this device."/><div class="workspace-content">
    <section v-if="!selected" class="notion-select-state"><div class="notion-select-icon"><Folder :size="31"/></div><p class="text-xs font-extrabold uppercase tracking-[.16em] text-[#5b45f5]">Document workspace</p><h1>Select a scholarship first</h1><p>Your CV and writing drafts stay inside the scholarship you are preparing for.</p><RouterLink to="/scholarships" class="btn-primary">Browse scholarships</RouterLink></section>
    <section v-else class="document-studio"><header class="document-studio-head"><div><p class="text-xs font-extrabold uppercase tracking-[.16em] text-[#5b45f5]">{{ selected.name }} folder</p><h2>Write with scholarship context</h2><p>{{ selected.provider }} · {{ selected.country }} · drafts remain separate from every other application.</p></div><button class="btn-secondary" @click="review"><WandSparkles :size="16"/>Refresh guidance</button></header>
      <div class="document-tabs" role="tablist"><button v-for="item in [{id:'essay',label:'Personal statement'},{id:'cv',label:'CV notes'}]" :key="item.id" :class="active===item.id&&'active'" @click="active=item.id as DocumentKind">{{ item.label }}</button><span class="ml-auto">{{ wordCount }} words</span></div>
      <div class="document-workspace"><div class="document-editor"><div class="document-editor-title"><FileText :size="18"/><input :value="active==='essay' ? 'Personal statement' : 'CV notes'" aria-label="Document title" readonly></div><textarea v-model="draft" :placeholder="active==='essay' ? `Start your statement for ${selected.name}. Explain your motivation, relevant experience, and impact after graduation…` : `Outline the CV achievements most relevant to ${selected.name}…`"/></div><aside class="document-guidance"><p class="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.15em] text-[#5b45f5]"><Sparkles :size="15"/>Writing suggestions</p><div v-for="suggestion in suggestions" :key="suggestion[0]" class="document-suggestion"><strong>{{ suggestion[0] }}</strong><p>{{ suggestion[1] }}</p><button @click="toast('Suggestion saved for your next revision.', 'info')">Keep in mind</button></div><p class="document-disclaimer">Guidance is a frontend preparation aid, not an external AI review.</p></aside></div>
    </section>
  </div></div></main>
</template>

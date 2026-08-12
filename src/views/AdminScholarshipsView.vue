<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Check, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-vue-next'
import { apiRequest } from '../api'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'

interface AdminScholarship {
  id: string
  name: string
  provider: string
  country: string
  university: string
  program: string
  educationLevel: string
  fieldOfStudy: string
  fundingType: string
  scholarshipType: string
  eligibilitySummary: string
  eligibilityRequirements?: string
  deadline: string
  applicationUrl: string
  requiredDocuments: string[]
  featured: boolean
  baselineMatchPercentage?: number
  minGpa?: number
  minIeltsScore?: number
  minWorkExperienceYears?: number
  apostilleRequired?: boolean
  submissionMethod?: string
  documentSubmissionGuidelines?: string
  coreValues?: string[]
}

type FormModel = Omit<AdminScholarship, 'id' | 'requiredDocuments' | 'coreValues' | 'deadline'> & { deadline: string; requiredDocumentsText: string; coreValuesText: string }

const items = ref<AdminScholarship[]>([])
const loading = ref(true)
const saving = ref(false)
const deletingId = ref('')
const error = ref('')
const query = ref('')
const isOpen = ref(false)
const editingId = ref<string | null>(null)
const emptyForm = (): FormModel => ({
  name: '', provider: '', country: '', university: '', program: '', educationLevel: 'Master', fieldOfStudy: '', fundingType: 'Fully funded', scholarshipType: 'Government', eligibilitySummary: '', eligibilityRequirements: '', deadline: '', applicationUrl: '', requiredDocumentsText: '', featured: false, baselineMatchPercentage: 50, minGpa: 0, minIeltsScore: 0, minWorkExperienceYears: 0, apostilleRequired: false, submissionMethod: 'online', documentSubmissionGuidelines: '', coreValuesText: '',
})
const form = ref<FormModel>(emptyForm())
const filtered = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return items.value
  return items.value.filter((item) => `${item.name} ${item.provider} ${item.country} ${item.fieldOfStudy}`.toLowerCase().includes(needle))
})
const toDateInput = (value: string) => value ? new Date(value).toISOString().slice(0, 10) : ''
const words = (value: string) => value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)
const load = async () => {
  loading.value = true; error.value = ''
  try {
    const result = await apiRequest<{ scholarships: AdminScholarship[] }>('/api/admin/scholarships')
    items.value = result.scholarships || []
  } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Could not load the scholarship catalog.' }
  finally { loading.value = false }
}
const openCreate = () => { editingId.value = null; form.value = emptyForm(); isOpen.value = true }
const openEdit = (item: AdminScholarship) => {
  editingId.value = item.id
  form.value = { ...emptyForm(), ...item, deadline: toDateInput(item.deadline), requiredDocumentsText: (item.requiredDocuments || []).join('\n'), coreValuesText: (item.coreValues || []).join('\n') }
  isOpen.value = true
}
const payload = () => ({
  ...form.value,
  deadline: new Date(`${form.value.deadline}T23:59:59.000Z`).toISOString(),
  requiredDocuments: words(form.value.requiredDocumentsText),
  coreValues: words(form.value.coreValuesText),
})
const save = async () => {
  saving.value = true; error.value = ''
  try {
    const result = editingId.value
      ? await apiRequest<{ scholarship: AdminScholarship }>(`/api/admin/scholarships/${editingId.value}`, { method: 'PUT', body: payload() })
      : await apiRequest<{ scholarship: AdminScholarship }>('/api/admin/scholarships', { method: 'POST', body: payload() })
    if (editingId.value) items.value = items.value.map((item) => item.id === result.scholarship.id ? result.scholarship : item)
    else items.value = [result.scholarship, ...items.value]
    isOpen.value = false
  } catch (reason) { error.value = reason instanceof Error ? reason.message : 'Could not save scholarship.' }
  finally { saving.value = false }
}
const remove = async (item: AdminScholarship) => {
  if (!confirm(`Delete “${item.name}”? This cannot be undone.`)) return
  deletingId.value = item.id; error.value = ''
  try { await apiRequest(`/api/admin/scholarships/${item.id}`, { method: 'DELETE' }); items.value = items.value.filter((entry) => entry.id !== item.id) }
  catch (reason) { error.value = reason instanceof Error ? reason.message : 'Could not delete scholarship.' }
  finally { deletingId.value = '' }
}
onMounted(load)
</script>

<template>
  <main class="workspace-shell">
    <WorkspaceSidebar active="admin" />
    <div class="workspace-main">
      <WorkspaceTopbar title="Scholarship administration" subtitle="Create, update, publish, or remove scholarships in Minerva's catalog." />
      <section class="workspace-content mx-auto w-full max-w-[1440px]">
        <div class="mb-6 flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-violet-100 bg-gradient-to-r from-violet-50 to-white p-6">
          <div><p class="workspace-kicker"><ShieldCheck :size="15" class="mr-1 inline" />Admin only</p><h1 class="mt-1 text-2xl font-black text-[#17136b]">Scholarship catalog</h1><p class="mt-1 text-sm text-slate-500">{{ items.length }} records available to Minerva users.</p></div>
          <button class="btn-primary inline-flex items-center gap-2" @click="openCreate"><Plus :size="17" />Add scholarship</button>
        </div>
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3"><label class="flex min-w-[280px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-400"><Search :size="17" /><input v-model="query" class="w-full bg-transparent text-sm text-slate-700 outline-none" placeholder="Search catalog" /></label><button class="btn-secondary inline-flex items-center gap-2" :disabled="loading" @click="load"><RefreshCw :size="16" />Refresh</button></div>
        <p v-if="error" class="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{{ error }}</p>
        <div v-if="loading" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><div v-for="n in 6" :key="n" class="h-52 animate-pulse rounded-2xl bg-slate-100" /></div>
        <div v-else-if="filtered.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><article v-for="item in filtered" :key="item.id" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div class="flex gap-3"><div class="min-w-0 flex-1"><p class="text-[11px] font-black uppercase tracking-[.1em] text-violet-500">{{ item.country }} · {{ item.educationLevel }}</p><h2 class="mt-1 line-clamp-2 text-lg font-black text-[#17136b]">{{ item.name }}</h2><p class="mt-1 truncate text-sm text-slate-500">{{ item.provider }} · {{ item.program }}</p></div><span v-if="item.featured" class="h-fit rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black text-violet-700">Featured</span></div><p class="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">{{ item.eligibilitySummary }}</p><div class="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span class="text-xs font-bold text-slate-500">Due {{ new Date(item.deadline).toLocaleDateString() }}</span><span class="flex gap-2"><button class="rounded-lg p-2 text-violet-600 hover:bg-violet-50" :aria-label="`Edit ${item.name}`" @click="openEdit(item)"><Pencil :size="17" /></button><button class="rounded-lg p-2 text-rose-600 hover:bg-rose-50" :disabled="deletingId === item.id" :aria-label="`Delete ${item.name}`" @click="remove(item)"><Trash2 :size="17" /></button></span></div></article></div>
        <div v-else class="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-500">No scholarships match that search.</div>
      </section>
    </div>
  </main>
  <Teleport to="body"><div v-if="isOpen" class="fixed inset-0 z-[100] overflow-y-auto bg-[#17136b]/40 p-4 backdrop-blur-sm"><form class="mx-auto my-6 w-full max-w-4xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8" @submit.prevent="save"><div class="mb-6 flex items-start justify-between gap-4"><div><p class="workspace-kicker">Admin catalog</p><h2 class="mt-1 text-2xl font-black text-[#17136b]">{{ editingId ? 'Edit scholarship' : 'Add scholarship' }}</h2></div><button type="button" class="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Close" @click="isOpen=false"><X :size="22" /></button></div><div class="grid gap-4 sm:grid-cols-2"><label class="sm:col-span-2">Scholarship name<input v-model.trim="form.name" required /></label><label>Provider<input v-model.trim="form.provider" required /></label><label>Country<input v-model.trim="form.country" required /></label><label>University<input v-model.trim="form.university" required /></label><label>Programme<input v-model.trim="form.program" required /></label><label>Education level<input v-model.trim="form.educationLevel" required /></label><label>Field of study<input v-model.trim="form.fieldOfStudy" required /></label><label>Funding type<input v-model.trim="form.fundingType" required /></label><label>Scholarship type<input v-model.trim="form.scholarshipType" required /></label><label>Deadline<input v-model="form.deadline" required type="date" /></label><label>Application URL<input v-model.trim="form.applicationUrl" required type="url" placeholder="https://…" /></label><label class="sm:col-span-2">Short eligibility summary<textarea v-model.trim="form.eligibilitySummary" required rows="3" /></label><label class="sm:col-span-2">Eligibility requirements<textarea v-model.trim="form.eligibilityRequirements" rows="3" /></label><label>Minimum GPA<input v-model.number="form.minGpa" min="0" max="4" step="0.01" type="number" /></label><label>Minimum IELTS<input v-model.number="form.minIeltsScore" min="0" max="9" step="0.5" type="number" /></label><label>Minimum experience (years)<input v-model.number="form.minWorkExperienceYears" min="0" max="80" type="number" /></label><label>Baseline match %<input v-model.number="form.baselineMatchPercentage" min="0" max="99" type="number" /></label><label class="sm:col-span-2">Required documents <small>One item per line</small><textarea v-model="form.requiredDocumentsText" rows="3" /></label><label class="sm:col-span-2">Core values <small>One item per line</small><textarea v-model="form.coreValuesText" rows="2" /></label><label class="sm:col-span-2">Submission guidelines<textarea v-model="form.documentSubmissionGuidelines" rows="2" /></label><label class="flex items-center gap-2 text-sm font-bold text-[#17136b]"><input v-model="form.featured" type="checkbox" />Featured in Discover</label><label class="flex items-center gap-2 text-sm font-bold text-[#17136b]"><input v-model="form.apostilleRequired" type="checkbox" />Apostille required</label></div><div class="mt-7 flex justify-end gap-3"><button class="btn-secondary" type="button" @click="isOpen=false">Cancel</button><button class="btn-primary inline-flex items-center gap-2" :disabled="saving" type="submit"><Check :size="17" />{{ saving ? 'Saving…' : 'Save scholarship' }}</button></div></form></div></Teleport>
</template>

<style scoped>
label { display: grid; gap: 7px; color: #17136b; font-size: .75rem; font-weight: 800; }
input:not([type='checkbox']), textarea { width: 100%; border: 1px solid #dbe1ee; border-radius: 10px; padding: 10px 12px; color: #334155; font-size: .9rem; font-weight: 500; outline: none; }
input:focus, textarea:focus { border-color: #7c5cff; box-shadow: 0 0 0 3px #ede9fe; }
textarea { resize: vertical; }
small { color: #94a3b8; font-weight: 600; }
</style>
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Files, GraduationCap, Plus, Target, Trash2, UploadCloud, UserRound } from 'lucide-vue-next'
import type { UserProfile } from '../types'
import { useAppState } from '../composables/useAppState'

const router = useRouter()
const route = useRoute()
const { profile, session, toast } = useAppState()
const error = ref('')
const uploaded = ref<Record<string, string>>({})
const fieldSuggestions = ['Accounting', 'Artificial Intelligence', 'Business Administration', 'Computer Science', 'Data Science', 'Economics', 'Education', 'Engineering', 'Environmental Science', 'International Relations', 'Law', 'Medicine', 'Public Health', 'Public Policy', 'Social Sciences']
const documents = ['CV', 'Personal statement']
const steps = [
  { label: 'Personal information', icon: UserRound },
  { label: 'Last education', icon: GraduationCap },
  { label: 'Scholarship goals', icon: Target },
  { label: 'Application documents', icon: Files },
]

const saved = (() => {
  try { return JSON.parse(localStorage.getItem('minerva-onboarding-draft') || 'null') as Partial<UserProfile> | null }
  catch { return null }
})()
const seed = saved || profile.value || {}
const defaults: UserProfile = {
  name: session.value?.name || '', age: null, country: '', destinationCountry: '',
  currentEducationLevel: '', targetEducationLevel: '', gpa: '', fieldOfStudy: '',
  scholarshipType: '', fundingPreference: '', englishLevel: '', ieltsScore: '',
  languageCertificate: '', languageScore: '', languageCertificates: [], availableDocuments: [], enrollmentYear: '',
}
const form = reactive<UserProfile>({
  ...defaults,
  ...seed,
  gpa: seed.gpa || '',
  languageCertificate: seed.languageCertificate || (seed.ieltsScore ? 'IELTS' : ''),
  languageScore: seed.languageScore || seed.ieltsScore || '',
  languageCertificates: seed.languageCertificates?.length ? seed.languageCertificates.map((item) => ({ ...item })) : (seed.languageCertificate || seed.ieltsScore ? [{ type: seed.languageCertificate || 'IELTS', score: seed.languageScore || seed.ieltsScore || '' }] : []),
  availableDocuments: [...(seed.availableDocuments || [])].filter((item) => documents.includes(item)),
})
const storedStep = Number(localStorage.getItem('minerva-onboarding-step') || 0)
const step = ref(Math.max(0, Math.min(4, storedStep > 4 ? 3 : storedStep)))
const requiresGpa = computed(() => ['Master', 'Doctorate'].includes(form.targetEducationLevel))

const done = (index: number) => [
  Boolean(form.name.trim() && form.age && form.country),
  Boolean(form.currentEducationLevel && form.targetEducationLevel && form.fieldOfStudy.trim() && (!requiresGpa.value || form.gpa.trim())),
  Boolean(form.destinationCountry && form.enrollmentYear && form.scholarshipType && form.fundingPreference),
  form.availableDocuments.length > 0,
][index] || false
const requiredComplete = computed(() => [0, 1, 2].every(done))
const progress = computed(() => [30, 30, 30, 10].reduce((total, weight, index) => total + (done(index) ? weight : 0), 0))
const reviewRows = computed(() => [
  ['Full name', form.name], ['Age', form.age], ['Country', form.country],
  ['Last education', form.currentEducationLevel], ['Target education', form.targetEducationLevel], ...(requiresGpa.value ? [['GPA', form.gpa]] : []),
  ['Target field of study', form.fieldOfStudy], ['Destination', form.destinationCountry], ['Enrollment year', form.enrollmentYear],
  ['Scholarship type', form.scholarshipType], ['Funding preference', form.fundingPreference],
  ['Language certificates', form.languageCertificates.filter((item) => item.type).map((item) => `${item.type}${item.score ? ` · ${item.score}` : ''}`).join(', ') || 'Not provided'],
])

watch(form, (value) => localStorage.setItem('minerva-onboarding-draft', JSON.stringify(value)), { deep: true })
watch(step, (value) => localStorage.setItem('minerva-onboarding-step', String(value)))
watch(() => form.languageCertificates, (certificates) => {
  const primary = certificates.find((item) => item.type)
  form.languageCertificate = primary?.type || ''
  form.languageScore = primary?.score || ''
}, { deep: true })
watch(() => form.targetEducationLevel, () => { if (!requiresGpa.value) form.gpa = '' })

const addCertificate = () => form.languageCertificates.push({ type: '', score: '' })
const removeCertificate = (index: number) => form.languageCertificates.splice(index, 1)

const upload = (document: string, event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploaded.value = { ...uploaded.value, [document]: file.name }
  if (!form.availableDocuments.includes(document)) form.availableDocuments.push(document)
}
const canReach = (target: number) => target <= step.value || Array.from({ length: Math.min(target, 3) }, (_, index) => done(index)).every(Boolean)
const go = (target: number) => {
  if (!canReach(target)) {
    error.value = 'Complete the required fields on this step before moving forward.'
    return
  }
  if (target === 4 && !requiredComplete.value) {
    error.value = 'Complete the three required profile sections before reviewing your profile.'
    return
  }
  error.value = ''
  step.value = target
}
const next = () => {
  if (step.value < 3 && !done(step.value)) {
    error.value = 'Complete the required fields on this step before moving forward.'
    return
  }
  go(step.value + 1)
}
const save = () => {
  if (!requiredComplete.value) {
    error.value = 'Complete Personal information, Last education, and Scholarship goals first.'
    return
  }
  profile.value = { ...form, availableDocuments: [...form.availableDocuments] }
  localStorage.removeItem('minerva-onboarding-draft')
  localStorage.removeItem('minerva-onboarding-step')
  toast('Your preferences are saved. Let’s find your best matches!')
  const destination = typeof route.query.return === 'string' && route.query.return.startsWith('/') ? route.query.return : '/scholarships?recommended=1'
  router.push(destination)
}
</script>

<template>
  <main class="onboarding-page">
    <div class="onboarding-shell">
      <aside class="onboarding-sidebar">
        <img src="/minerva-logo.png" alt="Minerva" class="onboarding-logo" />
        <p class="onboarding-progress-label">Profile progress · {{ progress }}%</p>
        <div class="onboarding-progress"><div :style="{ width: `${progress}%` }" /></div>
        <nav class="onboarding-steps" aria-label="Profile steps">
          <button v-for="(item, index) in steps" :key="item.label" :class="{ active: index === step, complete: done(index) }" @click="go(index)">
            <Check v-if="done(index) && index !== step" :size="18" />
            <component :is="item.icon" v-else :size="18" />
            <span>{{ item.label }}</span>
          </button>
          <button :class="{ active: step === 4, complete: requiredComplete && step !== 4 }" @click="go(4)">
            <Check v-if="requiredComplete && step !== 4" :size="18" /><ClipboardCheck v-else :size="18" /><span>Review profile</span>
          </button>
        </nav>
      </aside>

      <section class="onboarding-card">
        <header>
          <p v-if="step < 4" class="eyebrow">Step {{ step + 1 }} of 4</p>
          <p v-else class="eyebrow">Final review</p>
          <h1>{{ step < 4 ? steps[step].label : 'Your scholarship profile' }}</h1>
          <p v-if="step < 3">Your progress saves automatically. Required fields must be completed before moving forward.</p>
          <p v-else-if="step === 4">Review every preference that Minerva will use to tailor your scholarship matches.</p>
        </header>

        <div class="onboarding-form-area">
          <div v-if="step === 0" class="onboarding-fields">
            <label class="field-label span-2">Full name<input v-model="form.name" class="field" placeholder="Enter your full name" /></label>
            <label class="field-label">Age<input v-model.number="form.age" type="number" min="15" class="field" placeholder="e.g. 24" /></label>
            <label class="field-label">Country<select v-model="form.country" class="field"><option disabled value="">Select your country</option><option>Indonesia</option><option>Malaysia</option><option>Singapore</option><option>India</option><option>Philippines</option><option>Other</option></select></label>
          </div>

          <div v-else-if="step === 1" class="onboarding-fields">
            <label class="field-label">Last education<select v-model="form.currentEducationLevel" class="field"><option disabled value="">Select your last education</option><option>High school</option><option>Diploma</option><option>Bachelor</option><option>Master</option><option>Doctorate</option></select></label>
            <label class="field-label">Target education<select v-model="form.targetEducationLevel" class="field"><option disabled value="">Select your target education</option><option>Bachelor</option><option>Master</option><option>Doctorate</option></select></label>
            <label v-if="requiresGpa" class="field-label">GPA <span class="text-red-500">Required</span><input v-model="form.gpa" required class="field" inputmode="decimal" placeholder="e.g. 3.75 / 4.00" /><small>Required for master’s and doctorate applications.</small></label>
            <label class="field-label" :class="!requiresGpa && 'span-2'">Target field of study<input v-model="form.fieldOfStudy" list="field-options" class="field" placeholder="Start typing or choose a field" /><small>Choose a suggestion or enter any field.</small></label>
            <datalist id="field-options"><option v-for="item in fieldSuggestions" :key="item" :value="item" /></datalist>
          </div>

          <div v-else-if="step === 2" class="onboarding-fields">
            <label class="field-label">Destination<select v-model="form.destinationCountry" class="field"><option disabled value="">Choose a destination</option><option>Any destination</option><option>United Kingdom</option><option>Germany</option><option>Australia</option><option>Japan</option><option>United States</option><option>Europe</option></select></label>
            <label class="field-label">Enrollment year<select v-model="form.enrollmentYear" class="field"><option disabled value="">Choose a year</option><option>2027</option><option>2028</option><option>2029</option><option>2030</option></select></label>
            <label class="field-label">Scholarship type<select v-model="form.scholarshipType" class="field"><option disabled value="">Choose a scholarship type</option><option>All</option><option>Government</option><option>University</option><option>International</option></select></label>
            <label class="field-label">Funding<select v-model="form.fundingPreference" class="field"><option disabled value="">Choose a funding preference</option><option>Fully funded</option><option>Partial funding</option><option>Both</option></select></label>
            <section class="span-2 rounded-2xl border border-violet-100 bg-violet-50/40 p-5">
              <div class="flex flex-wrap items-center justify-between gap-3"><div><p class="field-label">Language certificates <span class="optional">If available</span></p><p class="mt-1 text-xs text-slate-500">Add every certificate you already hold. Each score is saved separately.</p></div><button type="button" class="inline-flex items-center gap-1 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-extrabold text-[#5b45f5]" @click="addCertificate"><Plus :size="15" />Add certificate</button></div>
              <p v-if="!form.languageCertificates.length" class="mt-5 rounded-xl border border-dashed border-violet-200 bg-white px-4 py-3 text-sm text-slate-500">No certificate added yet — you can continue without one.</p>
              <div v-else class="mt-5 grid gap-3"><div v-for="(certificate, index) in form.languageCertificates" :key="index" class="grid gap-3 rounded-xl bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><label class="field-label">Certificate<select v-model="certificate.type" class="field"><option disabled value="">Choose certificate</option><option>IELTS</option><option>TOEFL</option><option>TOPIK</option><option>PTE Academic</option><option>Duolingo English Test</option><option>Other</option></select></label><label class="field-label">Score <span class="optional">Optional</span><input v-model="certificate.score" class="field" :disabled="!certificate.type" :placeholder="certificate.type ? `Enter ${certificate.type} score` : 'Choose a certificate first'" /></label><button type="button" class="self-end rounded-xl p-3 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove certificate" @click="removeCertificate(index)"><Trash2 :size="17" /></button></div></div>
            </section>
          </div>

          <div v-else-if="step === 3">
            <div class="document-callout"><Files :size="24" /><div><strong>Application documents are optional</strong><p>It will be good if you came prepared to let us tailor the most specific scholarship, but it's okay to skip this for now.</p><small>Let’s keep moving. 10% more to complete your onboarding progress.</small></div></div>
            <div class="application-documents">
              <article v-for="document in documents" :key="document" :class="{ selected: form.availableDocuments.includes(document) }">
                <label><input v-model="form.availableDocuments" type="checkbox" :value="document" /><span><strong>{{ document }}</strong><small>Use this as a base copy for scholarship-specific adjustments.</small></span></label>
                <label class="document-upload"><UploadCloud :size="17" />{{ uploaded[document] || 'Upload file' }}<input type="file" accept=".pdf,.doc,.docx" @change="upload(document, $event)" /></label>
              </article>
            </div>
          </div>

          <div v-else class="profile-review">
            <section><h2>Profile and education</h2><div class="review-grid"><div v-for="row in reviewRows" :key="String(row[0])"><span>{{ row[0] }}</span><strong>{{ row[1] || 'Not provided' }}</strong></div></div></section>
            <section><h2>Application documents</h2><div class="review-documents"><span v-for="document in documents" :key="document" :class="form.availableDocuments.includes(document) && 'ready'"><Check :size="15" />{{ document }} · {{ form.availableDocuments.includes(document) ? 'Ready' : 'Skipped' }}</span></div></section>
          </div>
        </div>

        <p v-if="error" class="error onboarding-error">{{ error }}</p>
        <footer class="onboarding-actions">
          <button class="btn-secondary" :class="step === 0 && 'invisible'" @click="go(step - 1)"><ArrowLeft :size="16" />Back</button>
          <button v-if="step < 4" class="btn-primary" @click="next">{{ step === 3 ? 'Review my profile' : 'Continue' }}<ArrowRight :size="16" /></button>
          <button v-else class="btn-primary" @click="save">Save preferences & find my matches<ArrowRight :size="16" /></button>
        </footer>
      </section>
    </div>
  </main>
</template>

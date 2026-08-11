<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, CalendarDays, ChevronDown, ExternalLink, FolderPlus, GraduationCap, Heart, Landmark, MapPin, Sparkles } from 'lucide-vue-next'
import { getScholarship } from '../data/scholarships'
import { apiRequest } from '../api'
import { useAppState } from '../composables/useAppState'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'
import type { Scholarship } from '../types'

interface DetailSection {
  id: string
  title: string
  paragraphs?: string[]
  items?: string[]
  numbered?: boolean
  tableRows?: Array<[string, string]>
}

const route = useRoute()
const router = useRouter()

const documentLabels: Record<string, string> = {
  cv: 'CV',
  transcript: 'Academic transcript',
  passport: 'Passport copy',
  recommendation_letter: 'Recommendation letter',
  english_proficiency_test: 'English test certificate (IELTS/TOEFL)',
  personal_statement: 'Personal statement',
  motivation_letter: 'Motivation letter',
  study_plan: 'Study plan',
  research_proposal: 'Research proposal',
  birth_certificate: 'Birth certificate',
  citizenship_proof: 'Proof of citizenship',
  proof_of_residence: 'Proof of residence',
  study_objective: 'Study objective',
  toefl_score: 'TOEFL score report',
  unconditional_offer: 'Unconditional offer',
  letter_of_acceptance_unconditional: 'Unconditional acceptance letter',
}
const documentLabel = (key: string) =>
  documentLabels[key] || key.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

const scholarship = ref<Scholarship | null>(getScholarship(String(route.params.id)) || null)
onMounted(async () => {
  try {
    const result = await apiRequest<{ scholarship: Scholarship }>(`/api/scholarships/${encodeURIComponent(String(route.params.id))}`)
    scholarship.value = result.scholarship
  } catch { /* keep the static fallback when the backend is unreachable */ }
})
const { savedIds, toggleSaved, applicationIds, startApplication } = useAppState()
const alreadyAdded = computed(() => Boolean(scholarship.value && applicationIds.value.includes(scholarship.value.id)))
const openSections = ref<string[]>(['eligibility'])
const overviewParagraphs = computed(() => {
  const item = scholarship.value
  if (!item) return []
  if (item.id === 'chevening') return [
    'Chevening Scholarships enable outstanding emerging leaders from all over the world to pursue one-year master’s degrees in the UK. If you have the passion and influence to solve pressing local, national, or global challenges, we strongly encourage you to apply.',
    'Chevening Scholarships are fully-funded, leaving you free to focus on achieving your professional goals and maximising the experience of a lifetime. You will live and study in the UK for a year, during which time you will develop professionally and academically, network extensively, experience UK culture, and build lasting positive relationships with the UK.',
  ]
  return [
    item.eligibilitySummary,
    `This ${item.fundingType.toLowerCase()} opportunity supports eligible applicants pursuing ${item.program} studies in ${item.country}. Review the official requirements carefully before creating your preparation workspace.`,
  ]
})

const detailSections = computed<DetailSection[]>(() => {
  const item = scholarship.value
  if (!item) return []
  return [
    {
      id: 'eligibility',
      title: 'Eligibility',
      paragraphs: overviewParagraphs.value,
    },
    { id: 'documents', title: 'Required Documents', items: item.requiredDocuments.map(documentLabel) },
    {
      id: 'steps',
      title: 'Application Steps',
      numbered: true,
      items: ['Confirm your eligibility and program fit', 'Gather and certify required documents', 'Draft your motivation and study plan', 'Request references before the deadline', 'Submit through the official provider channel'],
    },
    { id: 'fields', title: 'Eligible University & Fields', tableRows: [['University', item.university], ['Program', item.program], ['Field of study', item.fieldOfStudy], ['Study level', item.educationLevel]] },
    { id: 'selection', title: 'Selection Process', paragraphs: ['Applications are generally reviewed for eligibility, academic strength, motivation, leadership potential, and alignment with the scholarship’s goals. Shortlisted applicants may be invited to an interview or asked for additional evidence.'] },
    { id: 'funding', title: 'Funding & Benefits', paragraphs: [`Funding category: ${item.fundingType}. Review the official scholarship page for the exact coverage, payment schedule, exclusions, and any conditions attached to the award.`] },
  ]
})

const toggleSection = (id: string) => {
  openSections.value = openSections.value.includes(id) ? openSections.value.filter((item) => item !== id) : [...openSections.value, id]
}
const openWorkspace = () => {
  if (!scholarship.value) return
  if (!alreadyAdded.value) startApplication(scholarship.value.id)
  router.push(`/dashboard/${scholarship.value.id}`)
}
const formatDate = (value: string) => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
</script>

<template>
  <main v-if="scholarship" class="workspace-shell">
    <WorkspaceSidebar active="discover" />
    <div class="workspace-main min-w-0 bg-[#f8f8fc]">
      <WorkspaceTopbar title="Scholarship details" subtitle="Review the opportunity before adding it to My Scholarships." />

      <section class="border-b border-violet-100 bg-gradient-to-br from-[#f4f2ff] via-[#f1f3ff] to-[#eef8ff] px-5 py-9 sm:px-8 lg:px-10 lg:py-10">
        <div class="mx-auto max-w-[1240px]">
          <RouterLink to="/scholarships" class="inline-flex items-center gap-2 text-sm font-bold text-[#5b45f5]"><ArrowLeft :size="16" />Back to scholarships</RouterLink>
          <div class="mt-9 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_170px]">
            <div>
              <p class="flex items-center gap-3 text-xs font-bold uppercase tracking-[.18em] text-[#5b45f5]"><span class="h-px w-6 bg-[#5b45f5]" />{{ scholarship.provider }}</p>
              <h1 class="mt-5 max-w-4xl text-4xl font-bold leading-[1.05] tracking-[-.04em] text-[#17136b] sm:text-[52px]">{{ scholarship.name }}</h1>
              <div class="mt-6 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                <span class="tag"><MapPin :size="14" />{{ scholarship.country }}</span>
                <span class="tag"><GraduationCap :size="14" />{{ scholarship.educationLevel }}</span>
                <span class="tag"><Landmark :size="14" />{{ scholarship.fundingType }}</span>
                <span class="tag"><CalendarDays :size="14" />Deadline {{ formatDate(scholarship.deadline) }}</span>
              </div>
            </div>
            <div class="rounded-[24px] border border-white/80 bg-white/90 p-6 text-center shadow-[0_14px_36px_rgba(23,19,107,.08)]"><p class="text-5xl font-bold text-[#5b45f5]">{{ scholarship.matchPercentage }}%</p><p class="mt-2 text-[11px] font-bold uppercase tracking-[.12em] text-slate-400">Profile match</p></div>
          </div>
          <div class="mt-8 max-w-[1120px] space-y-5 text-[13px] font-bold leading-6 text-slate-800">
            <p v-for="paragraph in overviewParagraphs" :key="paragraph">{{ paragraph }}</p>
          </div>
        </div>
      </section>

      <section class="px-5 py-9 sm:px-8 lg:px-10 lg:py-10">
        <div class="mx-auto grid max-w-[1240px] items-start gap-12 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div class="min-w-0">
            <section v-for="section in detailSections" :key="section.id" class="border-b border-violet-200">
              <button type="button" class="flex w-full items-center justify-between gap-5 py-[18px] text-left text-xl font-bold text-[#211879]" :aria-expanded="openSections.includes(section.id)" @click="toggleSection(section.id)">
                <span>{{ section.title }}</span><ChevronDown :size="22" class="shrink-0 text-[#5b45f5] transition-transform duration-200" :class="openSections.includes(section.id) && 'rotate-180'" />
              </button>
              <Transition enter-active-class="transition duration-200" enter-from-class="-translate-y-1 opacity-0" leave-active-class="transition duration-150" leave-to-class="-translate-y-1 opacity-0">
                <div v-if="openSections.includes(section.id)" class="pb-7">
                  <div v-if="section.paragraphs" class="space-y-5 text-[13px] font-medium leading-6 text-slate-800"><p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p></div>
                  <ol v-if="section.items && section.numbered" class="list-decimal space-y-3 pl-6 text-[13px] font-medium leading-6 text-slate-800"><li v-for="item in section.items" :key="item" class="pl-2">{{ item }}</li></ol>
                  <ul v-else-if="section.items" class="list-disc space-y-3 pl-6 text-[13px] font-medium leading-6 text-slate-800"><li v-for="item in section.items" :key="item" class="pl-2 marker:text-[#5b45f5]">{{ item }}</li></ul>
                  <div v-if="section.tableRows" class="overflow-hidden rounded-xl border border-slate-200">
                    <table class="w-full border-collapse text-left text-[13px]"><tbody><tr v-for="row in section.tableRows" :key="row[0]" class="border-b border-slate-200 last:border-b-0"><th class="w-1/3 bg-slate-50 px-4 py-3 font-bold text-[#17136b]">{{ row[0] }}</th><td class="px-4 py-3 font-medium text-slate-700">{{ row[1] }}</td></tr></tbody></table>
                  </div>
                </div>
              </Transition>
            </section>
          </div>

          <aside class="lg:sticky lg:top-6">
            <div class="rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_16px_45px_rgba(23,19,107,.08)]">
              <div class="flex items-center gap-2 text-xs font-bold text-[#5b45f5]"><Sparkles :size="15" />Preparation workspace</div>
              <h2 class="mt-4 text-xl font-bold text-[#17136b]">Ready to prepare?</h2>
              <p class="mt-3 text-sm leading-6 text-slate-500">Review the details first. When you are ready, add this opportunity to My Scholarships to create its checklist and document workspace.</p>
              <button class="btn-primary mt-6 w-full" @click="openWorkspace"><FolderPlus :size="17" />{{ alreadyAdded ? 'Open My Scholarship' : 'Add to My Scholarships' }}</button>
              <button class="btn-secondary mt-3 w-full" :class="savedIds.includes(scholarship.id) && 'border-violet-300 bg-violet-50 text-[#5b45f5]'" @click="toggleSaved(scholarship.id)"><Heart :size="16" :fill="savedIds.includes(scholarship.id) ? 'currentColor' : 'none'" />{{ savedIds.includes(scholarship.id) ? 'In Wishlist' : 'Add to Wishlist' }}</button>
              <a :href="scholarship.applicationUrl" target="_blank" rel="noreferrer" class="btn-ghost mt-3 w-full">Official link <ExternalLink :size="15" /></a>
              <p class="mt-5 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-400">Minerva provides guidance and does not guarantee acceptance. Always verify details on the official website.</p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  </main>
  <main v-else class="section"><div class="container text-center"><h1 class="page-title">Scholarship not found</h1><RouterLink to="/scholarships" class="btn-primary mt-8">Browse scholarships</RouterLink></div></main>
</template>

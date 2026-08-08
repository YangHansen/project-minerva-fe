<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Bookmark, CalendarDays, ExternalLink, CircleCheck, MapPin, GraduationCap, Landmark, Sparkles, FolderPlus } from 'lucide-vue-next'
import { getScholarship } from '../data/scholarships'
import { useAppState } from '../composables/useAppState'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'

const route = useRoute()
const router = useRouter()
const scholarship = computed(() => getScholarship(String(route.params.id)))
const { savedIds, toggleSaved, applicationIds, startApplication } = useAppState()
const alreadyAdded = computed(() => Boolean(scholarship.value && applicationIds.value.includes(scholarship.value.id)))
const steps = [
  'Confirm your eligibility and program fit',
  'Gather and certify required documents',
  'Draft your motivation and study plan',
  'Request references well before the deadline',
  'Submit through the official provider channel',
]

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
    <div class="workspace-main">
      <WorkspaceTopbar title="Scholarship details" subtitle="Review the opportunity before adding it to My Scholarships." />
    <section class="border-b border-slate-200 bg-gradient-to-br from-[#f3f1ff] to-[#eff8ff] py-16">
      <div class="container">
        <RouterLink to="/scholarships" class="inline-flex items-center gap-2 text-sm font-bold text-[#5b45f5]"><ArrowLeft :size="16" />Back to scholarships</RouterLink>
        <div class="mt-10 grid items-end gap-10 lg:grid-cols-[1fr_auto]">
          <div>
            <p class="eyebrow">{{ scholarship.provider }}</p>
            <h1 class="page-title mt-5 max-w-4xl">{{ scholarship.name }}</h1>
            <div class="mt-7 flex flex-wrap gap-3 text-sm font-semibold text-slate-500">
              <span class="tag"><MapPin :size="14" />{{ scholarship.country }}</span>
              <span class="tag"><GraduationCap :size="14" />{{ scholarship.educationLevel }}</span>
              <span class="tag"><Landmark :size="14" />{{ scholarship.fundingType }}</span>
              <span class="tag"><CalendarDays :size="14" />Deadline {{ formatDate(scholarship.deadline) }}</span>
            </div>
          </div>
          <div class="card min-w-48 p-6 text-center"><p class="text-5xl font-bold text-[#5b45f5]">{{ scholarship.matchPercentage }}%</p><p class="mt-2 text-xs font-bold uppercase tracking-wider text-slate-400">Profile match</p></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container grid gap-10 lg:grid-cols-[1fr_340px]">
        <div class="grid gap-8">
          <section>
            <h2 class="text-2xl font-bold text-[#17136b]">Opportunity overview</h2>
            <p class="mt-4 leading-8 text-slate-500">{{ scholarship.eligibilitySummary }}</p>
            <dl class="mt-7 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2">
              <div v-for="item in [['University', scholarship.university], ['Program', scholarship.program], ['Field', scholarship.fieldOfStudy], ['Scholarship type', scholarship.scholarshipType]]" :key="item[0]" class="bg-white p-5"><dt class="text-xs font-bold uppercase tracking-wider text-slate-400">{{ item[0] }}</dt><dd class="mt-2 font-bold text-[#17136b]">{{ item[1] }}</dd></div>
            </dl>
          </section>
          <section>
            <h2 class="text-2xl font-bold text-[#17136b]">Required documents</h2>
            <div class="mt-5 grid gap-3 sm:grid-cols-2"><div v-for="item in scholarship.requiredDocuments" :key="item" class="flex items-center gap-3 rounded-xl border border-slate-200 p-4 font-semibold text-[#17136b]"><CircleCheck :size="18" class="text-emerald-500" />{{ item }}</div></div>
          </section>
          <section>
            <h2 class="text-2xl font-bold text-[#17136b]">Application steps</h2>
            <div class="mt-5 grid gap-4"><div v-for="(item, index) in steps" :key="item" class="flex gap-4"><span class="step-num">{{ index + 1 }}</span><div><h3 class="font-bold text-[#17136b]">{{ item }}</h3><p class="mt-1 text-sm text-slate-500">Complete this step on the official provider timeline.</p></div></div></div>
          </section>
        </div>

        <aside>
          <div class="card sticky top-24 p-6">
            <div class="flex items-center gap-2 text-xs font-bold text-[#5b45f5]"><Sparkles :size="15" />Preparation workspace</div>
            <h2 class="mt-4 text-xl font-bold text-[#17136b]">Ready to prepare?</h2>
            <p class="mt-3 text-sm leading-6 text-slate-500">Review the details first. When you are ready, add this opportunity to My Scholarships to create its checklist and document workspace.</p>
            <button class="btn-primary mt-6 w-full" @click="openWorkspace"><FolderPlus :size="17" />{{ alreadyAdded ? 'Open My Scholarship' : 'Add to My Scholarships' }}</button>
            <button class="btn-secondary mt-3 w-full" @click="toggleSaved(scholarship.id)"><Bookmark :size="16" :fill="savedIds.includes(scholarship.id) ? 'currentColor' : 'none'" />{{ savedIds.includes(scholarship.id) ? 'Saved' : 'Save scholarship' }}</button>
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

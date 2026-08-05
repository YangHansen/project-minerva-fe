<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { GraduationCap, Search, SlidersHorizontal, Sparkles, X } from 'lucide-vue-next'
import ScholarshipCard from '../components/scholarships/ScholarshipCard.vue'
import WorkspaceSidebar from '../components/dashboard/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/dashboard/WorkspaceTopbar.vue'
import { scholarships } from '../data/scholarships'
import { useAppState } from '../composables/useAppState'
import type { Scholarship } from '../types'

const loading = ref(true)
const query = ref('')
const country = ref('')
const level = ref('')
const major = ref('')
const funding = ref('')
const sort = ref<'match' | 'deadline' | 'name'>('match')
const route = useRoute()
const { savedIds, session, profile } = useAppState()

onMounted(() => window.setTimeout(() => { loading.value = false }, 350))
const countries = [...new Set(scholarships.map((item) => item.country))].sort()
const levels = [...new Set(scholarships.map((item) => item.educationLevel))].sort()
const majors = [...new Set(scholarships.map((item) => item.fieldOfStudy).filter((item) => item !== 'All fields'))].sort()
const fundings = [...new Set(scholarships.map((item) => item.fundingType))].sort()
const firstSetup = computed(() => Boolean(route.query.recommended) || Boolean(session.value && savedIds.value.length === 0))
const profileSignals = computed(() => [profile.value?.destinationCountry, profile.value?.targetEducationLevel, profile.value?.fieldOfStudy].filter(Boolean) as string[])
const personalizedScore = (item: Scholarship) => {
  let score = item.matchPercentage
  const user = profile.value
  if (!user) return score
  if (user.destinationCountry && item.country.toLowerCase().includes(user.destinationCountry.toLowerCase())) score += 3
  if (user.targetEducationLevel && item.educationLevel.toLowerCase().includes(user.targetEducationLevel.toLowerCase())) score += 2
  if (user.fieldOfStudy && (item.fieldOfStudy === 'All fields' || item.fieldOfStudy.toLowerCase().includes(user.fieldOfStudy.toLowerCase()))) score += 3
  if (user.fundingPreference && item.fundingType.toLowerCase().includes(user.fundingPreference.toLowerCase())) score += 2
  return Math.min(99, score)
}
const scoredScholarships = computed(() => scholarships.map((item) => ({ ...item, matchPercentage: personalizedScore(item) })))
const isFiltered = computed(() => Boolean(query.value || country.value || level.value || major.value || funding.value))
const results = computed(() => scoredScholarships.value.filter((item) => {
  const haystack = `${item.name} ${item.provider} ${item.country} ${item.fieldOfStudy} ${item.program}`.toLowerCase()
  const matchesQuery = haystack.includes(query.value.trim().toLowerCase())
  const matchesMajor = !major.value || item.fieldOfStudy === major.value || item.fieldOfStudy === 'All fields'
  return matchesQuery && matchesMajor && (!country.value || item.country === country.value) && (!level.value || item.educationLevel === level.value) && (!funding.value || item.fundingType === funding.value)
}).sort((a, b) => sort.value === 'name' ? a.name.localeCompare(b.name) : sort.value === 'deadline' ? a.deadline.localeCompare(b.deadline) : b.matchPercentage - a.matchPercentage))
const clear = () => { query.value = ''; country.value = ''; level.value = ''; major.value = ''; funding.value = ''; sort.value = 'match' }
</script>

<template>
  <main class="workspace-shell">
    <WorkspaceSidebar active="discover" />
    <div class="workspace-main">
      <WorkspaceTopbar title="Discover scholarships" subtitle="Find a scholarship, then create its dedicated preparation folder." />
      <div class="workspace-content discover-workspace">
        <section v-if="firstSetup" class="recommendation-spotlight">
          <span class="recommendation-icon"><Sparkles :size="22" /></span>
          <div><p class="workspace-kicker">AI recommendations</p><h1>Your best scholarship matches are ready</h1><p>Minerva has ordered the opportunities below using your destination, study level, major, and funding preferences.</p><div v-if="profileSignals.length" class="recommendation-signals"><span v-for="signal in profileSignals" :key="signal">{{ signal }}</span></div></div>
          <div class="recommendation-count"><strong>{{ results.slice(0, 3).length }}</strong><span>top matches</span></div>
        </section>

        <section class="discover-results">
          <div class="discover-section-heading"><div><p class="workspace-kicker">{{ !isFiltered && sort === 'match' ? 'Recommended opportunities' : 'Explore all opportunities' }}</p><h2>{{ !isFiltered && sort === 'match' ? 'Scholarships matched to you' : 'Find the right scholarship' }}</h2></div><p><strong>{{ results.length }}</strong> scholarships available</p></div>

          <div class="discover-filter-panel">
            <div class="discover-filter-grid">
              <label class="discover-search"><span class="sr-only">Search scholarships</span><Search :size="18" /><input v-model="query" placeholder="Search scholarship, country, or field" /></label>
              <label><span>Destination</span><select v-model="country"><option value="">All destinations</option><option v-for="item in countries" :key="item">{{ item }}</option></select></label>
              <label><span>Study level</span><select v-model="level"><option value="">All study levels</option><option v-for="item in levels" :key="item">{{ item }}</option></select></label>
              <label><span>Major</span><select v-model="major"><option value="">All majors</option><option v-for="item in majors" :key="item">{{ item }}</option></select></label>
              <label><span>Funding</span><select v-model="funding"><option value="">All funding</option><option v-for="item in fundings" :key="item">{{ item }}</option></select></label>
            </div>
            <div class="discover-filter-footer">
              <div class="active-filter-list"><SlidersHorizontal :size="16" /><span v-if="!isFiltered">Use filters to narrow your recommendations</span><button v-if="country" @click="country = ''">{{ country }} <X :size="12" /></button><button v-if="level" @click="level = ''">{{ level }} <X :size="12" /></button><button v-if="major" @click="major = ''"><GraduationCap :size="12" />{{ major }} <X :size="12" /></button><button v-if="funding" @click="funding = ''">{{ funding }} <X :size="12" /></button><button v-if="query" @click="query = ''">“{{ query }}” <X :size="12" /></button></div>
              <div class="discover-sort"><button v-if="isFiltered" @click="clear">Clear all</button><label>Sort by<select v-model="sort"><option value="match">Best match</option><option value="deadline">Deadline</option><option value="name">Name</option></select></label></div>
            </div>
          </div>

          <div v-if="loading" class="scholarship-results-grid"><div v-for="n in 6" :key="n" class="h-[335px] animate-pulse rounded-3xl bg-slate-100" /></div>
          <div v-else-if="results.length" class="scholarship-results-grid"><ScholarshipCard v-for="item in results" :key="item.id" :scholarship="item" /></div>
          <div v-else class="discover-empty"><Search :size="34" /><h2>No scholarships match those filters</h2><p>Try clearing a filter or selecting a broader major.</p><button class="btn-primary" @click="clear">Clear all filters</button></div>
        </section>
      </div>
    </div>
  </main>
</template>

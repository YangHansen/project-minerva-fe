<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { GraduationCap, Search, SlidersHorizontal, Sparkles, X } from 'lucide-vue-next'
import ScholarshipCard from '../components/scholarships/ScholarshipCard.vue'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'
import { apiRequest } from '../api'
import { useAppState } from '../composables/useAppState'
import { useScholarJourneyPage } from '../composables/useProductTour'
import type { Scholarship } from '../types'

useScholarJourneyPage('discover')

const loading = ref(true)
const error = ref('')
const query = ref('')
const country = ref('')
const level = ref('')
const major = ref('')
const funding = ref('')
const sort = ref<'match' | 'deadline' | 'name'>('match')
const route = useRoute()
const { applicationIds, session, recommendedScholarshipIds } = useAppState()
const scholarships = ref<Scholarship[]>([])

onMounted(async () => {
  try {
    const result = await apiRequest<{ scholarships: Scholarship[] }>('/api/scholarships?pageSize=100')
    scholarships.value = Array.isArray(result.scholarships) ? result.scholarships : []
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Could not load scholarships.'
  } finally {
    loading.value = false
  }
})
const majorList = (value: string | string[]) => Array.isArray(value) ? value : value ? [value] : []
const countries = computed(() => [...new Set(scholarships.value.map((item) => item.country))].sort())
const levels = computed(() => [...new Set(scholarships.value.map((item) => item.educationLevel))].sort())
const majors = computed(() => [...new Set(scholarships.value.flatMap((item) => majorList(item.fieldOfStudy)).filter((item) => item !== 'All fields'))].sort())
const fundings = computed(() => [...new Set(scholarships.value.map((item) => item.fundingType))].sort())
const firstSetup = computed(() => Boolean(route.query.recommended) || Boolean(session.value && applicationIds.value.length === 0))
const showRecommendationHighlight = computed(() => Boolean(route.query.recommended))
const isFiltered = computed(() => Boolean(query.value || country.value || level.value || major.value || funding.value))
const showChatRecommendations = computed(() => Boolean(recommendedScholarshipIds.value.length && !isFiltered.value && sort.value === 'match'))
const results = computed(() => scholarships.value.filter((item) => {
  const haystack = `${item.name} ${item.provider} ${item.country} ${majorList(item.fieldOfStudy).join(' ')} ${item.program}`.toLowerCase()
  const matchesQuery = haystack.includes(query.value.trim().toLowerCase())
  const matchesMajor = !major.value || majorList(item.fieldOfStudy).includes(major.value) || majorList(item.fieldOfStudy).includes('All fields')
  return matchesQuery && matchesMajor && (!country.value || item.country === country.value) && (!level.value || item.educationLevel === level.value) && (!funding.value || item.fundingType === funding.value)
}).sort((a, b) => {
  if (showChatRecommendations.value) {
    const aIndex = recommendedScholarshipIds.value.indexOf(a.id)
    const bIndex = recommendedScholarshipIds.value.indexOf(b.id)
    if (aIndex >= 0 || bIndex >= 0) return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex)
  }
  return sort.value === 'name' ? a.name.localeCompare(b.name) : sort.value === 'deadline' ? a.deadline.localeCompare(b.deadline) : b.matchPercentage - a.matchPercentage
}))
const clear = () => { query.value = ''; country.value = ''; level.value = ''; major.value = ''; funding.value = ''; sort.value = 'match' }
const reload = () => window.location.reload()
</script>

<template>
  <main class="workspace-shell">
    <WorkspaceSidebar active="discover" />
    <div class="workspace-main">
      <WorkspaceTopbar title="Discover scholarships" subtitle="Find a scholarship, then create its dedicated preparation folder." />
      <div class="workspace-content discover-workspace">
        <section v-if="firstSetup" class="recommendation-spotlight">
          <span class="recommendation-icon"><Sparkles :size="22" /></span>
          <div><p class="workspace-kicker">AI recommendations</p><h1>Your best scholarship matches are ready</h1><p>Minerva has ordered these opportunities around your saved profile. Adjust your answers any time to refresh the recommendations.</p><RouterLink to="/onboarding?return=/scholarships" class="recommendation-edit">Edit preferences</RouterLink></div>
          <div class="recommendation-count"><strong>{{ results.slice(0, 3).length }}</strong><span>top matches</span></div>
        </section>

        <section data-tour="page-discover" class="discover-results">
          <div class="discover-section-heading"><div><p class="workspace-kicker">{{ showChatRecommendations ? 'Minerva chat recommendations' : !isFiltered && sort === 'match' ? 'Recommended opportunities' : 'Explore all opportunities' }}</p><h2>{{ showChatRecommendations ? 'Your latest AI recommendations' : !isFiltered && sort === 'match' ? 'Scholarships matched to you' : 'Find the right scholarship' }}</h2></div><p><strong>{{ results.length }}</strong> scholarships available</p></div>

          <div class="discover-filter-panel">
            <div class="discover-filter-grid">
              <label class="discover-search"><span class="sr-only">Search scholarships</span><Search :size="18" /><input v-model="query" placeholder="Search scholarship, country, or field" /></label>
              <label><span>Destination</span><select v-model="country"><option value="">All destinations</option><option v-for="item in countries" :key="item">{{ item }}</option></select></label>
              <label><span>Study level</span><select v-model="level"><option value="">All study levels</option><option v-for="item in levels" :key="item">{{ item }}</option></select></label>
              <label><span>Major</span><select v-model="major"><option value="">All majors</option><option v-for="item in majors" :key="item">{{ item }}</option></select></label>
              <label><span>Funding</span><select v-model="funding"><option value="">All funding</option><option v-for="item in fundings" :key="item">{{ item }}</option></select></label>
            </div>
            <div class="discover-filter-footer">
              <div class="active-filter-list"><SlidersHorizontal :size="16" /><span v-if="!isFiltered">Use filters to narrow your recommendations</span><button v-if="country" @click="country = ''">{{ country }} <X :size="12" /></button><button v-if="level" @click="level = ''">{{ level }} <X :size="12" /></button><button v-if="major" @click="major = ''"><GraduationCap :size="12" />{{ major }} <X :size="12" /></button><button v-if="funding" @click="funding = ''">{{ funding }} <X :size="12" /></button><button v-if="query" @click="query = ''">&ldquo;{{ query }}&rdquo; <X :size="12" /></button></div>
              <div class="discover-sort"><button v-if="isFiltered" @click="clear">Clear all</button><label>Sort by<select v-model="sort"><option value="match">Best match</option><option value="deadline">Deadline</option><option value="name">Name</option></select></label></div>
            </div>
          </div>

          <div v-if="loading" class="scholarship-results-grid"><div v-for="n in 6" :key="n" class="h-[335px] animate-pulse rounded-3xl bg-slate-100" /></div>
          <div v-else-if="error" class="discover-empty"><Search :size="34" /><h2>Could not load scholarships</h2><p>{{ error }}</p><button class="btn-primary" @click="reload">Retry</button></div>
          <div v-else-if="results.length" class="scholarship-results-grid"><ScholarshipCard v-for="(item, index) in results" :key="item.id" :scholarship="item" :recommended="(showRecommendationHighlight && index < 3) || recommendedScholarshipIds.includes(item.id)" selectable /></div>
          <div v-else class="discover-empty"><Search :size="34" /><h2>No scholarships match those filters</h2><p>Try clearing a filter or selecting a broader major.</p><button class="btn-primary" @click="clear">Clear all filters</button></div>
        </section>
      </div>
    </div>
  </main>
</template>

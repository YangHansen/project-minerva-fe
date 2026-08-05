<script setup lang="ts">
import { Bookmark, CalendarDays, MapPin, ArrowRight, ArrowUpRight, FolderPlus } from 'lucide-vue-next'
import type { Scholarship } from '../../types'
import { useAppState } from '../../composables/useAppState'
import { useRouter } from 'vue-router'
const props = defineProps<{ scholarship: Scholarship; compact?: boolean; setup?: boolean }>()
const { savedIds, toggleSaved, selectScholarship } = useAppState()
const router = useRouter()
const formatDate = (value: string) => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
const createFolder = () => {
  if (!savedIds.value.includes(props.scholarship.id)) toggleSaved(props.scholarship.id)
  selectScholarship(props.scholarship.id)
  router.push('/dashboard')
}
</script>
<template>
  <article class="scholarship-card group">
    <div class="flex items-start justify-between gap-4"><span class="badge">{{ scholarship.scholarshipType }}</span><button class="save-button" :class="savedIds.includes(scholarship.id) && 'saved'" :aria-label="savedIds.includes(scholarship.id) ? 'Unsave scholarship' : 'Save scholarship'" @click="toggleSaved(scholarship.id)"><Bookmark :size="18" :fill="savedIds.includes(scholarship.id) ? 'currentColor' : 'none'" /></button></div>
    <div class="mt-5"><p class="text-xs font-bold uppercase tracking-[.14em] text-slate-400">{{ scholarship.provider }}</p><h3 class="mt-2 text-xl font-extrabold leading-snug text-[#17136b]">{{ scholarship.name }}</h3></div>
    <div class="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500"><span class="inline-flex items-center gap-1.5"><MapPin :size="15" />{{ scholarship.country }}</span><span class="inline-flex items-center gap-1.5"><CalendarDays :size="15" />{{ formatDate(scholarship.deadline) }}</span></div>
    <div v-if="!compact" class="mt-4 flex flex-wrap gap-2"><span class="tag">{{ scholarship.educationLevel }}</span><span class="tag">{{ scholarship.fundingType }}</span><span class="tag">{{ scholarship.fieldOfStudy }}</span></div>
    <div class="mt-6 flex items-center justify-between border-t border-slate-100 pt-5"><div><span class="text-2xl font-extrabold text-[#5b45f5]">{{ scholarship.matchPercentage }}%</span><span class="ml-1 text-xs font-semibold text-slate-400">match</span></div><button v-if="setup" class="inline-flex items-center gap-1 rounded-lg bg-[#5b45f5] px-3 py-2 text-sm font-extrabold text-white" @click="createFolder"><FolderPlus :size="15" />Create folder <ArrowRight :size="15" /></button><RouterLink v-else :to="`/scholarships/${scholarship.id}`" class="inline-flex items-center gap-1 text-sm font-bold text-[#17136b]">View details <ArrowUpRight :size="16" /></RouterLink></div>
  </article>
</template>

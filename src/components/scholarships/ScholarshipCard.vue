<script setup lang="ts">
import { Heart, CalendarDays, MapPin, ArrowRight, ArrowUpRight, FolderPlus } from 'lucide-vue-next'
import type { Scholarship } from '../../types'
import { useAppState } from '../../composables/useAppState'
import { useRouter } from 'vue-router'
const props = defineProps<{ scholarship: Scholarship; compact?: boolean; setup?: boolean; selectable?: boolean; recommended?: boolean }>()
const { savedIds, toggleSaved, startApplication } = useAppState()
const router = useRouter()
const formatDate = (value: string) => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
const createFolder = () => {
  startApplication(props.scholarship.id)
  router.push(`/dashboard/${props.scholarship.id}`)
}
</script>
<template>
  <article class="group relative flex min-h-[335px] flex-col rounded-3xl border border-[#e7e7ef] bg-white p-6 shadow-[0_12px_40px_rgba(23,19,107,.05)]" :class="recommended && 'border-violet-300 shadow-[0_14px_42px_rgba(91,69,245,.13)]'">
    <span v-if="recommended" aria-hidden="true" class="pointer-events-none absolute inset-0 rounded-3xl border-2 border-[#5b45f5] opacity-70 animate-pulse" />
    <div class="relative flex items-start justify-between gap-4"><span class="inline-flex rounded-full bg-violet-50 px-2.5 py-1.5 text-[.69rem] font-extrabold tracking-wide text-[#5b45f5]">{{ scholarship.scholarshipType }}</span><button class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-2.5 py-2 text-[.68rem] font-bold text-slate-500 transition-colors hover:border-[#5b45f5] hover:text-[#5b45f5]" :class="savedIds.includes(scholarship.id) && 'border-violet-300 bg-violet-50 text-[#5b45f5]'" @click="toggleSaved(scholarship.id)"><Heart :size="15" :fill="savedIds.includes(scholarship.id) ? 'currentColor' : 'none'" />{{ savedIds.includes(scholarship.id) ? 'In Wishlist' : 'Add to Wishlist' }}</button></div>
    <span v-if="recommended" class="relative mt-4 inline-flex w-fit rounded-full bg-[#5b45f5] px-2.5 py-1 text-[.62rem] font-extrabold text-white">AI recommended</span>
    <div class="mt-5"><p class="text-xs font-bold uppercase tracking-[.14em] text-slate-400">{{ scholarship.provider }}</p><h3 class="mt-2 text-xl font-extrabold leading-snug text-[#17136b]">{{ scholarship.name }}</h3></div>
    <div class="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500"><span class="inline-flex items-center gap-1.5"><MapPin :size="15" />{{ scholarship.country }}</span><span class="inline-flex items-center gap-1.5"><CalendarDays :size="15" />{{ formatDate(scholarship.deadline) }}</span></div>
    <div v-if="!compact" class="mt-4 flex flex-wrap gap-2"><span v-for="tag in [scholarship.educationLevel, scholarship.fundingType, scholarship.fieldOfStudy]" :key="tag" class="inline-flex rounded-full bg-slate-50 px-2.5 py-1.5 text-[.69rem] font-extrabold text-slate-500">{{ tag }}</span></div>
    <div class="mt-6 flex items-center justify-between border-t border-slate-100 pt-5"><div><span class="text-2xl font-extrabold text-[#5b45f5]">{{ scholarship.matchPercentage }}%</span><span class="ml-1 text-xs font-semibold text-slate-400">match</span></div><button v-if="setup || selectable" class="inline-flex items-center gap-1 rounded-lg bg-[#5b45f5] px-3 py-2 text-sm font-extrabold text-white" @click="createFolder"><FolderPlus :size="15" />{{ setup ? 'Create folder' : 'Choose scholarship' }} <ArrowRight :size="15" /></button><RouterLink v-else :to="`/scholarships/${scholarship.id}`" class="inline-flex items-center gap-1 text-sm font-bold text-[#17136b]">View details <ArrowUpRight :size="16" /></RouterLink></div>
  </article>
</template>

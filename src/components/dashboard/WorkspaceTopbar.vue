<script setup lang="ts">
import { Bell, Search, Sparkles } from 'lucide-vue-next'
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <header class="workspace-topbar"><div><p class="text-xs font-bold uppercase tracking-[.15em] text-[#5b45f5]">Scholar workspace</p><h1 class="mt-1 text-2xl font-extrabold tracking-tight text-[#17136b]">{{ title }}</h1><p v-if="subtitle" class="mt-1 text-sm text-slate-500">{{ subtitle }}</p></div><div class="flex items-center gap-3"><label class="relative hidden md:block"><Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input class="h-10 w-56 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold outline-none focus:border-violet-300" placeholder="Search your workspace"></label><button class="workspace-icon-button" aria-label="Notifications"><Bell :size="18"/></button><RouterLink to="/onboarding" class="hidden items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs font-extrabold text-[#5b45f5] sm:inline-flex"><Sparkles :size="15"/>Profile</RouterLink></div></header>
</template>

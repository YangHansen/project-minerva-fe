<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { Bell, LogOut, MoreHorizontal, Search, Sparkles, X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAppState } from '../../composables/useAppState'

defineProps<{ title: string; subtitle?: string }>()
const searchOpen = ref(false)
const menuOpen = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)
const router = useRouter()
const { session, toast } = useAppState()

const openSearch = async () => { searchOpen.value = true; await nextTick(); searchInput.value?.focus() }
const signOut = () => { session.value = null; toast('You have signed out of this demo.', 'info'); router.push('/') }
</script>

<template>
  <header class="workspace-topbar">
    <div><p class="text-xs font-bold uppercase tracking-[.15em] text-[#5b45f5]">Scholar workspace</p><h1 class="mt-1 text-2xl font-extrabold tracking-tight text-[#17136b]">{{ title }}</h1><p v-if="subtitle" class="mt-1 text-sm text-slate-500">{{ subtitle }}</p></div>
    <div class="flex items-center gap-2 sm:gap-3">
      <div class="relative">
        <label v-if="searchOpen" class="relative block"><Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input ref="searchInput" class="h-10 w-48 rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-xs font-semibold outline-none focus:border-violet-300 sm:w-56" placeholder="Search your workspace" @keydown.esc="searchOpen = false" /><button class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Close search" @click="searchOpen = false"><X :size="16" /></button></label>
        <button v-else class="workspace-icon-button" aria-label="Open workspace search" @click="openSearch"><Search :size="18" /></button>
      </div>
      <button class="workspace-icon-button" aria-label="Notifications"><Bell :size="18" /></button>
      <div class="relative"><button class="workspace-icon-button" :aria-expanded="menuOpen" aria-label="Open account menu" @click="menuOpen = !menuOpen"><MoreHorizontal :size="20" /></button><div v-if="menuOpen" class="absolute right-0 top-12 z-40 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"><RouterLink to="/onboarding" class="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-extrabold text-[#5b45f5]" @click="menuOpen = false"><Sparkles :size="16" />Profile</RouterLink><button class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-extrabold text-[#c23f58] hover:bg-rose-50" @click="signOut"><LogOut :size="16" />Sign out</button></div></div>
    </div>
  </header>
</template>

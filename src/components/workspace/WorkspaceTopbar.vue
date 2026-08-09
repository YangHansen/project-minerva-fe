<script setup lang="ts">
import { ref } from 'vue'
import { Bell, LogOut, MoreHorizontal, Sparkles } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAppState } from '../../composables/useAppState'
import { apiRequest } from '../../api'

defineProps<{ title: string; subtitle?: string }>()
const menuOpen = ref(false)
const router = useRouter()
const { resetUserState, toast, workspaceError } = useAppState()

const signOut = async () => {
  try { await apiRequest<{ success: boolean }>('/api/auth/logout', { method: 'POST', body: {} }) } catch { /* Clear local state even if the backend is unavailable. */ }
  resetUserState()
  toast('You have signed out.', 'info')
  await router.push('/')
}
</script>

<template>
  <header class="flex min-h-[108px] items-center justify-between gap-6 border-b border-slate-200 bg-white px-[clamp(22px,4vw,58px)] py-5 max-sm:flex-col max-sm:items-start">
    <div><p class="text-xs font-bold uppercase tracking-[.15em] text-[#5b45f5]">Scholar workspace</p><h1 class="mt-1 text-2xl font-extrabold tracking-tight text-[#17136b]">{{ title }}</h1><p v-if="subtitle" class="mt-1 text-sm text-slate-500">{{ subtitle }}</p></div>
    <div class="flex items-center gap-2 sm:gap-3">
      <button class="grid size-10 place-items-center rounded-xl border border-transparent bg-white text-[#17136b] hover:border-slate-200" aria-label="Notifications"><Bell :size="18" /></button>
      <div class="relative"><button class="grid size-10 place-items-center rounded-xl border border-transparent bg-white text-[#17136b] hover:border-slate-200" :aria-expanded="menuOpen" aria-label="Open account menu" @click="menuOpen = !menuOpen"><MoreHorizontal :size="20" /></button><div v-if="menuOpen" class="absolute right-0 top-12 z-40 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"><RouterLink to="/onboarding" class="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-extrabold text-[#5b45f5]" @click="menuOpen = false"><Sparkles :size="16" />Profile</RouterLink><button class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-extrabold text-[#c23f58] hover:bg-rose-50" @click="signOut"><LogOut :size="16" />Sign out</button></div></div>
    </div>
  </header>
  <p v-if="workspaceError" role="alert" class="border-b border-rose-100 bg-rose-50 px-[clamp(22px,4vw,58px)] py-2.5 text-sm font-bold text-rose-700">
    {{ workspaceError }} Changes that could not be synced remain visible locally; retry after reconnecting.
  </p>
</template>

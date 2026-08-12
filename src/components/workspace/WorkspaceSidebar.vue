<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { FolderKanban, Search, FileText, BookOpenCheck, MessageSquareText, Users, Heart, PanelLeftClose, PanelLeftOpen, Coins, ShieldCheck, Sparkles } from 'lucide-vue-next'
import { useAppState } from '../../composables/useAppState'
import { beginScholarJourney } from '../../composables/useProductTour'

defineProps<{ active: 'overview' | 'discover' | 'wishlist' | 'checklist' | 'documents' | 'test' | 'interview' | 'mentors' | 'payment' | 'admin' }>()
const router = useRouter()
const { tokenBalance, session } = useAppState()
const collapsed = ref(localStorage.getItem('minerva-sidebar-collapsed') === 'true')
watch(collapsed, (value) => localStorage.setItem('minerva-sidebar-collapsed', String(value)))
const links = [
  { id: 'overview', label: 'My scholarships', to: '/dashboard', icon: FolderKanban },
  { id: 'discover', label: 'Discover', to: '/scholarships', icon: Search },
  { id: 'wishlist', label: 'Wishlist', to: '/wishlist', icon: Heart },
  { id: 'documents', label: 'Documents', to: '/documents', icon: FileText },
  { id: 'test', label: 'Test Prep', to: '/test-prep', icon: BookOpenCheck },
  { id: 'interview', label: 'Interview Prep', to: '/interview-prep', icon: MessageSquareText },
  { id: 'mentors', label: 'Mentors', to: '/mentors', icon: Users },
]

const startQuickTour = async () => {
  if (!session.value) return
  if (collapsed.value) collapsed.value = false
  await beginScholarJourney(router)
}
</script>

<template>
  <aside class="workspace-sidebar sticky top-0 flex h-screen self-start flex-col overflow-y-auto border-r border-slate-200 bg-white px-[18px] pb-5 pt-[26px] max-[900px]:static max-[900px]:h-auto max-[900px]:w-full max-[900px]:overflow-hidden max-[900px]:border-b max-[900px]:border-r-0 max-[900px]:p-4" :class="collapsed && 'collapsed sidebar-collapsed items-center px-3 max-[900px]:items-stretch max-[900px]:px-4'">
    <div class="flex items-center justify-between gap-2" :class="collapsed && 'w-full flex-col gap-2'">
      <RouterLink to="/dashboard" class="flex min-w-0 items-center p-0.5" aria-label="Go to My Scholarships"><img :src="collapsed ? '/minerva-owl.png' : '/minerva-logo.png'" :alt="collapsed ? 'Minerva' : ''" :class="collapsed ? 'size-14 rounded-2xl object-cover' : 'h-14 w-[185px] object-cover'"/><span class="hidden text-xl font-extrabold tracking-tight text-[#17136b]">Minerva</span></RouterLink>
      <button class="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-violet-300 hover:text-[#5b45f5]" :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'" @click="collapsed=!collapsed"><PanelLeftOpen v-if="collapsed" :size="18"/><PanelLeftClose v-else :size="18"/></button>
    </div>
    <p class="mt-10 px-3 text-[10px] font-extrabold uppercase tracking-[.18em] text-slate-400" :class="collapsed && 'hidden'">Scholar workspace</p>
    <nav class="mt-3 grid gap-1 max-[900px]:flex max-[900px]:w-full max-[900px]:overflow-x-auto" aria-label="Scholar workspace">
      <RouterLink
        v-for="link in links"
        :key="link.id"
        :to="link.to"
        class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 transition hover:bg-slate-50 hover:text-[#5b45f5] max-[900px]:shrink-0 max-[900px]:whitespace-nowrap"
        :class="[active === link.id && 'bg-violet-50 text-[#5b45f5]', collapsed && 'justify-center px-2.5']"
        :title="collapsed ? link.label : undefined"
      >
        <component :is="link.icon" :size="18"/><span :class="collapsed && 'hidden'">{{ link.label }}</span>
        <span v-if="link.id === 'interview'" class="ml-auto rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-extrabold text-[#5b45f5]" :class="collapsed && 'hidden'">New</span>
      </RouterLink>
      <RouterLink v-if="session?.role === 'admin'" to="/admin/scholarships" class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 transition hover:bg-slate-50 hover:text-[#5b45f5] max-[900px]:shrink-0 max-[900px]:whitespace-nowrap" :class="[active === 'admin' && 'bg-violet-50 text-[#5b45f5]', collapsed && 'justify-center px-2.5']" :title="collapsed ? 'Admin catalog' : undefined"><ShieldCheck :size="18"/><span :class="collapsed && 'hidden'">Admin catalog</span></RouterLink>
    </nav>
    <button
      type="button"
      class="quick-tour-btn mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-[#5b45f5] transition hover:bg-violet-50"
      :class="collapsed && 'justify-center px-2.5'"
      aria-label="Quick Tour"
      title="Quick Tour"
      @click="startQuickTour"
    >
      <Sparkles :size="16" />
      <span :class="collapsed && 'hidden'">Quick Tour</span>
    </button>
    <RouterLink to="/payment" class="mt-auto block overflow-hidden rounded-[22px] bg-gradient-to-br from-[#241979] via-[#2d1e8e] to-[#1b126d] p-4 text-white shadow-[0_16px_28px_rgba(36,25,121,.22)] max-[900px]:hidden" :class="collapsed && 'mt-6 p-2.5'">
      <span class="grid size-10 place-items-center rounded-xl bg-white/15 text-white"><Coins :size="20" /></span>
      <div class="mt-4" :class="collapsed && 'hidden'">
        <p class="text-[.64rem] font-black uppercase tracking-[.14em] text-violet-200">Tokens owned</p>
        <strong class="mt-1 block text-xl font-black">{{ tokenBalance }} tokens</strong>
        <p class="mt-2 text-[.68rem] leading-5 text-violet-100">Use them for optional preparation feedback.</p>
        <span class="mt-4 inline-flex items-center gap-1 text-xs font-black">Manage tokens <span aria-hidden="true">→</span></span>
      </div>
    </RouterLink>
  </aside>
</template>
<style scoped>
.quick-tour-btn {
  font-family: 'Nunito Sans Variable', 'Nunito Sans', ui-sans-serif, system-ui, sans-serif;
}
.sidebar-collapsed {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.sidebar-collapsed::-webkit-scrollbar { display: none; }
</style>

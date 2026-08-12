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
  <aside
    class="workspace-sidebar sticky top-0 flex h-screen self-start flex-col overflow-x-hidden overflow-y-auto border-r border-slate-200 bg-white px-[18px] pb-5 pt-[26px] transition-[padding] duration-300 ease-in-out max-[900px]:static max-[900px]:h-auto max-[900px]:w-full max-[900px]:overflow-hidden max-[900px]:border-b max-[900px]:border-r-0 max-[900px]:p-4"
    :class="collapsed && 'collapsed sidebar-collapsed items-center px-3 max-[900px]:items-stretch max-[900px]:px-4'"
  >
    <div
      class="flex items-center justify-between gap-2 transition-[flex-direction] duration-300 ease-in-out"
      :class="collapsed && 'w-full flex-col gap-2'"
    >
      <RouterLink
        to="/dashboard"
        class="flex min-w-0 shrink-0 items-center p-0.5 transition-[gap] duration-300 ease-in-out"
        :class="collapsed ? 'gap-0' : 'gap-2.5'"
        aria-label="Go to My Scholarships"
      >
        <img
          src="/minerva-owl.png"
          alt=""
          class="size-[46px] shrink-0 object-contain"
        />
        <span
          class="grid min-w-0 transition-[grid-template-columns,opacity] duration-300 ease-in-out"
          :class="collapsed ? 'grid-cols-[0fr] opacity-0' : 'grid-cols-[1fr] opacity-100'"
          :aria-hidden="collapsed"
        >
          <span class="overflow-hidden whitespace-nowrap leading-tight">
            <span class="block text-[1.35rem] font-extrabold tracking-tight text-[#17136b]">Minerva</span>
            <span class="mt-0.5 block text-[0.68rem] font-bold tracking-[0.02em] text-[#5b45f5]">Find. Prepare. Succeed.</span>
          </span>
        </span>
      </RouterLink>
      <button
        class="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors duration-300 ease-in-out hover:border-violet-300 hover:text-[#5b45f5]"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="collapsed = !collapsed"
      >
        <PanelLeftOpen v-if="collapsed" :size="18" /><PanelLeftClose v-else :size="18" />
      </button>
    </div>

    <p
      class="mt-10 overflow-hidden px-3 text-[10px] font-extrabold uppercase tracking-[.18em] text-slate-400 transition-[max-height,opacity,margin] duration-300 ease-in-out"
      :class="collapsed ? 'mt-0 max-h-0 opacity-0' : 'max-h-8 opacity-100'"
      :aria-hidden="collapsed"
    >
      Scholar workspace
    </p>

    <nav class="mt-3 grid gap-1 max-[900px]:flex max-[900px]:w-full max-[900px]:overflow-x-auto" aria-label="Scholar workspace">
      <RouterLink
        v-for="link in links"
        :key="link.id"
        :to="link.to"
        class="flex items-center rounded-xl py-2.5 text-xs font-bold text-slate-500 transition-[background-color,color,padding,justify-content,gap] duration-300 ease-in-out hover:bg-slate-50 hover:text-[#5b45f5] max-[900px]:shrink-0 max-[900px]:whitespace-nowrap"
        :class="[
          active === link.id && 'bg-violet-50 text-[#5b45f5]',
          collapsed ? 'justify-center gap-0 px-2.5' : 'gap-3 px-3',
        ]"
        :title="collapsed ? link.label : undefined"
      >
        <component :is="link.icon" :size="18" class="shrink-0" />
        <span
          class="grid min-w-0 transition-[grid-template-columns,opacity] duration-300 ease-in-out"
          :class="collapsed ? 'grid-cols-[0fr] opacity-0' : 'grid-cols-[1fr] opacity-100'"
        >
          <span class="overflow-hidden whitespace-nowrap">{{ link.label }}</span>
        </span>
        <span
          v-if="link.id === 'interview'"
          class="ml-auto overflow-hidden rounded-full bg-violet-100 text-[10px] font-extrabold text-[#5b45f5] transition-[max-width,opacity,padding,margin] duration-300 ease-in-out"
          :class="collapsed ? 'max-w-0 px-0 opacity-0' : 'max-w-[4rem] px-2 py-0.5 opacity-100'"
        >New</span>
      </RouterLink>
      <RouterLink
        v-if="session?.role === 'admin'"
        to="/admin/scholarships"
        class="flex items-center rounded-xl py-2.5 text-xs font-bold text-slate-500 transition-[background-color,color,padding,gap] duration-300 ease-in-out hover:bg-slate-50 hover:text-[#5b45f5] max-[900px]:shrink-0 max-[900px]:whitespace-nowrap"
        :class="[active === 'admin' && 'bg-violet-50 text-[#5b45f5]', collapsed ? 'justify-center gap-0 px-2.5' : 'gap-3 px-3']"
        :title="collapsed ? 'Admin catalog' : undefined"
      >
        <ShieldCheck :size="18" class="shrink-0" />
        <span
          class="grid min-w-0 transition-[grid-template-columns,opacity] duration-300 ease-in-out"
          :class="collapsed ? 'grid-cols-[0fr] opacity-0' : 'grid-cols-[1fr] opacity-100'"
        >
          <span class="overflow-hidden whitespace-nowrap">Admin catalog</span>
        </span>
      </RouterLink>
    </nav>

    <button
      type="button"
      class="quick-tour-btn mt-3 flex w-full items-center rounded-xl py-2 text-xs font-bold text-[#5b45f5] transition-[background-color,padding,gap,justify-content] duration-300 ease-in-out hover:bg-violet-50"
      :class="collapsed ? 'justify-center gap-0 px-2.5' : 'gap-2 px-3'"
      aria-label="Quick Tour"
      title="Quick Tour"
      @click="startQuickTour"
    >
      <Sparkles :size="16" class="shrink-0" />
      <span
        class="grid min-w-0 transition-[grid-template-columns,opacity] duration-300 ease-in-out"
        :class="collapsed ? 'grid-cols-[0fr] opacity-0' : 'grid-cols-[1fr] opacity-100'"
      >
        <span class="overflow-hidden whitespace-nowrap">Quick Tour</span>
      </span>
    </button>

    <RouterLink
      to="/payment"
      class="mt-auto block overflow-hidden rounded-[22px] bg-gradient-to-br from-[#241979] via-[#2d1e8e] to-[#1b126d] text-white shadow-[0_16px_28px_rgba(36,25,121,.22)] transition-[padding,margin,border-radius] duration-300 ease-in-out max-[900px]:hidden"
      :class="collapsed ? 'mt-6 rounded-2xl p-2.5' : 'p-4'"
    >
      <span class="grid size-10 place-items-center rounded-xl bg-white/15 text-white"><Coins :size="20" /></span>
      <div
        class="grid transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out"
        :class="collapsed ? 'mt-0 grid-rows-[0fr] opacity-0' : 'mt-4 grid-rows-[1fr] opacity-100'"
        :aria-hidden="collapsed"
      >
        <div class="overflow-hidden">
          <p class="text-[.64rem] font-black uppercase tracking-[.14em] text-violet-200">Tokens owned</p>
          <strong class="mt-1 block text-xl font-black">{{ tokenBalance }} tokens</strong>
          <p class="mt-2 text-[.68rem] leading-5 text-violet-100">Use them for optional preparation feedback.</p>
          <span class="mt-4 inline-flex items-center gap-1 text-xs font-black">Manage tokens <span aria-hidden="true">→</span></span>
        </div>
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

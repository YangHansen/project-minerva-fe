<script setup lang="ts">
import { ref, watch } from 'vue'
import { FolderKanban, Search, ClipboardCheck, FileText, BookOpenCheck, MessageSquareText, Users, CreditCard, PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next'

defineProps<{ active: 'overview' | 'discover' | 'checklist' | 'documents' | 'test' | 'interview' | 'mentors' }>()
const collapsed = ref(localStorage.getItem('minerva-sidebar-collapsed') === 'true')
watch(collapsed, (value) => localStorage.setItem('minerva-sidebar-collapsed', String(value)))
const links = [
  { id: 'overview', label: 'My scholarships', to: '/dashboard', icon: FolderKanban },
  { id: 'discover', label: 'Discover', to: '/scholarships', icon: Search },
  { id: 'checklist', label: 'Checklist', to: '/checklist', icon: ClipboardCheck },
  { id: 'documents', label: 'Documents', to: '/documents', icon: FileText },
  { id: 'test', label: 'Test Prep', to: '/test-prep', icon: BookOpenCheck },
  { id: 'interview', label: 'Interview Prep', to: '/interview-prep', icon: MessageSquareText },
  { id: 'mentors', label: 'Mentors', to: '/mentors', icon: Users },
]
</script>

<template>
  <aside class="workspace-sidebar" :class="collapsed && 'collapsed'">
    <div class="sidebar-head"><RouterLink to="/" class="sidebar-logo" aria-label="Minerva home"><img src="/minerva-logo.png" alt=""/><span class="sidebar-brand text-xl font-extrabold tracking-tight text-[#17136b]">Minerva</span></RouterLink><button class="sidebar-collapse" :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'" @click="collapsed=!collapsed"><PanelLeftOpen v-if="collapsed" :size="18"/><PanelLeftClose v-else :size="18"/></button></div>
    <p class="mt-10 px-3 text-[10px] font-extrabold uppercase tracking-[.18em] text-slate-400">Scholar workspace</p>
    <nav class="mt-3 grid gap-1" aria-label="Scholar workspace"><RouterLink v-for="link in links" :key="link.id" :to="link.to" class="workspace-nav" :class="active === link.id && 'active'" :title="collapsed ? link.label : undefined"><component :is="link.icon" :size="18"/><span class="sidebar-label">{{ link.label }}</span><span v-if="link.id === 'interview'" class="sidebar-new ml-auto rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-extrabold text-[#5b45f5]">New</span></RouterLink></nav>
    <div class="mt-auto"><div class="sidebar-plan rounded-2xl bg-gradient-to-br from-[#17136b] to-[#4c35d9] p-4 text-white"><CreditCard :size="19" class="text-violet-200"/><p class="mt-4 text-sm font-extrabold">12 demo tokens</p><p class="mt-1 text-xs leading-5 text-violet-200">Use them to preview optional preparation feedback.</p><RouterLink to="/pricing" class="mt-4 inline-flex text-xs font-extrabold text-white underline decoration-violet-300 underline-offset-4">View plans</RouterLink></div></div>
  </aside>
</template>

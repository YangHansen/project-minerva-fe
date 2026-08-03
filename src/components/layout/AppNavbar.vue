<script setup lang="ts">
import { ref, watch } from 'vue'
import { Menu, X, ChevronDown } from 'lucide-vue-next'
import { useRoute } from 'vue-router'

const open = ref(false)
const route = useRoute()
watch(() => route.fullPath, () => { open.value = false })
const links = [
  { label: 'Product', to: '/#product' }, { label: 'Scholarships', to: '/scholarships' },
  { label: 'Preparation', to: '/documents' }, { label: 'Mentors', to: '/mentors' },
  { label: 'Pricing', to: '/pricing' }, { label: 'Resources', to: '/#faq' },
]
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
    <nav class="container flex h-18 items-center justify-between" aria-label="Primary navigation">
      <RouterLink to="/" class="flex items-center font-extrabold text-[#17136b]" aria-label="Minerva home">
        <img src="/minerva-logo.png" alt="Minerva" class="h-11 w-36 object-contain">
      </RouterLink>
      <div class="hidden items-center gap-7 lg:flex">
        <RouterLink v-for="link in links" :key="link.label" :to="link.to" class="nav-link">
          {{ link.label }} <ChevronDown v-if="['Product','Preparation','Resources'].includes(link.label)" :size="13" />
        </RouterLink>
      </div>
      <div class="hidden items-center gap-3 lg:flex">
        <RouterLink to="/login" class="btn-ghost">Log In</RouterLink>
        <RouterLink to="/register" class="btn-primary">Get Started</RouterLink>
      </div>
      <button class="icon-button lg:hidden" :aria-expanded="open" aria-controls="mobile-menu" aria-label="Toggle menu" @click="open = !open">
        <X v-if="open" :size="22" /><Menu v-else :size="22" />
      </button>
    </nav>
    <Transition name="drawer">
      <div v-if="open" id="mobile-menu" class="border-t border-slate-200 bg-white p-5 lg:hidden">
        <div class="container grid gap-1">
          <RouterLink v-for="link in links" :key="link.label" :to="link.to" class="rounded-xl px-4 py-3 font-semibold text-slate-700 hover:bg-violet-50">{{ link.label }}</RouterLink>
          <div class="mt-3 grid grid-cols-2 gap-3"><RouterLink to="/login" class="btn-secondary">Log In</RouterLink><RouterLink to="/register" class="btn-primary">Get Started</RouterLink></div>
        </div>
      </div>
    </Transition>
  </header>
</template>

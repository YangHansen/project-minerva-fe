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
    <nav class="mx-auto flex h-20 w-[min(1460px,calc(100%-32px))] items-center justify-between sm:w-[min(1460px,calc(100%-56px))]" aria-label="Primary navigation">
      <RouterLink to="/" class="flex items-center font-extrabold text-[#17136b]" aria-label="Minerva home">
        <img src="/minerva-logo.png" alt="Minerva" class="h-14 w-48 object-contain object-left">
      </RouterLink>
      <div class="hidden items-center gap-8 lg:flex">
        <RouterLink v-for="link in links" :key="link.label" :to="link.to" class="inline-flex items-center gap-1 text-[.82rem] font-bold text-slate-600 hover:text-[#5b45f5]">
          {{ link.label }} <ChevronDown v-if="['Product','Preparation','Resources'].includes(link.label)" :size="13" />
        </RouterLink>
      </div>
      <div class="hidden items-center gap-3 lg:flex">
        <RouterLink to="/login" class="inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-extrabold text-[#17136b]">Log In</RouterLink>
        <RouterLink to="/register" class="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#17136b] px-6 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(23,19,107,.18)]">Get Started</RouterLink>
      </div>
      <button class="grid size-[42px] place-items-center rounded-xl border border-slate-200 bg-white text-[#17136b] lg:hidden" :aria-expanded="open" aria-controls="mobile-menu" aria-label="Toggle menu" @click="open = !open">
        <X v-if="open" :size="22" /><Menu v-else :size="22" />
      </button>
    </nav>
    <Transition enter-active-class="transition duration-200" enter-from-class="-translate-y-2 opacity-0" leave-active-class="transition duration-200" leave-to-class="-translate-y-2 opacity-0">
      <div v-if="open" id="mobile-menu" class="border-t border-slate-200 bg-white p-5 lg:hidden">
        <div class="mx-auto grid w-[min(1460px,calc(100%-32px))] gap-1 sm:w-[min(1460px,calc(100%-56px))]">
          <RouterLink v-for="link in links" :key="link.label" :to="link.to" class="rounded-xl px-4 py-3 font-semibold text-slate-700 hover:bg-violet-50">{{ link.label }}</RouterLink>
          <div class="mt-3 grid grid-cols-2 gap-3"><RouterLink to="/login" class="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-[#17136b]">Log In</RouterLink><RouterLink to="/register" class="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#17136b] px-4 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(23,19,107,.18)]">Get Started</RouterLink></div>
        </div>
      </div>
    </Transition>
  </header>
</template>

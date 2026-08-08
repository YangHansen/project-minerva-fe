<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppNavbar from './components/layout/AppNavbar.vue'
import AppFooter from './components/layout/AppFooter.vue'
import ToastContainer from './components/common/ToastContainer.vue'
import FloatingAiChat from './components/common/FloatingAiChat.vue'
import { tailwindTheme } from './tailwindTheme'
import { useAppState } from './composables/useAppState'
const route = useRoute()
const { session } = useAppState()
const hideChrome = computed(() => Boolean(route.meta.workspace || route.meta.fullscreen || route.meta.auth))
const hideNavbar = computed(() => hideChrome.value || Boolean(session.value))
</script>

<template>
  <div :class="['min-h-screen bg-white font-sans text-slate-700 selection:bg-violet-200 selection:text-[#17136b]', tailwindTheme]">
    <AppNavbar v-if="!hideNavbar" />
    <RouterView v-slot="{ Component }">
      <Transition enter-active-class="transition duration-200" enter-from-class="translate-y-1 opacity-0" leave-active-class="transition duration-200" leave-to-class="opacity-0" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
    <AppFooter v-if="!hideChrome" />
    <ToastContainer />
    <FloatingAiChat />
  </div>
</template>

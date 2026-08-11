<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppNavbar from './components/layout/AppNavbar.vue'
import AppFooter from './components/layout/AppFooter.vue'
import ToastContainer from './components/common/ToastContainer.vue'
import FloatingAiChat from './components/common/FloatingAiChat.vue'
import { tailwindTheme } from './tailwindTheme'
import { normalizeUserProfile, useAppState } from './composables/useAppState'
import { ApiError, apiRequest } from './api'
const route = useRoute()
const { session, profile, tokenBalance, hydrateWorkspace, resetUserState, loadScholarshipCatalog } = useAppState()
const hideChrome = computed(() => Boolean(route.meta.workspace || route.meta.fullscreen || route.meta.auth))
const hideNavbar = computed(() => hideChrome.value || Boolean(session.value))
onMounted(async () => {
  void loadScholarshipCatalog()
  let currentUser: { id: string; name: string; email: string; role: string; tokenBalance: number; profileCompleted: boolean }
  try {
    const result = await apiRequest<{ user: typeof currentUser }>('/api/auth/me')
    currentUser = result.user
  } catch (caught) {
    if (caught instanceof ApiError && (caught.status === 401 || caught.status === 403)) resetUserState()
    return
  }

  session.value = { id: currentUser.id, name: currentUser.name, email: currentUser.email, role: currentUser.role }
  tokenBalance.value = currentUser.tokenBalance
  if (currentUser.profileCompleted) {
    try {
      const saved = await apiRequest<{ profile: unknown }>('/api/profile')
      if (saved.profile) profile.value = normalizeUserProfile(saved.profile)
    } catch {
      // Keep the last local profile during a transient profile-service failure.
    }
  }
  await hydrateWorkspace()
})
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

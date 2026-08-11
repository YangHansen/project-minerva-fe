<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LoaderCircle } from 'lucide-vue-next'
import { normalizeUserProfile, useAppState } from '../composables/useAppState'
import { apiRequest } from '../api'

const router = useRouter()
const route = useRoute()
const { session, profile, tokenBalance, hydrateWorkspace } = useAppState()

onMounted(async () => {
  try {
    const result = await apiRequest<{ user: { id: string; name: string; email: string; role: string; tokenBalance: number; profileCompleted: boolean } }>('/api/auth/me')
    session.value = { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role }
    tokenBalance.value = result.user.tokenBalance
    if (result.user.profileCompleted) {
      try {
        const saved = await apiRequest<{ profile: typeof profile.value }>('/api/profile')
        if (saved.profile) profile.value = normalizeUserProfile(saved.profile)
      } catch { /* Profile can be completed later. */ }
    }
    await hydrateWorkspace()
    const next = typeof route.query.next === 'string' && /^\/(?!\/)/.test(route.query.next) ? route.query.next : ''
    await router.replace(next || (result.user.profileCompleted ? '/dashboard' : '/onboarding'))
  } catch {
    await router.replace('/login')
  }
})
</script>

<template>
  <main class="grid min-h-screen place-items-center p-6">
    <div class="text-center">
      <LoaderCircle class="mx-auto animate-spin text-[#5b45f5]" :size="32" />
      <p class="mt-4 text-sm font-bold text-slate-600">Finishing your sign-in…</p>
    </div>
  </main>
</template>
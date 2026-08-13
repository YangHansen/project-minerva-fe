<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRight, MailCheck } from 'lucide-vue-next'
import { apiRequest } from '../api'

const email = ref('')
const loading = ref(false)
const error = ref('')
const sent = ref(false)

const submit = async () => {
  error.value = ''
  if (!/^\S+@\S+\.\S+$/.test(email.value)) { error.value = 'Enter a valid email.'; return }
  loading.value = true
  try {
    await apiRequest<{ success: boolean }>('/api/auth/forgot-password', { method: 'POST', body: { email: email.value } })
    sent.value = true
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to request a reset link.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="grid h-dvh max-h-dvh overflow-hidden lg:grid-cols-2">
    <section class="hidden h-full min-h-0 bg-gradient-to-br from-[#17136b] via-[#30209a] to-[#5b45f5] p-14 text-white lg:flex lg:flex-col lg:justify-between">
      <RouterLink to="/" aria-label="Go to Minerva homepage" class="w-fit rounded-xl focus:outline-none focus:ring-2 focus:ring-white">
        <img src="/minerva-logo.png" alt="Minerva" class="h-20 w-64 rounded-xl bg-white object-cover" />
      </RouterLink>
      <div>
        <p class="text-sm font-extrabold uppercase tracking-[.2em] text-violet-200">Find. Prepare. Succeed.</p>
        <h1 class="mt-6 max-w-xl text-6xl font-extrabold leading-[1.02] tracking-[-.05em]">Keep your workspace within reach.</h1>
        <p class="mt-6 max-w-lg text-lg leading-8 text-violet-100">Reset your password and get back to your shortlist, checklists, and preparation.</p>
      </div>
      <p class="text-xs text-violet-300">A reset link is sent only when an account exists.</p>
    </section>

    <section class="grid min-h-0 place-items-center overflow-y-auto p-6 py-10">
      <div v-if="sent" class="w-full max-w-md text-center">
        <span class="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-500"><MailCheck :size="30" /></span>
        <h1 class="mt-5 text-3xl font-extrabold tracking-tight text-[#17136b]">Check your inbox</h1>
        <p class="mt-3 leading-7 text-slate-500">If an account exists for that email, a reset link is on the way. The link expires in 30 minutes.</p>
        <RouterLink to="/login" class="btn-primary mt-8">Back to log in</RouterLink>
      </div>

      <form v-else class="w-full max-w-md" @submit.prevent="submit">
        <p class="eyebrow">Recover access</p>
        <h1 class="mt-5 text-4xl font-extrabold tracking-tight text-[#17136b]">Forgot your password?</h1>
        <p class="mt-3 text-slate-500">Enter the email on your account and we'll send a reset link.</p>
        <div class="mt-8 grid gap-5">
          <label class="field-label">Email<input v-model="email" type="email" autocomplete="email" class="field" placeholder="you@example.com" /></label>
          <p v-if="error" class="error">{{ error }}</p>
          <button class="btn-primary" type="submit" :disabled="loading">{{ loading ? 'Sending link…' : 'Send reset link' }}<ArrowRight :size="16" /></button>
        </div>
        <p class="mt-6 text-center text-sm text-slate-500">Remembered it? <RouterLink to="/login" class="font-extrabold text-[#5b45f5]">Log in</RouterLink></p>
      </form>
    </section>
  </main>
</template>
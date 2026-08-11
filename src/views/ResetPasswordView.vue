<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, CheckCircle2, Eye, EyeOff, ShieldAlert } from 'lucide-vue-next'
import { apiRequest } from '../api'

const route = useRoute()
const router = useRouter()
const token = typeof route.query.token === 'string' ? route.query.token : ''
const password = ref('')
const confirm = ref('')
const showPassword = ref(false)
const showConfirm = ref(false)
const loading = ref(false)
const checking = ref(true)
const error = ref('')
const invalid = ref(false)
const done = ref(false)

onMounted(async () => {
  if (!token) { invalid.value = true; checking.value = false; return }
  try {
    await apiRequest<{ success: boolean }>(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
  } catch {
    invalid.value = true
  } finally {
    checking.value = false
  }
})

const submit = async () => {
  error.value = ''
  if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password.value)) { error.value = 'Use 8+ characters with at least one capital letter and one number.'; return }
  if (password.value !== confirm.value) { error.value = 'Passwords do not match.'; return }
  loading.value = true
  try {
    await apiRequest<{ success: boolean }>('/api/auth/reset-password', { method: 'POST', body: { token, password: password.value } })
    done.value = true
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to reset your password.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="grid min-h-[calc(100vh-72px)] lg:grid-cols-2">
    <section class="hidden bg-gradient-to-br from-[#17136b] via-[#30209a] to-[#5b45f5] p-14 text-white lg:flex lg:flex-col lg:justify-between">
      <RouterLink to="/" aria-label="Go to Minerva homepage" class="w-fit rounded-xl focus:outline-none focus:ring-2 focus:ring-white">
        <img src="/minerva-logo.png" alt="Minerva" class="h-20 w-64 rounded-xl bg-white object-cover" />
      </RouterLink>
      <div>
        <p class="text-sm font-extrabold uppercase tracking-[.2em] text-violet-200">Find. Prepare. Succeed.</p>
        <h1 class="mt-6 max-w-xl text-6xl font-extrabold leading-[1.02] tracking-[-.05em]">Pick a new password and keep moving.</h1>
        <p class="mt-6 max-w-lg text-lg leading-8 text-violet-100">Your applications, checklist, and preparation work are all waiting.</p>
      </div>
      <p class="text-xs text-violet-300">Reset links are single-use and expire after 30 minutes.</p>
    </section>

    <section class="grid place-items-center p-6 py-16">
      <div v-if="checking" class="w-full max-w-md text-center">
        <p class="text-sm font-bold text-slate-500">Checking your reset link…</p>
      </div>

      <div v-else-if="invalid" class="w-full max-w-md text-center">
        <span class="mx-auto grid size-16 place-items-center rounded-2xl bg-red-50 text-red-500"><ShieldAlert :size="30" /></span>
        <h1 class="mt-5 text-3xl font-extrabold tracking-tight text-[#17136b]">This link is invalid or expired</h1>
        <p class="mt-3 leading-7 text-slate-500">Reset links expire after 30 minutes. Request a fresh one to try again.</p>
        <RouterLink to="/forgot-password" class="btn-primary mt-8">Request a new link</RouterLink>
      </div>

      <div v-else-if="done" class="w-full max-w-md text-center">
        <span class="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-500"><CheckCircle2 :size="30" /></span>
        <h1 class="mt-5 text-3xl font-extrabold tracking-tight text-[#17136b]">Password updated</h1>
        <p class="mt-3 leading-7 text-slate-500">Your password has been changed. Log in with your new password to continue.</p>
        <button class="btn-primary mt-8" @click="router.push('/login')">Log in<ArrowRight :size="16" /></button>
      </div>

      <form v-else class="w-full max-w-md" @submit.prevent="submit">
        <p class="eyebrow">Set a new password</p>
        <h1 class="mt-5 text-4xl font-extrabold tracking-tight text-[#17136b]">Reset your password</h1>
        <p class="mt-3 text-slate-500">Choose a strong password you haven't used before.</p>
        <div class="mt-8 grid gap-4">
          <label class="field-label">New password<span class="relative"><input v-model="password" :type="showPassword ? 'text' : 'password'" class="field pr-10" autocomplete="new-password" placeholder="8+ characters, capital letter & number" /><button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" :aria-label="showPassword ? 'Hide password' : 'Show password'" @click="showPassword = !showPassword"><EyeOff v-if="showPassword" :size="17" /><Eye v-else :size="17" /></button></span><small class="font-medium text-slate-400">At least 8 characters with one capital letter and one number.</small></label>
          <label class="field-label">Confirm password<span class="relative"><input v-model="confirm" :type="showConfirm ? 'text' : 'password'" class="field pr-10" autocomplete="new-password" placeholder="Repeat password" /><button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" :aria-label="showConfirm ? 'Hide password' : 'Show password'" @click="showConfirm = !showConfirm"><EyeOff v-if="showConfirm" :size="17" /><Eye v-else :size="17" /></button></span></label>
          <p v-if="error" class="error">{{ error }}</p>
          <button class="btn-primary mt-1" type="submit" :disabled="loading">{{ loading ? 'Updating…' : 'Update password' }}<ArrowRight :size="16" /></button>
        </div>
      </form>
    </section>
  </main>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowRight, Eye, EyeOff } from 'lucide-vue-next'
import { useAppState } from '../composables/useAppState'
import { auth } from '../api'
import { ApiError } from '../api/client'
import AuthLayout from '../components/layout/AuthLayout.vue'

const password = ref('')
const confirm = ref('')
const show = ref(false)
const loading = ref(false)
const error = ref('')
const router = useRouter()
const route = useRoute()
const { toast } = useAppState()

const submit = async () => {
  error.value = ''
  if (password.value.length < 8) {
    error.value = 'Use at least 8 characters for your new password.'
    return
  }
  if (password.value !== confirm.value) {
    error.value = 'Passwords do not match.'
    return
  }
  loading.value = true
  try {
    await auth.resetPassword(String(route.params.token), password.value)
    toast('Your password has been reset. Please sign in.')
    router.push('/login')
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Unable to reset your password. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout headline="Your next opportunity is closer than it feels." sub="Set a new password and get back to preparing your applications.">
    <form class="w-full max-w-md" @submit.prevent="submit">
      <p class="eyebrow">Reset password</p>
      <h1 class="mt-5 text-4xl font-extrabold tracking-tight text-[#17136b]">Set a new password</h1>
      <p class="mt-3 text-slate-500">Choose a new password for your Minerva account.</p>
      <div class="mt-8 grid gap-5">
        <label class="field-label">New password
          <span class="relative">
            <input v-model="password" :type="show ? 'text' : 'password'" autocomplete="new-password" class="field pr-12" placeholder="8+ characters" />
            <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" :aria-label="show ? 'Hide password' : 'Show password'" @click="show = !show">
              <EyeOff v-if="show" :size="18" /><Eye v-else :size="18" />
            </button>
          </span>
        </label>
        <label class="field-label">Confirm password
          <input v-model="confirm" :type="show ? 'text' : 'password'" autocomplete="new-password" class="field" placeholder="Repeat password" />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="btn-primary" type="submit" :disabled="loading">{{ loading ? 'Resetting…' : 'Reset password' }}<ArrowRight :size="16" /></button>
      </div>
      <p class="mt-6 text-center text-sm text-slate-500">Remembered it? <RouterLink to="/login" class="font-extrabold text-[#5b45f5]">Log in</RouterLink></p>
    </form>
  </AuthLayout>
</template>

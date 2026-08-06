<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowRight, Eye, EyeOff } from 'lucide-vue-next'
import { useAppState } from '../composables/useAppState'
import { auth } from '../api'
import { ApiError } from '../api/client'
import AuthLayout from '../components/layout/AuthLayout.vue'

const email = ref('')
const password = ref('')
const remember = ref(true)
const show = ref(false)
const loading = ref(false)
const error = ref('')
const showForgot = ref(false)
const forgotEmail = ref('')
const forgotLoading = ref(false)
const router = useRouter()
const route = useRoute()
const { signIn, toast } = useAppState()

const submit = async () => {
  if (showForgot.value) {
    await sendReset()
    return
  }
  error.value = ''
  if (!/^\S+@\S+\.\S+$/.test(email.value) || password.value.length < 6) {
    error.value = 'Enter a valid email and a password with at least 6 characters.'
    return
  }
  loading.value = true
  try {
    const res = await auth.login(email.value, password.value)
    signIn(res.token, res.user.email.split('@')[0], res.user.email)
    router.push(String(route.query.redirect || '/dashboard'))
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.'
  } finally {
    loading.value = false
  }
}

const sendReset = async () => {
  if (!/^\S+@\S+\.\S+$/.test(forgotEmail.value)) return
  forgotLoading.value = true
  try {
    await auth.forgotPassword(forgotEmail.value)
    toast('If that email is registered, a reset link has been sent.', 'info')
    showForgot.value = false
    forgotEmail.value = ''
  } finally {
    forgotLoading.value = false
  }
}
</script>

<template>
  <AuthLayout headline="Your next opportunity is closer than it feels." sub="Return to your shortlist, application checklist, and preparation workspace." footer="Sign in to continue to your workspace.">
    <form class="w-full max-w-md" @submit.prevent="submit">
      <p class="eyebrow">Welcome back</p>
      <h1 class="mt-5 text-4xl font-extrabold tracking-tight text-[#17136b]">{{ showForgot ? 'Reset your password' : 'Log in to Minerva' }}</h1>
      <p class="mt-3 text-slate-500">{{ showForgot ? 'Enter the email linked to your account and we will send a reset link.' : 'Enter your Minerva account credentials to continue.' }}</p>
      <div class="mt-8 grid gap-5">
        <template v-if="!showForgot">
          <label class="field-label">Email
            <input v-model="email" type="email" autocomplete="email" class="field" placeholder="you@example.com" />
          </label>
          <label class="field-label">Password
            <span class="relative">
              <input v-model="password" :type="show ? 'text' : 'password'" autocomplete="current-password" class="field pr-12" placeholder="••••••••" />
              <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" :aria-label="show ? 'Hide password' : 'Show password'" @click="show = !show">
                <EyeOff v-if="show" :size="18" /><Eye v-else :size="18" />
              </button>
            </span>
          </label>
          <div class="flex items-center justify-between text-sm">
            <label class="flex items-center gap-2"><input v-model="remember" type="checkbox" class="accent-[#5b45f5]" />Remember me</label>
            <button type="button" class="font-bold text-[#5b45f5]" @click="showForgot = true">Forgot password?</button>
          </div>
          <p v-if="error" class="error">{{ error }}</p>
          <button class="btn-primary" type="submit" :disabled="loading">{{ loading ? 'Signing in…' : 'Log in' }}<ArrowRight :size="16" /></button>
        </template>
        <template v-else>
          <label class="field-label">Email
            <input v-model="forgotEmail" type="email" autocomplete="email" class="field" placeholder="you@example.com" />
          </label>
          <p v-if="error" class="error">{{ error }}</p>
          <button class="btn-primary" type="submit" :disabled="forgotLoading">{{ forgotLoading ? 'Sending…' : 'Send reset link' }}</button>
          <button type="button" class="text-sm font-bold text-[#5b45f5]" @click="showForgot = false">Back to sign in</button>
        </template>
      </div>
      <p class="mt-6 text-center text-sm text-slate-500">New to Minerva? <RouterLink to="/register" class="font-extrabold text-[#5b45f5]">Create an account</RouterLink></p>
    </form>
  </AuthLayout>
</template>

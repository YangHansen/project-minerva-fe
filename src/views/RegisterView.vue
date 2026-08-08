<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-vue-next'
import { useAppState } from '../composables/useAppState'

const name = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const terms = ref(false)
const showPassword = ref(false)
const showConfirm = ref(false)
const loading = ref(false)
const errors = ref<string[]>([])
const router = useRouter()
const { session } = useAppState()

const submit = () => {
  errors.value = []
  if (name.value.trim().length < 2) errors.value.push('Enter your name.')
  if (!/^\S+@\S+\.\S+$/.test(email.value)) errors.value.push('Enter a valid email.')
  if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password.value)) errors.value.push('Use 8+ characters with at least one capital letter and one number.')
  if (password.value !== confirm.value) errors.value.push('Passwords do not match.')
  if (!terms.value) errors.value.push('Accept the demo terms to continue.')
  if (errors.value.length) return
  loading.value = true
  setTimeout(() => { session.value = { name: name.value, email: email.value }; router.push('/onboarding') }, 700)
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
        <h1 class="mt-6 max-w-xl text-6xl font-extrabold leading-[1.02] tracking-[-.05em]">Your scholarship journey starts here.</h1>
        <p class="mt-6 max-w-lg text-lg leading-8 text-violet-100">Create one organised home for scholarship discovery, applications, and preparation.</p>
        <div class="mt-9 grid gap-4"><p v-for="item in ['Your scholarship folders', 'Tailored checklists and documents', 'Focused test and interview prep']" :key="item" class="flex items-center gap-3 text-sm font-bold text-violet-100"><CheckCircle2 :size="18" class="text-emerald-300" />{{ item }}</p></div>
      </div>
      <p class="text-xs text-violet-300">Frontend demo · No real account is created</p>
    </section>

    <section class="grid place-items-center p-6 py-12 sm:p-10 lg:p-14">
      <form class="w-full max-w-md" @submit.prevent="submit">
        <p class="eyebrow">Start your journey</p>
        <h1 class="mt-5 text-4xl font-extrabold tracking-tight text-[#17136b]">Create your account</h1>
        <p class="mt-3 text-slate-500">Set up your Minerva workspace in a few moments.</p>
        <div class="mt-7 grid gap-4">
          <label class="field-label">Full name<input v-model="name" class="field" autocomplete="name" placeholder="Your full name" /></label>
          <label class="field-label">Email<input v-model="email" type="email" class="field" autocomplete="email" placeholder="you@example.com" /></label>
          <div class="grid gap-4">
            <label class="field-label">Password<span class="relative"><input v-model="password" :type="showPassword ? 'text' : 'password'" class="field pr-10" autocomplete="new-password" placeholder="8+ characters, capital letter & number" /><button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" :aria-label="showPassword ? 'Hide password' : 'Show password'" @click="showPassword = !showPassword"><EyeOff v-if="showPassword" :size="17" /><Eye v-else :size="17" /></button></span><small class="font-medium text-slate-400">At least 8 characters with one capital letter and one number.</small></label>
            <label class="field-label">Confirm password<span class="relative"><input v-model="confirm" :type="showConfirm ? 'text' : 'password'" class="field pr-10" autocomplete="new-password" placeholder="Repeat password" /><button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" :aria-label="showConfirm ? 'Hide password' : 'Show password'" @click="showConfirm = !showConfirm"><EyeOff v-if="showConfirm" :size="17" /><Eye v-else :size="17" /></button></span></label>
          </div>
          <label class="mt-1 flex items-start gap-3 text-sm leading-6 text-slate-600"><input v-model="terms" type="checkbox" class="mt-1 accent-[#5b45f5]" /><span>I agree to the demo terms and understand no real account is created.</span></label>
          <ul v-if="errors.length" class="rounded-xl bg-red-50 p-4 text-xs text-red-700"><li v-for="item in errors" :key="item">• {{ item }}</li></ul>
          <button class="btn-primary mt-1 w-full" type="submit" :disabled="loading">{{ loading ? 'Creating account…' : 'Create account' }}<ArrowRight :size="16" /></button>
        </div>
        <p class="mt-6 text-center text-sm text-slate-500">Already have an account? <RouterLink to="/login" class="font-extrabold text-[#5b45f5]">Log in</RouterLink></p>
      </form>
    </section>
  </main>
</template>

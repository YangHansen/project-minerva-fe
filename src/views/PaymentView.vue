<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, CheckCircle2, Coins, CreditCard, LockKeyhole, Sparkles } from 'lucide-vue-next'
import { useAppState } from '../composables/useAppState'
import { apiRequest } from '../api'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'

interface Pack { id: string; name: string; tokens: number; price: string; description: string; badge: string }
// ponytail: fallback mirrors the backend packs so the page renders offline
const fallbackPacks: Pack[] = [
  { id: 'starter', name: 'Starter', tokens: 10, price: '$4.99', description: 'A focused boost for one application.', badge: '' },
  { id: 'momentum', name: 'Momentum', tokens: 30, price: '$11.99', description: 'Great for an active application season.', badge: 'Most popular' },
  { id: 'focus', name: 'Focus', tokens: 60, price: '$19.99', description: 'Extra support across several folders.', badge: '' },
]
const packs = ref<Pack[]>(fallbackPacks)

const selectedPackId = ref<string>('momentum')
const processing = ref(false)
const complete = ref(false)
const cardholderName = ref('')
const cardNumber = ref('')
const expiryDate = ref('')
const cvc = ref('')
const selectedPack = computed(() => packs.value.find((pack) => pack.id === selectedPackId.value) ?? packs.value[1] ?? fallbackPacks[1])
const router = useRouter()
const { tokenBalance, toast } = useAppState()
const projectedBalance = computed(() => tokenBalance.value + (complete.value ? 0 : selectedPack.value.tokens))

onMounted(async () => {
  try {
    const result = await apiRequest<{ packs: Pack[] }>('/api/pricing/packs')
    if (Array.isArray(result.packs) && result.packs.length) packs.value = result.packs
  } catch {
    // keep local fallback on any failure
  }
})

const digitsOnly = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max)
const formatCardNumber = (value: string) => digitsOnly(value, 16).replace(/(.{4})/g, '$1 ').trim()
const formatExpiryDate = (value: string) => {
  const digits = digitsOnly(value, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits
}
const updateCardNumber = (event: Event) => { cardNumber.value = formatCardNumber((event.target as HTMLInputElement).value) }
const updateExpiryDate = (event: Event) => { expiryDate.value = formatExpiryDate((event.target as HTMLInputElement).value) }
const updateCvc = (event: Event) => { cvc.value = digitsOnly((event.target as HTMLInputElement).value, 4) }

async function purchaseTokens() {
  if (processing.value || complete.value) return
  if (!cardholderName.value.trim() || digitsOnly(cardNumber.value, 16).length !== 16 || digitsOnly(expiryDate.value, 4).length !== 4 || !/^\d{3,4}$/.test(cvc.value)) {
    toast('Enter a cardholder name, 16-digit card number, expiry date, and 3-4 digit CVC.', 'info')
    return
  }

  processing.value = true
  window.setTimeout(async () => {
    try {
      // This is deliberately a development-only demo endpoint. No payment data
      // leaves the browser; it credits the same balance checked by AI routes.
      const result = await apiRequest<{ creditedTokens: number; tokenBalance: number }>('/api/billing/demo-topups', {
        method: 'POST',
        body: { packId: selectedPack.value.id },
      })
      tokenBalance.value = result.tokenBalance
      complete.value = true
      toast(`Payment successful - ${result.creditedTokens} tokens added to your account.`)
      window.setTimeout(() => { void router.push('/dashboard') }, 1500)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Demo top-up could not be completed.', 'info')
    } finally {
      processing.value = false
    }
  }, 550)
}</script>

<template>
  <main class="workspace-shell">
    <WorkspaceSidebar active="payment" />
    <div class="workspace-main">
      <WorkspaceTopbar title="Tokens & payment" subtitle="Manage your tokens for optional Minerva preparation feedback." />

      <div class="workspace-content">
        <section class="mx-auto max-w-[1180px]">
          <div class="grid gap-5 lg:grid-cols-[1.35fr_.85fr]">
            <section class="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#241979] via-[#2d1e8e] to-[#1b126d] p-7 text-white shadow-[0_20px_40px_rgba(36,25,121,.2)] sm:p-8">
              <div class="absolute -right-12 -top-16 size-48 rounded-full bg-white/10 blur-2xl" />
              <div class="relative flex items-start justify-between gap-5">
                <div>
                  <span class="grid size-12 place-items-center rounded-2xl bg-white/15"><Coins :size="25" /></span>
                  <p class="mt-7 text-[.68rem] font-black uppercase tracking-[.17em] text-violet-200">Tokens owned</p>
                  <p class="mt-1 text-5xl font-black tracking-tight">{{ tokenBalance }}</p>
                  <p class="mt-3 max-w-md text-sm leading-6 text-violet-100">Use tokens for optional AI writing reviews, tailored interview feedback, and focused preparation guidance.</p>
                </div>
                <span class="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black">Minerva balance</span>
              </div>
            </section>

            <section class="rounded-[28px] border border-violet-100 bg-white p-7 shadow-[0_12px_34px_rgba(61,51,137,.08)]">
              <span class="grid size-11 place-items-center rounded-2xl bg-violet-50 text-[#5b45f5]"><Sparkles :size="21" /></span>
              <h2 class="mt-5 text-xl font-black text-[#17136b]">Use tokens when it helps</h2>
              <p class="mt-2 text-sm leading-6 text-slate-500">Your core scholarship workspace remains available without tokens.</p>
              <ul class="mt-5 grid gap-3 text-sm font-bold text-slate-600">
                <li class="flex gap-2"><Check :size="18" class="shrink-0 text-emerald-500" />AI writing feedback</li>
                <li class="flex gap-2"><Check :size="18" class="shrink-0 text-emerald-500" />Interview response review</li>
                <li class="flex gap-2"><Check :size="18" class="shrink-0 text-emerald-500" />Advanced preparation insights</li>
              </ul>
            </section>
          </div>

          <section class="mt-9">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p class="eyebrow">Add tokens</p>
                <h1 class="mt-2 text-3xl font-black tracking-tight text-[#17136b]">Choose a token pack</h1>
                <p class="mt-2 text-sm text-slate-500">Demo checkout only. No money is processed; completing this form adds tokens to your local demo balance.</p>
              </div>
              <span class="rounded-full bg-violet-50 px-4 py-2 text-xs font-black text-[#5b45f5]">Demo checkout</span>
            </div>

            <div class="mt-5 grid gap-4 md:grid-cols-3">
              <button v-for="pack in packs" :key="pack.id" type="button" class="relative rounded-[24px] border-2 bg-white p-5 text-left transition" :class="selectedPackId === pack.id ? 'border-[#5b45f5] shadow-[0_14px_30px_rgba(91,69,245,.14)]' : 'border-slate-200 hover:border-violet-200'" @click="selectedPackId = pack.id">
                <span v-if="pack.badge" class="absolute -top-3 left-5 rounded-full bg-[#5b45f5] px-3 py-1 text-[10px] font-black uppercase tracking-[.1em] text-white">{{ pack.badge }}</span>
                <div class="flex items-start justify-between gap-3">
                  <span class="grid size-10 place-items-center rounded-xl bg-violet-50 text-[#5b45f5]"><Coins :size="20" /></span>
                  <span v-if="selectedPackId === pack.id" class="grid size-6 place-items-center rounded-full bg-[#5b45f5] text-white"><Check :size="15" /></span>
                </div>
                <p class="mt-5 text-lg font-black text-[#17136b]">{{ pack.name }}</p>
                <p class="mt-1 text-sm text-slate-500">{{ pack.description }}</p>
                <div class="mt-5 flex items-end justify-between"><strong class="text-2xl font-black text-[#17136b]">{{ pack.tokens }} <span class="text-sm">tokens</span></strong><span class="text-sm font-black text-[#5b45f5]">{{ pack.price }}</span></div>
              </button>
            </div>
          </section>

          <section class="mt-6 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
            <form class="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(61,51,137,.06)] sm:p-7" @submit.prevent="purchaseTokens">
              <div class="flex items-center gap-3"><span class="grid size-10 place-items-center rounded-xl bg-violet-50 text-[#5b45f5]"><CreditCard :size="20" /></span><div><h2 class="font-black text-[#17136b]">Payment details</h2><p class="text-xs text-slate-500">Demo only. Card details are never stored or sent.</p></div></div>
              <div class="mt-6 grid gap-4 sm:grid-cols-2">
                <label class="field-label sm:col-span-2">Cardholder name<input v-model="cardholderName" required autocomplete="cc-name" class="field mt-2" placeholder="Name on card" /></label>
                <label class="field-label sm:col-span-2">Card number<input :value="cardNumber" required inputmode="numeric" autocomplete="cc-number" maxlength="19" class="field mt-2" placeholder="1234 1234 1234 1234" @input="updateCardNumber" /></label>
                <label class="field-label">Expiry date<input :value="expiryDate" required inputmode="numeric" autocomplete="cc-exp" maxlength="7" class="field mt-2" placeholder="MM / YY" @input="updateExpiryDate" /></label>
                <label class="field-label">CVC<input :value="cvc" required inputmode="numeric" autocomplete="cc-csc" maxlength="4" class="field mt-2" placeholder="123" @input="updateCvc" /></label>
              </div>
              <p class="mt-5 flex items-center gap-2 text-xs leading-5 text-slate-500"><LockKeyhole :size="15" class="text-emerald-600" />No payment details are stored or sent. This local demo adds tokens to your current browser balance.</p>
              <button class="btn-primary mt-6 w-full justify-center" type="submit" :disabled="processing"><CheckCircle2 v-if="complete" :size="18" />{{ processing ? 'Completing demo payment…' : complete ? 'Payment successful — returning to dashboard' : `Complete demo payment for ${selectedPack.tokens} tokens` }}</button>
            </form>

            <aside class="rounded-[26px] bg-[#241979] p-6 text-white shadow-[0_16px_32px_rgba(36,25,121,.16)] sm:p-7">
              <p class="text-[.68rem] font-black uppercase tracking-[.16em] text-violet-200">Order summary</p>
              <div class="mt-6 flex items-center justify-between border-b border-white/15 pb-5"><div><p class="font-black">{{ selectedPack.name }} pack</p><p class="mt-1 text-sm text-violet-100">{{ selectedPack.tokens }} Minerva tokens</p></div><strong>{{ selectedPack.price }}</strong></div>
              <div class="mt-5 flex items-center justify-between text-sm text-violet-100"><span>Current balance</span><strong class="text-white">{{ tokenBalance }} tokens</strong></div>
              <div class="mt-3 flex items-center justify-between text-sm text-violet-100"><span>New balance</span><strong class="text-white">{{ projectedBalance }} tokens</strong></div>
              <p class="mt-7 text-xs leading-5 text-violet-200">Demo mode only: no money is charged. The selected tokens will be added locally, then you will return to your dashboard.</p>
            </aside>
          </section>
        </section>
      </div>
    </div>
  </main>
</template>

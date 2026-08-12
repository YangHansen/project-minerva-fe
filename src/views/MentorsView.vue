<script setup lang="ts">
import { computed, ref } from 'vue'
import { Award, BellRing, CalendarDays, CheckCircle2, Clock3, Pencil, Search, Star, Trash2, Users } from 'lucide-vue-next'
import BaseModal from '../components/common/BaseModal.vue'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'
import type { Mentor } from '../types'
import { useAppState } from '../composables/useAppState'
import { useScholarJourneyPage } from '../composables/useProductTour'

useScholarJourneyPage('mentors')
const modal = ref(false)
const chosen = ref<Mentor | null>(null)
const service = ref('')
const date = ref('')
const time = ref('')
const notes = ref('')
const success = ref(false)
const managingBooking = ref(false)
const query = ref('')
const focus = ref('All')
const { mentors, booking, bookMentor, cancelMentorBooking, toast, selectedId, getScholarship, tokenBalance } = useAppState()
const scholarship = computed(() => selectedId.value ? getScholarship(selectedId.value) : undefined)
const minDate = computed(() => new Date().toISOString().slice(0, 10))
const filters = ['All', 'Essay review', 'Mock interview', 'Research proposal', 'IELTS speaking']
const bookingMentor = computed(() => booking.value ? mentors.value.find((mentor) => mentor.id === booking.value?.mentorId) : undefined)
const bookingStart = computed(() => {
  if (!booking.value) return null
  const start = booking.value.time.split('-')[0].trim().replace('.', ':')
  const value = new Date(`${booking.value.date}T${start}:00`)
  return Number.isNaN(value.getTime()) ? null : value
})
const hoursUntilBooking = computed(() => bookingStart.value ? Math.ceil((bookingStart.value.getTime() - Date.now()) / 3600000) : null)
const bookingIsSoon = computed(() => hoursUntilBooking.value !== null && hoursUntilBooking.value >= 0 && hoursUntilBooking.value <= 48)
const bookingCountdown = computed(() => {
  const hours = hoursUntilBooking.value
  if (hours === null) return ''
  if (hours < 1) return 'less than 1 hour'
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.ceil(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
})
const formatBookingDate = (value: string) => new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))

const formatTimeRange = (start: string) => {
  const [hour, minute] = start.split(':').map(Number)
  const endMinutes = hour * 60 + minute + 30
  const endHour = Math.floor(endMinutes / 60) % 24
  const endMinute = endMinutes % 60
  return `${String(hour).padStart(2, '0')}.${String(minute).padStart(2, '0')} - ${String(endHour).padStart(2, '0')}.${String(endMinute).padStart(2, '0')}`
}

const filtered = computed(() => mentors.value.filter((mentor) => {
  const text = `${mentor.name} ${mentor.expertise} ${mentor.scholarshipExperience} ${mentor.highlight} ${mentor.services.join(' ')}`.toLowerCase()
  const scholarshipMatch = !scholarship.value || text.includes(scholarship.value.name.split(' ')[0].toLowerCase()) || text.includes(scholarship.value.country.toLowerCase()) || mentor.services.includes('Application strategy') || mentor.services.includes('Mock interview')
  return scholarshipMatch && (!query.value || text.includes(query.value.toLowerCase())) && (focus.value === 'All' || mentor.services.includes(focus.value))
}))

function openBooking(mentor: Mentor) {
  chosen.value = mentor
  service.value = mentor.services[0] || ''
  time.value = mentor.availableTimes[0] || ''
  date.value = ''
  notes.value = ''
  success.value = false
  managingBooking.value = false
  modal.value = true
}

function openManageBooking() {
  if (!booking.value) return
  const mentor = mentors.value.find((item) => item.id === booking.value?.mentorId)
  if (!mentor) return
  chosen.value = mentor
  service.value = booking.value.service
  date.value = booking.value.date
  const storedStart = booking.value.time.split('-')[0].trim().replace('.', ':')
  time.value = mentor.availableTimes.includes(storedStart) ? storedStart : mentor.availableTimes[0] || ''
  notes.value = booking.value.notes
  success.value = false
  managingBooking.value = true
  modal.value = true
}

const insufficientBalance = computed(() => chosen.value ? tokenBalance.value < Number(chosen.value.priceInTokens) : false)

function submit() {
  if (!chosen.value || !date.value) return
  void bookMentor({ mentorId: chosen.value.id, mentorName: chosen.value.name, service: service.value, date: date.value, time: formatTimeRange(time.value), notes: notes.value })
    .then(() => {
      success.value = true
      toast(managingBooking.value ? 'Mentor session updated.' : 'Mentor session booked.')
    })
    .catch(() => {
      toast(insufficientBalance.value ? 'Not enough tokens for this mentor session.' : 'Unable to book the mentor session.', 'info')
    })
}
function cancelBooking() {
  if (!booking.value || !window.confirm(`Cancel your session with ${booking.value.mentorName}?`)) return
  void cancelMentorBooking()
    .then(() => toast('Mentor session cancelled.', 'info'))
    .catch(() => toast('Unable to cancel the mentor session.', 'info'))
  modal.value = false
}
</script>

<template>
  <main class="workspace-shell">
    <WorkspaceSidebar active="mentors" />
    <div class="workspace-main">
      <WorkspaceTopbar title="Mentorship" subtitle="Find mentors whose experience matches your scholarship path." />
      <div class="workspace-content">
        <section data-tour="page-mentors" class="mentor-hero">
          <div>
            <p class="eyebrow">Scholarship-aware support</p>
            <h2>{{ scholarship ? `Mentors for ${scholarship.name}` : 'Select a scholarship for tailored mentor matches' }}</h2>
            <p>{{ scholarship ? `${scholarship.country} · ${scholarship.program}` : 'Browse the full mentor directory or choose an application first.' }}</p>
          </div>
          <RouterLink v-if="!scholarship" to="/scholarships" class="btn-primary">Select scholarship</RouterLink>
        </section>

        <section v-if="bookingIsSoon" class="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950">
          <div class="flex items-center gap-3"><span class="grid size-10 place-items-center rounded-xl bg-white text-amber-600"><BellRing :size="20" /></span><div><p class="font-bold">Your mentor session is coming up in {{ bookingCountdown }}</p><p class="mt-0.5 text-sm text-amber-800">{{ booking?.mentorName }} · {{ booking?.date }} at {{ booking?.time }}</p></div></div>
          <button class="rounded-xl bg-white px-4 py-2 text-sm font-bold text-amber-800 shadow-sm" @click="openManageBooking">Manage booking</button>
        </section>

        <section v-if="booking" class="mt-5 overflow-hidden rounded-[22px] border border-violet-100 bg-white shadow-[0_12px_32px_rgba(23,19,107,.06)]">
          <div class="flex flex-wrap items-center justify-between gap-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-sky-50 px-5 py-4"><div class="flex items-center gap-3"><span class="grid size-10 place-items-center rounded-xl bg-[#5b45f5] text-white"><CalendarDays :size="19" /></span><div><p class="text-xs font-bold uppercase tracking-[.14em] text-[#5b45f5]">Your upcoming session</p><h2 class="mt-1 text-lg font-bold text-[#17136b]">{{ booking.mentorName }}</h2></div></div><button class="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-bold text-[#5b45f5]" @click="openManageBooking"><Pencil :size="16" />Manage booking</button></div>
          <div class="grid gap-4 p-5 text-sm sm:grid-cols-3"><div><span class="text-xs font-bold uppercase tracking-wide text-slate-400">Service</span><p class="mt-1.5 font-bold text-[#17136b]">{{ booking.service }}</p></div><div><span class="text-xs font-bold uppercase tracking-wide text-slate-400">Date & time</span><p class="mt-1.5 flex items-center gap-1.5 font-bold text-[#17136b]"><Clock3 :size="15" class="text-[#5b45f5]" />{{ formatBookingDate(booking.date) }} · {{ booking.time }}</p></div><div><span class="text-xs font-bold uppercase tracking-wide text-slate-400">Mentor focus</span><p class="mt-1.5 font-bold text-[#17136b]">{{ bookingMentor?.expertise || 'Scholarship guidance' }}</p></div><div v-if="booking.notes" class="sm:col-span-3"><span class="text-xs font-bold uppercase tracking-wide text-slate-400">Your notes</span><p class="mt-1.5 leading-6 text-slate-600">{{ booking.notes }}</p></div></div>
        </section>

        <section class="mentor-tools"><label><Search :size="17" /><input v-model="query" placeholder="Search mentor, scholarship, or expertise" /></label><div><button v-for="item in filters" :key="item" :class="focus === item && 'active'" @click="focus = item">{{ item }}</button></div></section>

        <section class="mentor-directory">
          <article v-for="mentor in filtered" :key="mentor.id" class="mentor-profile">
            <div class="mentor-avatar"><img :src="mentor.photo" :alt="`${mentor.name} profile photo`" /></div>
            <span class="mentor-rating"><Star :size="13" fill="currentColor" />{{ mentor.rating }}</span>
            <h3>{{ mentor.name }}</h3>
            <p class="mentor-expertise">Specialty · {{ mentor.expertise }}</p>
            <p class="mentor-achievement"><Award :size="15" />{{ mentor.highlight }}</p>
            <p class="mentor-alumni">{{ mentor.scholarshipExperience }}</p>
            <div><span v-for="item in mentor.services.slice(0, 3)" :key="item">{{ item }}</span></div>
            <footer><small>{{ mentor.sessionPrice }} · 30 minutes</small><button @click="openBooking(mentor)"><CalendarDays :size="15" />Book session</button></footer>
          </article>
          <div v-if="!filtered.length" class="col-span-full py-16 text-center text-slate-400">No mentor matches these filters yet.</div>
        </section>
      </div>
    </div>

    <BaseModal :open="modal" :title="success ? (managingBooking ? 'Booking updated' : 'Session booked') : (managingBooking ? 'Manage booking' : `Book ${chosen?.name || 'mentor'}`)" @close="modal = false">
      <div v-if="success" class="py-6 text-center"><CheckCircle2 class="mx-auto text-emerald-500" :size="38" /><h3 class="mt-5 text-2xl font-extrabold text-[#17136b]">{{ managingBooking ? 'Booking updated' : 'Session booked' }}</h3><p class="mt-2 text-sm text-slate-500">Your selected time has been saved to the dashboard.</p><button class="btn-primary mt-6" @click="modal = false">Done</button></div>
      <form v-else class="grid gap-5" @submit.prevent="submit">
        <label class="field-label">Service<select v-model="service" class="field"><option v-for="item in chosen?.services" :key="item">{{ item }}</option></select></label>
        <label class="field-label">Date<input v-model="date" type="date" :min="minDate" class="field" required /></label>
        <label class="field-label">30-minute session time<select v-model="time" class="field"><option v-for="item in chosen?.availableTimes" :key="item" :value="item">{{ formatTimeRange(item) }}</option></select></label>
        <label class="field-label">Notes<textarea v-model="notes" class="field min-h-24" /></label>
        <div class="flex flex-wrap justify-between gap-3"><button v-if="managingBooking" type="button" class="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50" @click="cancelBooking"><Trash2 :size="16" />Cancel booking</button><div class="ml-auto flex flex-col items-end gap-1"><span v-if="chosen?.priceInTokens" class="text-xs font-bold text-[#5b45f5]">Costs {{ chosen.priceInTokens }} tokens</span><span v-if="insufficientBalance" class="text-xs font-bold text-red-500">Not enough tokens</span><button class="btn-primary" :disabled="insufficientBalance"><Users :size="16" />{{ managingBooking ? 'Save changes' : 'Book session' }}</button></div></div>
      </form>
    </BaseModal>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Award, CalendarDays, CheckCircle2, Search, Star, Users } from 'lucide-vue-next'
import BaseModal from '../components/common/BaseModal.vue'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'
import { mentors } from '../data/mentors'
import { getScholarship } from '../data/scholarships'
import type { Mentor } from '../types'
import { useAppState } from '../composables/useAppState'

const modal = ref(false)
const chosen = ref<Mentor | null>(null)
const service = ref('')
const date = ref('')
const time = ref('')
const notes = ref('')
const success = ref(false)
const query = ref('')
const focus = ref('All')
const { booking, toast, selectedId } = useAppState()
const scholarship = computed(() => selectedId.value ? getScholarship(selectedId.value) : undefined)
const minDate = computed(() => new Date().toISOString().slice(0, 10))
const filters = ['All', 'Essay review', 'Mock interview', 'Research proposal', 'IELTS speaking']

const formatTimeRange = (start: string) => {
  const [hour, minute] = start.split(':').map(Number)
  const endMinutes = hour * 60 + minute + 30
  const endHour = Math.floor(endMinutes / 60) % 24
  const endMinute = endMinutes % 60
  return `${String(hour).padStart(2, '0')}.${String(minute).padStart(2, '0')} - ${String(endHour).padStart(2, '0')}.${String(endMinute).padStart(2, '0')}`
}

const filtered = computed(() => mentors.filter((mentor) => {
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
  modal.value = true
}

function submit() {
  if (!chosen.value || !date.value) return
  booking.value = { mentorId: chosen.value.id, mentorName: chosen.value.name, service: service.value, date: date.value, time: formatTimeRange(time.value), notes: notes.value }
  success.value = true
  toast('Mentor session booked locally.')
}
</script>

<template>
  <main class="workspace-shell">
    <WorkspaceSidebar active="mentors" />
    <div class="workspace-main">
      <WorkspaceTopbar title="Mentorship" subtitle="Find mentors whose experience matches your scholarship path." />
      <div class="workspace-content">
        <section class="mentor-hero">
          <div>
            <p class="eyebrow">Scholarship-aware support</p>
            <h2>{{ scholarship ? `Mentors for ${scholarship.name}` : 'Select a scholarship for tailored mentor matches' }}</h2>
            <p>{{ scholarship ? `${scholarship.country} · ${scholarship.program}` : 'Browse the full mentor directory or choose an application first.' }}</p>
          </div>
          <RouterLink v-if="!scholarship" to="/scholarships" class="btn-primary">Select scholarship</RouterLink>
        </section>

        <div v-if="booking" class="mt-5 rounded-2xl bg-emerald-50 p-5 text-emerald-900"><CheckCircle2 class="mr-2 inline" />Upcoming booking with <strong>{{ booking.mentorName }}</strong> on {{ booking.date }} at {{ booking.time }}</div>

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

    <BaseModal :open="modal" :title="success ? 'Session booked' : `Book ${chosen?.name || 'mentor'}`" @close="modal = false">
      <div v-if="success" class="py-6 text-center"><CheckCircle2 class="mx-auto text-emerald-500" :size="38" /><h3 class="mt-5 text-2xl font-extrabold text-[#17136b]">Session booked</h3><p class="mt-2 text-sm text-slate-500">Your selected time has been saved to the dashboard.</p><button class="btn-primary mt-6" @click="modal = false">Done</button></div>
      <form v-else class="grid gap-5" @submit.prevent="submit">
        <label class="field-label">Service<select v-model="service" class="field"><option v-for="item in chosen?.services" :key="item">{{ item }}</option></select></label>
        <label class="field-label">Date<input v-model="date" type="date" :min="minDate" class="field" required /></label>
        <label class="field-label">30-minute session time<select v-model="time" class="field"><option v-for="item in chosen?.availableTimes" :key="item" :value="item">{{ formatTimeRange(item) }}</option></select></label>
        <label class="field-label">Notes<textarea v-model="notes" class="field min-h-24" /></label>
        <button class="btn-primary"><Users :size="16" />Book Session</button>
      </form>
    </BaseModal>
  </main>
</template>

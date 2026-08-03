import { computed, ref, watch } from 'vue'
import type { ChecklistItem, MentorBooking, MockSession, PracticeResult, UserProfile } from '../types'

function read<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback }
}
function persist<T>(key: string, state: { value: T }) { watch(state, (value) => localStorage.setItem(key, JSON.stringify(value)), { deep: true }) }

const defaultChecklist: ChecklistItem[] = [
  ['cv','CV','Core documents',true], ['essay','Essay or personal statement','Written materials',true],
  ['study-plan','Study plan','Written materials',true], ['recommendation','Recommendation letter','References',true],
  ['transcript','Academic transcript','Core documents',true], ['ielts','IELTS certificate','Language',false],
  ['passport','Passport','Core documents',true], ['application','Application form','Submission',true],
].map(([id,title,category,required]) => ({ id: String(id), title: String(title), category: String(category), required: Boolean(required), completed: false, notes: '' }))

const savedIds = ref<string[]>(read('minerva-saved', []))
const selectedId = ref<string | null>(read('minerva-selected', null))
const legacyChecklist = read('minerva-checklist', defaultChecklist)
const checklistsByScholarship = ref<Record<string, ChecklistItem[]>>(read('minerva-checklists', {}))
if (selectedId.value && !checklistsByScholarship.value[selectedId.value]) checklistsByScholarship.value[selectedId.value] = legacyChecklist
const checklist = computed(() => {
  const scholarshipId = selectedId.value
  if (!scholarshipId) return []
  if (!checklistsByScholarship.value[scholarshipId]) {
    checklistsByScholarship.value[scholarshipId] = defaultChecklist.map((item) => ({ ...item }))
  }
  return checklistsByScholarship.value[scholarshipId]
})
const profile = ref<UserProfile | null>(read('minerva-profile', null))
const session = ref<MockSession | null>(read('minerva-session', null))
const booking = ref<MentorBooking | null>(read('minerva-booking', null))
const legacyPracticeResult = read<PracticeResult | null>('minerva-practice', null)
const practiceByScholarship = ref<Record<string, PracticeResult>>(read('minerva-practice-by-scholarship', {}))
if (selectedId.value && legacyPracticeResult && !practiceByScholarship.value[selectedId.value]) practiceByScholarship.value[selectedId.value] = legacyPracticeResult
const practiceResult = computed<PracticeResult | null>({
  get: () => selectedId.value ? practiceByScholarship.value[selectedId.value] || null : null,
  set: (value) => { if (selectedId.value && value) practiceByScholarship.value[selectedId.value] = value },
})
persist('minerva-saved', savedIds); persist('minerva-selected', selectedId); persist('minerva-checklists', checklistsByScholarship)
persist('minerva-profile', profile); persist('minerva-session', session); persist('minerva-booking', booking); persist('minerva-practice-by-scholarship', practiceByScholarship)

const toasts = ref<{ id: number; message: string; tone: 'success' | 'info' }[]>([])
let toastId = 0
function toast(message: string, tone: 'success' | 'info' = 'success') {
  const id = ++toastId; toasts.value.push({ id, message, tone }); window.setTimeout(() => { toasts.value = toasts.value.filter((item) => item.id !== id) }, 3200)
}

export function useAppState() {
  const progress = computed(() => checklist.value.length ? Math.round((checklist.value.filter((item) => item.completed).length / checklist.value.length) * 100) : 0)
  const toggleSaved = (id: string) => {
    savedIds.value = savedIds.value.includes(id) ? savedIds.value.filter((item) => item !== id) : [...savedIds.value, id]
    toast(savedIds.value.includes(id) ? 'Scholarship saved to your shortlist.' : 'Scholarship removed from saved items.', 'info')
  }
  const selectScholarship = (id: string) => { selectedId.value = id; toast('Scholarship selected for preparation.') }
  return { savedIds, selectedId, checklist, profile, session, booking, practiceResult, progress, toasts, toast, toggleSaved, selectScholarship }
}

export const useSavedScholarships = useAppState
export const useSelectedScholarship = useAppState
export const useChecklist = useAppState
export const useAuth = useAppState
export const useToast = useAppState

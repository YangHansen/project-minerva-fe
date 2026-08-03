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
const checklist = ref<ChecklistItem[]>(read('minerva-checklist', defaultChecklist))
const profile = ref<UserProfile | null>(read('minerva-profile', null))
const session = ref<MockSession | null>(read('minerva-session', null))
const booking = ref<MentorBooking | null>(read('minerva-booking', null))
const practiceResult = ref<PracticeResult | null>(read('minerva-practice', null))
persist('minerva-saved', savedIds); persist('minerva-selected', selectedId); persist('minerva-checklist', checklist)
persist('minerva-profile', profile); persist('minerva-session', session); persist('minerva-booking', booking); persist('minerva-practice', practiceResult)

const toasts = ref<{ id: number; message: string; tone: 'success' | 'info' }[]>([])
let toastId = 0
function toast(message: string, tone: 'success' | 'info' = 'success') {
  const id = ++toastId; toasts.value.push({ id, message, tone }); window.setTimeout(() => { toasts.value = toasts.value.filter((item) => item.id !== id) }, 3200)
}

export function useAppState() {
  const progress = computed(() => Math.round((checklist.value.filter((item) => item.completed).length / checklist.value.length) * 100))
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

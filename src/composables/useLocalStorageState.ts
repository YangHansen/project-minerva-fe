import { ref, watch, type Ref } from 'vue'

export function useLocalStorageState<T>(key: string, fallback: T): Ref<T> {
  let initial = fallback
  try { const raw = localStorage.getItem(key); if (raw) initial = JSON.parse(raw) as T } catch { /* use fallback */ }
  const state = ref(initial) as Ref<T>
  watch(state, (value) => localStorage.setItem(key, JSON.stringify(value)), { deep: true })
  return state
}

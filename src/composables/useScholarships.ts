import { computed, type Ref } from 'vue'
import { scholarships } from '../data/scholarships'

export function useScholarships(query?: Ref<string>) {
  const results = computed(() => {
    const value = query?.value.trim().toLowerCase() ?? ''
    return value ? scholarships.filter((item) => `${item.name} ${item.country} ${item.fieldOfStudy}`.toLowerCase().includes(value)) : scholarships
  })
  return { scholarships, results }
}

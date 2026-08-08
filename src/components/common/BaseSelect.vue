<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, ChevronDown, Search } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue: string
  options: string[]
  placeholder: string
  searchable?: boolean
  disabled?: boolean
}>(), { searchable: false, disabled: false })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const open = ref(false)
const query = ref('')
const root = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const visibleOptions = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return term ? props.options.filter((option) => option.toLocaleLowerCase().includes(term)) : props.options
})

const toggle = async () => {
  if (props.disabled) return
  open.value = !open.value
  if (open.value && props.searchable) {
    await nextTick()
    searchInput.value?.focus()
  }
}
const choose = (value: string) => {
  emit('update:modelValue', value)
  query.value = ''
  open.value = false
}
const closeIfOutside = (event: MouseEvent) => {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('click', closeIfOutside))
onBeforeUnmount(() => document.removeEventListener('click', closeIfOutside))
</script>

<template>
  <div ref="root" class="base-select" :class="{ 'is-open': open, 'is-disabled': disabled }">
    <button type="button" class="base-select-trigger" :aria-expanded="open" :disabled="disabled" @click="toggle">
      <span :class="modelValue ? 'text-[#17136b]' : 'text-slate-400'">{{ modelValue || placeholder }}</span>
      <ChevronDown :size="19" class="shrink-0 transition-transform duration-200" :class="open && 'rotate-180'" />
    </button>
    <div v-if="open" class="base-select-menu">
      <label v-if="searchable" class="base-select-search">
        <Search :size="16" />
        <input ref="searchInput" v-model="query" type="search" placeholder="Search fields of study" @click.stop />
      </label>
      <div class="base-select-options" role="listbox">
        <button v-for="option in visibleOptions" :key="option" type="button" role="option" :aria-selected="modelValue === option" :class="{ selected: modelValue === option }" @click="choose(option)">
          <span>{{ option }}</span><Check v-if="modelValue === option" :size="17" />
        </button>
        <p v-if="!visibleOptions.length" class="base-select-empty">No matching field found.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.base-select { position: relative; width: 100%; }
.base-select-trigger { display: flex; min-height: 52px; width: 100%; align-items: center; justify-content: space-between; gap: .75rem; border: 1px solid #dbe3f0; border-radius: 14px; background: #fff; padding: .75rem 1rem; color: #17136b; font-weight: 700; text-align: left; transition: border-color .2s, box-shadow .2s; }
.base-select-trigger:hover { border-color: #9d8cff; }
.base-select.is-open .base-select-trigger { border-color: #634cff; box-shadow: 0 0 0 3px rgb(99 76 255 / .12); }
.base-select.is-disabled .base-select-trigger { cursor: not-allowed; background: #f8fafc; color: #94a3b8; }
.base-select-menu { position: absolute; z-index: 40; top: calc(100% + .5rem); left: 0; width: 100%; overflow: hidden; border: 1px solid #ddd6fe; border-radius: 14px; background: #fff; box-shadow: 0 18px 35px rgb(38 25 110 / .16); }
.base-select-search { display: flex; align-items: center; gap: .5rem; margin: .6rem; border: 1px solid #e2e8f0; border-radius: 10px; padding: .55rem .65rem; color: #64748b; }
.base-select-search input { min-width: 0; flex: 1; outline: none; color: #17136b; font-size: .875rem; }
.base-select-options { max-height: 15rem; overflow-y: auto; padding: .35rem; }
.base-select-options button { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: .75rem; border-radius: 9px; padding: .65rem .7rem; color: #334155; font-size: .9rem; font-weight: 600; text-align: left; }
.base-select-options button:hover, .base-select-options button.selected { background: #f0edff; color: #4f39ef; }
.base-select-empty { padding: .75rem; color: #64748b; font-size: .875rem; text-align: center; }
</style>

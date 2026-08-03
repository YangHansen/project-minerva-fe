<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { X } from 'lucide-vue-next'
const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') emit('close') }
watch(() => props.open, (open) => { document.body.style.overflow = open ? 'hidden' : '' }, { immediate: true })
onMounted(() => window.addEventListener('keydown', onKey)); onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' })
</script>
<template><Teleport to="body"><Transition name="modal"><div v-if="open" class="fixed inset-0 z-[70] grid place-items-center bg-[#17136b]/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" :aria-label="title" @mousedown.self="emit('close')"><div class="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div class="mb-6 flex items-center justify-between"><h2 class="text-2xl font-extrabold text-[#17136b]">{{ title }}</h2><button class="icon-button" aria-label="Close modal" @click="emit('close')"><X :size="20" /></button></div><slot /></div></div></Transition></Teleport></template>

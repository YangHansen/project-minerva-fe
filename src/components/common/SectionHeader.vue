<script setup lang="ts">defineProps<{ eyebrow?: string; title: string; body?: string; align?: 'left' | 'center' }>()</script>
<template><div :class="['section-header', align === 'center' && 'mx-auto text-center']"><p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p><h2>{{ title }}</h2><p v-if="body" class="mt-5 text-lg leading-8 text-slate-500">{{ body }}</p><slot /></div></template>

<script setup lang="ts">
defineProps<{ headline: string; sub: string; footer?: string }>()
</script>

<template>
  <main class="grid min-h-[calc(100vh-72px)] lg:grid-cols-2">
    <section class="hidden bg-gradient-to-br from-[#17136b] via-[#30209a] to-[#5b45f5] p-14 text-white lg:flex lg:flex-col lg:justify-between">
      <img src="/minerva-logo.png" alt="Minerva" class="h-16 w-52 rounded-xl bg-white object-contain p-1" />
      <div>
        <p class="text-sm font-extrabold uppercase tracking-[.2em] text-violet-200">Find. Prepare. Succeed.</p>
        <h1 class="mt-6 max-w-xl text-6xl font-extrabold leading-[1.02] tracking-[-.05em]">{{ headline }}</h1>
        <p class="mt-6 max-w-lg text-lg leading-8 text-violet-100">{{ sub }}</p>
        <slot name="left" />
      </div>
      <p v-if="footer" class="text-xs text-violet-300">{{ footer }}</p>
    </section>
    <section class="grid place-items-center p-6 py-16">
      <slot />
    </section>
  </main>
</template>

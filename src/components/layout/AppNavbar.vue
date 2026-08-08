<template>
  <header class="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
    <nav class="mx-auto flex h-20 w-[min(1460px,calc(100%-24px))] items-center justify-between sm:w-[min(1460px,calc(100%-56px))]" aria-label="Primary navigation">
      <RouterLink to="/" class="relative h-12 w-36 overflow-hidden text-[#17136b] sm:h-16 sm:w-56" aria-label="Minerva home">
        <img src="/minerva-logo.png" alt="Minerva" class="absolute left-0 top-1/2 w-40 max-w-none -translate-y-1/2 sm:w-56">
      </RouterLink>
      <div class="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <RouterLink to="/login" class="inline-flex min-h-10 items-center justify-center rounded-xl px-2.5 text-xs font-bold text-[#17136b] sm:min-h-11 sm:px-5 sm:text-sm">Log In</RouterLink>
        <RouterLink to="/register" class="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl bg-[#17136b] px-3.5 text-xs font-bold text-white shadow-[0_10px_24px_rgba(23,19,107,.18)] sm:min-h-11 sm:px-6 sm:text-sm">Get Started</RouterLink>
      </div>
    </nav>
  </header>
</template>

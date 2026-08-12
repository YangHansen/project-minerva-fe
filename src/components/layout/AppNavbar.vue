<template>
  <header class="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
    <nav class="mx-auto flex h-20 w-[min(1460px,calc(100%-24px))] items-center justify-between sm:w-[min(1460px,calc(100%-56px))]" aria-label="Primary navigation">
      <RouterLink to="/" class="flex items-center gap-2.5 text-[#17136b]" aria-label="Minerva home">
        <img src="/minerva-owl.png" alt="" class="size-11 shrink-0 object-contain sm:size-12" />
        <span class="leading-tight">
          <span class="block text-xl font-extrabold tracking-tight sm:text-2xl">Minerva</span>
          <span class="hidden text-[0.68rem] font-bold tracking-[0.02em] text-[#5b45f5] sm:block">Find. Prepare. Succeed.</span>
        </span>
      </RouterLink>
      <div class="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <RouterLink to="/login" class="inline-flex min-h-10 items-center justify-center rounded-xl px-2.5 text-xs font-bold text-[#17136b] sm:min-h-11 sm:px-5 sm:text-sm">Log In</RouterLink>
        <RouterLink to="/register" class="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl bg-[#17136b] px-3.5 text-xs font-bold text-white shadow-[0_10px_24px_rgba(23,19,107,.18)] sm:min-h-11 sm:px-6 sm:text-sm">Get Started</RouterLink>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { ArrowUpRight } from 'lucide-vue-next'
</script>

<template>
  <footer class="border-t border-slate-200 bg-[#fbfbfe] py-16">
    <div class="container grid gap-12 lg:grid-cols-[1.5fr_2fr]">
      <div><img src="/minerva-logo.png" alt="Minerva" class="mb-4 h-14 w-44 object-contain"><p class="max-w-sm text-sm leading-6 text-slate-500">One clear place to find scholarships, prepare stronger applications, and move forward with confidence.</p><p class="mt-6 text-xs font-bold uppercase tracking-[.18em] text-[#5b45f5]">Find. Prepare. Succeed.</p></div>
      <div class="grid grid-cols-2 gap-8 sm:grid-cols-4">
        <div><h3 class="footer-title">Explore</h3><RouterLink to="/scholarships">Scholarships</RouterLink><RouterLink to="/dashboard">Dashboard</RouterLink><RouterLink to="/pricing">Pricing</RouterLink></div>
        <div><h3 class="footer-title">Prepare</h3><RouterLink to="/checklist">Checklist</RouterLink><RouterLink to="/documents">Documents</RouterLink><RouterLink to="/practice">Practice</RouterLink></div>
        <div><h3 class="footer-title">Support</h3><RouterLink to="/mentors">Mentors</RouterLink><RouterLink to="/#faq">FAQ</RouterLink><a href="mailto:hello@minerva.demo">Contact <ArrowUpRight :size="13" /></a></div>
        <div><h3 class="footer-title">Account</h3><RouterLink to="/login">Log in</RouterLink><RouterLink to="/register">Create account</RouterLink><RouterLink to="/onboarding">Profile</RouterLink></div>
      </div>
    </div>
    <div class="container mt-14 flex flex-col gap-2 border-t border-slate-200 pt-6 text-xs text-slate-400 sm:flex-row sm:justify-between"><span>© 2026 Minerva. Frontend product demo.</span><span>Recommendations do not guarantee acceptance.</span></div>
  </footer>
</template>

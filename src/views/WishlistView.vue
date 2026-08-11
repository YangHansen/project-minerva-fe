<script setup lang="ts">
import { computed } from 'vue'
import { Heart } from 'lucide-vue-next'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar.vue'
import WorkspaceTopbar from '../components/workspace/WorkspaceTopbar.vue'
import ScholarshipCard from '../components/scholarships/ScholarshipCard.vue'
import { useAppState } from '../composables/useAppState'

const { savedIds, scholarships } = useAppState()
const savedScholarships = computed(() => scholarships.value.filter((item) => savedIds.value.includes(item.id)))
</script>

<template>
  <main class="workspace-shell">
    <WorkspaceSidebar active="wishlist" />
    <div class="workspace-main">
      <WorkspaceTopbar title="Wishlist" subtitle="Keep promising scholarships here until you are ready to start an application folder." />
      <div class="workspace-content discover-workspace">
        <div class="discover-section-heading"><div><p class="workspace-kicker">Saved opportunities</p><h2>Your scholarship Wishlist</h2></div><p>{{ savedScholarships.length }} saved</p></div>
        <div v-if="savedScholarships.length" class="scholarship-results-grid"><ScholarshipCard v-for="item in savedScholarships" :key="item.id" :scholarship="item" selectable /></div>
        <section v-else class="discover-empty"><Heart :size="34" /><h2>Your Wishlist is empty</h2><p>Save scholarships while exploring opportunities to keep them here for later.</p></section>
      </div>
    </div>
  </main>
</template>

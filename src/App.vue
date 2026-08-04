<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppNavbar from './components/layout/AppNavbar.vue'
import AppFooter from './components/layout/AppFooter.vue'
import ToastContainer from './components/common/ToastContainer.vue'
const route = useRoute()
const isWorkspace = computed(() => Boolean(route.meta.workspace))
</script>

<template>
  <div class="min-h-screen bg-white text-slate-700">
    <AppNavbar v-if="!isWorkspace" />
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
    <AppFooter v-if="!isWorkspace" />
    <ToastContainer />
  </div>
</template>

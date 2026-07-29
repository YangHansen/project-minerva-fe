<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { treaty } from '@elysiajs/eden'
// Import the type signature directly from the server folder
import type { App } from '../../server/src/index'


const client = treaty<App>('http://localhost:3000')
const status = ref('')

onMounted(async () => {
  const { data } = await client.api.health.get()
  if (data) {
    status.value = data.status
  }
})
</script>

<template>
  <main>
    <p>API Status: <strong>{{ status }}</strong></p>
  </main>
</template>
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fontsource-variable/nunito'
import '@fontsource-variable/nunito-sans'
import './tailwind.css'
import App from './App.vue'
import router from './router'

createApp(App).use(createPinia()).use(router).mount('#app')

// src/main.ts
import './assets/main.css' // Or remove if Vuetify handles all base styling

import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Import Vuetify plugin
import vuetify from './plugins/vuetify'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify) // Add this line

app.mount('#app')

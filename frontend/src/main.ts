import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { configure } from "vue-gtag";

// Import Vuetify plugin instance
import vuetify from './plugins/vuetify'

import App from './App.vue'
import router from './router'

configure({
    tagId: "G-5692SEBW21",
    initMode: "manual"
})

const app = createApp(App)

app.use(vuetify)
app.use(createPinia())
app.use(router)

app.mount('#app')

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createGtag } from "vue-gtag";

// Import Vuetify plugin instance
import vuetify from './plugins/vuetify'

import App from './App.vue'
import router from './router'

const gtag = createGtag({
    tagId: "G-5692SEBW21"
})

const app = createApp(App)

app.use(gtag)
app.use(vuetify)
app.use(createPinia())
app.use(router)

app.mount('#app')

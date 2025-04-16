// src/plugins/vuetify.ts
import 'vuetify/styles' // <-- CRITICAL: Imports Vuetify CSS
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components' // Often needed if not using auto-import plugin
import * as directives from 'vuetify/directives' // Often needed if not using auto-import plugin
import '@mdi/font/css/materialdesignicons.css' // Ensure icon CSS is imported

export default createVuetify({
  components, // Makes components available (if not using auto-import)
  directives, // Makes directives available (if not using auto-import)
  icons: {
    defaultSet: 'mdi',
  },
  // Handle dark theme by default
  theme: {
    defaultTheme: 'dark'
  },
})
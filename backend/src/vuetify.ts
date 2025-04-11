// src/plugins/vuetify.ts
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css' // Ensure you are using css-loader

export default createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi', // This is already the default value - only for display purposes
  },
  // Add theme customization here if needed
  // theme: {
  //   themes: {
  //     light: {
  //       dark: false,
  //       colors: {
  //         primary: '#1976D2', // example
  //         secondary: '#424242', // example
  //       }
  //     },
  //   },
  // }
})

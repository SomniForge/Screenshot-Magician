// frontend/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'


// Home View component
import HomeView from '../views/HomeView.vue'
// SS Magician component
import ScreenshotMagician from '../views/ScreenshotMagician.vue'
// Terms of Use component
import TermsOfUse from '../views/TermsOfUse.vue'
// Privacy Policy component
import PrivacyPolicy from '../views/PrivacyPolicy.vue'

// Create the router
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView // Point '/' to our new HomeView
    },
    {
      path: '/ssmag',
      name: 'screenshotmagician',
      component: ScreenshotMagician // Point '/ssmag' to the Screenshot Magician view
    },
    {
      path: '/terms',
      name: 'terms',
      component: TermsOfUse // Point '/terms' to our Terms Of Use
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: PrivacyPolicy // Point '/privacy' to our Privacy Policy
    }
  ]
})

export default router
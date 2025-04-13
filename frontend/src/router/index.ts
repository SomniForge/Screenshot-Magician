// frontend/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'


// Home View component
import HomeView from '../views/HomeView.vue'
// SS Magician Component
import ScreenshotMagician from '../views/ScreenshotMagician.vue'

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
      component: ScreenshotMagician // Point '/ssmag' to our new HomeView
    }
  ]
})

export default router
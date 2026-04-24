// frontend/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { useUnsavedNavigationStore } from '@/stores/unsavedNavigation'

const HomeView = () => import('../views/HomeView.vue')
const ScreenshotMagician = () => import('../views/ScreenshotMagician.vue')
const TestimonialModerationView = () => import('../views/TestimonialModerationView.vue')
const TermsOfUse = () => import('../views/TermsOfUse.vue')
const PrivacyPolicy = () => import('../views/PrivacyPolicy.vue')

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
      path: '/admin/testimonials',
      name: 'testimonialmoderation',
      component: TestimonialModerationView
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

router.beforeEach((to, from) => {
  if (to.fullPath === from.fullPath) {
    return true
  }

  const unsavedNavigationStore = useUnsavedNavigationStore()
  return unsavedNavigationStore.confirmNavigation()
})

export default router

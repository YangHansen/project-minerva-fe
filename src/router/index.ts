import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '../views/LandingView.vue'
import { ApiError, apiRequest } from '../api'
import { useAppState } from '../composables/useAppState'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', component: LandingView, meta: { title: 'Minerva - Find. Prepare. Succeed.' } },
    { path: '/scholarships', component: () => import('../views/ScholarshipsView.vue'), meta: { title: 'Scholarships | Minerva', workspace: true } },
    { path: '/scholarships/:id', component: () => import('../views/ScholarshipDetailView.vue'), meta: { title: 'Scholarship details | Minerva', workspace: true } },
    { path: '/dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: 'Dashboard | Minerva', workspace: true } },
    { path: '/dashboard/:id', component: () => import('../views/DashboardView.vue'), meta: { title: 'Scholarship folder | Minerva', workspace: true } },
    { path: '/checklist', component: () => import('../views/ChecklistView.vue'), meta: { title: 'Application checklist | Minerva', workspace: true } },
    { path: '/documents', component: () => import('../views/DocumentsView.vue'), meta: { title: 'Document review | Minerva', workspace: true } },
    { path: '/documents/:documentId', component: () => import('../views/DocumentEditorView.vue'), meta: { title: 'Document editor | Minerva', workspace: true } },
    { path: '/practice', redirect: '/test-prep' },
    { path: '/test-prep', component: () => import('../views/TestPrepView.vue'), meta: { title: 'Test Prep | Minerva', workspace: true } },
    { path: '/interview-prep', component: () => import('../views/InterviewPrepView.vue'), meta: { title: 'Interview Prep | Minerva', workspace: true } },
    { path: '/mentors', component: () => import('../views/MentorsView.vue'), meta: { title: 'Mentors | Minerva', workspace: true } },
    { path: '/wishlist', component: () => import('../views/WishlistView.vue'), meta: { title: 'Wishlist | Minerva', workspace: true } },
    { path: '/payment', component: () => import('../views/PaymentView.vue'), meta: { title: 'Tokens & payment | Minerva', workspace: true } },
    { path: '/pricing', component: () => import('../views/PricingView.vue'), meta: { title: 'Pricing | Minerva' } },
    { path: '/login', component: () => import('../views/LoginView.vue'), meta: { title: 'Log in | Minerva', auth: true } },
    { path: '/register', component: () => import('../views/RegisterView.vue'), meta: { title: 'Create an account | Minerva', auth: true } },
    { path: '/onboarding', component: () => import('../views/OnboardingView.vue'), meta: { title: 'Build your profile | Minerva', fullscreen: true, requiresAuth: true } },
    { path: '/:pathMatch(.*)*', component: () => import('../views/NotFoundView.vue'), meta: { title: 'Page not found | Minerva' } },
  ],
})

let validatedUserId: string | null = null
let authCheck: Promise<boolean> | null = null

async function ensureAuthenticated() {
  const state = useAppState()
  if (state.session.value?.id && state.session.value.id === validatedUserId) return true
  if (authCheck) return authCheck

  authCheck = (async () => {
    try {
      const result = await apiRequest<{ user: { id: string; name: string; email: string; role: string; tokenBalance: number } }>('/api/auth/me')
      if (state.session.value?.id && state.session.value.id !== result.user.id) state.resetUserState()
      state.session.value = { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role }
      state.tokenBalance.value = result.user.tokenBalance
      validatedUserId = result.user.id
      await state.hydrateWorkspace()
      return true
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        validatedUserId = null
        state.resetUserState()
        return false
      }
      // Preserve a previously validated local workspace during a transient network failure.
      return Boolean(state.session.value)
    } finally {
      authCheck = null
    }
  })()
  return authCheck
}

router.beforeEach(async (to) => {
  const requiresAuth = Boolean(to.meta.workspace || to.meta.requiresAuth)
  if (!requiresAuth || await ensureAuthenticated()) return true
  return { path: '/login', query: { redirect: to.fullPath } }
})

router.afterEach((to) => { document.title = String(to.meta.title ?? 'Minerva') })
export default router

import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '../views/LandingView.vue'

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
    { path: '/onboarding', component: () => import('../views/OnboardingView.vue'), meta: { title: 'Build your profile | Minerva', fullscreen: true } },
    { path: '/:pathMatch(.*)*', component: () => import('../views/NotFoundView.vue'), meta: { title: 'Page not found | Minerva' } },
  ],
})

router.afterEach((to) => { document.title = String(to.meta.title ?? 'Minerva') })
export default router

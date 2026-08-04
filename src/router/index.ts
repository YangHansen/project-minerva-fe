import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '../views/LandingView.vue'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', component: LandingView, meta: { title: 'Minerva - Find. Prepare. Succeed.' } },
    { path: '/scholarships', component: () => import('../views/ScholarshipsView.vue'), meta: { title: 'Scholarships | Minerva' } },
    { path: '/scholarships/:id', component: () => import('../views/ScholarshipDetailView.vue'), meta: { title: 'Scholarship details | Minerva' } },
    { path: '/dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: 'Dashboard | Minerva', workspace: true } },
    { path: '/checklist', component: () => import('../views/ChecklistView.vue'), meta: { title: 'Application checklist | Minerva', workspace: true } },
    { path: '/documents', component: () => import('../views/DocumentsView.vue'), meta: { title: 'Document review | Minerva', workspace: true } },
    { path: '/practice', redirect: '/test-prep' },
    { path: '/test-prep', component: () => import('../views/TestPrepView.vue'), meta: { title: 'Test Prep | Minerva', workspace: true } },
    { path: '/interview-prep', component: () => import('../views/InterviewPrepView.vue'), meta: { title: 'Interview Prep | Minerva', workspace: true } },
    { path: '/mentors', component: () => import('../views/MentorsView.vue'), meta: { title: 'Mentors | Minerva', workspace: true } },
    { path: '/pricing', component: () => import('../views/PricingView.vue'), meta: { title: 'Pricing | Minerva' } },
    { path: '/login', component: () => import('../views/LoginView.vue'), meta: { title: 'Log in | Minerva' } },
    { path: '/register', component: () => import('../views/RegisterView.vue'), meta: { title: 'Create an account | Minerva' } },
    { path: '/onboarding', component: () => import('../views/OnboardingView.vue'), meta: { title: 'Build your profile | Minerva' } },
    { path: '/:pathMatch(.*)*', component: () => import('../views/NotFoundView.vue'), meta: { title: 'Page not found | Minerva' } },
  ],
})

router.afterEach((to) => { document.title = String(to.meta.title ?? 'Minerva') })
export default router

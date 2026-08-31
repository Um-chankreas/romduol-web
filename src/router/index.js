import { createRouter, createWebHistory } from 'vue-router'
import { authService } from '../services/authService' // Update path to match your authService file

import ClassesView from '../views/classes/ClassesView.vue'
import DashboardView from '../views/dashboard/DashboardView.vue'
import LoginView from '../views/auth/LoginView.vue'

const routes = [
    {
        path: '/login',
        name: 'Login',
        component: LoginView,
        meta: { requiresGuest: true } // Only accessible when logged out
    },
    {
        path: '/',
        name: 'Classes',
        component: ClassesView,
        meta: { requiresAuth: true } // Protected route
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: DashboardView,
        meta: { requiresAuth: true } // Protected route
    },
    {
        path: '/live/:id',
        name: 'LiveStream',
        component: () => import('../views/live/LiveStreamView.vue'),
        meta: { requiresAuth: true } // Protected route
    },
    {
        path: '/students',
        name: 'StudentManagement',
        component: () => import('@/views/admin/StudentManagementView.vue'),
        meta: { requiresAuth: true, roles: ['admin'] } // Admin-only
    },
    // Fallback route
    {
        path: '/:pathMatch(.*)*',
        redirect: '/'
    },
    {
        path: '/courses/:id',
        name: 'CourseDetail',
        component: () => import('@/views/course/CourseDetailView.vue'),
    },
    {
        path: '/course/:courseId/quiz/create',
        name: 'CreateQuiz',
        component: () => import('@/views/course/CreateQuizView.vue')
    },
    {
        path: '/course/:courseId/quiz/edit/:id',
        name: 'EditQuiz',
        component: () => import('@/views/course/CreateQuizView.vue') // Reusing your creator view
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

// Navigation Guard to enforce auth check on every route change
router.beforeEach((to, from, next) => {
    const loggedIn = authService.isAuthenticated()

    if (to.meta.requiresAuth && !loggedIn) {
        // Redirect unauthenticated user trying to access protected route to /login
        next('/login')
    } else if (to.meta.requiresGuest && loggedIn) {
        // Redirect authenticated user trying to access /login back to /
        next('/')
    } else if (to.meta.roles && loggedIn) {
        // Role-gated route: bounce anyone without a matching role back home.
        const role = authService.getCurrentUser()?.role
        next(to.meta.roles.includes(role) ? undefined : '/')
    } else {
        // Allow navigation
        next()
    }
})

export default router
import { createRouter, createWebHistory } from 'vue-router'
import { authService } from '../services/authService' // Update path to match your authService file

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
    // Fallback route
    {
        path: '/:pathMatch(.*)*',
        redirect: '/'
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
    } else {
        // Allow navigation
        next()
    }
})

export default router
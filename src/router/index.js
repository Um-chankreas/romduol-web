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
        meta: { requiresAuth: true, roles: ['teacher', 'admin', 'super_admin'] } // Not students
    },
    {
        path: '/live/:id',
        name: 'LiveStream',
        component: () => import('../views/live/LiveStreamView.vue'),
        meta: { requiresAuth: true } // Protected route
    },
    {
        // Read-only view for OBS to capture. Authorised by ?key=, not a login.
        path: '/live/:id/record',
        name: 'LiveRecorder',
        component: () => import('../views/live/LiveRecorderView.vue')
    },
    {
        path: '/live/:id/save-recording',
        name: 'LiveRecordingSave',
        component: () => import('../views/live/LiveRecordingSaveView.vue'),
        meta: { requiresAuth: true, roles: ['teacher'] }
    },
    {
        path: '/students',
        name: 'StudentManagement',
        component: () => import('@/views/admin/StudentManagementView.vue'),
        meta: { requiresAuth: true, roles: ['admin', 'super_admin'] } // Admin-only
    },
    {
        path: '/roles',
        name: 'RoleManagement',
        component: () => import('@/views/admin/RoleManagementView.vue'),
        meta: { requiresAuth: true, roles: ['super_admin'] } // Super-admin-only
    },
    {
        path: '/tools/latex-to-text',
        name: 'LatexToText',
        component: () => import('@/views/tools/LatexConverterView.vue'),
        meta: { requiresAuth: true, roles: ['admin', 'super_admin'] }
    },
    {
        path: '/tools/trim-video',
        name: 'TrimVideo',
        component: () => import('@/views/tools/TrimVideoView.vue'),
        meta: { requiresAuth: true, roles: ['admin', 'super_admin'] }
    },
    {
        path: '/tools/compress-video',
        name: 'CompressVideo',
        component: () => import('@/views/tools/CompressVideoView.vue'),
        meta: { requiresAuth: true, roles: ['admin', 'super_admin'] }
    },
    {
        path: '/schedule',
        name: 'Schedule',
        component: () => import('@/views/schedule/ScheduleView.vue'),
        meta: { requiresAuth: true, roles: ['teacher', 'admin', 'super_admin'] } // Not students
    },
    {
        path: '/privacy-policy',
        name: 'PrivacyPolicy',
        component: () => import('@/views/legal/PrivacyPolicyView.vue')
        // Public — no auth required (needed for the app-store listing)
    },
    {
        path: '/support',
        name: 'Support',
        component: () => import('@/views/legal/SupportView.vue')
        // Public — no auth required (used as the App Store "Support URL")
    },
    {
        path: '/courses/:id',
        name: 'CourseDetail',
        component: () => import('@/views/course/CourseDetailView.vue'),
    },
    {
        path: '/lessons/:lessonId',
        name: 'Lesson',
        component: () => import('@/views/course/LessonView.vue'),
        meta: { requiresAuth: true } // chapter reader + teacher unit editor
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
    },
    {
        path: '/course/:courseId/assignment/create',
        name: 'CreateAssignment',
        component: () => import('@/views/course/AssignmentEditorView.vue')
    },
    {
        path: '/course/:courseId/assignment/edit/:id',
        name: 'EditAssignment',
        component: () => import('@/views/course/AssignmentEditorView.vue') // Reusing the creator view
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
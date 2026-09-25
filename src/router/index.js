import { createRouter, createWebHistory } from 'vue-router'
import { authService } from '../services/authService' // Update path to match your authService file
import { permissionsService } from '../services/permissionsService'

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
        // No `roles` here on purpose — an admin can grant/revoke this per
        // individual user (see permissionsService.js), which a role list
        // can't express. `feature` is checked against that per-user map,
        // which itself falls back to a role default (students: none).
        meta: { requiresAuth: true, feature: 'dashboard' }
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
        // Both can open the page; role changes and admin-account creation
        // inside it stay super_admin-only (enforced by the page itself and
        // the backend) — a plain admin's version only lets them toggle
        // per-user feature permissions for teacher/student accounts.
        meta: { requiresAuth: true, roles: ['admin', 'super_admin'] }
    },
    {
        path: '/roles/permissions',
        name: 'RolePermissions',
        component: () => import('@/views/admin/RolePermissionsView.vue'),
        // Same access as /roles — editing the matrix is super_admin-only,
        // enforced by the page itself and the backend.
        meta: { requiresAuth: true, roles: ['admin', 'super_admin'] }
    },
    {
        path: '/students/:id/profile',
        name: 'StudentProfile',
        component: () => import('@/views/students/StudentProfileView.vue'),
        meta: { requiresAuth: true, roles: ['admin', 'teacher'] } // teachers: own students only (enforced by the API)
    },
    {
        path: '/tools/latex-to-text',
        name: 'LatexToText',
        component: () => import('@/views/tools/LatexConverterView.vue'),
        meta: { requiresAuth: true, feature: 'latex_to_text' }
    },
    {
        path: '/tools/trim-video',
        name: 'TrimVideo',
        component: () => import('@/views/tools/TrimVideoView.vue'),
        meta: { requiresAuth: true, feature: 'trim_video' }
    },
    {
        path: '/tools/compress-video',
        name: 'CompressVideo',
        component: () => import('@/views/tools/CompressVideoView.vue'),
        meta: { requiresAuth: true, feature: 'compress_video' }
    },
    {
        path: '/schedule',
        name: 'Schedule',
        component: () => import('@/views/schedule/ScheduleView.vue'),
        meta: { requiresAuth: true, feature: 'schedule' }
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
router.beforeEach(async (to, from, next) => {
    const loggedIn = authService.isAuthenticated()

    if (to.meta.requiresAuth && !loggedIn) {
        // Redirect unauthenticated user trying to access protected route to /login
        next('/login')
        return
    }
    if (to.meta.requiresGuest && loggedIn) {
        // Redirect authenticated user trying to access /login back to /
        next('/')
        return
    }
    if (to.meta.roles && loggedIn) {
        // Role-gated route: bounce anyone without a matching role back home.
        const role = authService.getCurrentUser()?.role
        if (!to.meta.roles.includes(role)) {
            next('/')
            return
        }
    }
    if (to.meta.feature && loggedIn) {
        // Per-user feature toggle on top of the role check above — an admin
        // can grant/revoke this specific page for this specific account (see
        // permissionsService.js / lms-backend src/utils/permissions.js).
        const permissions = await permissionsService.getPermissions()
        if (!permissions[to.meta.feature]) {
            next('/')
            return
        }
    }
    // Allow navigation
    next()
})

export default router
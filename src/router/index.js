import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/dashboard/DashboardView.vue'
import LiveStreamView from '../views/live/LiveStreamView.vue'

const routes = [
    {
        path: '/',
        name: 'Dashboard',
        component: DashboardView
    },
    {
        path: '/live/:channelName',
        name: 'LiveStream',
        component: LiveStreamView,
        props: true
    },
    // Fallback route to prevent blank screens on unmatched URLs
    {
        path: '/:pathMatch(.*)*',
        redirect: '/'
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
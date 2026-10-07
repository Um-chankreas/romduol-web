import api from './axios'

// Our own estimate of Agora minutes used (lms-backend/src/routes/agoraUsage.routes.js).
export const agoraUsageService = {
    // month: 'YYYY-MM' (omit for the current month)
    async getUsage(month) {
        const res = await api.get('/admin/agora-usage', { params: month ? { month } : {} })
        return res.data.data
    },
}

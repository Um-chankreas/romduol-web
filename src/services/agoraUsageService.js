import api from './axios'

// Our own estimate of Agora minutes used (lms-backend/src/routes/agoraUsage.routes.js).
export const agoraUsageService = {
    // month: 'YYYY-MM' (omit for the current month)
    async getUsage(month, account) {
        const params = {}
        if (month) params.month = month
        if (account) params.account = account
        const res = await api.get('/admin/agora-usage', { params })
        return res.data.data
    },

    // Agora projects the admin can switch between (certificates never come back).
    async listAccounts() {
        const res = await api.get('/admin/agora-accounts')
        return res.data.data.accounts
    },
    // { label, app_id, app_certificate, free_minutes } — super admin only
    async addAccount(body) {
        const res = await api.post('/admin/agora-accounts', body)
        return res.data.data.accounts
    },
    // Any of { label, email, app_id, free_minutes, app_certificate } — certificate only if changing it
    async updateAccount(id, body) {
        const res = await api.put(`/admin/agora-accounts/${encodeURIComponent(id)}`, body)
        return res.data.data.accounts
    },
    // Sync with the Agora console: the minutes it shows as used this month.
    async setUsedMinutes(id, usedMinutes) {
        const res = await api.post(`/admin/agora-accounts/${encodeURIComponent(id)}/usage`, { used_minutes: usedMinutes })
        return res.data.data.accounts
    },
    async activateAccount(id) {
        const res = await api.post(`/admin/agora-accounts/${encodeURIComponent(id)}/activate`)
        return res.data.data.accounts
    },
    async removeAccount(id) {
        const res = await api.delete(`/admin/agora-accounts/${encodeURIComponent(id)}`)
        return res.data.data.accounts
    },
}

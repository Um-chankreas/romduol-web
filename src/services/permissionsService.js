import api from './axios'

// The logged-in user's effective per-feature permissions (dashboard/schedule/
// latex_to_text/trim_video/compress_video — see
// lms-backend/src/utils/permissions.js). Fetched once and cached in module
// state: Sidebar.vue and the router guard both need this synchronously-ish
// on every navigation, so re-fetching per check would be wasteful. Cleared
// on logout via clearCache().
let cache = null
let inflight = null

export const permissionsService = {
    // Returns the cached map once fetched; fetches (and caches the promise,
    // so concurrent callers share one request) otherwise.
    async getPermissions() {
        if (cache) return cache
        if (!inflight) {
            inflight = api.get('/permissions/mine')
                .then((res) => {
                    cache = res.data?.data?.permissions || {}
                    return cache
                })
                .finally(() => { inflight = null })
        }
        return inflight
    },

    // Force a re-fetch next call — use after an admin changes your own
    // permissions, or just to be safe right after login.
    clearCache() {
        cache = null
        inflight = null
    },

    // Admin/super_admin: read/edit another user's per-feature overrides.
    // Backend: lms-backend/src/routes/admin.routes.js (GET/PUT /users/:id/permissions)
    async getUserPermissions(userId) {
        const res = await api.get(`/admin/users/${userId}/permissions`)
        return res.data?.data
    },

    // updates: { feature_key: true | false | null } — null resets to the role default.
    async updateUserPermissions(userId, updates) {
        const res = await api.put(`/admin/users/${userId}/permissions`, { permissions: updates })
        return res.data?.data
    },

    // The role x feature default matrix — { [role]: { [feature_key]: allowed } }.
    // Readable by any admin; editing (below) is super_admin only.
    async getRoleDefaults() {
        const res = await api.get('/admin/role-permissions')
        return res.data?.data
    },

    // updates: [{ role, feature_key, allowed }, ...]
    async updateRoleDefaults(updates) {
        const res = await api.put('/admin/role-permissions', { updates })
        return res.data?.data
    },
}

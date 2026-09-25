import api from './axios'

// Super-admin-only: manage any account's role (student/teacher/admin/super_admin).
// Backend: ../lms-backend/src/routes/admin.routes.js (USERS / ROLE section, bottom of file)

export const roleService = {
  /**
   * List/search accounts across every role.
   * params: { search?, role?, page?, limit? }
   * Each row: { id, name, email, phone, role, avatar_url, is_active, created_at }
   */
  async listUsers(params = {}) {
    const query = {}
    if (params.search) query.search = params.search
    if (params.role) query.role = params.role
    if (params.page) query.page = params.page
    if (params.limit) query.limit = params.limit

    const res = await api.get('/admin/users', { params: query })
    const data = res.data?.data || res.data || {}
    return {
      users: data.users || [],
      pagination: data.pagination || { page: params.page || 1, limit: params.limit || 20, total: 0, total_pages: 1 },
    }
  },

  // body: { name, email?, phone?, password, role }
  async createUser(payload) {
    const res = await api.post('/admin/users', payload)
    return res.data?.data?.user
  },

  // body: { name?, email?, phone?, password?, is_active? } — not role, see updateRole
  async updateUser(id, payload) {
    const res = await api.patch(`/admin/users/${id}`, payload)
    return res.data?.data?.user
  },

  async updateRole(id, role) {
    const res = await api.patch(`/admin/users/${id}/role`, { role })
    return res.data?.data?.user
  },
}

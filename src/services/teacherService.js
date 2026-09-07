import api from './axios'

// Admin-only teacher management.
// Backend: ../lms-backend/src/routes/admin.routes.js  (TEACHERS section)
//
// Teachers use the same account model as students (users row, bcrypt
// password, JWT login) with role:"teacher". No subscription. Email is
// required. Removal is a soft deactivate — the teacher's courses and content
// are left untouched.

export const teacherService = {
  /**
   * List teachers.
   * params: { search?, include_inactive?: boolean, page?, limit? }
   * Each row: { id, name, email, phone, role, avatar_url, is_active,
   *             course_count, created_at }
   */
  async listTeachers(params = {}) {
    const query = {}
    if (params.search) query.search = params.search
    if (params.include_inactive) query.include_inactive = 'true'
    if (params.page) query.page = params.page
    if (params.limit) query.limit = params.limit

    const res = await api.get('/admin/teachers', { params: query })
    const data = res.data?.data || res.data || {}
    return {
      teachers: data.teachers || [],
      pagination: data.pagination || { page: params.page || 1, limit: params.limit || 20, total: 0, total_pages: 1 },
    }
  },

  // Detail: { teacher, courses: [{ id, title, is_free, live_enabled, code, created_at }] }
  async getTeacher(id) {
    const res = await api.get(`/admin/teachers/${id}`)
    const data = res.data?.data || res.data || {}
    return { teacher: data.teacher || null, courses: data.courses || [] }
  },

  // { name, email, password (min 6), phone? } — email + password required.
  async createTeacher(payload) {
    const res = await api.post('/admin/teachers', payload)
    return res.data?.data?.teacher || res.data?.teacher || res.data
  },

  // Partial update: { name?, email?, phone?, password?, is_active? }
  async updateTeacher(id, payload) {
    const res = await api.patch(`/admin/teachers/${id}`, payload)
    return res.data?.data?.teacher || res.data?.teacher || res.data
  },

  async deactivateTeacher(id) {
    const res = await api.delete(`/admin/teachers/${id}`)
    return res.data?.data?.teacher || res.data?.teacher || res.data
  },

  async restoreTeacher(id) {
    return this.updateTeacher(id, { is_active: true })
  },
}

export default teacherService

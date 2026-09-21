import api from './axios'

// Admin-only student & subscription management.
// Backend: ../lms-backend/src/routes/admin.routes.js — source of truth for shapes.
//
// Payment model (migration 038): subscriptions are PER COURSE. A student has one
// student_course_subscriptions row per course; the row is active while
// expiry_date >= today, and only unlocks THAT course's live classes.
// Admins additionally switch live classes off for a whole course via
// courses.live_enabled ("Course Live Access" tab) — that overrides everything.

export const studentService = {
  /**
   * List students.
   * params: { search?, paid?: boolean, include_inactive?: boolean, page?, limit? }
   * `paid` = has / has no ACTIVE subscription on any course.
   * Each row: { id, name, email, phone, role, avatar_url, xp, is_active,
   *             is_paid, created_at,
   *             subscription_summary: { enrolled, active,
   *               active_courses: [{ course_id, title, expiry_date }] } }
   */
  async listStudents(params = {}) {
    const query = {}
    if (params.search) query.search = params.search
    if (typeof params.paid === 'boolean') query.paid = String(params.paid)
    if (params.include_inactive) query.include_inactive = 'true'
    if (params.page) query.page = params.page
    if (params.limit) query.limit = params.limit

    const res = await api.get('/admin/students', { params: query })
    const data = res.data?.data || res.data || {}
    return {
      students: data.students || [],
      pagination: data.pagination || { page: params.page || 1, limit: params.limit || 20, total: 0, total_pages: 1 },
    }
  },

  // Detail: { student, enrolled_courses: [{
  //   course: { id, title, is_free, live_enabled }, enrolled_at,
  //   subscription: { is_active, expiry_date, last_updated } }] }
  async getStudent(id) {
    const res = await api.get(`/admin/students/${id}`)
    const data = res.data?.data || res.data || {}
    return {
      student: data.student || null,
      enrolled_courses: data.enrolled_courses || [],
    }
  },

  // { name, password (min 6), email?, phone? } — email OR phone required.
  async createStudent(payload) {
    const res = await api.post('/admin/students', payload)
    return res.data?.data?.student || res.data?.student || res.data
  },

  // Partial update: { name?, email?, phone?, password?, is_active? }
  async updateStudent(id, payload) {
    const res = await api.patch(`/admin/students/${id}`, payload)
    return res.data?.data?.student || res.data?.student || res.data
  },

  async deactivateStudent(id) {
    const res = await api.delete(`/admin/students/${id}`)
    return res.data?.data?.student || res.data?.student || res.data
  },

  async restoreStudent(id) {
    return this.updateStudent(id, { is_active: true })
  },

  /**
   * Grant / extend / revoke ONE course's live-class subscription for a student.
   *   { weeks: n }                  -> extend expiry by n weeks (1..52)
   *   { expiry_date: 'YYYY-MM-DD' } -> set expiry explicitly
   *   { expiry_date: null }         -> revoke immediately
   * Returns { student_id, course_id, is_active, expiry_date, last_updated }
   */
  async setCourseSubscription(studentId, courseId, body) {
    const res = await api.post(`/admin/students/${studentId}/courses/${courseId}/subscription`, body)
    return res.data?.data?.subscription || res.data?.subscription || res.data
  },

  addWeeks(studentId, courseId, weeks = 1) {
    return this.setCourseSubscription(studentId, courseId, { weeks })
  },

  revokeSubscription(studentId, courseId) {
    return this.setCourseSubscription(studentId, courseId, { expiry_date: null })
  },

  // Course list: [{ id, title, is_free, live_enabled, code, teacher }]
  async listCourses() {
    const res = await api.get('/admin/courses')
    return res.data?.data?.courses || res.data?.courses || res.data || []
  },

  // Toggle whether a course's live classes can be joined at all.
  async setCourseLiveEnabled(courseId, live_enabled) {
    const res = await api.patch(`/admin/courses/${courseId}`, { live_enabled })
    return res.data?.data?.course || res.data?.course || res.data
  },

  // Optional live-class monitoring feed.
  async listLiveClasses(status) {
    const res = await api.get('/admin/live-classes', {
      params: status ? { status: Array.isArray(status) ? status.join(',') : status } : {},
    })
    return res.data?.data?.liveClasses || res.data?.liveClasses || res.data || []
  },
}

export default studentService

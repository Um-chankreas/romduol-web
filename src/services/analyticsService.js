import api from './axios'

// Dashboard analytics — whole school for admins, own classes for teachers.
// Backend: ../lms-backend/src/routes/admin.routes.js  GET /admin/analytics
//
// Shape:
//   kpis: {
//     total_students, active_eligible, new_students_7d, new_students_prev_7d,
//     paid_students, active_students_7d, avg_quiz_score_30d, avg_quiz_score_prev_30d
//   }
//   signups_weekly: [{ week: 'YYYY-MM-DD' (Mon), count, cumulative }]  // 12 wks
//   most_improved: [{ student_id, name, avatar_url, recent_avg, prior_avg, delta, quizzes }]
//   at_risk: [{ student_id, name, avatar_url, reason, last_active, days_inactive, recent_avg, delta }]
//   at_risk_total, generated_at

const toParams = ({ days, from, to, courseId } = {}) => ({
  ...(from && to ? { from, to } : days ? { days } : {}),
  ...(courseId ? { course_id: courseId } : {}),
})

export const analyticsService = {
  // filters: { days: 7|30|90 } or { from, to } ('YYYY-MM-DD'), plus optional courseId.
  async getDashboard(filters = {}) {
    const res = await api.get('/admin/analytics', { params: toParams(filters) })
    return res.data?.data || res.data || {}
  },

  // Dashboard report as an .xlsx file (data sheets + a Charts sheet with the
  // charts embedded as pictures). Backend: GET /admin/analytics/export.
  async downloadReport(filters = {}) {
    const res = await api.get('/admin/analytics/export', { params: toParams(filters), responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `romduol-dashboard_${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}

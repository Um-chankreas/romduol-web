import api from './axios'

// Admin-only school analytics for the teacher dashboard.
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

export const analyticsService = {
  async getDashboard() {
    const res = await api.get('/admin/analytics')
    return res.data?.data || res.data || {}
  },
}

import api from './axios'

// Student progress insights for admins and teachers.
// Backend: ../lms-backend/src/routes/studentInsights.routes.js — source of truth for shapes.
// Teachers only see students enrolled in their own courses (and only those
// courses' data); admins see everything.

export const insightsService = {
  /**
   * Dashboard overview across every course the caller can see (admin: all,
   * teacher: own).
   * { totals: { students, enrollments, avg_progress, on_track, behind, inactive, not_started, completed },
   *   courses: [{ course, students, avg_progress, status_counts, lessons: [{ lesson_id, title, index, students_here }], finished }],
   *   daily_active: [{ day, students }]  // 30 UTC days, oldest first
   *   top_learners: [{ student_id, name, avatar_url, xp_7d, level }] }
   */
  async getOverview() {
    const res = await api.get('/insights/overview')
    return res.data?.data || res.data || {}
  },

  /**
   * Class roster with where every enrolled student is in the course.
   * { course, lessons: [{ lesson_id, title, index, units_total, students_here }],
   *   summary: { students, avg_progress, completed, not_started, active_7d, inactive, avg_quiz_score },
   *   students: [{ student, enrolled_at, progress, xp, quizzes, assignments, activity, subscription, status }] }
   */
  async getCourseStudents(courseId) {
    const res = await api.get(`/insights/courses/${courseId}/students`)
    return res.data?.data || res.data || {}
  },

  /**
   * Everything about one student: level/XP, streaks, per-course progress
   * (current lesson + unit, path), study calendar, XP history, quiz and
   * assignment history, live classes, daily challenges, achievements.
   */
  async getStudentProfile(studentId) {
    const res = await api.get(`/insights/students/${studentId}`)
    return res.data?.data || res.data || {}
  },
}

import api from './axios'

// Student progress insights for admins and teachers.
// Backend: ../lms-backend/src/routes/studentInsights.routes.js — source of truth for shapes.
// Teachers only see students enrolled in their own courses (and only those
// courses' data); admins see everything.

const tableParams = ({ courseId, status, q, sort, dir, page, limit, fresh, activeFrom, activeTo } = {}) => ({
  ...(courseId ? { course_id: courseId } : {}),
  ...(status ? { status } : {}),
  ...(q ? { q } : {}),
  ...(sort ? { sort } : {}),
  ...(dir ? { dir } : {}),
  ...(page ? { page } : {}),
  ...(limit ? { limit } : {}),
  ...(fresh ? { fresh: 1 } : {}),
  ...(activeFrom ? { active_from: activeFrom } : {}),
  ...(activeTo ? { active_to: activeTo } : {}),
})

export const insightsService = {
  /**
   * Dashboard "Student performance" table — one row per student per class.
   * Filters/sort/paging run on the server (results are cached ~1 min there).
   * { rows: [{ student_id, name, email, avatar_url, is_active, course_id, course_title,
   *            progress, avg_quiz, quizzes_attempted, quizzes_total, last_active,
   *            days_inactive, status }],
   *   pagination: { page, limit, total, total_pages },
   *   status_counts: { on_track, behind, inactive, not_started, completed }, generated_at }
   */
  async getStudentsTable(filters = {}, { signal } = {}) {
    const res = await api.get('/insights/students-table', { params: tableParams(filters), signal })
    return res.data?.data || res.data || {}
  },

  // Every row matching the filters as a file. format: 'xlsx' | 'csv' | 'pdf'.
  // courseId empty = ALL classes: Excel gets an "All classes" sheet plus one per
  // class, CSV comes as a .zip with one file per class, PDF has a section per class.
  async downloadStudentsTable(filters = {}, { format = 'xlsx', includeContacts = false } = {}) {
    const res = await api.get('/insights/students-table/export', {
      params: { ...tableParams({ ...filters, page: null, limit: null, sort: null, dir: null }), format, ...(includeContacts ? { include_contacts: 1 } : {}) },
      responseType: 'blob',
    })
    const ext = format === 'csv' && !filters.courseId ? 'zip' : format
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `romduol-students_${new Date().toISOString().slice(0, 10)}.${ext}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },

  /**
   * Dashboard overview across every course the caller can see (admin: all,
   * teacher: own).
   * { totals: { students, enrollments, avg_progress, on_track, behind, inactive, not_started, completed },
   *   courses: [{ course, students, avg_progress, status_counts, lessons: [{ lesson_id, title, index, students_here }], finished }],
   *   daily_active: [{ day, students }]  // 30 UTC days, oldest first
   *   top_learners: [{ student_id, name, avatar_url, xp_7d, level }] }
   */
  /**
   * Dashboard "how are my classes doing": classes, lesson locations and live-class attendance.
   * { totals: { classes, classes_with_students, enrolments, students, avg_progress, active_7d, avg_quiz, attendance_rate },
   *   classes: [{ course, students, lessons, next_live_at, avg_progress, attendance_rate, live_classes_held,
   *               avg_quiz, inactive, status_counts, flag: { key, label }, finished,
   *               lesson_distribution: [{ lesson_id, title, index, students_here }] }],
   *   attendance: [{ course, sessions: [{ live_class_id, title, date, eligible, attended, rate }] }],
   *   missed: { total, students: [{ student_id, name, avatar_url, course_id, course_title, missed_in_a_row, last_joined }] },
   *   generated_at }
   */
  async getLearningOverview({ fresh = false } = {}) {
    const res = await api.get('/insights/learning-overview', { params: fresh ? { fresh: 1 } : {} })
    return res.data?.data || res.data || {}
  },

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

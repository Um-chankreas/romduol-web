import api from './axios'

export const courseService = {
    // Create course
    async createCourse(title, description, category, color, icon, cover_image, is_free = false, teacher_id = undefined, is_published = true) {
        const response = await api.post('/courses', {
            title,
            description,
            category,
            color,
            icon,
            cover_image,
            is_free,
            is_published,
            ...(teacher_id ? { teacher_id } : {})
        })
        return response.data
    },

    // Get all courses
    async getCourses() {
        const response = await api.get('/courses')
        return response.data
    },

    // Get course details
    async getCourseDetails(id) {
        const response = await api.get(`/courses/${id}`)
        return response.data
    },

    // Update course
    async updateCourse(id, data) {
        const response = await api.put(`/courses/${id}`, data)
        return response.data
    },

    // Enrolled students + paid/unpaid (live-class subscription) status.
    // Teacher (own course) or admin/super_admin.
    async getCourseRoster(id) {
        const response = await api.get(`/courses/${id}/roster`)
        return response.data
    },

    // Students not yet in this class, matched by name / email / phone.
    async searchStudentCandidates(id, q) {
        const response = await api.get(`/courses/${id}/student-candidates`, { params: { q } })
        return response.data.data.students
    },

    // Add students to the class: ids = [studentId, ...]
    async addStudents(id, ids) {
        const response = await api.post(`/courses/${id}/students`, { student_ids: ids })
        return response.data
    },

    // Delete course
    async deleteCourse(id) {
        const response = await api.delete(`/courses/${id}`)
        return response.data
    },

    // Join course by code
    async joinCourseByCode(code) {
        const response = await api.post(`/courses/join/${code}`)
        return response.data
    }
}

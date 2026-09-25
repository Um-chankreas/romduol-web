import api from './axios'

export const courseService = {
    // Create course
    async createCourse(title, description, category, color, icon, cover_image, is_free = false, teacher_id = undefined) {
        const response = await api.post('/courses', {
            title,
            description,
            category,
            color,
            icon,
            cover_image,
            is_free,
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

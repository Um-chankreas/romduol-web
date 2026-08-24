import api from './axios'

export const courseService = {
    // Create course
    async createCourse(title, description, category, color, icon, cover_image) {
        const response = await api.post('/courses', {
            title,
            description,
            category,
            color,
            icon,
            cover_image
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

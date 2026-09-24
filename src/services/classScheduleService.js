import api from './axios'

export const classScheduleService = {
    // All schedule slots for one course
    async getCourseSchedules(courseId) {
        const response = await api.get(`/class-schedules/course/${courseId}`)
        return response.data
    },

    // Every active schedule slot across the teacher's own courses, for the
    // "My Classes" list badge (one request instead of one per course).
    async getMySchedules() {
        const response = await api.get('/class-schedules/mine')
        return response.data
    },

    // body: { course_id, days_of_week: [0-6,...], start_time: "HH:MM", end_time: "HH:MM", timezone? }
    async createSchedule(payload) {
        const response = await api.post('/class-schedules', payload)
        return response.data
    },

    async updateSchedule(id, payload) {
        const response = await api.put(`/class-schedules/${id}`, payload)
        return response.data
    },

    async deleteSchedule(id) {
        const response = await api.delete(`/class-schedules/${id}`)
        return response.data
    }
}

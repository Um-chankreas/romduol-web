import api from './axios'

export const liveClassService = {
    // Create live class
    async createLiveClass(courseId, title, description, scheduledAt) {
        const response = await api.post('/live-classes', {
            course_id: courseId,
            title,
            description,
            scheduled_at: scheduledAt
        })
        return response.data
    },

    // Get live class details
    async getLiveClassDetails(id) {
        const response = await api.get(`/live-classes/${id}`)
        return response.data
    },

    // Get course live classes
    async getCourseLiveClasses(courseId) {
        const response = await api.get(`/live-classes/course/${courseId}`)
        return response.data
    },

    // Get Agora token for joining
    async getAgoraToken(id) {
        const response = await api.post(`/live-classes/${id}/token`)
        return response.data
    },

    // Start live class
    async startLiveClass(id) {
        const response = await api.put(`/live-classes/${id}/start`)
        return response.data
    },

    // End live class
    async endLiveClass(id) {
        const response = await api.put(`/live-classes/${id}/end`)
        return response.data
    },

    // Leave live class
    async leaveLiveClass(id) {
        const response = await api.post(`/live-classes/${id}/leave`)
        return response.data
    }
}

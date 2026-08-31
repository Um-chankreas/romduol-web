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
    },

    // ---- Raise hand / speak (Google-Meet style, no request queue) ----
    // Statuses: 'none' | 'raised' | 'speaking'

    // Current stage: { speakers: [...], raised_hands: [...] } — socket fallback
    async getStage(id) {
        const response = await api.get(`/live-classes/${id}/stage`)
        return response.data
    },

    // Teacher: push a student straight to "speaking" (optional)
    async inviteSpeaker(id, userId) {
        const response = await api.post(`/live-classes/${id}/speakers/${userId}/invite`)
        return response.data
    },

    // Teacher: ask a speaker to mute — NOT strict, no DB change. The student's
    // app turns the mic off but they stay a co-host and can unmute themselves.
    async muteSpeaker(id, userId) {
        const response = await api.post(`/live-classes/${id}/speakers/${userId}/mute`)
        return response.data
    },

    // Teacher: drop a student off the stage -> "none". Not a ban.
    async removeSpeaker(id, userId) {
        const response = await api.post(`/live-classes/${id}/speakers/${userId}/remove`)
        return response.data
    },

    // Student: raise hand silently (just signals the teacher) -> "raised"
    async raiseHand(id) {
        const response = await api.post(`/live-classes/${id}/hand`, { mode: 'raise' })
        return response.data
    },

    // Student: open voice immediately, no approval -> "speaking"
    async speak(id) {
        const response = await api.post(`/live-classes/${id}/hand`, { mode: 'speak' })
        return response.data
    },

    // Student: lower hand / stop speaking -> "none"
    async lowerHand(id) {
        const response = await api.delete(`/live-classes/${id}/hand`)
        return response.data
    },

    // Student: poll own hand status (socket fallback)
    async getHandStatus(id) {
        const response = await api.get(`/live-classes/${id}/hand`)
        return response.data
    }
}

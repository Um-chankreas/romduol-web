import api from './axios'

export const assignmentService = {
    // All assignments for a course.
    async getCourseAssignments(courseId) {
        const response = await api.get(`/assignments/course/${courseId}`)
        return response.data?.data?.assignments || response.data?.assignments || []
    },

    // One assignment. Teachers get `.submissions` (all students, with user info);
    // students get `.submission` (their own, or null).
    async getAssignment(id) {
        const response = await api.get(`/assignments/${id}`)
        return response.data?.data?.assignment || response.data?.assignment || null
    },

    // Teacher: create an assignment. { course_id, title, description?, due_date? }
    async createAssignment(payload) {
        const response = await api.post('/assignments', payload)
        return response.data?.data?.assignment || response.data?.assignment || null
    },

    // Student: submit. `file` optional (multipart).
    async submitAssignment(id, { submissionText = '', file = null } = {}) {
        const formData = new FormData()
        formData.append('submission_text', submissionText)
        if (file) formData.append('file', file)
        const response = await api.post(`/assignments/${id}/submit`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        return response.data
    },

    // Teacher: grade a submission. { grade, feedback }
    async gradeSubmission(assignmentId, submissionId, { grade, feedback }) {
        const response = await api.put(
            `/assignments/${assignmentId}/submissions/${submissionId}/grade`,
            { grade, feedback },
        )
        return response.data?.data?.submission || response.data?.submission || null
    },
}

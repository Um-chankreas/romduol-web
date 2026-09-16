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

    // Teacher: create an assignment. { course_id, title, description?, due_date?, type?, status? }
    // type: 'file' (default, free-text/file submission) | 'quiz' (MCQ, auto-graded).
    // status: 'draft' (default) | 'published' — only meaningful for file-type
    // here, since a brand-new quiz has no questions yet to publish with.
    async createAssignment(payload) {
        const response = await api.post('/assignments', payload)
        return response.data?.data?.assignment || response.data?.assignment || null
    },

    // Teacher: update title/description/due_date, and/or publish a draft.
    // { title?, description?, due_date?, status? } — status: 'published' is
    // the only transition that means anything; it's also the one moment
    // students get notified.
    async updateAssignment(id, payload) {
        const response = await api.put(`/assignments/${id}`, payload)
        return response.data?.data?.assignment || response.data?.assignment || null
    },

    // Teacher: add ONE MCQ question to a quiz-type assignment.
    // { question, options: string[], correct_answer, explanation? }
    async addAssignmentQuestion(assignmentId, question) {
        const response = await api.post(`/assignments/${assignmentId}/questions`, question)
        return response.data?.data?.question || response.data?.question || null
    },

    // Teacher: update ONE question in place.
    async updateAssignmentQuestion(assignmentId, questionId, question) {
        const response = await api.put(`/assignments/${assignmentId}/questions/${questionId}`, question)
        return response.data?.data?.question || response.data?.question || null
    },

    // Teacher: remove ONE question.
    async deleteAssignmentQuestion(assignmentId, questionId) {
        const response = await api.delete(`/assignments/${assignmentId}/questions/${questionId}`)
        return response.data
    },

    // Teacher: bulk-import MCQ questions for a quiz-type assignment from a CSV file.
    async importAssignmentQuestionsFromCsv(assignmentId, file) {
        const formData = new FormData()
        formData.append('file', file)
        const response = await api.post(`/assignments/${assignmentId}/questions/import`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        return response.data
    },

    // Download the CSV template used for bulk-importing assignment questions.
    async downloadAssignmentQuestionsCsvTemplate() {
        const response = await api.get('/assignments/questions/import/template', {
            responseType: 'blob',
        })
        return response.data
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

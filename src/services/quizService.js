import api from './axios' // Adjust path if your api.js is located elsewhere (e.g. '@/services/api')

export const quizService = {
    // Fetch quizzes for a course
    async getQuizzesByCourse(courseId) {
        const response = await api.get(`/quizzes/course/${courseId}`)
        return response.data?.data?.quizzes || response.data?.quizzes || response.data
    },

    // Fetch quizzes for a lesson
    async getLessonQuizzes(lessonId) {
        const response = await api.get(`/quizzes/lesson/${lessonId}`)
        return response.data?.data?.quizzes || response.data?.quizzes || response.data
    },

    // Fetch quizzes attached to a unit (students get published only) — the
    // "practice" quiz for that unit.
    async getUnitQuizzes(unitId) {
        const response = await api.get(`/quizzes/unit/${unitId}`)
        return response.data?.data?.quizzes || response.data?.quizzes || response.data
    },

    // Fetch full details for a single quiz (including questions)
    async getQuizById(quizId) {
        const response = await api.get(`/quizzes/${quizId}`)
        return response.data?.data?.quiz || response.data?.quiz || response.data
    },

    // Create new quiz (Accepts courseId or full payload depending on how it's called)
    async createQuiz(courseIdOrPayload, quizPayloadOptional) {
        // Handle both signatures: createQuiz(courseId, payload) or createQuiz(payload)
        let payload = quizPayloadOptional || courseIdOrPayload
        if (quizPayloadOptional && typeof courseIdOrPayload !== 'object') {
            payload = { ...quizPayloadOptional, course_id: courseIdOrPayload }
        }

        const response = await api.post('/quizzes', payload)
        return response.data?.data?.quiz || response.data?.quiz || response.data
    },

    // Update existing quiz metadata & questions (handles Draft and Published status)
    async updateQuiz(quizId, quizPayload) {
        const response = await api.put(`/quizzes/${quizId}`, quizPayload)
        return response.data?.data?.quiz || response.data?.quiz || response.data
    },

    // Delete a quiz
    async deleteQuiz(quizId) {
        const response = await api.delete(`/quizzes/${quizId}`)
        return response.data
    },

    // Bulk-import questions for an existing quiz from a CSV file
    async importQuestionsFromCsv(quizId, file) {
        const formData = new FormData()
        formData.append('file', file)
        const response = await api.post(`/quizzes/${quizId}/questions/import`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        return response.data
    },

    // Download the CSV template used for bulk-importing quiz questions
    async downloadQuestionsCsvTemplate() {
        const response = await api.get('/quizzes/questions/import/template', {
            responseType: 'blob'
        })
        return response.data
    },

    // High-level Auto-Save Helper (Creates or Updates based on ID presence)
    async saveQuizDraft(quizData) {
        if (quizData.id) {
            return this.updateQuiz(quizData.id, { ...quizData, status: 'draft' })
        } else {
            return this.createQuiz({ ...quizData, status: 'draft' })
        }
    },

    // Publish Quiz Helper
    async publishQuiz(quizData) {
        if (quizData.id) {
            return this.updateQuiz(quizData.id, { ...quizData, status: 'published' })
        } else {
            return this.createQuiz({ ...quizData, status: 'published' })
        }
    },

    // Submit student answers
    async submitQuiz(quizId, answers) {
        const response = await api.post(`/quizzes/${quizId}/submit`, { answers })
        return response.data
    },

    // Get student submission result
    async getQuizResults(quizId) {
        const response = await api.get(`/quizzes/${quizId}/results`)
        return response.data
    }
}

export default quizService
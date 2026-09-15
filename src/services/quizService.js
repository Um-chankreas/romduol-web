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

    // Fetch full details for a single quiz. With no args, returns every
    // question (small quizzes, students taking it). Pass { page, limit } to
    // get one page of a teacher's question bank instead — see
    // fetchAllQuizQuestions() for pulling the whole bank page by page.
    async getQuizById(quizId, { page, limit, q } = {}) {
        const params = page !== undefined ? { page, limit, ...(q ? { q } : {}) } : undefined
        const response = await api.get(`/quizzes/${quizId}`, { params })
        return response.data?.data?.quiz || response.data?.quiz || response.data
    },

    // Search a teacher's question bank by prompt text. Returns every match
    // (capped server-side) with its order_number, so the caller can work out
    // which page each one lives on and jump there.
    async searchQuizQuestions(quizId, q) {
        const quiz = await this.getQuizById(quizId, { page: 1, limit: 1, q })
        return quiz.questions || []
    },

    // Loads a teacher's full question bank a page at a time (so the editor
    // can paint the first page immediately instead of waiting on the whole
    // bank), invoking onPage(questionsSoFar, quiz) after each page lands.
    // Resolves with the assembled quiz once every page has arrived — the
    // editor's save PUTs the whole array back, so it must wait for this
    // before allowing a save (see UnitQuizEditor.vue).
    async fetchAllQuizQuestions(quizId, { pageSize = 20, onPage } = {}) {
        let page = 1
        let quiz = await this.getQuizById(quizId, { page, limit: pageSize })
        let questions = [...(quiz.questions || [])]
        onPage?.(questions, quiz)

        const total = quiz.pagination?.total ?? questions.length
        while (questions.length < total) {
            page += 1
            const next = await this.getQuizById(quizId, { page, limit: pageSize })
            questions = questions.concat(next.questions || [])
            onPage?.(questions, quiz)
            if (!next.questions?.length) break // safety net against an infinite loop
        }

        return { ...quiz, questions, total_questions: questions.length }
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

    // Per-question CRUD — lets the editor add/edit/remove one question at a
    // time instead of resending the whole bank (which is what PUT /quizzes/:id
    // does when given a `questions` array). See UnitQuizEditor.vue: this is
    // what makes true on-demand paging of a big bank safe to save from.
    async addQuizQuestion(quizId, question) {
        const response = await api.post(`/quizzes/${quizId}/questions`, question)
        return response.data?.data?.question || response.data?.question
    },
    async updateQuizQuestion(quizId, questionId, question) {
        const response = await api.put(`/quizzes/${quizId}/questions/${questionId}`, question)
        return response.data?.data?.question || response.data?.question
    },
    async deleteQuizQuestion(quizId, questionId) {
        const response = await api.delete(`/quizzes/${quizId}/questions/${questionId}`)
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
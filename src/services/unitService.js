import api from './axios'

// Units (a.k.a. sections) live inside a chapter (a `lessons` row). Content is
// Markdown for every subject — plain prose for history, Markdown + $LaTeX$ for
// maths. See lms-backend/src/routes/units.routes.js.
export const unitService = {
    // A chapter's units — title, order, preview, and (when unlocked) full
    // Markdown `content`. Also returns `chapter` and `course_access`.
    async listUnits(lessonId) {
        const response = await api.get('/units', { params: { lesson_id: lessonId } })
        return response.data
    },

    // Browse / search units the caller can see. Optionally scope to one course.
    async searchUnits(q, courseId = null) {
        const params = { q }
        if (courseId) params.course_id = courseId
        const response = await api.get('/units/search', { params })
        return response.data
    },

    // One unit with its full Markdown content (access-checked via the course).
    async getUnit(id) {
        const response = await api.get(`/units/${id}`)
        return response.data
    },

    // ── Teacher ──────────────────────────────────────────────────────────

    // { lesson_id, title, content?, order_number?, is_free? }
    async createUnit(payload) {
        const response = await api.post('/units', payload)
        return response.data
    },

    // Paste a whole chapter's Markdown; the server splits it on every `## `
    // heading. `replace: true` wipes the chapter's existing units first.
    async bulkImport(lessonId, markdown, { replace = false } = {}) {
        const response = await api.post('/units/bulk', { lesson_id: lessonId, markdown, replace })
        return response.data
    },

    // { lesson_id, order: [unitId, unitId, ...] }
    async reorderUnits(lessonId, order) {
        const response = await api.post('/units/reorder', { lesson_id: lessonId, order })
        return response.data
    },

    // { title?, content?, order_number?, is_free? }
    async updateUnit(id, payload) {
        const response = await api.put(`/units/${id}`, payload)
        return response.data
    },

    async deleteUnit(id) {
        const response = await api.delete(`/units/${id}`)
        return response.data
    },
}

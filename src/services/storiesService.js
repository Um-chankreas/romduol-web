import api from './axios'

// Khmer stories library (lms-backend/src/routes/stories.routes.js).
// Reads work for any signed-in user; writes are admin / super_admin only.
export const storiesService = {
    async list(params = {}) {
        const res = await api.get('/stories', { params })
        return res.data.data.stories
    },
    // The story plus its excerpts.
    async get(id) {
        const res = await api.get(`/stories/${encodeURIComponent(id)}`)
        return res.data.data.story
    },
    // { title_km, title_en, author, year, summary_km, summary_en, themes: [] }
    async create(body) {
        const res = await api.post('/stories', body)
        return res.data.data.story
    },
    async update(id, body) {
        const res = await api.put(`/stories/${encodeURIComponent(id)}`, body)
        return res.data.data.story
    },
    async remove(id) {
        await api.delete(`/stories/${encodeURIComponent(id)}`)
    },
    // { label, excerpt_km, usable_for_topics: [], order_number }
    async addExcerpt(storyId, body) {
        const res = await api.post(`/stories/${encodeURIComponent(storyId)}/excerpts`, body)
        return res.data.data.excerpt
    },
    async updateExcerpt(storyId, excerptId, body) {
        const res = await api.put(`/stories/${encodeURIComponent(storyId)}/excerpts/${encodeURIComponent(excerptId)}`, body)
        return res.data.data.excerpt
    },
    async removeExcerpt(storyId, excerptId) {
        await api.delete(`/stories/${encodeURIComponent(storyId)}/excerpts/${encodeURIComponent(excerptId)}`)
    },
}

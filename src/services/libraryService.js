import api from './axios'

// Library shelves shown in the mobile app (lms-backend/src/routes/library.routes.js).
// Browsing is the public /textbooks and /past-papers; uploading is admin-only.
export const libraryService = {
    async getOptions() {
        const res = await api.get('/library/options')
        return res.data.data
    },

    async listTextbooks() {
        const res = await api.get('/textbooks')
        return res.data.data.textbooks
    },

    async listPastPapers() {
        const res = await api.get('/past-papers')
        return res.data.data.past_papers
    },

    // Revision formula sheets (read-only here — the app's "Formulas" tab).
    // file_url is a presigned link that lapses, so it is fetched fresh on load.
    async listFormulas() {
        const res = await api.get('/formulas')
        return res.data.data.formulas
    },

    // fields: { kind, order, ...textbook/past-paper naming fields, overwrite? }
    async upload(file, fields, onUploadProgress, coverBlob) {
        const form = new FormData()
        Object.entries(fields).forEach(([k, v]) => {
            if (v !== '' && v != null) form.append(k, v)
        })
        // The file goes last: multer must see the text fields before it
        // streams the file part.
        if (coverBlob) form.append('cover', coverBlob, 'cover.jpg')
        form.append('file', file)
        const res = await api.post('/library/upload', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress,
            timeout: 0,
        })
        return res.data.data
    },

    // Change a file's naming fields; the server moves it to the new name.
    async update(kind, id, fields) {
        const res = await api.put(`/library/${kind}/${encodeURIComponent(id)}`, fields)
        return res.data.data
    },

    // blob: a cropped JPEG from CoverCropper. `id` is the file name without .pdf.
    async setCover(kind, id, blob) {
        const form = new FormData()
        form.append('cover', blob, 'cover.jpg')
        await api.put(`/library/${kind}/${encodeURIComponent(id)}/cover`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
    },

    async removeCover(kind, id) {
        await api.delete(`/library/${kind}/${encodeURIComponent(id)}/cover`)
    },

    async remove(kind, id) {
        const res = await api.delete(`/library/${kind}/${encodeURIComponent(id)}`)
        return res.data.data
    },
}

import axios from 'axios'
import api from './axios'

// Content types the backend's /video/upload-url endpoint accepts, keyed by
// file extension so we can still resolve one when the browser gives us a
// blank `file.type` (common for .mkv / .mov).
const VIDEO_MIME_BY_EXT = {
    mp4: 'video/mp4',
    m4v: 'video/x-m4v',
    mov: 'video/quicktime',
    webm: 'video/webm',
    mkv: 'video/x-matroska'
}
const ALLOWED_VIDEO_MIMES = new Set(Object.values(VIDEO_MIME_BY_EXT))

const videoContentType = (file) => {
    if (file.type && ALLOWED_VIDEO_MIMES.has(file.type)) return file.type
    const ext = file.name.split('.').pop()?.toLowerCase()
    return VIDEO_MIME_BY_EXT[ext] || null
}

// Strict: only the formats uploadLessonVideo() can actually send (MP4, MOV,
// WebM, M4V, MKV). isVideoFile() below also lets other video/* types through.
export const isSupportedVideoFile = (file) => !!file && !!videoContentType(file)

export const isVideoFile = (file) =>
    !!file && (file.type?.startsWith('video/') || !!videoContentType(file))

// Read a local video's duration (seconds) without uploading it. Best-effort:
// resolves null if the browser can't parse metadata.
export const readVideoDuration = (file) => new Promise((resolve) => {
    try {
        const el = document.createElement('video')
        el.preload = 'metadata'
        el.onloadedmetadata = () => {
            URL.revokeObjectURL(el.src)
            resolve(Number.isFinite(el.duration) ? Math.round(el.duration) : null)
        }
        el.onerror = () => {
            URL.revokeObjectURL(el.src)
            resolve(null)
        }
        el.src = URL.createObjectURL(file)
    } catch {
        resolve(null)
    }
})

// PUT a file straight to Supabase Storage using a signed upload URL. This must
// NOT go through the `api` instance — the signed URL is absolute, carries its
// own token in the query string, and must not receive our Bearer/JSON headers.
// Resolve the absolute Supabase URL to PUT the file to. Prefers the backend's
// `upload_url`; falls back to deriving it from `signed_url` (a bare path) +
// the origin of `public_url` for backends that don't send `upload_url` yet.
const resolveUploadUrl = ({ upload_url, signed_url, public_url }) => {
    for (const candidate of [upload_url, signed_url]) {
        if (candidate && /^https?:\/\//i.test(candidate)) return candidate
    }
    if (signed_url && public_url) {
        const origin = new URL(public_url).origin
        const base = signed_url.startsWith('/storage/v1') ? origin : `${origin}/storage/v1`
        return `${base}${signed_url.startsWith('/') ? '' : '/'}${signed_url}`
    }
    return upload_url || null
}

const putToSignedUrl = (uploadUrl, file, contentType, onProgress) => {
    if (!uploadUrl) {
        throw new Error('No upload URL returned by the server — restart the API so it sends `upload_url`.')
    }
    return axios.request({
        url: uploadUrl,
        method: 'put',
        data: file,
        headers: { 'Content-Type': contentType },
        transformRequest: [(d) => d],
        onUploadProgress: (e) => {
            if (onProgress && e.total) {
                onProgress(Math.round((e.loaded / e.total) * 100))
            }
        }
    })
}

export const lessonService = {
    // Create a chapter. `file` is legacy/optional; content is text units
    // (unitService) and an optional video (uploadLessonVideo()).
    async createLesson(courseId, title, description, file, orderNumber = 0, extra = {}) {
        const formData = new FormData()
        formData.append('course_id', courseId)
        formData.append('title', title)
        formData.append('description', description || '')
        formData.append('order_number', orderNumber)
        if (extra.startPage != null) formData.append('start_page', extra.startPage)
        if (extra.endPage != null) formData.append('end_page', extra.endPage)
        if (extra.isFree != null) formData.append('is_free', extra.isFree)
        if (file) {
            formData.append('file', file)
        }

        const response = await api.post('/lessons', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })
        return response.data
    },

    // Get lesson details
    async getLessonDetails(id) {
        const response = await api.get(`/lessons/${id}`)
        return response.data
    },

    // Get all lessons for a course
    async getCourseLessons(courseId) {
        const response = await api.get(`/lessons/course/${courseId}`)
        return response.data
    },

    // Update lesson
    async updateLesson(id, data) {
        const response = await api.put(`/lessons/${id}`, data)
        return response.data
    },

    // Delete lesson
    async deleteLesson(id) {
        const response = await api.delete(`/lessons/${id}`)
        return response.data
    },

    // Mark lesson as complete
    async markLessonComplete(id) {
        const response = await api.post(`/lessons/${id}/mark-complete`)
        return response.data
    },

    // ---- Lesson video -----------------------------------------------------

    // Full flow: ask the backend for a signed URL, upload the file directly to
    // storage, then record the path on the lesson. `onProgress(percent)` is
    // called during the direct upload. Returns the updated lesson.
    async uploadLessonVideo(lessonId, file, { onProgress } = {}) {
        const contentType = videoContentType(file)
        if (!contentType) {
            throw new Error('Unsupported video type. Use MP4, MOV, WebM, M4V or MKV.')
        }

        const urlRes = await api.post(`/lessons/${lessonId}/video/upload-url`, {
            content_type: contentType
        })
        const { path } = urlRes.data.data

        await putToSignedUrl(resolveUploadUrl(urlRes.data.data), file, contentType, onProgress)

        const duration_seconds = await readVideoDuration(file)
        const attachRes = await api.post(`/lessons/${lessonId}/video`, {
            path,
            ...(duration_seconds ? { duration_seconds } : {})
        })
        return attachRes.data
    },

    async deleteLessonVideo(lessonId) {
        const response = await api.delete(`/lessons/${lessonId}/video`)
        return response.data
    },

    // ---- Lesson attachments ---------------------------------------------

    async uploadLessonAttachment(lessonId, file, { title, onProgress } = {}) {
        const urlRes = await api.post(`/lessons/${lessonId}/attachments/upload-url`, {
            filename: file.name,
            content_type: file.type || null
        })
        const { path } = urlRes.data.data

        await putToSignedUrl(resolveUploadUrl(urlRes.data.data), file, file.type || 'application/octet-stream', onProgress)

        const recordRes = await api.post(`/lessons/${lessonId}/attachments`, {
            path,
            title: title || file.name,
            content_type: file.type || null,
            size_bytes: file.size
        })
        return recordRes.data
    },

    async deleteLessonAttachment(lessonId, attachmentId) {
        const response = await api.delete(`/lessons/${lessonId}/attachments/${attachmentId}`)
        return response.data
    }
}

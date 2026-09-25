import api from './axios'

// Server-side video tools (lms-backend/src/routes/videoTools.routes.js).
export const videoToolsService = {
    // Cut `file` into one clip per segment ({ start, end } in SECONDS). The
    // server answers with the clip itself (one segment) or a .zip (several),
    // so this resolves { blob, isZip }. Naming the download is left to the
    // caller — Content-Disposition isn't readable cross-origin without CORS
    // exposing it, and the caller knows the source name and ranges anyway.
    async trim(file, segments, { onUploadProgress } = {}) {
        const form = new FormData()
        form.append('video', file)
        form.append('segments', JSON.stringify(segments))
        try {
            const res = await api.post('/video-tools/trim', form, {
                responseType: 'blob',
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress,
            })
            return { blob: res.data, isZip: (res.headers['content-type'] || '').includes('zip') }
        } catch (err) {
            // With responseType 'blob' an error body arrives as a Blob too —
            // unwrap the server's { error } so the caller gets a real message.
            if (err.response?.data instanceof Blob) {
                try {
                    const body = JSON.parse(await err.response.data.text())
                    if (body?.error) err.message = body.error
                } catch { /* not JSON — keep axios' message */ }
            }
            throw err
        }
    },

    // Re-encodes `file` to shrink it (unlike trim, this is lossy — that's the
    // point). `quality`: 'high' | 'balanced' (default) | 'small'. Resolves
    // { blob, originalSize, compressedSize }.
    async compress(file, quality = 'balanced', { onUploadProgress } = {}) {
        const form = new FormData()
        form.append('video', file)
        form.append('quality', quality)
        try {
            const res = await api.post('/video-tools/compress', form, {
                responseType: 'blob',
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress,
            })
            return {
                blob: res.data,
                originalSize: Number(res.headers['x-original-size']) || file.size,
                compressedSize: Number(res.headers['x-compressed-size']) || res.data.size,
            }
        } catch (err) {
            if (err.response?.data instanceof Blob) {
                try {
                    const body = JSON.parse(await err.response.data.text())
                    if (body?.error) err.message = body.error
                } catch { /* not JSON — keep axios' message */ }
            }
            throw err
        }
    },
}

import api from './axios'

// Server-side video tools (lms-backend/src/routes/videoTools.routes.js).
export const videoToolsService = {
    // Cut `file` into one clip per segment ({ start, end } in SECONDS). The
    // server answers with the clip itself (one segment) or a .zip (several),
    // so this resolves { blob, isZip }. Naming the download is left to the
    // caller — Content-Disposition isn't readable cross-origin without CORS
    // exposing it, and the caller knows the source name and ranges anyway.
    //
    // Runs as a server-side job (like compress) so progress can be shown:
    // upload, poll the job (onProcessProgress(percent 0-100)), then fetch.
    async trim(file, segments, { onUploadProgress, onProcessProgress, onDownloadProgress } = {}) {
        const form = new FormData()
        form.append('video', file)
        form.append('segments', JSON.stringify(segments))
        try {
            const { data: { jobId } } = await api.post('/video-tools/trim-jobs', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress,
            })

            for (;;) {
                const { data: job } = await api.get(`/video-tools/trim-jobs/${jobId}`)
                onProcessProgress?.(job.percent || 0)
                if (job.status === 'done') break
                if (job.status === 'error') throw new Error(job.error || 'Trimming failed.')
                await new Promise((r) => setTimeout(r, 1000))
            }

            const res = await api.get(`/video-tools/trim-jobs/${jobId}/file`, {
                responseType: 'blob',
                onDownloadProgress,
            })
            return { blob: res.data, isZip: (res.headers['content-type'] || '').includes('zip') }
        } catch (err) {
            if (err.response?.data instanceof Blob) {
                try {
                    const body = JSON.parse(await err.response.data.text())
                    if (body?.error) err.message = body.error
                } catch { /* not JSON — keep axios' message */ }
            } else if (err.response?.status === 404 && err.response.data?.error) {
                err.message = err.response.data.error
            }
            throw err
        }
    },

    // Re-encodes `file` to shrink it (unlike trim, this is lossy — that's the
    // point). `quality`: 'high' | 'balanced' (default) | 'small'. Resolves
    // { blob, originalSize, compressedSize }.
    //
    // Runs as a server-side job so encoding progress can be shown: upload
    // (onUploadProgress), then poll the job (onProcessProgress(percent 0-100)),
    // then fetch the result (onDownloadProgress).
    async compress(file, quality = 'balanced', { onUploadProgress, onProcessProgress, onDownloadProgress } = {}) {
        const form = new FormData()
        form.append('video', file)
        form.append('quality', quality)
        try {
            const { data: { jobId } } = await api.post('/video-tools/compress-jobs', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress,
            })

            let job
            for (;;) {
                const { data } = await api.get(`/video-tools/compress-jobs/${jobId}`)
                job = data
                onProcessProgress?.(job.percent || 0)
                if (job.status === 'done') break
                if (job.status === 'error') throw new Error(job.error || 'Compression failed.')
                await new Promise((r) => setTimeout(r, 2000))
            }

            const res = await api.get(`/video-tools/compress-jobs/${jobId}/file`, {
                responseType: 'blob',
                onDownloadProgress,
            })
            return {
                blob: res.data,
                originalSize: job.originalSize || file.size,
                compressedSize: job.compressedSize || res.data.size,
            }
        } catch (err) {
            // A server restart mid-job loses it — say so rather than "404".
            if (err.response?.status === 404 && !(err.response.data instanceof Blob)) {
                err.message = err.response.data?.error || err.message
            }
            if (err.response?.data instanceof Blob) {
                try {
                    const body = JSON.parse(await err.response.data.text())
                    if (body?.error) err.message = body.error
                } catch { /* not JSON — keep axios' message */ }
            }
            throw err
        }
    },

    // Joins `files` (2+, in this order) into one .mp4. Resolves the Blob.
    async merge(files, { onUploadProgress } = {}) {
        const form = new FormData()
        files.forEach((f) => form.append('videos', f))
        try {
            const res = await api.post('/video-tools/merge', form, {
                responseType: 'blob',
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress,
            })
            return res.data
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

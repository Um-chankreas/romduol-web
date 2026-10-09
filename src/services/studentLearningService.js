import api from './axios'

// The student's learning data — the same endpoints the mobile app uses, all
// student-only on the server (so a teacher/admin calling these gets a 403).
export const studentLearningService = {
    // Home: XP/level, streak, study time, daily targets, "resume" card and the
    // enrolled courses with progress.
    async getHome() {
        const res = await api.get('/dashboard')
        return res.data.data
    },

    // What classmates have been up to (quiz passes, chests, finished chapters).
    async getActivity(limit = 8) {
        const res = await api.get('/dashboard/activity', { params: { limit } })
        return res.data.data.activity || []
    },

    // One course as a path: a node per chapter (status, stars) plus its chest.
    async getCoursePath(courseId) {
        const res = await api.get(`/courses/${courseId}/path`)
        return res.data.data
    },

    // One chapter as a step path: its units, each unit's practice quiz, the
    // chapter quiz, then the chest.
    async getLessonPath(lessonId) {
        const res = await api.get(`/lessons/${lessonId}/path`)
        return res.data.data
    },

    // Claim a chapter's surprise-box XP once the chapter is finished.
    async claimChest(courseId, chestIndex) {
        const res = await api.post(`/courses/${courseId}/path/chest/${chestIndex}/claim`)
        return res.data.data
    },
}

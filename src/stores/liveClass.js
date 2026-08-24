import { defineStore } from 'pinia';
import { ref } from 'vue';
import { liveClassService } from '../api/liveClass.service';

export const useLiveClassStore = defineStore('liveClass', () => {
    const activeClass = ref(null);
    const tokenData = ref(null);
    const loading = ref(false);
    const error = ref(null);

    async function joinClassSession(classId) {
        loading.value = true;
        error.value = null;
        try {
            const res = await liveClassService.getAgoraToken(classId);
            if (res.success) {
                tokenData.value = res.data;
            }
            return res;
        } catch (err) {
            error.value = err.response?.data?.error || 'Failed to obtain live class token';
            throw err;
        } finally {
            loading.value = false;
        }
    }

    async function leaveSession(classId) {
        try {
            await liveClassService.leaveLiveClass(classId);
            tokenData.value = null;
        } catch (err) {
            console.error('Error leaving class:', err);
        }
    }

    return {
        activeClass,
        tokenData,
        loading,
        error,
        joinClassSession,
        leaveSession
    };
});
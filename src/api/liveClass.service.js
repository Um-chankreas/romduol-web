import api from './axios';

export const liveClassService = {
    // POST /api/live-classes
    async createLiveClass(data) {
        const response = await api.post('/live-classes', data);
        return response.data;
    },

    // GET /api/live-classes/:id
    async getLiveClassDetails(id) {
        const response = await api.get(`/live-classes/${id}`);
        return response.data;
    },

    // POST /api/live-classes/:id/token
    async getAgoraToken(id) {
        const response = await api.post(`/live-classes/${id}/token`);
        return response.data;
    },

    // PUT /api/live-classes/:id/start
    async startLiveClass(id) {
        const response = await api.put(`/live-classes/${id}/start`);
        return response.data;
    },

    // PUT /api/live-classes/:id/end
    async endLiveClass(id) {
        const response = await api.put(`/live-classes/${id}/end`);
        return response.data;
    },

    // POST /api/live-classes/:id/leave
    async leaveLiveClass(id) {
        const response = await api.post(`/live-classes/${id}/leave`);
        return response.data;
    }
};
// src/api/auth.service.js
import api from './axios';

export const authService = {
    // POST /api/auth/login
    async login(credentials) {
        const response = await api.post('/auth/login', credentials);
        return response.data;
    },

    // GET /api/auth/profile
    async getProfile() {
        const response = await api.get('/auth/profile');
        return response.data;
    },

    // PUT /api/auth/profile
    async updateProfile(userData) {
        const response = await api.put('/auth/profile', userData);
        return response.data;
    }
};
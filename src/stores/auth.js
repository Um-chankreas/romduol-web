// src/stores/auth.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authService } from '../api/auth.service';

export const useAuthStore = defineStore('auth', () => {
    const user = ref(JSON.parse(localStorage.getItem('auth_user') || 'null'));
    const token = ref(localStorage.getItem('auth_token') || null);
    const loading = ref(false);
    const error = ref(null);

    const isAuthenticated = computed(() => !!token.value);
    const userRole = computed(() => user.value?.role || null);

    async function login(email, password) {
        loading.value = true;
        error.value = null;

        try {
            const res = await authService.login({ email, password });

            if (res.success) {
                user.value = res.data.user;
                token.value = res.data.token;

                // Persist session
                localStorage.setItem('auth_token', res.data.token);
                localStorage.setItem('auth_user', JSON.stringify(res.data.user));

                return res.data;
            }
        } catch (err) {
            error.value = err.response?.data?.error || 'Login failed';
            throw new Error(error.value);
        } finally {
            loading.value = false;
        }
    }

    async function fetchProfile() {
        try {
            const res = await authService.getProfile();
            if (res.success) {
                user.value = res.data.user;
                localStorage.setItem('auth_user', JSON.stringify(res.data.user));
            }
        } catch (err) {
            console.error('Failed to update user profile state:', err);
        }
    }

    function logout() {
        user.value = null;
        token.value = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        window.location.href = '/login';
    }

    return {
        user,
        token,
        loading,
        error,
        isAuthenticated,
        userRole,
        login,
        fetchProfile,
        logout
    };
});
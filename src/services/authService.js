import api from './axios'
import { permissionsService } from './permissionsService'

export const authService = {
    // Signup
    async signup(email, password, name, role) {
        const response = await api.post('/auth/signup', {
            email,
            password,
            name,
            role
        })

        // Save token and user
        if (response.data.data.token) {
            localStorage.setItem('token', response.data.data.token)
            localStorage.setItem('user', JSON.stringify(response.data.data.user))
            permissionsService.clearCache()
        }

        return response.data
    },

    // Login
    async login(email, password) {
        const response = await api.post('/auth/login', {
            email,
            password
        })

        // Save token and user
        if (response.data.data.token) {
            localStorage.setItem('token', response.data.data.token)
            localStorage.setItem('user', JSON.stringify(response.data.data.user))
            permissionsService.clearCache()
        }

        return response.data
    },

    // Get Profile
    async getProfile() {
        const response = await api.get('/auth/profile')
        return response.data
    },

    // Update Profile (name, email, phone)
    async updateProfile(data) {
        const response = await api.put('/auth/profile', data)
        const updatedUser = response.data?.data?.user
        if (updatedUser) {
            localStorage.setItem('user', JSON.stringify(updatedUser))
        }
        return response.data
    },

    // Upload/replace avatar
    async uploadAvatar(file) {
        const formData = new FormData()
        formData.append('avatar', file)

        const response = await api.put('/auth/profile/avatar', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        const updatedUser = response.data?.data?.user
        if (updatedUser) {
            localStorage.setItem('user', JSON.stringify(updatedUser))
        }
        return response.data
    },

    // Logout
    logout() {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        permissionsService.clearCache()
    },

    // Check if user is authenticated
    isAuthenticated() {
        return !!localStorage.getItem('token')
    },

    // Get current user
    getCurrentUser() {
        const user = localStorage.getItem('user')
        return user ? JSON.parse(user) : null
    }
}
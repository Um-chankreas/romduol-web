import api from './axios'

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
        }

        return response.data
    },

    // Get Profile
    async getProfile() {
        const response = await api.get('/auth/profile')
        return response.data
    },

    // Logout
    logout() {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
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
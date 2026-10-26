
import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://192.168.0.117:5001/api'

// Same host as the REST API, without the `/api` suffix — Socket.IO mounts at
// `<origin>/socket.io` on the backend HTTP server.
export const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '')

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
})

// Add token to all requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
}, (error) => {
    return Promise.reject(error)
})

// Requests made before there is a session (or to get one back). Their 401/429
// mean "wrong password" / "too many attempts" — the page shows that message,
// so they must not trigger the session-ended redirect below.
const SESSIONLESS_PATHS = ['/auth/login', '/auth/signup', '/auth/account/restore']

// The backend answers 403 (not 401) when the token itself is bad or the
// account is gone — see lms-backend src/middleware/auth.js. Any other 403 is
// an ordinary "you can't do that" and leaves the session alone.
const SESSION_ENDED_CODES = ['ACCOUNT_NOT_FOUND', 'ACCOUNT_DELETED', 'ACCOUNT_SUSPENDED']
const isSessionEnded = (response) => {
    if (response.status === 401) return true
    if (response.status !== 403) return false
    const data = response.data || {}
    return SESSION_ENDED_CODES.includes(data.code) || data.error === 'Invalid or expired token'
}

// Handle errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const { response, config } = error
        const sessionless = SESSIONLESS_PATHS.some(p => config?.url?.startsWith(p))
        if (response && !sessionless && isSessionEnded(response)) {
            // Token expired / invalid, or the account was removed or suspended
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            if (window.location.pathname !== '/login') window.location.href = '/login'
        }
        return Promise.reject(error)
    }
)

export default api

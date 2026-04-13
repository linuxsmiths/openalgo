import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

// Helper to fetch CSRF token
export async function fetchCSRFToken(): Promise<string> {
  const response = await fetch('/auth/csrf-token', {
    credentials: 'include',
  })
  const data = await response.json()
  return data.csrf_token
}

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // API key can be added here if needed for specific endpoints
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Flag to prevent multiple redirects/alerts during auth failure
let isRedirecting = false

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isRedirecting) {
      isRedirecting = true

      const authError = error.response?.data?.auth_error
      const message = error.response?.data?.message || 'Session expired. Please log in again.'

      if (authError) {
        // Broker session expired: show message, then logout (clears Flask session)
        // so user is forced to re-authenticate fully (not bounced back to dashboard)
        alert(message)
        window.location.href = '/auth/logout'
      } else {
        // Regular session expiry: just go to login
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Auth client for login/logout operations
export const authClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  withCredentials: true,
})

// Endpoints that don't require CSRF token (no session yet)
const CSRF_EXEMPT_ENDPOINTS = ['/auth/login', '/auth/setup']

// Add CSRF token to auth client requests (except for initial login/setup)
authClient.interceptors.request.use(
  async (config) => {
    // Check if endpoint is exempt from CSRF (exact match or starts with path + query/fragment)
    const url = config.url || ''
    const isExempt = CSRF_EXEMPT_ENDPOINTS.some((exempt) => {
      // Exact match or match with query string/fragment
      return url === exempt || url.startsWith(`${exempt}?`) || url.startsWith(`${exempt}#`)
    })

    if (
      !isExempt &&
      (config.method === 'post' || config.method === 'put' || config.method === 'delete')
    ) {
      try {
        const csrfToken = await fetchCSRFToken()
        if (csrfToken) {
          config.headers['X-CSRFToken'] = csrfToken
        }
      } catch {
        // Continue without CSRF for auth operations - backend may handle differently
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Web client for session-based routes (non-API endpoints) with CSRF support
// Note: Don't set default Content-Type here - let axios set it automatically based on data type
// (multipart/form-data for FormData, application/json for objects, etc.)
export const webClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

// Add CSRF token to web client requests
webClient.interceptors.request.use(
  async (config) => {
    const method = config.method?.toLowerCase()
    if (method === 'post' || method === 'put' || method === 'delete') {
      try {
        const csrfToken = await fetchCSRFToken()
        if (!csrfToken) {
          // Reject request if CSRF token is empty - security requirement
          return Promise.reject(new Error('CSRF token is required for this operation'))
        }
        config.headers['X-CSRFToken'] = csrfToken
      } catch {
        // Reject request if CSRF token fetch fails - security requirement
        return Promise.reject(
          new Error('Failed to fetch CSRF token. Please refresh the page and try again.')
        )
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for web client
webClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    if (status === 401) {
      // Unauthorized - redirect to login
      window.location.href = '/login'
    } else if (status === 403) {
      // Forbidden - user doesn't have permission for this resource
      // Create a more descriptive error for the caller to handle
      error.message = 'You do not have permission to access this resource'
    }
    return Promise.reject(error)
  }
)

export default apiClient

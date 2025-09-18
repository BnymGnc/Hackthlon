import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers = config.headers || {}
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

let isRedirectingToLogin = false
api.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const original: any = error.config
    const status = error?.response?.status

    // If schedule save gets forbidden (e.g., bad token), retry without auth (public endpoint)
    if (!original?._retried_noauth && status === 403 && typeof original?.url === 'string' && original.url.includes('/api/ai/schedule/save/')) {
      try {
        original._retried_noauth = true
        original.headers = { ...(original.headers || {}) }
        delete original.headers['Authorization']
        return axios(original)
      } catch {}
    }

    if (status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        if (refresh) {
          const res = await axios.post((import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api/auth/token/refresh/', { refresh })
          const newAccess = res.data?.access
          if (newAccess) {
            localStorage.setItem('access_token', newAccess)
            original.headers = original.headers || {}
            original.headers['Authorization'] = `Bearer ${newAccess}`
            return axios(original)
          }
        }
      } catch {}
      // if refresh fails, drop tokens and navigate to login once to avoid loops
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      if (!isRedirectingToLogin && typeof window !== 'undefined' && window.location.pathname !== '/login') {
        isRedirectingToLogin = true
        try { window.location.assign('/login') } catch {}
      }
    }
    return Promise.reject(error)
  }
)

export default api



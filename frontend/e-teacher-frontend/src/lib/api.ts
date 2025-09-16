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

api.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const original = error.config
    if (error?.response?.status === 401 && !original._retry) {
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
      // if refresh fails, drop tokens and redirect to login
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      try { window.location.href = '/login' } catch {}
    }
    return Promise.reject(error)
  }
)

export default api



import axios from 'axios'

/**
 * Build an axios instance dynamically for each call so we always use
 * the latest server URL and token from localStorage.
 */
export function apiClient() {
  const token  = localStorage.getItem('pg_admin_token') || ''
  const server = localStorage.getItem('pg_admin_server') || 'http://localhost:8042'

  const instance = axios.create({
    baseURL: server,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    withCredentials: true,
  })

  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message
      return Promise.reject(new Error(msg))
    }
  )

  return instance
}

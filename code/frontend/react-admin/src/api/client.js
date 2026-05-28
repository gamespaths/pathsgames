import axios from 'axios'

/**
 * Build an axios instance dynamically for each call so we always use
 * the latest server URL and token from localStorage.
 */
export function apiClient() {
  const token  = localStorage.getItem('pg_admin_token') || ''
  const rawServer = localStorage.getItem('pg_admin_server') || 'http://localhost:8042'
  
  let server = 'http://localhost:8042'
  try {
    const parsedUrl = new URL(rawServer)
    if (['http:', 'https:'].includes(parsedUrl.protocol)) {
      // Reconstruct the URL from parsed components to sanitize it and avoid using the raw tainted string
      server = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`
      if (server.endsWith('/')) {
        server = server.slice(0, -1)
      }
    }
  } catch (e) {
    // Keep default if invalid
  }

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

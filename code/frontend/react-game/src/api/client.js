import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 5000,
})

export async function fetchWithFallback(url, mockData) {
  try {
    const res = await api.get(url)
    return res.data
  } catch {
    return mockData
  }
}

export default api

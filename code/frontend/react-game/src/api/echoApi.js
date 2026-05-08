import axios from 'axios'

function normalizeBaseUrl(url) {
  if (typeof url !== 'string') {
    throw new Error('Invalid server URL')
  }

  const trimmed = url.trim()
  if (!trimmed) {
    throw new Error('Invalid server URL')
  }

  const parsed = new URL(trimmed)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Unsupported protocol')
  }

  parsed.hash = ''
  parsed.search = ''

  return parsed.origin
}

export async function getServerStatus(url) {
  const baseUrl = normalizeBaseUrl(url)
  const res = await axios.get(`${baseUrl}/api/echo/status`, { timeout: 3000 })
  return res.data
}

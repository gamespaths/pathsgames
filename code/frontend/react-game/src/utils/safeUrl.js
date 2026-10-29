// v1.11.0 a link taken from story or image data is opened only when it is http(s): never javascript:, data:, ...
export function safeExternalUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url.trim() : null
  } catch {
    return null
  }
}

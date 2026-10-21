import axios from 'axios'

/**
 * Guest authentication API client (Step 12).
 *
 * `createGuestSession` posts to `/api/auth/guest` to mint a new anonymous
 * session. `resumeGuestSession` posts to `/api/auth/guest/resume` and relies
 * on the HttpOnly `pathsgames.guestcookie` cookie which the browser sends
 * automatically when `withCredentials: true`.
 *
 * Both endpoints return `GuestLoginResponse`:
 *   { userUuid, username, accessToken, accessTokenExpiresAt, refreshTokenExpiresAt, csrfToken }
 */

export async function createGuestSession(serverUrl) {
  if (!serverUrl) return null
  const res = await axios.post(
    `${serverUrl}/api/auth/guest`,
    null,
    { withCredentials: true, timeout: 5000 }
  )
  return res.data
}

export async function resumeGuestSession(serverUrl) {
  if (!serverUrl) return null
  const res = await axios.post(
    `${serverUrl}/api/auth/guest/resume`,
    null,
    { withCredentials: true, timeout: 5000 }
  )
  return res.data
}

/** v1.2.0 Bearer header of the current session (the guest a Google login merges), when known. */
function bearer(accessToken) {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
}

/**
 * v1.2.0 POST /api/auth/google with the GIS ID token and its nonce; the current guest (bearer and
 * HttpOnly guest cookie) is merged into the Google user. Answers the profile and the access token.
 */
export async function googleLogin(serverUrl, { idToken, nonce, language }, accessToken) {
  const res = await axios.post(
    `${serverUrl}/api/auth/google`,
    { idToken, nonce, ...(language ? { language } : {}) },
    { withCredentials: true, timeout: 10000, headers: bearer(accessToken) }
  )
  return res.data
}

/** v1.2.0 POST /api/auth/refresh: a new access token from the HttpOnly refresh cookie. */
export async function refreshSession(serverUrl) {
  const res = await axios.post(`${serverUrl}/api/auth/refresh`, null, { withCredentials: true, timeout: 5000 })
  return res.data
}

/** v1.2.0 GET /api/auth/me: nickname, displayName, pictureUrl and the account type. */
export async function getMe(serverUrl, accessToken) {
  const res = await axios.get(`${serverUrl}/api/auth/me`, { timeout: 5000, headers: bearer(accessToken) })
  return res.data
}

/** v1.2.0 POST /api/auth/logout: revokes this session (refresh cookie) and clears the cookies. */
export async function logoutSession(serverUrl, accessToken) {
  const res = await axios.post(`${serverUrl}/api/auth/logout`, null,
    { withCredentials: true, timeout: 5000, headers: bearer(accessToken) })
  return res.data
}

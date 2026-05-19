import axios from 'axios'
import { MOCK_SERVER } from '../context/ServerContext'

/**
 * Guest authentication API client (Step 12).
 *
 * `createGuestSession` posts to `/api/auth/guest` to mint a new anonymous
 * session. `resumeGuestSession` posts to `/api/auth/guest/resume` and relies
 * on the HttpOnly `pathsgames.guestcookie` cookie which the browser sends
 * automatically when `withCredentials: true`.
 *
 * Both endpoints return `GuestLoginResponse`:
 *   { userUuid, username, accessToken, accessTokenExpiresAt, refreshTokenExpiresAt }
 */

export async function createGuestSession(serverUrl) {
  if (!serverUrl || serverUrl === MOCK_SERVER) return null
  const res = await axios.post(
    `${serverUrl}/api/auth/guest`,
    null,
    { withCredentials: true, timeout: 5000 }
  )
  return res.data
}

export async function resumeGuestSession(serverUrl) {
  if (!serverUrl || serverUrl === MOCK_SERVER) return null
  const res = await axios.post(
    `${serverUrl}/api/auth/guest/resume`,
    null,
    { withCredentials: true, timeout: 5000 }
  )
  return res.data
}

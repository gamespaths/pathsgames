import { useState } from 'react'
import { CF_KEY, isTurnstilePassValid, recordTurnstilePass } from '@/utils/turnstile'

/**
 * useAntibot — shared Cloudflare Turnstile gate state machine.
 *
 * Returns `phase`: 'checking' (widget running) | 'ready' (passed/bypassed) |
 * 'error' (widget failed — caller offers a retry instead of hard-blocking).
 *   - No site key (dev bypass) → starts 'ready'.
 *   - `cookie:true` + a recent first-party pass cookie → starts 'ready'
 *     (skip re-verifying within the TTL).
 *
 * `onSuccess(token)` stores the token and, when `cookie:true`, records the pass
 * cookie. `retry` remounts the widget (bump `attempt`, used as its React `key`,
 * for a fresh challenge) and returns to 'checking'.
 *
 * Two call sites:
 *   - `cookie:true`  → Home/guest gates: skippable, session-cached; the token
 *     itself is not consumed server-side.
 *   - `cookie:false` → start-match: always challenge so a FRESH token is minted
 *     and sent to the backend on match creation (single-use server-side).
 */
export default function useAntibot({ cookie = false } = {}) {
  const startReady = !CF_KEY || (cookie && isTurnstilePassValid())
  const [phase, setPhase] = useState(startReady ? 'ready' : 'checking')
  const [token, setToken] = useState(null)
  const [attempt, setAttempt] = useState(0)

  function retry() {
    setAttempt(a => a + 1)
    setPhase('checking')
  }

  function onSuccess(tok) {
    setToken(tok ?? null)
    if (cookie) recordTurnstilePass()
    setPhase('ready')
  }

  function onError() {
    setPhase('error')
  }

  return { phase, token, attempt, retry, onSuccess, onError, onExpire: retry }
}

/* haptics — step 16: a light vibration when a card is played (Android; iOS has no Vibration API). */

export const PLAY_VIBRATION_MS = 15

/** True where the Vibration API exists. */
export function canVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/** Vibrates once for a play; call it inside the tap (user activation). Off, missing or throwing: a silent no-op. */
export function vibratePlay(enabled = true) {
  if (!enabled || !canVibrate()) return false
  try {
    navigator.vibrate(PLAY_VIBRATION_MS)
    return true
  } catch {
    return false
  }
}

import { Turnstile } from '@marsidev/react-turnstile'
import { CF_KEY } from '../../utils/turnstile'

/**
 * Thin wrapper around the Cloudflare Turnstile widget with the shared dark
 * theme. Renders nothing when no site key is configured (dev bypass).
 */
export default function TurnstileWidget({ appearance = 'always', size = 'flexible', onSuccess, onError, onExpire }) {
  if (!CF_KEY) return null
  return (
    <Turnstile
      siteKey={CF_KEY}
      onSuccess={onSuccess}
      onError={onError}
      onExpire={onExpire}
      options={{
        theme: 'dark',
        size,
        appearance,
        // Resilience on flaky mobile networks / webviews: auto-retry transient
        // failures and auto-refresh expired/timed-out tokens instead of bubbling
        // straight to onError/onExpire (which callers used to treat as "bot").
        retry: 'auto',
        refreshExpired: 'auto',
        refreshTimeout: 'auto',
      }}
    />
  )
}

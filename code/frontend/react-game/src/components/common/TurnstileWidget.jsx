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
      options={{ theme: 'dark', size, appearance }}
    />
  )
}

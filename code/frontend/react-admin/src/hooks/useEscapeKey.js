import { useEffect } from 'react'

/** Closes a modal on Escape: the key listener lives on document so focus can be anywhere. */
export default function useEscapeKey(onEscape, active = true) {
  useEffect(() => {
    if (!active) return undefined
    const handler = e => { if (e.key === 'Escape') onEscape() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onEscape, active])
}

import { useLayoutEffect, useRef } from 'react'
import { useAnimationSettings } from '@/context/AnimationContext'
import { canAnimate } from '@/components/book/pageTurn'
import { isMobileViewport } from '@/features/gameplay/js/mobileView'

/* FadeIn — step 15: an (i) preview fades in where it opens, on the phone layout only (the desktop Book
   fades the whole page); keyed by the preview, so each new one fades. `display: contents` on desktop. */
export default function FadeIn({ children, className = '' }) {
  const ref = useRef(null)
  const settings = useAnimationSettings()
  const live = useRef(settings)
  live.current = settings

  useLayoutEffect(() => {
    const el = ref.current
    const { turn, reduced, timings } = live.current
    if (!el || !turn || reduced || !isMobileViewport() || !canAnimate(el)) return undefined
    const anim = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: timings.fade, easing: 'ease-out' })
    return () => anim.cancel()
  }, [])

  return <div ref={ref} className={['pg-fade-in', className].filter(Boolean).join(' ')}>{children}</div>
}

/** What tells two previews apart (type and card): a new one fades in again. */
export function previewKey(preview) {
  return `${preview?.type ?? ''}|${preview?.card?.uuid ?? preview?.card?.title ?? preview?.entity?.uuid ?? ''}`
}

import { useRef } from 'react'
import useDeal from '@/hooks/useDeal'
import { useBookTurning } from '@/components/book/BookPages'

/* DealtList — step 14: a card grid whose cards are dealt from the deck (useDeal); the caller's classes
   plus `pg-dealt`. `hold` (and step 15's page turn of its book) keeps the deal until the turn ends. */
export default function DealtList({ className = '', children, hold = false, ...rest }) {
  const ref = useRef(null)
  const turning = useBookTurning()
  const dealing = useDeal(ref, { hold: hold || turning })
  return (
    <div ref={ref} className={[className.trim(), 'pg-dealt'].filter(Boolean).join(' ')}
      data-deal-list={dealing ? 'on' : undefined} {...rest}>
      {children}
    </div>
  )
}

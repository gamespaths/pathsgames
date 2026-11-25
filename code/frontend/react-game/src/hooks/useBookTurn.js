import { useCallback, useState } from 'react'

/* useBookTurn — step 15: the page key and turn direction of a book whose pages live in useState;
   `turnTo(direction)` goes in the same handler as the state change (one batched commit, one turn). */
export default function useBookTurn() {
  const [turn, setTurn] = useState({ pageKey: 0, direction: null })
  const turnTo = useCallback(direction => {
    setTurn(prev => ({ pageKey: prev.pageKey + 1, direction: direction ?? null }))
  }, [])
  return { pageKey: turn.pageKey, direction: turn.direction, turnTo }
}

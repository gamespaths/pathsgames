/** v1.7.0 — the game requests in flight, so a language changed elsewhere waits for a quiet moment. */
let count = 0
let waiters = []

export function beginRequest() {
  count += 1
}

export function endRequest() {
  count = Math.max(0, count - 1)
  if (count === 0) {
    const ready = waiters
    waiters = []
    ready.forEach(resolve => resolve())
  }
}

export function inFlightCount() {
  return count
}

/** Resolves when no request is in flight (at once when none is). */
export function whenIdle() {
  return count === 0 ? Promise.resolve() : new Promise(resolve => { waiters.push(resolve) })
}

/** Test seam: forget every request and waiter. */
export function resetInFlight() {
  count = 0
  waiters = []
}

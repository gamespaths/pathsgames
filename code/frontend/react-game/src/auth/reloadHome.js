/** v1.2.0 — a fresh load of the home: after a Google logout nothing of the old session stays open. */
export function reloadHome() {
  window.location.assign(import.meta.env.BASE_URL)
}

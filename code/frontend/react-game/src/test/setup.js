import '@testing-library/jest-dom'

// v1.13.0 — the document scrolls now; jsdom only logs "not implemented" for window.scrollTo.
window.scrollTo = () => {}

import { vi } from 'vitest'

/* Step 15 — a Web Animations API stand-in for jsdom: every animate() call is recorded and settles only
   when the test says so (finish / cancel), so the order of a play or a page turn can be asserted. */
export function installWaapi() {
  const animations = []
  const had = Object.prototype.hasOwnProperty.call(Element.prototype, 'animate')
  const original = Element.prototype.animate
  Element.prototype.animate = function animate(keyframes, options) {
    let resolve
    let reject
    const finished = new Promise((res, rej) => { resolve = res; reject = rej })
    finished.catch(() => {})
    const anim = {
      target: this,
      keyframes,
      options,
      playState: 'running',
      finished,
      finish: vi.fn(() => { anim.playState = 'finished'; resolve(anim) }),
      cancel: vi.fn(() => { anim.playState = 'idle'; reject(new Error('AbortError')) }),
    }
    animations.push(anim)
    return anim
  }
  return {
    animations,
    running: () => animations.filter(a => a.playState === 'running'),
    finishAll: () => animations.forEach(a => { if (a.playState === 'running') a.finish() }),
    restore: () => {
      if (had) Element.prototype.animate = original
      else delete Element.prototype.animate
    },
  }
}

/** A fixed layout box for an element (jsdom has none). */
export function setBox(el, { left = 0, top = 0, width = 100, height = 100 } = {}) {
  Object.defineProperties(el, {
    offsetLeft: { configurable: true, value: left },
    offsetTop: { configurable: true, value: top },
    offsetWidth: { configurable: true, value: width },
    offsetHeight: { configurable: true, value: height },
  })
  el.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top })
  return el
}

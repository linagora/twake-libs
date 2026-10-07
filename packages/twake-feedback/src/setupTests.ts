import '@testing-library/jest-dom/vitest'

// MUI useMediaQuery needs matchMedia: nothing matches, so tests run as desktop
window.matchMedia = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false
})

// jsdom has no PointerEvent: without it, fireEvent drops the coordinates
if (!('PointerEvent' in window)) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number
    pointerType: string

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 0
      this.pointerType = init.pointerType ?? 'mouse'
    }
  }
  Object.defineProperty(window, 'PointerEvent', {
    value: PointerEventPolyfill,
    configurable: true
  })
}

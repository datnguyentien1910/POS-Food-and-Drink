import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom reports a 1024px viewport; tests assume the primary laptop layout.
Object.defineProperty(window, 'innerWidth', {
  configurable: true,
  writable: true,
  value: 1440,
})
Object.defineProperty(window, 'innerHeight', {
  configurable: true,
  writable: true,
  value: 900,
})

// jsdom does not implement the native <dialog> methods Tailwind UI relies on.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true
  }
}

if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close() {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

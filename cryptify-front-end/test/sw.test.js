const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const crypto = require('crypto')

// sw.js is a classic service worker served as a static file, so it is not an
// importable module. To unit-test the pure randomHex() helper against the code
// that actually ships, we load the real source into a sandboxed context with a
// stubbed `self`, then expose the top-level const via an appended assignment.
function loadRandomHex ({ getRandomValues } = {}) {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'sw.js'),
    'utf8'
  )
  const sandbox = {
    self: {
      // Only addEventListener runs at load time; the handlers are not invoked.
      addEventListener: () => {},
      crypto: getRandomValues
        ? { getRandomValues }
        : crypto.webcrypto
    }
  }
  vm.createContext(sandbox)
  vm.runInContext(src + '\nthis.__randomHex = randomHex;', sandbox, {
    filename: 'sw.js'
  })
  return sandbox.__randomHex
}

test('randomHex returns a 32-character lowercase hex string (16 bytes)', () => {
  const randomHex = loadRandomHex()
  const value = randomHex()
  assert.match(value, /^[0-9a-f]{32}$/)
})

test('randomHex produces distinct values across calls', () => {
  const randomHex = loadRandomHex()
  const values = new Set(Array.from({ length: 100 }, () => randomHex()))
  // Collisions across 100 draws of 128 bits are astronomically unlikely.
  assert.equal(values.size, 100)
})

test('randomHex uses the crypto-secure PRNG, not Math.random', () => {
  let calledWith = null
  const getRandomValues = (arr) => {
    calledWith = arr
    return crypto.webcrypto.getRandomValues(arr)
  }
  // Guard against a regression back to Math.random(): fail loudly if it is used.
  const originalRandom = Math.random
  Math.random = () => {
    throw new Error('randomHex must not call Math.random')
  }
  try {
    const randomHex = loadRandomHex({ getRandomValues })
    randomHex()
  } finally {
    Math.random = originalRandom
  }
  // The array is constructed inside the vm sandbox, so cross-realm
  // `instanceof` fails; check the constructor name and view-ness instead.
  assert.ok(
    calledWith && calledWith.constructor.name === 'Uint8Array',
    'expected self.crypto.getRandomValues to be called with a Uint8Array'
  )
  assert.equal(calledWith.length, 16, 'expected 16 bytes of entropy (128 bits)')
})

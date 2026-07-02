const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')

const {
  secureWebPreferences,
  createWebPreferences,
} = require('../public/windowConfig')

test('renderer is not granted Node integration', () => {
  assert.equal(secureWebPreferences.nodeIntegration, false)
})

test('renderer runs with context isolation enabled', () => {
  assert.equal(secureWebPreferences.contextIsolation, true)
})

test('renderer runs sandboxed', () => {
  assert.equal(secureWebPreferences.sandbox, true)
})

test('createWebPreferences carries the hardened flags and wires a preload', () => {
  const prefs = createWebPreferences()
  assert.equal(prefs.nodeIntegration, false)
  assert.equal(prefs.contextIsolation, true)
  assert.equal(prefs.sandbox, true)
  assert.equal(prefs.preload, path.join(__dirname, '..', 'public', 'preload.js'))
})

test('createWebPreferences accepts a custom preload path', () => {
  const custom = '/tmp/custom-preload.js'
  assert.equal(createWebPreferences(custom).preload, custom)
})

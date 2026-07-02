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

test('electron-builder packages the main entry and its preload/config siblings', () => {
  // Regression guard: electron.js (the "main" entry) require()s ./windowConfig
  // and loads ./preload.js at runtime. If public/ is dropped from build.files
  // the packaged app crashes with MODULE_NOT_FOUND, so the directory holding
  // the main entry must be covered by an electron-builder files glob.
  const pkg = require('../package.json')
  const mainDir = path.posix.dirname(pkg.main.replace(/^\.\//, ''))
  const files = pkg.build.files.map((glob) => glob.replace(/^\.\//, ''))
  const packagesMainDir = files.some((glob) => glob.startsWith(`${mainDir}/`))
  assert.ok(
    packagesMainDir,
    `build.files (${JSON.stringify(pkg.build.files)}) must package "${mainDir}/" so the main entry and its requires ship`,
  )
})

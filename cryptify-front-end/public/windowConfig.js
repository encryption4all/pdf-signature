const path = require('path')

// Hardened webPreferences for the renderer BrowserWindow: Node integration is
// disabled and the renderer runs isolated + sandboxed, so it cannot reach
// Node.js APIs directly. Any privileged capability must be exposed explicitly
// through the preload script via contextBridge.
const secureWebPreferences = {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
}

// Builds the webPreferences object wired to the preload bridge.
function createWebPreferences(preloadPath = path.join(__dirname, 'preload.js')) {
  return {
    ...secureWebPreferences,
    preload: preloadPath,
  }
}

module.exports = { secureWebPreferences, createWebPreferences }

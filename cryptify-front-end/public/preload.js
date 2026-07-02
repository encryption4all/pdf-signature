// Preload bridge. Runs in an isolated, sandboxed context and is the ONLY place
// allowed to expose capabilities to the renderer, via
// contextBridge.exposeInMainWorld.
//
// The renderer (the React app in src/) uses no Node.js APIs — all `process.env`
// references are CRA/webpack build-time constants, not runtime Node access — so
// no interface is exposed today. When the renderer needs a privileged
// capability, add a narrowly-scoped, explicitly-listed method here through
// contextBridge; never re-enable nodeIntegration.

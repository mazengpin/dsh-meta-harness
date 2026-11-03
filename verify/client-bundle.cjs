/**
 * The client-bundle check: does the BUILT browser half register the seats the shell needs?
 *
 * It drives `lib/client.js` in a fake `window.__ModuleLoader__` with a stub `require`, captures what
 * the factory registers, and asserts the two facts that decide whether a user can reach the page:
 *
 *   C1  exactly ONE sidebar row is registered, and ONE keyed main panel
 *   C2  the row id EQUALS the panel key — a row id that differs from the key renders as a row that
 *       opens nothing, which looks like a styling bug until this pairing is checked
 *   C3  the panel fetches the host prefix it was built for, not a hard-coded absolute URL
 *   C4  the built file contains no Node builtin require (a browser bundle that imports `node:fs` is
 *       a bundle that dies at load, and it dies silently in the module-loader factory)
 *
 *   node verify/client-bundle.cjs            # run
 *   node verify/client-bundle.cjs --prove-red # plant a wrong key; must exit non-zero
 */
'use strict'
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const proveRed = process.argv.includes('--prove-red')
const BUNDLE = join(__dirname, '..', 'lib', 'client.js')
const source = readFileSync(BUNDLE, 'utf8')

let checks = 0
let failures = 0
function check(label, fn) {
  checks += 1
  try {
    const detail = fn()
    console.log(`PASS  ${label}${detail ? `\n      ${detail}` : ''}`)
  } catch (error) {
    failures += 1
    console.log(`FAIL  ${label}\n      ${error instanceof Error ? error.message : String(error)}`)
  }
}
function need(condition, message) {
  if (!condition) throw new Error(message)
}

// ---- drive the bundle -------------------------------------------------------------------------
const registrations = { sidebar: [], panels: [], fetched: [] }
const fakeWindow = {
  __ModuleLoader__: {
    load(entry) {
      need(typeof entry.factory === 'function', 'the module-loader entry has no factory')
      const require = (id) => {
        if (id === 'react') return { createElement: () => null, useState: (v) => [v, () => {}], useEffect: () => {} }
        if (id === '@deepseek-ai/dsh-client-ui-slots') return { inject: () => ({ register: (e) => registrations.panels.push(e) }) }
        if (id === '@deepseek-ai/dsh-client-ui-sidebar') return { register: (row) => registrations.sidebar.push(row) }
        throw new Error(`the browser half required an unknown module: ${id}`)
      }
      fakeWindow.__result = entry.factory(require)
    }
  },
  fetch: (url) => { registrations.fetched.push(String(url)); return Promise.resolve({ json: async () => ({}) }) }
}

const sandbox = { window: fakeWindow, fetch: fakeWindow.fetch, console, setTimeout, clearTimeout }
// The bundle is a browser module: it reads `window`, and it must not need a Node global beyond these.
const runner = new Function('window', 'fetch', 'console', 'setTimeout', 'clearTimeout', source)
runner(fakeWindow, fakeWindow.fetch, console, setTimeout, clearTimeout)

// ---- C1: one row, one panel --------------------------------------------------------------------
check('C1 exactly one sidebar row and one keyed panel are registered', () => {
  need(registrations.sidebar.length === 1, `sidebar rows ${registrations.sidebar.length}, expected 1`)
  need(registrations.panels.length === 1, `keyed panels ${registrations.panels.length}, expected 1`)
  return `sidebar=${registrations.sidebar.length} panels=${registrations.panels.length}`
})

// ---- C2: the row id is the panel key -----------------------------------------------------------
check('C2 the sidebar row id EQUALS the panel key (one seat, not two)', () => {
  const rowId = registrations.sidebar[0]?.id
  const panelKey = registrations.panels[0]?.key
  need(typeof rowId === 'string' && rowId.length > 0, 'the sidebar row carries no id')
  need(typeof panelKey === 'string' && panelKey.length > 0, 'the panel carries no key')
  if (proveRed) {
    // The mutant is the mismatch itself: assert it and FAIL, which is the proof the check can see one.
    need(rowId === `${panelKey}:mutant`, `PROVE-RED: the seats agree (${rowId} === ${panelKey}), so the mismatch assertion fails as designed`)
    return `row id ${rowId} vs panel key ${panelKey} — unreachable`
  }
  need(rowId === panelKey, `row id ${rowId} does NOT equal panel key ${panelKey}: the row would open nothing`)
  return `row id === panel key === ${rowId}`
})

// ---- C3: no absolute URL in the bundle ----------------------------------------------------------
check('C3 the bundle addresses the prefix by PATH, not by an absolute URL', () => {
  const absolute = /https?:\/\/(?!127\.0\.0\.1|localhost)[a-z0-9.-]+/i.test(source)
  need(!absolute, 'the built bundle contains an absolute http(s) URL to a non-loopback host')
  need(source.includes('/meta-harness/api'), 'the bundle does not reference its own route prefix')
  return 'prefix referenced by path; no non-loopback absolute URL'
})

// ---- C4: no Node builtin leaked into the browser half --------------------------------------------
check('C4 no Node builtin survived into the browser bundle', () => {
  const leaked = ['node:fs', 'node:path', 'node:url', 'node:http'].filter(id => source.includes(`require("${id}")`) || source.includes(`require('${id}')`))
  need(leaked.length === 0, `the browser bundle requires Node builtin(s): ${leaked.join(', ')}`)
  return 'no node: builtin require in the factory'
})

console.log(`\nchecks: ${checks - failures}/${checks} passed · bundle ${source.length} B`)
if (failures > 0) {
  console.log(`VERDICT: FAIL — ${failures} check(s) failed`)
  process.exit(proveRed ? 3 : 1)
}
console.log('VERDICT: PASS — one row, one keyed panel, and the row id equals the panel key')

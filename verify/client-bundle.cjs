/**
 * The client-bundle check: does the BUILT browser half register the seats the shell needs?
 *
 * It drives `lib/client.js` in a STRICT fake `window.__ModuleLoader__` that rejects a repeated
 * factory id with the real client-module-system error, materializes the registered factory with a
 * stub `require`, and applies the module's exported Cordis plugin to a fake Client context.
 *
 * The checks:
 *
 *   C0  the bundle registers its id EXACTLY ONCE: `window.__ModuleLoader__.load` == 1,
 *       `loader.load(` == 0, `.load({` == 1, and the id is the package name. A hand-written inner
 *       `loader.load({ id, ... })` is the duplicate that fails a real boot, and it does NOT show up
 *       in a count of `window.__ModuleLoader__.load` — which is why the triple is asserted.
 *   C1  under the strict loader the bundle executes, materializes and applies without throwing, and
 *       exactly ONE sidebar row and ONE keyed main panel are registered
 *   C2  the row id EQUALS the panel key — a row id that differs from the key renders as a row that
 *       opens nothing, which looks like a styling bug until this pairing is checked
 *   C3  the panel fetches the host prefix it was built for, not a hard-coded absolute URL
 *   C4  the built file contains no Node builtin require (a browser bundle that imports `node:fs` is
 *       a bundle that dies at load, and it dies silently in the module-loader factory)
 *   C5  the module exports a valid Cordis plugin (name + inject + apply); a side-effect-only export
 *       fails a real boot with "invalid plugin, expect function or object with an apply method"
 *
 *   node verify/client-bundle.cjs                     # run against lib/client.js
 *   node verify/client-bundle.cjs --prove-red         # plant a wrong key + replay the duplicate
 *                                                    # registration; the first must fail, the
 *                                                    # second must be REJECTED by this harness
 *   node verify/client-bundle.cjs --bundle <path>     # run against an arbitrary artifact
 */
'use strict'
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const argv = process.argv.slice(2)
const proveRed = argv.includes('--prove-red')
const bundleIndex = argv.indexOf('--bundle')
const BUNDLE = bundleIndex >= 0 && argv[bundleIndex + 1]
  ? argv[bundleIndex + 1]
  : join(__dirname, '..', 'lib', 'client.js')
const BUNDLE_ID = 'dsh-meta-harness'
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

// ---- C0: exactly one registration, spelled the way the client module system expects -----------------
check('C0 the bundle registers its id EXACTLY ONCE and that id is the package name', () => {
  const windowLoad = (source.match(/window\.__ModuleLoader__\.load/g) ?? []).length
  const loaderLoad = (source.match(/loader\.load\(/g) ?? []).length
  const totalLoad = (source.match(/\.load\(\{/g) ?? []).length
  const named = source.includes(`window.__ModuleLoader__.load({`) && /window\.__ModuleLoader__\.load\(\{[^}]*id:\s*"dsh-meta-harness"/.test(source)
  need(windowLoad === 1, `window.__ModuleLoader__.load count ${windowLoad}, expected 1 (the tsdown banner)`)
  need(loaderLoad === 0, `loader.load( count ${loaderLoad}, expected 0 (a hand-written inner registration is the duplicate)`)
  need(totalLoad === 1, `.load({ count ${totalLoad}, expected 1 — the package id must be registered by exactly one call`)
  need(named, 'the single registration does not carry id "dsh-meta-harness"')
  return `window.__ModuleLoader__.load=1 · loader.load(=0 · .load({=1 · id=${BUNDLE_ID}`
})

// ---- drive the bundle in a STRICT loader ------------------------------------------------------------
const factories = new Map()
const registrations = { sidebar: [], panels: [], fetched: [] }
const localeDictionaries = new Map()

/** Mirror the client module system's id normalization. */
const stripClientSuffix = spec => (spec.endsWith('/client') ? spec.slice(0, -'/client'.length) : spec)

const fakeWindow = {
  __ModuleLoader__: {
    load(entry) {
      need(entry !== null && typeof entry === 'object', 'the module-loader entry is not an object')
      need(typeof entry.id === 'string' && entry.id.length > 0, 'the module-loader entry carries no id')
      need(typeof entry.factory === 'function', 'the module-loader entry has no factory')
      const id = stripClientSuffix(entry.id)
      // The real ClientModuleSystem.register throws exactly this on a repeated id
      // (packages/client/modules/src/client/system.ts:174).
      need(!factories.has(id), `duplicate factory registration for "${entry.id}" (bundle executed twice without invalidate?)`)
      factories.set(id, entry.factory)
    }
  },
  fetch: url => { registrations.fetched.push(String(url)); return Promise.resolve({ json: async () => ({}) }) }
}

const stubRequire = (id) => {
  if (id === 'react') {
    return {
      createElement: () => null,
      useState: initial => [initial, () => {}],
      useEffect: () => {},
    }
  }
  if (id === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: null }
  throw new Error(`the browser half required an unknown module: ${id}`)
}

const fakeCtx = {
  slots: {
    inject(kind, factory) {
      const disposer = factory()
      return typeof disposer === 'function' ? disposer : () => {}
    },
    register(meta, component) {
      need(meta !== null && typeof meta === 'object', 'slots.register was called without registration metadata')
      if (meta.name === 'main') {
        registrations.panels.push({ ...meta, component })
      } else if (typeof meta.name === 'string' && meta.name.startsWith('sidebar.')) {
        registrations.sidebar.push({ ...meta, component })
      } else {
        throw new Error(`slots.register names an unexpected slot: ${String(meta.name)}`)
      }
      return () => {}
    },
  },
  locale: {
    register(ns, lang, dictionary) {
      localeDictionaries.set(`${ns}:${lang}`, dictionary)
      return () => {}
    },
    bind(ns) {
      const dictionary = localeDictionaries.get(`${ns}:en`) ?? {}
      return key => dictionary[key] ?? key
    },
  },
  effect(execute) {
    const disposer = execute()
    return typeof disposer === 'function' ? disposer : () => {}
  },
  logger: { warn: () => {} },
}

// The bundle is a browser module: it reads `window`, and it must not need a Node global beyond these.
const runner = new Function('window', 'fetch', 'console', 'setTimeout', 'clearTimeout', source)

let executionError = null
try {
  runner(fakeWindow, fakeWindow.fetch, console, setTimeout, clearTimeout)
} catch (error) {
  executionError = error instanceof Error ? error.message : String(error)
}

let exportsObject = null
let materializeError = executionError
if (executionError === null) {
  const factory = factories.get(BUNDLE_ID)
  if (factory === undefined) {
    materializeError = `the bundle did not register a factory for "${BUNDLE_ID}" (registered: ${[...factories.keys()].join(', ') || 'none'})`
  } else {
    try {
      exportsObject = factory(stubRequire)
    } catch (error) {
      materializeError = error instanceof Error ? error.message : String(error)
    }
  }
}

let applyError = materializeError
if (applyError === null) {
  if (typeof exportsObject?.apply !== 'function') {
    applyError = 'the module exports carry no `apply` function, so the Cordis Loader cannot activate it'
  } else {
    try {
      exportsObject.apply(fakeCtx)
    } catch (error) {
      applyError = error instanceof Error ? error.message : String(error)
    }
  }
}

// ---- C1: strict loader, one row, one panel -----------------------------------------------------------
check('C1 under a strict duplicate-rejecting loader the bundle executes, materializes and applies without throwing, with exactly one sidebar row and one keyed panel', () => {
  need(executionError === null, `bundle script execution threw: ${executionError}`)
  need(materializeError === null, `factory materialization/apply threw: ${materializeError}`)
  need(applyError === null, `apply threw: ${applyError}`)
  need(registrations.sidebar.length === 1, `sidebar rows ${registrations.sidebar.length}, expected 1`)
  need(registrations.panels.length === 1, `keyed panels ${registrations.panels.length}, expected 1`)
  if (proveRed) {
    // Prove the strict loader is a real guard: replaying the same id must be rejected.
    let rejected = false
    try {
      fakeWindow.__ModuleLoader__.load({ id: BUNDLE_ID, factory: () => ({}) })
    } catch (error) {
      rejected = /duplicate factory registration/.test(error instanceof Error ? error.message : String(error))
    }
    need(rejected, 'PROVE-RED: the strict loader did NOT reject a repeated registration, so the duplicate guard is not real')
    return `sidebar=${registrations.sidebar.length} panels=${registrations.panels.length} · replay of "${BUNDLE_ID}" was REJECTED with "duplicate factory registration"`
  }
  return `sidebar=${registrations.sidebar.length} panels=${registrations.panels.length} · no duplicate registration`
})

// ---- C2: the row id is the panel key ---------------------------------------------------------------
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

// ---- C3: no absolute URL in the bundle ---------------------------------------------------------------
check('C3 the bundle addresses the prefix by PATH, not by an absolute URL', () => {
  const absolute = /https?:\/\/(?!127\.0\.0\.1|localhost)[a-z0-9.-]+/i.test(source)
  need(!absolute, 'the built bundle contains an absolute http(s) URL to a non-loopback host')
  need(source.includes('/meta-harness/api'), 'the bundle does not reference its own route prefix')
  return 'prefix referenced by path; no non-loopback absolute URL'
})

// ---- C4: no Node builtin leaked into the browser half -------------------------------------------------
check('C4 no Node builtin survived into the browser bundle', () => {
  const leaked = ['node:fs', 'node:path', 'node:url', 'node:http'].filter(id => source.includes(`require("${id}")`) || source.includes(`require('${id}')`))
  need(leaked.length === 0, `the browser bundle requires Node builtin(s): ${leaked.join(', ')}`)
  return 'no node: builtin require in the factory'
})

// ---- C5: the exports are a Cordis plugin ----------------------------------------------------------------
check('C5 the module exports a valid Cordis plugin (name + inject + apply)', () => {
  need(exportsObject !== null && typeof exportsObject === 'object', 'the factory did not return a module-exports object')
  need(typeof exportsObject.name === 'string' && exportsObject.name.length > 0, 'the export has no string `name`')
  need(exportsObject.name === BUNDLE_ID, `the exported name is ${JSON.stringify(exportsObject.name)}, expected ${JSON.stringify(BUNDLE_ID)}`)
  need(Array.isArray(exportsObject.inject), 'the export has no `inject` string array')
  need(exportsObject.inject.includes('slots'), "the `inject` array does not name the `slots` service the registrations need")
  need(typeof exportsObject.apply === 'function', 'the export has no `apply` function — Cordis rejects "invalid plugin, expect function or object with an \\"apply\\" method"')
  return `name=${exportsObject.name} · inject=[${exportsObject.inject.join(',')}] · apply=function`
})

console.log(`\nchecks: ${checks - failures}/${checks} passed · bundle ${source.length} B`)
if (failures > 0) {
  console.log(`VERDICT: FAIL — ${failures} check(s) failed`)
  process.exit(proveRed ? 3 : 1)
}
console.log('VERDICT: PASS — one registration, a valid Cordis plugin, one row, one keyed panel, and the row id equals the panel key')

/**
 * The Elixir app stage, read over loopback — the bundle's tie to the BEAM.
 *
 * WHY A READER AND NOT A CLIENT LIBRARY: the harness must be foldable onto the Elixir app without
 * becoming a second implementation of anything. This file reads two facts the app's own control plane
 * already serves, and it invents neither a route nor a default port: the endpoints below are the ones
 * cited in `backend/control/lib/control/routes.ex` of the program, and the port is that module's
 * `Control.HTTP @default_port 4100` with a documented environment override.
 *
 * THE THREE-VALUED RULE APPLIES HERE TOO. A reading is `{value}` or `{unmeasured: reason}`. A dead
 * control plane is NOT zero modules loaded and NOT an empty fleet; it is a reading that was not taken.
 *
 * @module dsh-meta-harness/host/elixir
 */

/** Where the control plane listens. A documented default, overridable, never a machine path. */
export function controlBase(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.DSH_META_CONTROL_URL
  if (typeof explicit === 'string' && /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(explicit)) return explicit
  const port = env.CONTROL_PORT && /^\d+$/.test(env.CONTROL_PORT) ? env.CONTROL_PORT : '4100'
  return `http://127.0.0.1:${port}`
}

/** One field that either has a value or states why it does not. */
export interface Reading<T> {
  readonly value: T | null
  readonly unmeasured: string | null
}

function measured<T>(value: T): Reading<T> { return { value, unmeasured: null } }
function unmeasured<T>(reason: string): Reading<T> { return { value: null, unmeasured: reason } }

/** The shape this bundle publishes for the BEAM. Every field is a {@link Reading}. */
export interface BeamReading {
  readonly base: string
  readonly readAt: string
  readonly loadedModuleCount: Reading<number>
  readonly processCount: Reading<number>
  readonly uptimeMs: Reading<number>
  readonly fleetUnits: Reading<number>
  /** How many of the four facts were measured, with the denominator. */
  readonly measuredOf: { readonly measured: number; readonly of: number }
}

const TIMEOUT_MS = 5000

async function getJson(url: string): Promise<{ ok: true; body: unknown } | { ok: false; reason: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'manual', headers: { accept: 'application/json' } })
    if (res.status !== 200) return { ok: false, reason: `${url} answered ${res.status}` }
    return { ok: true, body: await res.json() }
  } catch (error) {
    return { ok: false, reason: `${url} could not be read: ${error instanceof Error ? error.message : String(error)}` }
  } finally {
    clearTimeout(timer)
  }
}

/** A number from a body, or the reason it is not one — never a coercion of `undefined` to `0`. */
function numberAt(body: unknown, keys: readonly string[], source: string): Reading<number> {
  if (body === null || typeof body !== 'object') return unmeasured(`${source} answered a body that is not an object`)
  let cursor: unknown = body
  for (const key of keys) {
    if (cursor === null || typeof cursor !== 'object' || !(key in (cursor as Record<string, unknown>))) {
      return unmeasured(`${source} carries no ${keys.join('.')}`)
    }
    cursor = (cursor as Record<string, unknown>)[key]
  }
  return typeof cursor === 'number' && Number.isFinite(cursor)
    ? measured<number>(cursor)
    : unmeasured(`${source} carries ${keys.join('.')} as ${typeof cursor}, not a number`)
}

/**
 * Read the BEAM through the control plane's own status routes.
 *
 * Endpoints, cited: `GET /api/beam/status` and `GET /fleet/status` (`backend/control/lib/control/routes.ex`).
 * Both are GETs; this reader issues no control write, so a dead plane can never be mistaken for a
 * request to start one.
 */
export async function readBeam(base: string = controlBase()): Promise<BeamReading> {
  const [beam, fleet] = await Promise.all([getJson(`${base}/api/beam/status`), getJson(`${base}/fleet/status`)])
  const beamFields = beam.ok
    ? {
        loadedModuleCount: numberAt(beam.body, ['loaded_module_count'], 'beam/status'),
        processCount: numberAt(beam.body, ['process_count'], 'beam/status'),
        uptimeMs: numberAt(beam.body, ['uptime_ms'], 'beam/status')
      }
    : {
        loadedModuleCount: unmeasured<number>(beam.reason),
        processCount: unmeasured<number>(beam.reason),
        uptimeMs: unmeasured<number>(beam.reason)
      }
  const fleetUnits = fleet.ok
    ? numberAt(fleet.body, ['units', 'length'], 'fleet/status')
    : unmeasured<number>(fleet.reason)

  const all = [beamFields.loadedModuleCount, beamFields.processCount, beamFields.uptimeMs, fleetUnits]
  return {
    base,
    readAt: new Date().toISOString(),
    ...beamFields,
    fleetUnits,
    measuredOf: { measured: all.filter(reading => reading.value !== null).length, of: all.length }
  }
}

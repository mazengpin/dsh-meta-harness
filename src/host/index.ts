/**
 * ============================================================================
 * dsh-meta-harness — Host half
 * ============================================================================
 *
 * A BUNDLE (decision D-0460), not a tenth surface with its own opinions. It mounts ONE prefix
 * (`/meta-harness/api`) with three routes and reads the eight existing `dsh-meta-*` packages over
 * loopback, relaying what each member's own route answered. It re-implements no member capability,
 * so there is no second copy of a member's rule to drift against the first.
 *
 * THE THREE ROUTES, AND WHY THERE IS NO INDEX ROUTE
 *
 *   GET /meta-harness/api/status   the census of the bundle: per member, present + status + reason
 *   GET /meta-harness/api/members  the declared table itself, so the surface states its own scope
 *   GET /meta-harness/api/health   cheap liveness: this plugin answered, and the routes it serves
 *
 * An index route is deliberately absent: a prefix that answers its own bare path advertises a root
 * nobody asked for, and the 404 body is rendered FROM the route table so it cannot name a path the
 * table does not serve.
 *
 * ONLY `webServer` IS INJECTED. Nothing here reads a member's service in process: a member's LIVE
 * state is what its own route answers, and an in-process read would answer from a state the member's
 * actuator does not read.
 *
 * @module dsh-meta-harness/host
 */
import { readFileSync } from 'node:fs'
import { ROUTE_PATH, MEMBERS, ROUTES, censusOf, advertisedPaths } from '../shared/protocol.ts'
import type { HealthResponse, MembersResponse, StatusResponse } from '../shared/protocol.ts'
import { probeBaseFrom, readMembers } from './readings.ts'
import { controlBase, readBeam } from './elixir.ts'

/** Loader row name; the bundle patch mounts this package under `meta-harness`. */
export const name = 'dsh-meta-harness'

/**
 * Only the web server is required.
 *
 * Cordis gates service access on the plugin's DECLARED inject: `ctx.webServer` below is a service
 * read, and without this declaration the gate throws `cannot get property "webServer" without
 * inject` at real boot, leaving the row unactivated. `logger` is a runtime property, not a service,
 * and siblings read it without declaring it.
 */
export const inject = ['webServer']

/** The request surface this plugin reads. Declared structurally so no `node:http` type is needed. */
interface Req {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
}

/** The response surface it writes. */
interface Res {
  writeHead(status: number, headers: Record<string, string>): void
  end(body?: string): void
}

/** The subset of the host context this plugin uses. */
export interface HostContext {
  webServer: {
    register(route: {
      kind: 'prefix'
      path: string
      handler: (req: Req, res: Res) => void | Promise<void>
    }): void
  }
  logger: { info(message: string): void; warn(message: string): void }
  effect(fn: () => void): void
}

function json(res: Res, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': String(Buffer.byteLength(text)) })
  res.end(text)
}

function notFound(res: Res, pathname: string): void {
  json(res, 404, {
    ok: false,
    fused: 'dsh-meta-harness',
    error: 'unknown meta-harness route',
    path: pathname,
    prefix: ROUTE_PATH,
    advertised: advertisedPaths()
  })
}

/** This package's own version, read at request time so a rebuild is visible without a footnote. */
function ownVersion(): string | null {
  try {
    const raw = readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
    const parsed = JSON.parse(raw) as { version?: unknown }
    return typeof parsed.version === 'string' ? parsed.version : null
  } catch {
    return null
  }
}

function hostHeaderOf(req: Req): string | undefined {
  const raw = req.headers.host
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) return raw[0]
  return undefined
}

export function apply(ctx: HostContext): void {
  const handler = async (req: Req, res: Res): Promise<void> => {
    const method = (req.method ?? 'GET').toUpperCase()
    const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname
    if (!pathname.startsWith(ROUTE_PATH)) { notFound(res, pathname); return }
    const tail = pathname.slice(ROUTE_PATH.length).replace(/^\/+/, '')

    if (method !== 'GET') {
      json(res, 405, { ok: false, fused: 'dsh-meta-harness', error: 'method not allowed', path: pathname, declared: 'GET', advertised: advertisedPaths() })
      return
    }

    if (tail === '' || !ROUTES.some(route => route.tail === tail)) { notFound(res, pathname); return }

    if (tail === 'health') {
      const body: HealthResponse = {
        ok: true,
        name: 'dsh-meta-harness',
        version: ownVersion(),
        prefix: ROUTE_PATH,
        memberCount: MEMBERS.length,
        routes: ROUTES.map(route => `GET ${ROUTE_PATH}/${route.tail}`),
        probes: { ran: false, reason: 'health is cheap by design: no member is probed on this route' }
      }
      json(res, 200, body)
      return
    }

    if (tail === 'members') {
      const body: MembersResponse = { ok: true, prefix: ROUTE_PATH, members: MEMBERS }
      json(res, 200, body)
      return
    }

    if (tail === 'elixir') {
      const beam = await readBeam(controlBase())
      json(res, 200, { ok: true, prefix: ROUTE_PATH, ...beam })
      return
    }

    const base = probeBaseFrom(hostHeaderOf(req))
    const members = await readMembers(MEMBERS, base)
    const body: StatusResponse = {
      ok: true,
      prefix: ROUTE_PATH,
      censusAt: new Date().toISOString(),
      probeBase: base,
      census: censusOf(members),
      members
    }
    json(res, 200, body)
  }

  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: ROUTE_PATH, handler }))
  ctx.logger.info(`dsh-meta-harness: ${ROUTE_PATH} serves ${ROUTES.length} routes over ${MEMBERS.length} members`)
}

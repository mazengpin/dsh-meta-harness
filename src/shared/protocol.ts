/**
 * The wire contract shared by both halves of dsh-meta-harness — and the authority on
 * the member table, the route prefix, and the one id that is both a sidebar row id and
 * a keyed panel key.
 *
 * This module imports NOTHING: not a Node builtin, not `react`, not another plugin. The
 * browser bundle inlines it, so an import here would either leak a Node builtin into
 * the module-loader factory or add a module-table edge, and the client build's purity
 * gate rejects both.
 *
 * WHAT THIS PACKAGE IS, AND WHAT IT IS NOT
 *
 * It is a BUNDLE, authorised by decision D-0460. It COMPOSES the eight existing
 * `dsh-meta-*` packages and reports which are present, absent or unmeasured. It
 * re-implements NO member capability: it reads a member's own live route and relays the
 * answer, so there is no second copy of a member's rule to drift.
 *
 * WHY THE THREE-VALUED READING
 *
 * `present` is a filesystem fact about the member's package directory. `status` is what
 * that member's own route answered, and it is `number | null`. A member that could not be
 * reached is `status: null` WITH A `reason` — never `0` and never a `200`. A published
 * `0` from an instrument that could not see its subject is this program's most repeated
 * defect, and `0` is not an HTTP status at all, so the type is where the rule lives.
 *
 * @module dsh-meta-harness/shared/protocol
 */

/**
 * The prefix this plugin own routes are mounted under, WITHOUT a leading slash. The
 * Client resolves it against the page base (so the plugin keeps working behind a
 * reverse-proxy prefix); the Host adds the slash when it registers, because the web
 * server prefix table matches absolute pathnames.
 */
export const ROUTE_PREFIX = 'meta-harness/api'

/** The absolute pathname the Host registers the prefix route under. */
export const ROUTE_PATH = `/${ROUTE_PREFIX}`

/**
 * The ONE id used for BOTH the sidebar row and the keyed main panel.
 *
 * It is a single constant because a row id that differs from the panel key renders as a
 * row that opens nothing: the shell keys the panel it opens by the row's id, so two
 * spellings are two different seats and only one of them has a page behind it.
 */
export const PANEL_ID = 'dsh-meta-harness:harness'

/** The `sidebar.panellist` row id. The same value as {@link PANEL_ID}, deliberately. */
export const SIDEBAR_ID = 'dsh-meta-harness:harness'

/**
 * Position among the sidebar rows, ascending. The shipped Plugins row is 0, Automation
 * tasks is 10, `dsh-meta-context` is 12 and `dsh-context` own row is 20, so 14 seats
 * this hub beside the meta family without displacing a shipped or member row.
 */
export const SIDEBAR_ORDER = 14

/** The locale namespace both halves register under. */
export const LOCALE_NS = 'meta-harness'

/** One composed member of the bundle, with the facts needed to read it live. */
export interface MemberRef {
  /** The loader row name and the package name. */
  readonly name: string
  /** The package directory name under `plugins-src/`. */
  readonly clone: string
  /** The member own route path to probe, absolute, or `null` when it owns no route. */
  readonly probePath: string | null
  /** One line on what the member is, so a reader knows the bundle scope. */
  readonly role: string
}

/**
 * THE MEMBER TABLE. Eight rows, and the count is a fact rather than a target.
 *
 * Every row is an EXISTING clone under `plugins-src/`; nothing here is a planned or
 * future package. The `probePath` values are read from each member own source and are
 * named in the README beside the file they were taken from.
 */
export const MEMBERS: readonly MemberRef[] = [
  { name: 'dsh-meta-community', clone: 'dsh-meta-community', probePath: '/meta-community/api', role: 'Community surface: catalogue and identity routes.' },
  { name: 'dsh-meta-context', clone: 'dsh-meta-context', probePath: '/meta-context/api', role: 'Fused context surface: one prefix over the context family.' },
  { name: 'dsh-meta-evolve', clone: 'dsh-meta-evolve', probePath: '/meta-evolve/api/state', role: 'Evolution rounds and composed state.' },
  { name: 'dsh-meta-intent', clone: 'dsh-meta-intent', probePath: '/meta-intent/api', role: 'Intent map surface.' },
  { name: 'dsh-meta-market', clone: 'dsh-meta-market', probePath: '/meta-market/api', role: 'Market pre-seed surface.' },
  { name: 'dsh-meta-memory', clone: 'dsh-meta-memory', probePath: '/meta-memory', role: 'Memory surface.' },
  { name: 'dsh-meta-research', clone: 'dsh-meta-research', probePath: '/meta-research/api', role: 'Research surface.' },
  { name: 'dsh-meta-skills', clone: 'dsh-meta-skills', probePath: '/meta-skills', role: 'Tools and skills surface.' },
]

/**
 * One member reading.
 *
 * The three fields the bundle promises are `present`, `status` and `reason`. `status`
 * is `number | null`, and `null` ALWAYS comes with a `reason`; `0` is never a status,
 * because `0` is not an HTTP status and reads as a measurement that was not taken.
 */
export interface MemberReading {
  /** The loader row name and the package name. */
  readonly name: string
  /** The package directory name under `plugins-src/`. */
  readonly clone: string
  /** The version its `package.json` declares, or `null` when it could not be read. */
  readonly version: string | null
  /** Whether the package directory is on disk. A filesystem fact, not a probe. */
  readonly present: boolean
  /** What the member own route answered, or `null` when it did not answer. */
  readonly status: number | null
  /** Why a reading is partial or absent. `null` only when `status` is 200. */
  readonly reason: string | null
}

/** The counts taken over one round of readings, each with its denominator implied by `total`. */
export interface Census {
  /** Every member in the table. */
  readonly total: number
  /** Members whose package directory is on disk. */
  readonly present: number
  /** Members whose package directory is NOT on disk. */
  readonly absent: number
  /** Members whose own route answered 200. */
  readonly answered200: number
  /** Members with `status: null` — the unmeasured ones. Never folded into `absent`. */
  readonly unmeasured: number
}

/** The body of `GET /meta-harness/api/status`. */
export interface StatusResponse {
  /** The bundle answered. This is the harness health, NOT the health of its members. */
  readonly ok: boolean
  /** The route prefix this body came from. */
  readonly prefix: string
  /** ISO-8601 stamp of the census. */
  readonly censusAt: string
  /** The authority the member probes were addressed to, or `null` when the request carried none. */
  readonly probeBase: string | null
  /** The counts, over {@link MEMBERS}. */
  readonly census: Census
  /** One reading per member, in table order. */
  readonly members: readonly MemberReading[]
}

/** The body of `GET /meta-harness/api/members` — the table itself, with no live reads. */
export interface MembersResponse {
  /** The bundle answered. */
  readonly ok: boolean
  /** The route prefix this body came from. */
  readonly prefix: string
  /** The composed members declared by {@link MEMBERS}. */
  readonly members: readonly MemberRef[]
}

/** The body of `GET /meta-harness/api/health` — cheap, and it runs no member probe. */
export interface HealthResponse {
  /** The bundle answered. */
  readonly ok: boolean
  /** The package name. */
  readonly name: string
  /** The bundle version, read from its own `package.json` at request time. */
  readonly version: string | null
  /** The route prefix this body came from. */
  readonly prefix: string
  /** How many members the table declares. A count, not a health verdict. */
  readonly memberCount: number
  /** The routes this prefix serves, so the surface describes itself. */
  readonly routes: readonly string[]
  /** The probe status OF THIS ROUTE, stated rather than implied. */
  readonly probes: { readonly ran: boolean; readonly reason: string | null }
}

/** One row of the route table, rendered into the 404 body from this same table. */
export interface RouteSpec {
  /** The pathname tail under the prefix, without slashes. */
  readonly tail: string
  /** The accepted method. */
  readonly method: 'GET'
  /** One line on what it serves. */
  readonly summary: string
}

/**
 * Every route this prefix serves. Three rows, and there is no index route: a surface
 * that answers an empty tail advertises a root the brief did not ask for.
 *
 * The 404 body is rendered FROM this table, because a hand-written 404 once advertised
 * a path the dispatch table could not reach — the one place whose job is to be
 * authoritative was the one place that was wrong.
 */
export const ROUTES: readonly RouteSpec[] = [
  { tail: 'status', method: 'GET', summary: 'Bundle census: every member, its version, whether it is present, and what its route answered.' },
  { tail: 'members', method: 'GET', summary: 'The composed member table itself, with no live reads.' },
  { tail: 'health', method: 'GET', summary: 'This bundle own health. Cheap, and it probes no member.' },
  { tail: 'elixir', method: 'GET', summary: 'The Elixir app stage read over loopback: loaded modules, processes, uptime and fleet units, each either a value or the reason it is unmeasured.' },
]

/** Every path this prefix advertises, derived in one place so a listing cannot drift. */
export function advertisedPaths(): readonly string[] {
  return ROUTES.map(route => `${ROUTE_PATH}/${route.tail}`)
}

/**
 * Count the readings.
 * @param readings - one reading per member, in table order.
 * @returns the census; every count has `total` as its denominator.
 */
export function censusOf(readings: readonly MemberReading[]): Census {
  let present = 0
  let answered200 = 0
  let unmeasured = 0
  for (const reading of readings) {
    if (reading.present) present += 1
    if (reading.status === 200) answered200 += 1
    if (reading.status === null) unmeasured += 1
  }
  return { total: readings.length, present, absent: readings.length - present, answered200, unmeasured }
}
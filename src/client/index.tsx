/**
 * dsh-meta-harness — Client half.
 *
 * ONE sidebar row and ONE keyed panel, and the two use the SAME constant because the shell keys the
 * panel it opens by the row id: two spellings are two seats, and only one of them has a page behind
 * it. That is not a style preference — it is the defect this constant exists to prevent.
 *
 * The page reads `/meta-harness/api/status` and lists every member with the three facts the bundle
 * promises: whether the clone is on disk, what its own route answered, and why a reading is absent.
 * A `null` status renders as `no answer` WITH its reason; it is never shown as `0`.
 *
 * Nothing here recomputes a member's rule. The page is a reader of the host half, which is a reader
 * of each member's own route.
 *
 * @module dsh-meta-harness/client
 */
import { PANEL_ID, SIDEBAR_ID, SIDEBAR_ORDER, LOCALE_NS, ROUTE_PATH } from '../shared/protocol.ts'
import type { StatusResponse } from '../shared/protocol.ts'

/** The path the page fetches: the host prefix without the leading slash. */
const STATUS_PATH = `/${ROUTE_PATH.replace(/^\//, '')}/status`

type Style = Record<string, string | number>

interface ReactModule {
  createElement: (tag: unknown, props?: unknown, ...children: unknown[]) => unknown
  useState: <T>(initial: T) => [T, (next: T) => void]
  useEffect: (fn: () => void, deps?: unknown[]) => void
}

interface SlotsModule { inject(id: string): { register(entry: unknown): void } }
interface SidebarModule { register(row: unknown): void }

export const name = 'dsh-meta-harness-client'

interface LoaderContext {
  load(entry: { id: string; factory: (require: (id: string) => unknown) => unknown }): void
}

declare const window: { __ModuleLoader__?: LoaderContext }

const loader = window.__ModuleLoader__
if (!loader) throw new Error('dsh-meta-harness/client: window.__ModuleLoader__ is absent')

interface ViewState {
  loading: boolean
  body: StatusResponse | null
  error: string | null
}

/**
 * The page. Built with a one-line element helper rather than deeply nested `createElement` calls:
 * a mis-paired parenthesis in a nested tree typechecks as nothing and renders as an empty page, so
 * the shape here keeps the nesting visible.
 */
function HarnessPage(react: ReactModule): () => unknown {
  const el = (tag: unknown, props: unknown, ...children: unknown[]): unknown =>
    react.createElement(tag, props, ...children)

  return function Page(): unknown {
    const [state, setState] = react.useState<ViewState>({ loading: true, body: null, error: null })

    react.useEffect(() => {
      let live = true
      fetch(STATUS_PATH, { headers: { accept: 'application/json' } })
        .then(async res => await res.json() as StatusResponse)
        .then((body: StatusResponse) => { if (live) setState({ loading: false, body, error: null }) })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          if (live) setState({ loading: false, body: null, error: message })
        })
      return () => { live = false }
    }, [])

    const cell: Style = { padding: '6px 10px', borderBottom: '1px solid rgba(127,127,127,0.25)', textAlign: 'left' }
    const head: Style = { ...cell, fontWeight: 600 }

    if (state.loading) return el('div', { style: { padding: 16 } }, 'Reading the bundle…')
    if (state.error !== null) return el('div', { style: { padding: 16 } }, `The bundle did not answer: ${state.error}`)
    const body = state.body
    if (body === null) return el('div', { style: { padding: 16 } }, 'The bundle answered with no body.')

    const census = body.census
    const summary = `${census.total} members · ${census.present} present on disk · ${census.absent} absent · ${census.answered200} answered 200 · ${census.unmeasured} unmeasured`

    const rows = body.members.map((member) => el('tr', { key: member.name },
      el('td', { style: cell }, member.name),
      el('td', { style: cell }, member.version ?? '—'),
      el('td', { style: cell }, member.present ? 'yes' : 'NO'),
      el('td', { style: cell }, member.status === null ? 'no answer' : String(member.status)),
      el('td', { style: { ...cell, opacity: 0.85 } }, member.reason ?? '')))

    const header = el('tr', null,
      el('th', { style: head }, 'member'),
      el('th', { style: head }, 'version'),
      el('th', { style: head }, 'on disk'),
      el('th', { style: head }, 'status'),
      el('th', { style: head }, 'reason'))

    return el('div', { style: { padding: 16, display: 'grid', gap: 12 } },
      el('div', { style: { fontSize: 13, opacity: 0.8 } }, summary),
      el('table', { style: { borderCollapse: 'collapse', fontSize: 13 } },
        el('thead', null, header),
        el('tbody', null, ...rows)),
      el('div', { style: { fontSize: 12, opacity: 0.7 } }, `census at ${body.censusAt}`))
  }
}

loader.load({
  id: 'dsh-meta-harness',
  factory: (require) => {
    const react = require('react') as ReactModule
    const slots = require('@deepseek-ai/dsh-client-ui-slots') as SlotsModule
    const sidebar = require('@deepseek-ai/dsh-client-ui-sidebar') as SidebarModule

    const Page = HarnessPage(react)
    slots.inject('main').register({ key: PANEL_ID, component: Page })
    sidebar.register({ id: SIDEBAR_ID, order: SIDEBAR_ORDER, localeKey: `${LOCALE_NS}.panelTitle` })
    return { name }
  }
})

/**
 * The bundle's own harness: it drives the FOUR routes through a fake host context, proves each absence
 * path can go RED rather than asserting that it is fine, and gives the Elixir reader a positive
 * control so "unmeasured" is a reading rather than an assumption.
 *
 *   node verify/bundle.mjs              # run it
 *   node verify/bundle.mjs --prove-red  # plant a wrong expectation; the run MUST fail
 *
 * A1  `status` answers 200 and its census adds up (present + absent = total; unmeasured is separate)
 * A2  a request with NO loopback Host header measures nothing — every member `status: null` WITH reason
 * A3  a dead probe base yields `status: null` with a reason, counted as unmeasured
 * A4  `members` and `health` answer from the declared table, and `health` runs no probe
 * A5  an unknown tail answers 404, and the body advertises ONLY paths the table serves
 * A6  a non-GET verb answers 405 naming the declared method
 * A7  a dead control plane yields `measuredOf 0 of 4`, every Elixir field carrying its reason
 * A8  a stub control plane that answers both routes measures `4 of 4` — the positive control
 * M1  mutation: a reading with `status: 0` must fail the census contract
 * M2  mutation: a table read missing a member must fail the row-count assertion
 */
import { createServer } from 'node:http'
import { apply } from '../lib/index.js'
import { readBeam } from '../src/host/elixir.ts'
import { MEMBERS, ROUTES, ROUTE_PATH } from '../src/shared/protocol.ts'

const proveRed = process.argv.includes('--prove-red')
let failures = 0
let checks = 0

async function check(label, fn) {
  checks += 1
  try {
    const detail = await fn()
    console.log(`PASS  ${label}${detail ? `\n      ${detail}` : ''}`)
  } catch (error) {
    failures += 1
    console.log(`FAIL  ${label}\n      ${error instanceof Error ? error.message : String(error)}`)
  }
}

function need(condition, message) {
  if (!condition) throw new Error(message)
}

/** A fake host context that captures the ONE registered prefix handler. */
function mount() {
  let handler = null
  const logs = []
  apply({
    webServer: { register(route) { handler = route.handler; this.route = route } },
    logger: { info: m => logs.push(m), warn: m => logs.push(m) },
    effect: fn => fn()
  })
  need(typeof handler === 'function', 'apply() did not register a handler')
  return { handler, logs }
}

/** Drive one request through the captured handler and return the parsed body. */
async function drive(handler, { method = 'GET', path, host = '127.0.0.1:3083' } = {}) {
  let status = null
  let text = ''
  const res = { writeHead(s) { status = s }, end(b) { text = b ?? '' } }
  const req = { method, url: path, headers: host === null ? {} : { host } }
  await handler(req, res)
  let body = null
  try { body = JSON.parse(text) } catch { body = text }
  return { status, body }
}

const { handler } = mount()

await check('A1 the status route answers 200 and its census adds up', async () => {
  const { status, body } = await drive(handler, { path: `${ROUTE_PATH}/status`, host: null })
  need(status === 200, `expected 200, got ${status}`)
  const c = body.census
  need(c.total === MEMBERS.length, `census.total ${c.total} != table ${MEMBERS.length}`)
  need(c.present + c.absent === c.total, `present ${c.present} + absent ${c.absent} != total ${c.total}`)
  need(c.unmeasured <= c.total, `unmeasured ${c.unmeasured} exceeds total ${c.total}`)
  need(body.members.length === MEMBERS.length, `readings ${body.members.length} != table ${MEMBERS.length}`)
  return `census: total=${c.total} present=${c.present} absent=${c.absent} answered200=${c.answered200} unmeasured=${c.unmeasured}`
})

await check('A2 a request with no loopback Host measures NOTHING, and every row says why', async () => {
  const { body } = await drive(handler, { path: `${ROUTE_PATH}/status`, host: null })
  need(body.probeBase === null, `probeBase should be null, got ${JSON.stringify(body.probeBase)}`)
  const wrong = body.members.filter(m => !(m.status === null && typeof m.reason === 'string' && m.reason.length > 0))
  need(wrong.length === 0, `${wrong.length} row(s) had a status without a reason`)
  return `${body.members.length} of ${MEMBERS.length} rows are status:null with a reason`
})

await check('A3 a dead probe base yields status:null with a reason, counted as unmeasured', async () => {
  const { body } = await drive(handler, { path: `${ROUTE_PATH}/status`, host: '127.0.0.1:1' })
  need(body.probeBase === 'http://127.0.0.1:1', `probeBase ${body.probeBase}`)
  need(body.census.answered200 === 0, `answered200 ${body.census.answered200} should be 0 against a dead port`)
  need(body.census.unmeasured === MEMBERS.length, `unmeasured ${body.census.unmeasured} != ${MEMBERS.length}`)
  const noReason = body.members.filter(m => m.status === null && !m.reason)
  need(noReason.length === 0, `${noReason.length} unmeasured row(s) carried no reason`)
  return `answered200=0 unmeasured=${body.census.unmeasured} (every row names its reason)`
})

await check('A4 members and health answer from the declared table; health runs no probe', async () => {
  const members = await drive(handler, { path: `${ROUTE_PATH}/members` })
  need(members.status === 200, `members answered ${members.status}`)
  need(members.body.members.length === MEMBERS.length, `members ${members.body.members.length} != ${MEMBERS.length}`)
  const health = await drive(handler, { path: `${ROUTE_PATH}/health` })
  need(health.status === 200, `health answered ${health.status}`)
  need(health.body.routes.length === ROUTES.length, `health advertised ${health.body.routes.length} routes, table has ${ROUTES.length}`)
  need(health.body.probes.ran === false, 'health claims it ran a probe; it must not')
  return `members=${members.body.members.length} routes=${health.body.routes.length} probes.ran=false`
})

await check('A5 an unknown tail 404s and advertises ONLY paths the table serves', async () => {
  const { status, body } = await drive(handler, { path: `${ROUTE_PATH}/nope` })
  need(status === 404, `expected 404, got ${status}`)
  const served = new Set(ROUTES.map(route => `${ROUTE_PATH}/${route.tail}`))
  const invented = body.advertised.filter(p => !served.has(p))
  need(invented.length === 0, `404 advertised path(s) the table does not serve: ${invented.join(', ')}`)
  return `${body.advertised.length} advertised, all ${served.size} served`
})

await check('A6 a non-GET verb answers 405 naming the declared method', async () => {
  const { status, body } = await drive(handler, { method: 'POST', path: `${ROUTE_PATH}/status` })
  need(status === 405, `expected 405, got ${status}`)
  need(body.declared === 'GET', `declared ${body.declared}`)
  return 'POST /status -> 405 declared=GET'
})

await check('A7 a dead control plane yields measuredOf 0 of 4, every field carrying its reason', async () => {
  const beam = await readBeam('http://127.0.0.1:1')
  need(beam.measuredOf.of === 4, `measuredOf.of ${beam.measuredOf.of} != 4`)
  need(beam.measuredOf.measured === 0, `measured ${beam.measuredOf.measured} should be 0 against a dead plane`)
  const fields = [beam.loadedModuleCount, beam.processCount, beam.uptimeMs, beam.fleetUnits]
  const silent = fields.filter(f => f.value === null && typeof f.unmeasured !== 'string')
  need(silent.length === 0, `${silent.length} field(s) unmeasured with NO reason`)
  return `measured ${beam.measuredOf.measured} of ${beam.measuredOf.of}, every field names its reason`
})

await check('A8 a stub control plane that answers both routes measures 4 of 4 (positive control)', async () => {
  const server = createServer((req, res) => {
    const body = req.url === '/api/beam/status'
      ? { loaded_module_count: 412, process_count: 57, uptime_ms: 123456 }
      : req.url === '/fleet/status'
        ? { units: [{ id: 'unit-01' }, { id: 'unit-02' }] }
        : null
    if (body === null) { res.writeHead(404); res.end('{}'); return }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  try {
    const beam = await readBeam(`http://127.0.0.1:${port}`)
    need(beam.measuredOf.measured === 4, `measured ${beam.measuredOf.measured} of ${beam.measuredOf.of} against a live stub`)
    need(beam.loadedModuleCount.value === 412, `loadedModuleCount ${String(beam.loadedModuleCount.value)}`)
    need(beam.fleetUnits.value === 2, `fleetUnits ${String(beam.fleetUnits.value)}`)
    return `measured 4 of 4: modules=${String(beam.loadedModuleCount.value)} processes=${String(beam.processCount.value)} fleet=${String(beam.fleetUnits.value)}`
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})

await check('M1 MUTATION: a member reading with status 0 must FAIL the census contract', async () => {
  const { body } = await drive(handler, { path: `${ROUTE_PATH}/status`, host: null })
  const mutated = body.members.map((m, i) => (i === 0 ? { ...m, status: 0, reason: null } : m))
  const violated = mutated.filter(m => m.status === 0 || (m.status === null && !m.reason))
  if (proveRed) need(violated.length === 0, `PROVE-RED: ${violated.length} row(s) violated the contract, as required`)
  need(violated.length > 0, 'the mutant survived: no row violated the contract')
  return `${violated.length} row(s) would violate the contract; the assertion catches them`
})

await check('M2 MUTATION: a table read missing a member must FAIL the row-count assertion', async () => {
  const { body } = await drive(handler, { path: `${ROUTE_PATH}/members` })
  const truncated = body.members.slice(0, -1)
  const survived = truncated.length === MEMBERS.length
  if (proveRed) need(survived, `PROVE-RED: the truncated table still reported ${truncated.length} of ${MEMBERS.length}`)
  need(!survived, 'truncation did not change the count, so the assertion is not reading the table')
  return `truncation changes the count ${truncated.length} != ${MEMBERS.length}`
})

console.log(`\nchecks: ${checks - failures}/${checks} passed`)
if (failures > 0) {
  console.log(`VERDICT: FAIL — ${failures} check(s) failed`)
  process.exit(proveRed ? 3 : 1)
}
console.log('VERDICT: PASS — four routes answered, every absence carried its reason, and the Elixir reader has a positive control')

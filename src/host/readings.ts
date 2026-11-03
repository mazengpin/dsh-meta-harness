/**
 * The composing read: one probe per member, and three states kept apart.
 *
 * A member reading is a filesystem fact PLUS a live answer. The filesystem fact is `present`;
 * the live answer is `status`, which is `number | null`. `null` always carries a `reason`, and
 * `0` is never a status — `0` is not an HTTP status, so a published `0` reads as a measurement
 * that was never taken. `absent` and `unmeasured` are separate counts in the census for the same
 * reason: a package that is not on disk and a package that is on disk but did not answer are
 * different findings, and folding them together turns the second into the first.
 *
 * @module dsh-meta-harness/host/readings
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MemberReading, MemberRef } from '../shared/protocol.ts'

/** Where the clones live, resolved rather than hard-coded, so the read works off this machine too. */
export function pluginsRoot(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.DSH_META_PLUGINS_SRC) return env.DSH_META_PLUGINS_SRC
  const programRoot = env.DSH_META_PROGRAM_ROOT
  if (programRoot) return join(programRoot, 'plugins-src')
  // THIRD RULE, and the one that makes `census.present` a measurement rather than a zero: this file
  // lives at `<plugins-src>/<package>/src/host/readings.ts`, so three directories up from its own URL
  // IS the clones directory. Computed from `import.meta.url`, never from a literal path — a literal
  // would be right on one machine and a published home directory everywhere else.
  try {
    const here = fileURLToPath(import.meta.url)
    return join(dirname(here), '..', '..')
  } catch {
    return null
  }
}

/** The version declared by a member's own `package.json`, or `null` with no guess made. */
function readVersion(root: string | null, clone: string): string | null {
  if (root === null) return null
  try {
    const raw = readFileSync(join(root, clone, 'package.json'), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object' && typeof (parsed as { version?: unknown }).version === 'string') {
      return (parsed as { version: string }).version
    }
    return null
  } catch {
    return null
  }
}

/** Whether the clone directory exists at all — a filesystem fact, not a probe. */
function readPresent(root: string | null, clone: string): boolean {
  if (root === null) return false
  try {
    readFileSync(join(root, clone, 'package.json'), 'utf8')
    return true
  } catch {
    return false
  }
}

/**
 * THE PROBE BASE, derived from the incoming request rather than configured.
 *
 * The bundle must address the SAME server it is answering on: a configured port would be wrong the
 * moment the profile binds elsewhere, and an absolute path would name one machine. `null` means the
 * request carried no Host header, and then every member is unmeasured WITH that reason — never
 * probed against a guess.
 */
export function probeBaseFrom(hostHeader: string | undefined): string | null {
  if (typeof hostHeader !== 'string' || hostHeader.length === 0) return null
  // A loopback authority only: a member is a local plugin, and a Host header is caller-controlled.
  const host = hostHeader.split(':')[0]?.toLowerCase() ?? ''
  const port = hostHeader.includes(':') ? hostHeader.slice(hostHeader.lastIndexOf(':') + 1) : '80'
  const loopback = host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '0.0.0.0'
  if (!loopback || !/^\d+$/.test(port)) return null
  return `http://127.0.0.1:${port}`
}

/** One bounded read. A timeout, a refused connection and a 4xx/5xx are three different reasons. */
async function probe(url: string, timeoutMs: number): Promise<{ status: number | null; reason: string | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'manual' })
    await res.text()
    return res.status === 200
      ? { status: 200, reason: null }
      : { status: res.status, reason: `the member answered ${res.status} at ${url}` }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { status: null, reason: `the member could not be reached at ${url}: ${message}` }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Read every member of the table. `base === null` is not an error: it is an unmeasured round, and
 * every row says so, because a round that could not address the server has measured nothing.
 */
export async function readMembers(
  members: readonly MemberRef[],
  base: string | null,
  options: { root?: string | null; timeoutMs?: number } = {}
): Promise<MemberReading[]> {
  const root = options.root !== undefined ? options.root : pluginsRoot()
  const timeoutMs = options.timeoutMs ?? 8000
  const readings: MemberReading[] = []
  for (const member of members) {
    const present = readPresent(root, member.clone)
    const version = readVersion(root, member.clone)
    if (base === null) {
      readings.push({ name: member.name, clone: member.clone, version, present, status: null, reason: 'the request carried no loopback Host header, so no member could be addressed' })
      continue
    }
    if (member.probePath === null) {
      readings.push({ name: member.name, clone: member.clone, version, present, status: null, reason: 'this member owns no route of its own to probe' })
      continue
    }
    const { status, reason } = await probe(`${base}${member.probePath}`, timeoutMs)
    readings.push({ name: member.name, clone: member.clone, version, present, status, reason })
  }
  return readings
}

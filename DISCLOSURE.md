# DISCLOSURE — dsh-meta-harness

## 1. What this package is
A bundle: one route prefix (`/meta-harness/api`) and one keyed sidebar entry that compose the eight existing `dsh-meta-*` packages. It re-implements no member capability and edits no member file.

## 2. Why a bundle belongs in the ecosystem
Eight `dsh-meta-*` packages answer eight route prefixes, so the set is eight separate things a user must discover before they can tell what is loaded. A bundle that reports **present / absent / unmeasured** makes the set one thing: one prefix, one sidebar entry, one census that names every member. It does this without re-implementing any member, because every reading is a relay of that member's own route rather than a second encoding of that member's rule. What the bundle adds is discoverability and an absence that cannot be mistaken for an empty answer — not a capability the members lack.

## 3. What it does today, with the evidence
`pnpm run verify` → **18 checks pass** (12 in `verify/bundle.mjs`, 6 in `verify/client-bundle.cjs`; measured 2026-11-03, the earlier `14 / 10 + 4` figure was stale against the harnesses on disk). It drives the four routes through a fake host context and prints, in the same run: `census: total=8 present=8 absent=0 answered200=0 unmeasured=8` for a request with no `Host` header, and `answered200=0 unmeasured=8` against a dead port with every row naming its reason. `node verify/bundle.mjs --prove-red` exits **3**, which is the proof the harness can disagree with itself.

## 4. What it does NOT do
It does not merge, replace or shadow a member's route, panel or service. It does not read a member's in-process service — a member's live state is what its own route answers. It does not cache: every `status` request probes the members again. It does not authenticate: the routes are as public as the host web server they sit on.

## 5. Data it reads and writes
Reads: each member's `package.json` (name, version) and its own route over loopback, at the authority carried by the request's `Host` header. Writes: **NONE**. It has no store, no cache file and no log file of its own.

## 6. Network
Inbound: one prefix on the host web server. Outbound: HTTP to **loopback only**, addressed from the request's own `Host` authority and refused when that authority is not loopback. Outbound to the Elixir control plane is a read of `GET /api/beam/status` and `GET /fleet/status`; no control write is issued. No outbound connection to any other host, no model call, and no device access of any kind.

## 7. Security posture
Encrypted: **NONE**. Signed: **NONE**. Access control on the routes: **NONE** — the host web server has none, so a caller who can reach the port can read the census. What the census exposes is member presence, version and route status, which is already visible to anyone who can reach those routes directly.

## 8. Licence and engines
MIT. `engines`: `node ^22.19.0 || >=24.0.0`, `dsh >=0.2.2-0 <0.3.0`. The `dsh` peer range is the version this package was built and driven against.

## 9. State
**SOURCE PREVIEW — information-providing only.** Readable and reviewable today; NOT installable from source. Install arrives with the published pre-release tarball on the `next` dist-tag.

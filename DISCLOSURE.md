# DISCLOSURE — dsh-meta-harness

## 1. What this package is
A bundle: one route prefix (`/meta-harness/api`) and one keyed sidebar entry that compose the eight existing `dsh-meta-*` packages. It re-implements no member capability and edits no member file.

## 2. What it does today, with the evidence
`node verify/bundle.mjs` → **8 of 8 checks pass**. It drives the three routes through a fake host context and prints, in the same run: `census: total=8 present=8 absent=0 answered200=0 unmeasured=8` for a request with no `Host` header, and `answered200=0 unmeasured=8` against a dead port with every row naming its reason. `node verify/bundle.mjs --prove-red` exits **3**, which is the proof the harness can disagree with itself.

## 3. What it does NOT do
It does not merge, replace or shadow a member's route, panel or service. It does not read a member's in-process service — a member's live state is what its own route answers. It does not cache: every `status` request probes the members again. It does not authenticate: the routes are as public as the host web server they sit on.

## 4. Data it reads and writes
Reads: each member's `package.json` (name, version) and its own route over loopback, at the authority carried by the request's `Host` header. Writes: **NONE**. It has no store, no cache file and no log file of its own.

## 5. Network
Inbound: one prefix on the host web server. Outbound: HTTP to **loopback only**, addressed from the request's own `Host` authority and refused when that authority is not loopback. No outbound connection to any other host, no model call, and no device access of any kind.

## 6. Security posture
Encrypted: **NONE**. Signed: **NONE**. Access control on the routes: **NONE** — the host web server has none, so a caller who can reach the port can read the census. What the census exposes is member presence, version and route status, which is already visible to anyone who can reach those routes directly.

## 7. Licence and engines
MIT. `engines`: `node ^22.19.0 || >=24.0.0`, `dsh >=0.2.2-0 <0.3.0`. The `dsh` peer range is the version this package was built and driven against.

## 8. State
**SOURCE PREVIEW — information-providing only.** Readable and reviewable today; NOT installable from source. Install arrives with the published pre-release tarball on the `next` dist-tag.

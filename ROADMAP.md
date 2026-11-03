# ROADMAP — dsh-meta-harness

Every row names the command that checks it, so no row here is a claim a reader has to take on trust. **This roadmap is what [`research.md`](research.md) tests:** that file carries the research question, the measurements that answer it, and the parts that are still NOT MEASURED — so a row marked done is done because a listed check passed, not because it was written down.

## Done
- Elixir reader: `GET /meta-harness/api/elixir` reads the control plane beam and fleet status, and each field is a value or its reason. CHECK: `node verify/bundle.mjs` → `A7` prints `measured 0 of 4, every field names its reason` against a dead port, and `A8` prints `measured 4 of 4` against a stub that answers both routes.
- Host half: four routes under `/meta-harness/api` (`status`, `members`, `health`, `elixir`), with a 404 rendered from the route table. CHECK: `node verify/bundle.mjs` → `A1`..`A6` pass, including `A5` (`4 advertised, all 4 served`) and `A6` (`POST /status -> 405 declared=GET`).
- Client half: one sidebar row and one keyed panel sharing ONE id constant. CHECK: `node verify/client-bundle.cjs` → `C1` (`sidebar=1 panels=1`) and `C2` (`row id === panel key === dsh-meta-harness:harness`).
- Harness: `verify/bundle.mjs` and `verify/client-bundle.cjs`. CHECK: `node verify/bundle.mjs` → `checks: 12/12 passed`; `node verify/client-bundle.cjs` → `checks: 6/6 passed`; `node verify/bundle.mjs --prove-red` → **exit 3**, so the harness is proven able to go red. The earlier `8 of 8` figure on this row was stale against the harnesses on disk.
- One declared member table of eight members, so the surface states its own scope. CHECK: `node verify/bundle.mjs` → `A4` prints `members=8 routes=4 probes.ran=false`, and `M2` prints `truncation changes the count 7 != 8`.

## Not yet measured
- A LIVE mount in a profile: the plugin has never been booted, so no route of this package has answered on a running host. CHECK when it is done: `GET /meta-harness/api/health` answers 200 on a booted profile. Today: **NOT MEASURED**, never booted.
- A real member census against a running profile: `answered200` is 0 in the harness because the harness serves no members. CHECK when it is done: `GET /meta-harness/api/status` names at least one member with `status: 200` and its version. Today: **NOT MEASURED**, no profile serves these members.

## 1.0.0 requires
- One real boot with the package in `dsh.profile.bundles`. CHECK: `GET /meta-harness/api/status` answers 200 and each of the eight rows carries either that member's live status or a reason it is unmeasured.
- A falsifier that a member going down moves its row from `answered200` to `unmeasured` with a reason rather than to `absent`. CHECK: stop one member on the booted profile, re-read `status`, and confirm the row's `present` stays true while its status becomes `null` with a reason, and the census counts it under `unmeasured`, not `absent`.

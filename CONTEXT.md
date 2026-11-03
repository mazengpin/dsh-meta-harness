# CONTEXT — dsh-meta-harness

## The problem
Eight `dsh-meta-*` packages each answer their own route prefix, and a reader has no single place that says which of them is actually loaded in the profile in front of them. The failure this causes is specific: a panel that renders an empty list looks identical whether the member answered "nothing" or the member never mounted.

## The context, and the constraint that shaped it
It is a BUNDLE, authorised by decision `D-0460`, built beside the eight packages it composes and released with the Elixir app stage. The constraint is that a bundle must not become a second implementation: if it re-derived a member's rule, the day the member changed there would be two answers and no way to tell which one was governing. So every reading is a relay of that member's own route, and the only thing this package owns is the table and the three states.

## The intent, and what was deliberately not attempted
Intent: one surface that answers "which members are here, and what did each say". Not attempted: merging member panels, proxying member bodies, caching, authentication, and any control action over a member — a control that only relabels a reading is not a control.

## Alternatives rejected
**Re-derive each member's answer in this package** — rejected: two encodings of one fact drift, and the drift is invisible until they disagree.
**Read members in process instead of over HTTP** — rejected: an in-process read answers from a state the member's actuator may not be reading, and it would import member internals into a bundle whose whole job is to stay outside them.
**A single flat `/status` with no member table** — rejected: without the table the surface cannot say what it did not probe, which is the absence this package exists to make visible.

## Recreate a working environment
1. `git clone <repo-url> dsh-meta-harness`
2. `cd dsh-meta-harness`
3. `pnpm install`
4. `pnpm run build`
5. `node verify/bundle.mjs`
6. `node verify/bundle.mjs --prove-red` (must exit non-zero)
7. Add the package to a profile as a relative link: `"dsh-meta-harness": "link:../../plugins-src/dsh-meta-harness"`
8. Add `"dsh-meta-harness"` to that profile's `dsh.profile.bundles`
9. `pnpm install` in the profile, then restart it — a newly added package is not seen until the next boot
10. `node -e "fetch('http://127.0.0.1:3083/meta-harness/api/health').then(r=>r.text()).then(console.log)"`

## What to read next
`DISCLOSURE.md` for the limits, `ROADMAP.md` for what 1.0.0 requires, and `src/host/readings.ts`, whose comments state the three-valued reading rule the whole package is shaped around.

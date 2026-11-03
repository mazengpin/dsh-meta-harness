# dsh-meta-harness

One route prefix and one sidebar entry that compose the eight `dsh-meta-*` packages and report which of them is present, absent or unmeasured.
It re-implements no member capability: every member reading is read from that member's own live route, so there is no second copy of a member's rule to drift against the first.

## What it serves

| Route | What it answers |
|---|---|
| `GET /meta-harness/api/status` | the bundle census — per member: present on disk, version, the status its own route answered, and the reason when it did not |
| `GET /meta-harness/api/members` | the declared member table, so the surface states its own scope |
| `GET /meta-harness/api/health` | cheap liveness, naming the routes this prefix serves; it runs no member probe |
| `GET /meta-harness/api/elixir` | the Elixir app stage over loopback: loaded modules, processes, uptime and fleet units, each a value or the reason it is unmeasured |

There is deliberately no index route: a prefix that answers its own bare path advertises a root nobody asked for, and the 404 body is rendered from the route table so it cannot name a path the table does not serve.

## The three-valued reading

`present` is a filesystem fact about the member's package directory. `status` is what that member's own route answered, and it is `number | null`. A member that could not be reached is `status: null` **with a reason** — never `0` and never a `200`, because `0` is not an HTTP status and reads as a measurement that was never taken. The census therefore counts `absent` and `unmeasured` separately: a package that is not on disk and a package that is on disk but silent are different findings.

## Adopting it inside DSH

A consumer installs the published pre-release only:

A deployment stages the **published pre-release** tarball from the `next` dist-tag. The package is also the one entry that brings the whole meta layer: enabling it in a profile bundle list enables the bundle, which then reports each member as present, absent or unmeasured.

A profile consumes a clone through a relative `link:` — an absolute path is not supported by this package or its siblings.

## Develop it

```
git clone <repo-url> dsh-meta-harness
cd dsh-meta-harness
pnpm install
pnpm run build
node verify/bundle.mjs
```

`verify/bundle.mjs` drives the four routes through a fake host context and asserts every absence path, including that a reading with `status: 0` breaks the census contract. `node verify/bundle.mjs --prove-red` plants the wrong expectation and must exit non-zero.

## Roadmap at a glance

The authoritative list is [`ROADMAP.md`](ROADMAP.md). Today the package ships the host half, the client half, and one harness that proves the three routes and their absence paths; a live mount in a profile is unmeasured here and stated as such.

## Licence

MIT.

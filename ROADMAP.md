# ROADMAP — dsh-meta-harness

## Done
- Host half: three routes under `/meta-harness/api` (`status`, `members`, `health`), with a 404 rendered from the route table.
- Client half: one sidebar row and one keyed panel sharing ONE id constant.
- `verify/bundle.mjs`: 8 of 8 checks, driving the three routes and every absence path; `--prove-red` exits 3.

## Not yet measured
- A LIVE mount in a profile: the plugin has not been booted, so no route of this package has answered on a running host.
- A real member census against a running profile: `answered200` is 0 in the harness because the harness serves no members.

## 1.0.0 requires
- One real boot with the package in `dsh.profile.bundles`, showing `status` naming each member's live answer.
- A falsifier that a member going down moves its row from `answered200` to `unmeasured` with a reason rather than to `absent`.

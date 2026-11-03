import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
/** The absolute pathname the Host registers the prefix route under. */
const ROUTE_PATH = `/meta-harness/api`;
/**
* THE MEMBER TABLE. Eight rows, and the count is a fact rather than a target.
*
* Every row is an EXISTING clone under `plugins-src/`; nothing here is a planned or
* future package. The `probePath` values are read from each member own source and are
* named in the README beside the file they were taken from.
*/
const MEMBERS = [
	{
		name: "dsh-meta-community",
		clone: "dsh-meta-community",
		probePath: "/meta-community/api",
		role: "Community surface: catalogue and identity routes."
	},
	{
		name: "dsh-meta-context",
		clone: "dsh-meta-context",
		probePath: "/meta-context/api",
		role: "Fused context surface: one prefix over the context family."
	},
	{
		name: "dsh-meta-evolve",
		clone: "dsh-meta-evolve",
		probePath: "/meta-evolve/api/state",
		role: "Evolution rounds and composed state."
	},
	{
		name: "dsh-meta-intent",
		clone: "dsh-meta-intent",
		probePath: "/meta-intent/api",
		role: "Intent map surface."
	},
	{
		name: "dsh-meta-market",
		clone: "dsh-meta-market",
		probePath: "/meta-market/api",
		role: "Market pre-seed surface."
	},
	{
		name: "dsh-meta-memory",
		clone: "dsh-meta-memory",
		probePath: "/meta-memory",
		role: "Memory surface."
	},
	{
		name: "dsh-meta-research",
		clone: "dsh-meta-research",
		probePath: "/meta-research/api",
		role: "Research surface."
	},
	{
		name: "dsh-meta-skills",
		clone: "dsh-meta-skills",
		probePath: "/meta-skills",
		role: "Tools and skills surface."
	}
];
/**
* Every route this prefix serves. Three rows, and there is no index route: a surface
* that answers an empty tail advertises a root the brief did not ask for.
*
* The 404 body is rendered FROM this table, because a hand-written 404 once advertised
* a path the dispatch table could not reach — the one place whose job is to be
* authoritative was the one place that was wrong.
*/
const ROUTES = [
	{
		tail: "status",
		method: "GET",
		summary: "Bundle census: every member, its version, whether it is present, and what its route answered."
	},
	{
		tail: "members",
		method: "GET",
		summary: "The composed member table itself, with no live reads."
	},
	{
		tail: "health",
		method: "GET",
		summary: "This bundle own health. Cheap, and it probes no member."
	},
	{
		tail: "elixir",
		method: "GET",
		summary: "The Elixir app stage read over loopback: loaded modules, processes, uptime and fleet units, each either a value or the reason it is unmeasured."
	}
];
/** Every path this prefix advertises, derived in one place so a listing cannot drift. */
function advertisedPaths() {
	return ROUTES.map((route) => `${ROUTE_PATH}/${route.tail}`);
}
/**
* Count the readings.
* @param readings - one reading per member, in table order.
* @returns the census; every count has `total` as its denominator.
*/
function censusOf(readings) {
	let present = 0;
	let answered200 = 0;
	let unmeasured = 0;
	for (const reading of readings) {
		if (reading.present) present += 1;
		if (reading.status === 200) answered200 += 1;
		if (reading.status === null) unmeasured += 1;
	}
	return {
		total: readings.length,
		present,
		absent: readings.length - present,
		answered200,
		unmeasured
	};
}
// src/host/readings.ts
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
/** Where the clones live, resolved rather than hard-coded, so the read works off this machine too. */
function pluginsRoot(env = process.env) {
	if (env.DSH_META_PLUGINS_SRC) return env.DSH_META_PLUGINS_SRC;
	const programRoot = env.DSH_META_PROGRAM_ROOT;
	if (programRoot) return join(programRoot, "plugins-src");
	try {
		const here = fileURLToPath(import.meta.url);
		return join(dirname(here), "..", "..");
	} catch {
		return null;
	}
}
/** The version declared by a member's own `package.json`, or `null` with no guess made. */
function readVersion(root, clone) {
	if (root === null) return null;
	try {
		const raw = readFileSync(join(root, clone, "package.json"), "utf8");
		const parsed = JSON.parse(raw);
		if (parsed !== null && typeof parsed === "object" && typeof parsed.version === "string") return parsed.version;
		return null;
	} catch {
		return null;
	}
}
/** Whether the clone directory exists at all — a filesystem fact, not a probe. */
function readPresent(root, clone) {
	if (root === null) return false;
	try {
		readFileSync(join(root, clone, "package.json"), "utf8");
		return true;
	} catch {
		return false;
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
function probeBaseFrom(hostHeader) {
	if (typeof hostHeader !== "string" || hostHeader.length === 0) return null;
	const host = hostHeader.split(":")[0]?.toLowerCase() ?? "";
	const port = hostHeader.includes(":") ? hostHeader.slice(hostHeader.lastIndexOf(":") + 1) : "80";
	if (!(host === "127.0.0.1" || host === "localhost" || host === "[::1]" || host === "0.0.0.0") || !/^\d+$/.test(port)) return null;
	return `http://127.0.0.1:${port}`;
}
/** One bounded read. A timeout, a refused connection and a 4xx/5xx are three different reasons. */
async function probe(url, timeoutMs) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			redirect: "manual"
		});
		await res.text();
		return res.status === 200 ? {
			status: 200,
			reason: null
		} : {
			status: res.status,
			reason: `the member answered ${res.status} at ${url}`
		};
	} catch (error) {
		return {
			status: null,
			reason: `the member could not be reached at ${url}: ${error instanceof Error ? error.message : String(error)}`
		};
	} finally {
		clearTimeout(timer);
	}
}
/**
* Read every member of the table. `base === null` is not an error: it is an unmeasured round, and
* every row says so, because a round that could not address the server has measured nothing.
*/
async function readMembers(members, base, options = {}) {
	const root = options.root !== void 0 ? options.root : pluginsRoot();
	const timeoutMs = options.timeoutMs ?? 8e3;
	const readings = [];
	for (const member of members) {
		const present = readPresent(root, member.clone);
		const version = readVersion(root, member.clone);
		if (base === null) {
			readings.push({
				name: member.name,
				clone: member.clone,
				version,
				present,
				status: null,
				reason: "the request carried no loopback Host header, so no member could be addressed"
			});
			continue;
		}
		if (member.probePath === null) {
			readings.push({
				name: member.name,
				clone: member.clone,
				version,
				present,
				status: null,
				reason: "this member owns no route of its own to probe"
			});
			continue;
		}
		const { status, reason } = await probe(`${base}${member.probePath}`, timeoutMs);
		readings.push({
			name: member.name,
			clone: member.clone,
			version,
			present,
			status,
			reason
		});
	}
	return readings;
}
// src/host/elixir.ts
/**
* The Elixir app stage, read over loopback — the bundle's tie to the BEAM.
*
* WHY A READER AND NOT A CLIENT LIBRARY: the harness must be foldable onto the Elixir app without
* becoming a second implementation of anything. This file reads two facts the app's own control plane
* already serves, and it invents neither a route nor a default port: the endpoints below are the ones
* cited in `backend/control/lib/control/routes.ex` of the program, and the port is that module's
* `Control.HTTP @default_port 4100` with a documented environment override.
*
* THE THREE-VALUED RULE APPLIES HERE TOO. A reading is `{value}` or `{unmeasured: reason}`. A dead
* control plane is NOT zero modules loaded and NOT an empty fleet; it is a reading that was not taken.
*
* @module dsh-meta-harness/host/elixir
*/
/** Where the control plane listens. A documented default, overridable, never a machine path. */
function controlBase(env = process.env) {
	const explicit = env.DSH_META_CONTROL_URL;
	if (typeof explicit === "string" && /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(explicit)) return explicit;
	return `http://127.0.0.1:${env.CONTROL_PORT && /^\d+$/.test(env.CONTROL_PORT) ? env.CONTROL_PORT : "4100"}`;
}
function measured(value) {
	return {
		value,
		unmeasured: null
	};
}
function unmeasured(reason) {
	return {
		value: null,
		unmeasured: reason
	};
}
const TIMEOUT_MS = 5e3;
async function getJson(url) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			redirect: "manual",
			headers: { accept: "application/json" }
		});
		if (res.status !== 200) return {
			ok: false,
			reason: `${url} answered ${res.status}`
		};
		return {
			ok: true,
			body: await res.json()
		};
	} catch (error) {
		return {
			ok: false,
			reason: `${url} could not be read: ${error instanceof Error ? error.message : String(error)}`
		};
	} finally {
		clearTimeout(timer);
	}
}
/** A number from a body, or the reason it is not one — never a coercion of `undefined` to `0`. */
function numberAt(body, keys, source) {
	if (body === null || typeof body !== "object") return unmeasured(`${source} answered a body that is not an object`);
	let cursor = body;
	for (const key of keys) {
		if (cursor === null || typeof cursor !== "object" || !(key in cursor)) return unmeasured(`${source} carries no ${keys.join(".")}`);
		cursor = cursor[key];
	}
	return typeof cursor === "number" && Number.isFinite(cursor) ? measured(cursor) : unmeasured(`${source} carries ${keys.join(".")} as ${typeof cursor}, not a number`);
}
/**
* Read the BEAM through the control plane's own status routes.
*
* Endpoints, cited: `GET /api/beam/status` and `GET /fleet/status` (`backend/control/lib/control/routes.ex`).
* Both are GETs; this reader issues no control write, so a dead plane can never be mistaken for a
* request to start one.
*/
async function readBeam(base = controlBase()) {
	const [beam, fleet] = await Promise.all([getJson(`${base}/api/beam/status`), getJson(`${base}/fleet/status`)]);
	const beamFields = beam.ok ? {
		loadedModuleCount: numberAt(beam.body, ["loaded_module_count"], "beam/status"),
		processCount: numberAt(beam.body, ["process_count"], "beam/status"),
		uptimeMs: numberAt(beam.body, ["uptime_ms"], "beam/status")
	} : {
		loadedModuleCount: unmeasured(beam.reason),
		processCount: unmeasured(beam.reason),
		uptimeMs: unmeasured(beam.reason)
	};
	const fleetUnits = fleet.ok ? numberAt(fleet.body, ["units", "length"], "fleet/status") : unmeasured(fleet.reason);
	const all = [
		beamFields.loadedModuleCount,
		beamFields.processCount,
		beamFields.uptimeMs,
		fleetUnits
	];
	return {
		base,
		readAt: (/* @__PURE__ */ new Date()).toISOString(),
		...beamFields,
		fleetUnits,
		measuredOf: {
			measured: all.filter((reading) => reading.value !== null).length,
			of: all.length
		}
	};
}
// src/host/index.ts
/**
* ============================================================================
* dsh-meta-harness — Host half
* ============================================================================
*
* A BUNDLE (decision D-0460), not a tenth surface with its own opinions. It mounts ONE prefix
* (`/meta-harness/api`) with three routes and reads the eight existing `dsh-meta-*` packages over
* loopback, relaying what each member's own route answered. It re-implements no member capability,
* so there is no second copy of a member's rule to drift against the first.
*
* THE THREE ROUTES, AND WHY THERE IS NO INDEX ROUTE
*
*   GET /meta-harness/api/status   the census of the bundle: per member, present + status + reason
*   GET /meta-harness/api/members  the declared table itself, so the surface states its own scope
*   GET /meta-harness/api/health   cheap liveness: this plugin answered, and the routes it serves
*
* An index route is deliberately absent: a prefix that answers its own bare path advertises a root
* nobody asked for, and the 404 body is rendered FROM the route table so it cannot name a path the
* table does not serve.
*
* ONLY `webServer` IS INJECTED. Nothing here reads a member's service in process: a member's LIVE
* state is what its own route answers, and an in-process read would answer from a state the member's
* actuator does not read.
*
* @module dsh-meta-harness/host
*/
/** Loader row name; the bundle patch mounts this package under `meta-harness`. */
const name = "dsh-meta-harness";
function json(res, status, body) {
	const text = JSON.stringify(body);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"content-length": String(Buffer.byteLength(text))
	});
	res.end(text);
}
function notFound(res, pathname) {
	json(res, 404, {
		ok: false,
		fused: "dsh-meta-harness",
		error: "unknown meta-harness route",
		path: pathname,
		prefix: ROUTE_PATH,
		advertised: advertisedPaths()
	});
}
/** This package's own version, read at request time so a rebuild is visible without a footnote. */
function ownVersion() {
	try {
		const raw = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
		const parsed = JSON.parse(raw);
		return typeof parsed.version === "string" ? parsed.version : null;
	} catch {
		return null;
	}
}
function hostHeaderOf(req) {
	const raw = req.headers.host;
	if (typeof raw === "string") return raw;
	if (Array.isArray(raw)) return raw[0];
}
function apply(ctx) {
	const handler = async (req, res) => {
		const method = (req.method ?? "GET").toUpperCase();
		const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
		if (!pathname.startsWith("/meta-harness/api")) {
			notFound(res, pathname);
			return;
		}
		const tail = pathname.slice(ROUTE_PATH.length).replace(/^\/+/, "");
		if (method !== "GET") {
			json(res, 405, {
				ok: false,
				fused: "dsh-meta-harness",
				error: "method not allowed",
				path: pathname,
				declared: "GET",
				advertised: advertisedPaths()
			});
			return;
		}
		if (tail === "" || !ROUTES.some((route) => route.tail === tail)) {
			notFound(res, pathname);
			return;
		}
		if (tail === "health") {
			json(res, 200, {
				ok: true,
				name: "dsh-meta-harness",
				version: ownVersion(),
				prefix: ROUTE_PATH,
				memberCount: MEMBERS.length,
				routes: ROUTES.map((route) => `GET ${ROUTE_PATH}/${route.tail}`),
				probes: {
					ran: false,
					reason: "health is cheap by design: no member is probed on this route"
				}
			});
			return;
		}
		if (tail === "members") {
			json(res, 200, {
				ok: true,
				prefix: ROUTE_PATH,
				members: MEMBERS
			});
			return;
		}
		if (tail === "elixir") {
			const beam = await readBeam(controlBase());
			json(res, 200, {
				ok: true,
				prefix: ROUTE_PATH,
				...beam
			});
			return;
		}
		const base = probeBaseFrom(hostHeaderOf(req));
		const members = await readMembers(MEMBERS, base);
		json(res, 200, {
			ok: true,
			prefix: ROUTE_PATH,
			censusAt: (/* @__PURE__ */ new Date()).toISOString(),
			probeBase: base,
			census: censusOf(members),
			members
		});
	};
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: ROUTE_PATH,
		handler
	}));
	ctx.logger.info(`dsh-meta-harness: ${ROUTE_PATH} serves ${ROUTES.length} routes over ${MEMBERS.length} members`);
}
export { apply, name };

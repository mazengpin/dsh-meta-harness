window.__ModuleLoader__.load({
	id: "dsh-meta-harness",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		/** The absolute pathname the Host registers the prefix route under. */
		const ROUTE_PATH = `/meta-harness/api`;
		/**
		* The ONE id used for BOTH the sidebar row and the keyed main panel.
		*
		* It is a single constant because a row id that differs from the panel key renders as a
		* row that opens nothing: the shell keys the panel it opens by the row's id, so two
		* spellings are two different seats and only one of them has a page behind it.
		*/
		const PANEL_ID = "dsh-meta-harness:harness";
		/** The `sidebar.panellist` row id. The same value as {@link PANEL_ID}, deliberately. */
		const SIDEBAR_ID = "dsh-meta-harness:harness";
		/** The locale namespace both halves register under. */
		const LOCALE_NS = "meta-harness";
		// src/client/index.tsx
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
		/** The path the page fetches: the host prefix without the leading slash. */
		const STATUS_PATH = `/${ROUTE_PATH.replace(/^\//, "")}/status`;
		const name = "dsh-meta-harness-client";
		const loader = window.__ModuleLoader__;
		if (!loader) throw new Error("dsh-meta-harness/client: window.__ModuleLoader__ is absent");
		/**
		* The page. Built with a one-line element helper rather than deeply nested `createElement` calls:
		* a mis-paired parenthesis in a nested tree typechecks as nothing and renders as an empty page, so
		* the shape here keeps the nesting visible.
		*/
		function HarnessPage(react) {
			const el = (tag, props, ...children) => react.createElement(tag, props, ...children);
			return function Page() {
				const [state, setState] = react.useState({
					loading: true,
					body: null,
					error: null
				});
				react.useEffect(() => {
					let live = true;
					fetch(STATUS_PATH, { headers: { accept: "application/json" } }).then(async (res) => await res.json()).then((body) => {
						if (live) setState({
							loading: false,
							body,
							error: null
						});
					}).catch((error) => {
						const message = error instanceof Error ? error.message : String(error);
						if (live) setState({
							loading: false,
							body: null,
							error: message
						});
					});
					return () => {
						live = false;
					};
				}, []);
				const cell = {
					padding: "6px 10px",
					borderBottom: "1px solid rgba(127,127,127,0.25)",
					textAlign: "left"
				};
				const head = {
					...cell,
					fontWeight: 600
				};
				if (state.loading) return el("div", { style: { padding: 16 } }, "Reading the bundle…");
				if (state.error !== null) return el("div", { style: { padding: 16 } }, `The bundle did not answer: ${state.error}`);
				const body = state.body;
				if (body === null) return el("div", { style: { padding: 16 } }, "The bundle answered with no body.");
				const census = body.census;
				const summary = `${census.total} members · ${census.present} present on disk · ${census.absent} absent · ${census.answered200} answered 200 · ${census.unmeasured} unmeasured`;
				const rows = body.members.map((member) => el("tr", { key: member.name }, el("td", { style: cell }, member.name), el("td", { style: cell }, member.version ?? "—"), el("td", { style: cell }, member.present ? "yes" : "NO"), el("td", { style: cell }, member.status === null ? "no answer" : String(member.status)), el("td", { style: {
					...cell,
					opacity: .85
				} }, member.reason ?? "")));
				const header = el("tr", null, el("th", { style: head }, "member"), el("th", { style: head }, "version"), el("th", { style: head }, "on disk"), el("th", { style: head }, "status"), el("th", { style: head }, "reason"));
				return el("div", { style: {
					padding: 16,
					display: "grid",
					gap: 12
				} }, el("div", { style: {
					fontSize: 13,
					opacity: .8
				} }, summary), el("table", { style: {
					borderCollapse: "collapse",
					fontSize: 13
				} }, el("thead", null, header), el("tbody", null, ...rows)), el("div", { style: {
					fontSize: 12,
					opacity: .7
				} }, `census at ${body.censusAt}`));
			};
		}
		loader.load({
			id: "dsh-meta-harness",
			factory: (require$1) => {
				const react = require$1("react");
				const slots = require$1("@deepseek-ai/dsh-client-ui-slots");
				const sidebar = require$1("@deepseek-ai/dsh-client-ui-sidebar");
				const Page = HarnessPage(react);
				slots.inject("main").register({
					key: PANEL_ID,
					component: Page
				});
				sidebar.register({
					id: SIDEBAR_ID,
					order: 14,
					localeKey: `${LOCALE_NS}.panelTitle`
				});
				return { name };
			}
		});
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
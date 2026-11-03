window.__ModuleLoader__.load({
	id: "dsh-meta-harness",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
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
		// src/client/locales.ts
		/**
		* The Client half's dictionaries.
		*
		* `LOCALE_NS` is imported from the shared contract rather than restated, because two
		* spellings of a namespace is a translation that silently does not apply. The sidebar
		* row's label is the only string the shell resolves through this namespace today; the
		* page renders its own copy from the protocol, which is the same source the Host half
		* reads for its routes.
		*
		* @module dsh-meta-harness/client/locales
		*/
		/** English dictionary. */
		const en = { panelTitle: "Harness" };
		/** Chinese dictionary. */
		const zh = { panelTitle: "元框架" };
		// src/client/index.tsx
		/**
		* dsh-meta-harness — Client half.
		*
		* A Cordis Client plugin: `name`, `inject`, and `apply(ctx)`. The package id is
		* registered by EXACTLY ONE `__ModuleLoader__.load(...)` call, and that call is the
		* tsdown banner around this file — never a hand-written one here. Two registrations of
		* the same package id make the client module system throw `duplicate factory
		* registration` and the shell reports the entry as unactivated.
		*
		* ONE sidebar row and ONE keyed panel, and the two use the SAME constant because the
		* shell keys the panel it opens by the row id: two spellings are two seats, and only one
		* of them has a page behind it. That is not a style preference — it is the defect this
		* constant exists to prevent.
		*
		* Both seats go through `ctx.slots.inject` because `sidebar.panellist` and `main` are
		* declared by other packages: injecting waits for the real declaration instead of racing
		* it, disappears when it collapses, and is reinstalled if it returns.
		*
		* The page reads `/meta-harness/api/status` and lists every member with the three facts
		* the bundle promises: whether the clone is on disk, what its own route answered, and why
		* a reading is absent. A `null` status renders as `no answer` WITH its reason; it is
		* never shown as `0`.
		*
		* Nothing here recomputes a member's rule. The page is a reader of the host half, which
		* is a reader of each member's own route.
		*
		* @module dsh-meta-harness/client
		*/
		/** Loader row name; the Client bundle registers itself under this same id. */
		const name = "dsh-meta-harness";
		/** The two Client services this half reads. */
		const inject = ["slots", "locale"];
		/** The path the page fetches: the host prefix without the leading slash. */
		const STATUS_PATH = `/${ROUTE_PATH.replace(/^\//, "")}/status`;
		/** The keyed slot the page goes into. */
		const PANEL_SLOT = "main";
		/** The list slot the sidebar row goes into. */
		const SIDEBAR_SLOT = "sidebar.panellist";
		/**
		* The sidebar row glyph: a bracket wrapping three stacked bars, which reads as one
		* surface over several members. Sized from the slot's own prop when the shell supplies
		* one, so the row matches its neighbours.
		* @param props - the owner props supplied by the sidebar list.
		* @returns the icon element.
		*/
		function HarnessIcon({ size }) {
			const dimension = typeof size === "number" ? size : 16;
			return (0, react.createElement)("svg", {
				width: dimension,
				height: dimension,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				strokeLinecap: "round",
				"aria-hidden": true
			}, (0, react.createElement)("path", { d: "M5.5 2.5H4a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 4 13.5h1.5" }), (0, react.createElement)("path", { d: "M10.5 2.5H12A1.5 1.5 0 0 1 13.5 4v8a1.5 1.5 0 0 1-1.5 1.5h-1.5" }), (0, react.createElement)("path", { d: "M7 5.5h2M7 8h2M7 10.5h2" }));
		}
		/**
		* The element helper. `createElement` is restated with a loose signature so the page's
		* style objects and cell values need no per-call casts: a mis-paired parenthesis in a
		* nested tree would typecheck as nothing and render as an empty page, so the shape here
		* keeps the nesting visible.
		*/
		const el = react.createElement;
		/**
		* The page. It reads the host half's census and renders one row per member.
		* @returns the page element.
		*/
		function HarnessPage() {
			const [state, setState] = (0, react.useState)({
				loading: true,
				body: null,
				error: null
			});
			(0, react.useEffect)(() => {
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
		}
		/**
		* Register the dictionaries, the sidebar row and the keyed page.
		* @param ctx - the Client plugin context (slots, locale, effect).
		*/
		function apply(ctx) {
			ctx.effect(() => {
				const offZh = ctx.locale.register(LOCALE_NS, "zh", zh);
				const offEn = ctx.locale.register(LOCALE_NS, "en", en);
				return () => {
					offZh();
					offEn();
				};
			}, "dsh-meta-harness: dictionaries");
			const t = ctx.locale.bind(LOCALE_NS);
			ctx.slots.inject(PANEL_SLOT, () => ctx.slots.register({
				name: PANEL_SLOT,
				key: PANEL_ID,
				locale: LOCALE_NS,
				registrant: "dsh-meta-harness"
			}, HarnessPage));
			ctx.slots.inject(SIDEBAR_SLOT, () => ctx.slots.register({
				name: SIDEBAR_SLOT,
				id: SIDEBAR_ID,
				order: 14,
				label: () => t("panelTitle"),
				locale: LOCALE_NS,
				registrant: "dsh-meta-harness"
			}, (props) => el(HarnessIcon, { size: typeof props.size === "number" ? props.size : void 0 })));
		}
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
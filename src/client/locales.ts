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
export const en: Record<string, string> = {
  panelTitle: 'Harness',
}

/** Chinese dictionary. */
export const zh: Record<string, string> = {
  panelTitle: '元框架',
}

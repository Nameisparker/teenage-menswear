/**
 * DOM id of the app-wide "Back" bar, shared by the component that renders it
 * and the home page that hides it.
 *
 * Two files need to agree on this string, and getting it wrong is invisible
 * until someone notices a stray Back button on the home page in production —
 * see the comment in components/back-button.tsx.
 */
export const BACK_BAR_ID = "app-back-bar";

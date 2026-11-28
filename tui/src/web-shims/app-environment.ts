// SvelteKit's $app/environment for the web code the TUI shares
// (frontend/src/lib, compiled by sveltui-build): the TUI is never a
// browser, so the web's state keeps nothing in browser storage.
export const browser = false;

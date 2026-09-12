import { writable } from 'svelte/store';

/** Per direct request: pressing Esc while in a real, main-content
 * panel should return focus to the left sidebar — but if that panel
 * has a real, genuine, unsaved edit pending, Esc should warn first,
 * rather than silently discard it. Any real, individual page can
 * opt in by setting this true while it has a real, unsaved edit, and
 * false again once saved or discarded — the shared layout itself
 * only ever reads it, never assumes a page's own, internal state. */
export const hasUnsavedEdit = writable(false);

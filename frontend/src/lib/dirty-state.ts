import { writable } from 'svelte/store';

// Superseded by state.svelte.ts — see docs/pm-frontend-reference.md.
export const hasUnsavedEdit = writable(false);

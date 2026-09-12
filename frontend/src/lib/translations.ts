import { writable } from 'svelte/store';

/** Maps a vocabulary entity's canonical (English) name to its text in
 * the currently selected language — e.g. t['Save'] might be 'Speichern'.
 * Falls back to the English name itself for anything not translated,
 * same as the backend's localized_text view does; populated by the
 * layout whenever the session's chosen language changes. */
export const translations = writable<Record<string, string>>({});

import { writable, type Readable } from 'svelte/store';
import { auth } from './state.svelte';

export interface PaginatedState<T> {
  items: T[];
  page: number;
  loading: boolean;
  error: string;
  /** Whether there's any real reason to show pagination controls at
   * all — false when everything already fits on one page. */
  showPager: boolean;
  isFirstPage: boolean;
  isLastPage: boolean;
  /** Only known when the backend reports a total count (not every
   * list does yet) — null means "unknown," not zero. When known,
   * enables "page n of nn" and jumping straight to the last page. */
  totalCount: number | null;
  totalPages: number | null;
}

export interface Paginator<T> extends Readable<PaginatedState<T>> {
  load: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  first: () => Promise<void>;
  last: () => Promise<void>;
}

function deriveFlags(page: number, itemCount: number, pageSize: number, totalCount: number | null) {
  const totalPages = totalCount != null ? Math.max(1, Math.ceil(totalCount / pageSize)) : null;
  return {
    isFirstPage: page === 0,
    isLastPage: totalPages != null ? page >= totalPages - 1 : itemCount < pageSize,
    showPager: totalPages != null ? totalPages > 1 : page > 0 || itemCount >= pageSize,
    totalCount,
    totalPages,
  };
}

/** The result shape fetchPage returns. totalCount is optional — a
 * list backed by a real count endpoint provides it (enabling "page n
 * of nn" and jump-to-last); a list that doesn't yet just omits it,
 * falling back to the plain Newer/Older behavior this already had. */
export interface FetchPageResult<T> {
  items: T[];
  totalCount?: number;
}

/** The one implementation of "load a page, go to first/previous/next/
 * last page" every paginated list in this app should use — created
 * once per page component (each call gets its own independent
 * state), not shared globally. `fetchPage(limit, offset)` is the only
 * thing that varies between callers; everything else (page tracking,
 * knowing when to hide Newer/Older, knowing when to hide the whole
 * pager, computing "page n of nn" when a total count is available) is
 * handled once, here.
 *
 * pageSize defaults to the logged-in user's own preference
 * (auth.current.user.page_size) when omitted — a real per-user setting, not
 * a fixed constant every page independently hardcodes.
 *
 * Usage:
 *   const journal = createPaginator((limit, offset) =>
 *     listJournalEntries(business, ledger, limit, offset)
 *   );
 *   onMount(journal.load);
 *   // in the template: {#each $journal.items as item}...
 *   // pager: <Pager paginator={journal} />
 */
export function createPaginator<T>(fetchPage: (limit: number, offset: number) => Promise<FetchPageResult<T>>, pageSize?: number): Paginator<T> {
  const effectivePageSize = pageSize ?? auth.current?.user.page_size ?? 20;

  const state = writable<PaginatedState<T>>({
    items: [],
    page: 0,
    loading: true,
    error: '',
    ...deriveFlags(0, 0, effectivePageSize, null),
  });

  async function load() {
    let currentPage = 0;
    state.update((s) => {
      currentPage = s.page;
      return { ...s, loading: true, error: '' };
    });
    try {
      const { items, totalCount } = await fetchPage(effectivePageSize, currentPage * effectivePageSize);
      state.update((s) => ({ ...s, items, loading: false, ...deriveFlags(s.page, items.length, effectivePageSize, totalCount ?? null) }));
    } catch (e) {
      state.update((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'Failed to load.' }));
    }
  }

  async function next() {
    state.update((s) => ({ ...s, page: s.page + 1 }));
    await load();
  }

  async function previous() {
    let atFirstPage = false;
    state.update((s) => {
      atFirstPage = s.page === 0;
      return atFirstPage ? s : { ...s, page: s.page - 1 };
    });
    if (!atFirstPage) await load();
  }

  async function first() {
    let alreadyFirst = false;
    state.update((s) => {
      alreadyFirst = s.page === 0;
      return alreadyFirst ? s : { ...s, page: 0 };
    });
    if (!alreadyFirst) await load();
  }

  async function last() {
    let target: number | null = null;
    state.update((s) => {
      if (s.totalPages == null || s.page === s.totalPages - 1) return s;
      target = s.totalPages - 1;
      return { ...s, page: target };
    });
    if (target != null) await load();
  }

  return { subscribe: state.subscribe, load, next, previous, first, last };
}

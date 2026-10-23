// The shared paginator — see docs/pm-frontend-reference.md for the
// full design.

import { writable, type Readable } from 'svelte/store';
import { auth } from './state.svelte';

export interface PaginatedState<T> {
  items: T[];
  page: number;
  loading: boolean;
  error: string;
  showPager: boolean; // see docs/pm-frontend-reference.md
  isFirstPage: boolean;
  isLastPage: boolean;
  totalCount: number | null; // null = unknown, not zero — see docs/pm-frontend-reference.md
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

// See docs/pm-frontend-reference.md.
export interface FetchPageResult<T> {
  items: T[];
  totalCount?: number;
}

// See docs/pm-frontend-reference.md for usage and design.
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

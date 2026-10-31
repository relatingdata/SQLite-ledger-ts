// Same, real runtime-switching principle as backend/test/test-runtime.ts,
// copied rather than imported across workspaces (each workspace stays a
// self-contained npm package) — bun:test is a real, bun-only module
// specifier; node:test is the real, built-in fallback both Node and
// Deno's own Node-compatibility layer support directly.
const isBun = typeof (globalThis as unknown as { Bun?: unknown }).Bun !== 'undefined';

export const { test, before, after } = isBun
  ? await import('bun:test').then((m) => ({ test: m.test, before: m.beforeAll, after: m.afterAll }))
  : await import('node:test');

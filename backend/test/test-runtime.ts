// The same, real runtime-switching principle as sqlite-runtime.ts,
// applied to the test framework: bun:test is a real, bun-only module
// specifier. Node's own, real, built-in node:test module (stable
// since Node 18, no experimental flag needed) provides the same,
// real shape (test, before, after) - and Deno 2.x's own, real Node
// compatibility layer supports node:test directly too, so this one,
// real fallback path covers both.
const isBun = typeof (globalThis as unknown as { Bun?: unknown }).Bun !== 'undefined';

export const { test, before, after } = isBun ? await import('bun:test').then((m) => ({ test: m.test, before: m.beforeAll, after: m.afterAll })) : await import('node:test');

// Ported, verbatim, from frontend/src/lib/app.css's own real color
// tokens — see docs/tui-design.md ("Theme: porting the web app's own
// color tokens") for the full table and the reasoning behind each
// mapping. Kept as one, real, named export per token, matching the
// CSS custom property it mirrors, rather than a single opaque object,
// so a screen component can import exactly the tokens it needs.

export const ink = '#1e2430';
export const inkSoft = '#5a6472';
export const paperRaised = '#f7f8fa';
export const paperDim = '#f9f5ec';
export const rule = '#e2e5ea';
export const ruleStrong = '#c7ccd4';
export const brass = '#a9812f';
export const brassDark = '#8a6a24';

// Deliberately NOT exported: a `paper`/background token. The terminal's
// own background is the person's own, standing preference (the same way
// their OS theme is) and this TUI never fights it — see the design doc's
// "One deliberate departure" note.

export const theme = { ink, inkSoft, paperRaised, paperDim, rule, ruleStrong, brass, brassDark };

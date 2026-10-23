// Currency and quantity parsing — see docs/pm-frontend-reference.md
// for the full design, including the known 100-minor-units-per-unit gap.
export function parseMinorUnits(text: string): number {
  const n = Number(text);
  if (!text || !Number.isFinite(n)) return 0;
  return Math.round(Math.abs(n) * 100);
}

// See docs/pm-frontend-reference.md.
export function parseQuantity(text: string): number {
  const n = Number(text);
  if (!text || !Number.isFinite(n)) return 0;
  return Math.round(Math.abs(n));
}

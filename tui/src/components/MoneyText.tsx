// A lean port of frontend/src/lib/format.ts's own `formatAmount` —
// comma grouping, 2 decimal places, parentheses for negative amounts
// per the same, real accounting convention the web app already uses.
// Deliberately NOT the full multi-currency/number-format system
// (per-currency decimal places, locale separators) — a real, stated
// v1 simplification (docs/tui-design.md), since every screen in this
// TUI's own v1 scope only ever shows the business's home currency.
import React from 'react';
import { Text } from 'ink';
import { ink, inkSoft } from '../theme.js';

// The digits only, no sign/currency mark — callers wrap it themselves
// (see formatDollars below), since the parens for a negative amount
// belong around the whole "$1,234.56", not just the digits.
export function formatMinor(minorUnits: number): string {
  const abs = Math.abs(Math.round(minorUnits));
  const whole = Math.floor(abs / 100).toString();
  const cents = (abs % 100).toString().padStart(2, '0');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${grouped}.${cents}`;
}

export function formatDollars(minorUnits: number): string {
  const negative = minorUnits < 0;
  const body = `$${formatMinor(minorUnits)}`;
  return negative ? `(${body})` : body;
}

export function MoneyText({ minorUnits, dim = false }: { minorUnits: number; dim?: boolean }) {
  return <Text color={dim ? inkSoft : ink}>{formatDollars(minorUnits)}</Text>;
}

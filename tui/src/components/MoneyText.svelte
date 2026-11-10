<script lang="ts" module>
  // A lean port of frontend/src/lib/format.ts's own `formatAmount` —
  // comma grouping, 2 decimal places, parentheses for negative amounts,
  // per the same real accounting convention the web app already uses.
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
</script>

<script lang="ts">
  import { Text } from 'sveltui';
  import { ink, inkSoft } from '../theme.ts';

  let { minorUnits, dim = false }: { minorUnits: number; dim?: boolean } = $props();
</script>

<Text text={formatDollars(minorUnits)} color={dim ? inkSoft : ink} />

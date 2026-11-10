<!--
  Read-only — GET /reports/balance-sheet, rendered as the same three
  real sections (Assets / Liabilities / Equity) with their own real
  totals and the real `balanced` flag the web app's own report shows.
-->
<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import { ApiError, asBusinessName, asLedgerName, getBalanceSheet, type BalanceSheet as BalanceSheetData, type StatementLine } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import MoneyText from '../components/MoneyText.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  let { businessName, ledgerName, onBack }: { businessName: string; ledgerName: string; onBack: () => void } = $props();

  let data: BalanceSheetData | null = $state(null);
  let error: string | null = $state(null);

  getBalanceSheet(asBusinessName(businessName), asLedgerName(ledgerName))
    .then((d) => (data = d))
    .catch((err) => (error = err instanceof ApiError ? err.message : 'Could not load the Balance Sheet.'));

  const unsubscribe = keyboard.onKey('Escape', onBack);
  onDestroy(unsubscribe);

  function sectionTotalMinor(title: string): number {
    if (!data) return 0;
    if (title === 'Assets') return data.total_assets_minor;
    if (title === 'Liabilities') return data.total_liabilities_minor;
    return data.total_equity_minor;
  }
</script>

{#snippet section(title: string, lines: StatementLine[])}
  <Box flexDirection="column" marginBottom={1}>
    <Text text={title} color={brass} bold />
    {#if lines.length === 0}
      <Text text="  (no accounts with a real balance)" color={inkSoft} />
    {/if}
    {#each lines as l (l.name)}
      <Box flexDirection="row">
        <Box width={34}>
          <Text text={`  ${l.name}`} color={ink} />
        </Box>
        <Box><MoneyText minorUnits={l.debit_minor - l.credit_minor} /></Box>
      </Box>
    {/each}
    <Box flexDirection="row">
      <Box width={34}>
        <Text text={`  Total ${title}`} bold />
      </Box>
      <Box><MoneyText minorUnits={sectionTotalMinor(title)} /></Box>
    </Box>
  </Box>
{/snippet}

{#if error}
  <Panel title="Balance Sheet"><Text text={error} color="red" /></Panel>
{:else if !data}
  <Panel title="Balance Sheet"><Text text="Loading…" color={inkSoft} /></Panel>
{:else}
  <Panel title={`Balance Sheet — ${businessName} / ${ledgerName}`} focused>
    {@render section('Assets', data.assets)}
    {@render section('Liabilities', data.liabilities)}
    {@render section('Equity', data.equity)}
    <Text
      text={`${data.balanced ? 'Balanced' : 'NOT balanced'} — Assets ${data.total_assets_minor === data.total_liabilities_minor + data.total_equity_minor ? '=' : '≠'} Liabilities + Equity`}
      color={data.balanced ? brass : 'red'}
      bold
    />
    <Text text="Escape back to menu" color={inkSoft} dim />
  </Panel>
{/if}

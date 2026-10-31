// Read-only — GET /reports/balance-sheet, rendered as the same three
// real sections (Assets / Liabilities / Equity) with their own real
// totals and the real `balanced` flag the web app's own report shows.
import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ApiError, asBusinessName, asLedgerName, getBalanceSheet, type BalanceSheet as BalanceSheetData, type StatementLine } from '../api.js';
import { Panel } from '../components/Panel.js';
import { MoneyText } from '../components/MoneyText.js';
import { brass, ink, inkSoft } from '../theme.js';

function Section({ title, lines, totalMinor }: { title: string; lines: StatementLine[]; totalMinor: number }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={brass} bold>
        {title}
      </Text>
      {lines.length === 0 && <Text color={inkSoft}>  (no accounts with a real balance)</Text>}
      {lines.map((l) => (
        <Box key={l.name}>
          <Box width={34}>
            <Text color={ink}>  {l.name}</Text>
          </Box>
          <MoneyText minorUnits={l.debit_minor - l.credit_minor} />
        </Box>
      ))}
      <Box>
        <Box width={34}>
          <Text bold>  Total {title}</Text>
        </Box>
        <MoneyText minorUnits={totalMinor} />
      </Box>
    </Box>
  );
}

export function BalanceSheet({ businessName, ledgerName, onBack }: { businessName: string; ledgerName: string; onBack: () => void }) {
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBalanceSheet(asBusinessName(businessName), asLedgerName(ledgerName))
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the Balance Sheet.'));
  }, [businessName, ledgerName]);

  useInput((_input, key) => {
    if (key.escape) onBack();
  });

  if (error) return <Panel title="Balance Sheet"><Text color="red">{error}</Text></Panel>;
  if (!data) return <Panel title="Balance Sheet"><Text color={inkSoft}>Loading…</Text></Panel>;

  return (
    <Panel title={`Balance Sheet — ${businessName} / ${ledgerName}`} focused>
      <Section title="Assets" lines={data.assets} totalMinor={data.total_assets_minor} />
      <Section title="Liabilities" lines={data.liabilities} totalMinor={data.total_liabilities_minor} />
      <Section title="Equity" lines={data.equity} totalMinor={data.total_equity_minor} />
      <Text color={data.balanced ? brass : 'red'} bold>
        {data.balanced ? 'Balanced' : 'NOT balanced'} — Assets {data.total_assets_minor === data.total_liabilities_minor + data.total_equity_minor ? '=' : '≠'} Liabilities + Equity
      </Text>
      <Text color={inkSoft} dimColor>
        Escape back to menu
      </Text>
    </Panel>
  );
}

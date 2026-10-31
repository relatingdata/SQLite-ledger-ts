// The real, live General Journal stage-then-post flow — mirrors
// frontend/src/routes/post/+page.svelte's own two-step mechanism
// exactly: each line is staged individually (POST /journal/staging),
// then the whole, balanced entry is posted in one, final, separate
// step (POST /journal/post) — never one, combined, artificial call.
// Debit/Credit are two separate fields, mutually exclusive, the same
// way the web screen's own two columns work; amount_minor = debit -
// credit, the same real sign convention the backend expects.
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import {
  ApiError,
  asAccountName,
  asBusinessName,
  asLedgerName,
  postJournalEntry,
  removeStagedLine,
  stageLine,
  type StagedLine,
} from '../api.js';
import { Panel } from '../components/Panel.js';
import { MoneyText, formatMinor } from '../components/MoneyText.js';
import { brass, ink, inkSoft } from '../theme.js';

type Step = 'reference' | 'lines' | 'line-account' | 'line-debit' | 'line-credit' | 'posted';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dollarsToMinor(text: string): number {
  const n = Number(text.trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function GeneralJournal({
  businessName,
  ledgerName,
  onBack,
}: {
  businessName: string;
  ledgerName: string;
  onBack: () => void;
}) {
  const [step, setStep] = useState<Step>('reference');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<StagedLine[]>([]);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // In-progress new line, while in the line-account/line-debit/line-credit steps.
  const [account, setAccount] = useState('');
  const [debit, setDebit] = useState('');
  const [credit, setCredit] = useState('');

  const debitTotal = lines.reduce((sum, l) => sum + Math.max(l.amount_minor, 0), 0);
  const creditTotal = lines.reduce((sum, l) => sum + Math.max(-l.amount_minor, 0), 0);
  const balanced = lines.length > 0 && debitTotal === creditTotal;

  useInput((input, key) => {
    // Escape means the same thing — "back out one level" — on every step of
    // this screen, not just 'lines'; see docs/tui-design.md's keyboard table.
    if (key.escape) {
      if (step === 'reference' || step === 'posted' || step === 'lines') return onBack();
      if (step === 'line-account' || step === 'line-debit' || step === 'line-credit') {
        setStep('lines');
        return;
      }
    }
    if (step !== 'lines') return;
    if (key.downArrow) setSelected((s) => Math.min(s + 1, Math.max(lines.length - 1, 0)));
    if (key.upArrow) setSelected((s) => Math.max(s - 1, 0));
    if (input === 'i') {
      setAccount('');
      setDebit('');
      setCredit('');
      setStep('line-account');
    }
    if ((input === 'd' || key.backspace) && lines[selected]) {
      void removeLine(selected);
    }
    if ((input === 'p' || (key.ctrl && input === 'p')) && balanced) {
      void post();
    }
  });

  async function addLine() {
    const debitMinor = dollarsToMinor(debit);
    const creditMinor = dollarsToMinor(credit);
    if (!account.trim() || (debitMinor === 0 && creditMinor === 0)) {
      setError('A line needs an account and a debit or credit amount.');
      setStep('lines');
      return;
    }
    const line: StagedLine = {
      reference,
      business: asBusinessName(businessName),
      ledger: asLedgerName(ledgerName),
      transdate: todayIso(),
      account: asAccountName(account.trim()),
      amount_minor: debitMinor - creditMinor,
    };
    setBusy(true);
    setError(null);
    try {
      await stageLine(line);
      setLines((prev) => [...prev, line]);
      setStep('lines');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not stage that line.');
      setStep('lines');
    } finally {
      setBusy(false);
    }
  }

  async function removeLine(index: number) {
    const line = lines[index];
    setBusy(true);
    setError(null);
    try {
      await removeStagedLine(line.reference, line.business, line.ledger, line.account);
      setLines((prev) => prev.filter((_, i) => i !== index));
      setSelected((s) => Math.max(0, Math.min(s, lines.length - 2)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove that line.');
    } finally {
      setBusy(false);
    }
  }

  async function post() {
    setBusy(true);
    setError(null);
    try {
      await postJournalEntry(reference, asBusinessName(businessName), asLedgerName(ledgerName));
      setStep('posted');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not post this entry.');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'reference') {
    return (
      <Panel title={`General Journal — ${businessName} / ${ledgerName}`} focused>
        <Box>
          <Box width={14}>
            <Text color={brass}>Reference</Text>
          </Box>
          <TextInput
            value={reference}
            onChange={setReference}
            onSubmit={() => reference.trim() && setStep('lines')}
          />
        </Box>
        <Text color={inkSoft} dimColor>
          Enter to continue · Escape back to menu
        </Text>
      </Panel>
    );
  }

  if (step === 'line-account' || step === 'line-debit' || step === 'line-credit') {
    return (
      <Panel title={`New line — ${reference}`} focused>
        <Box>
          <Box width={10}>
            <Text color={step === 'line-account' ? brass : inkSoft}>Account</Text>
          </Box>
          <TextInput value={account} onChange={setAccount} focus={step === 'line-account'} onSubmit={() => setStep('line-debit')} />
        </Box>
        <Box>
          <Box width={10}>
            <Text color={step === 'line-debit' ? brass : inkSoft}>Debit</Text>
          </Box>
          <TextInput
            value={debit}
            onChange={(v) => {
              setDebit(v);
              if (v) setCredit('');
            }}
            focus={step === 'line-debit'}
            onSubmit={() => setStep('line-credit')}
          />
        </Box>
        <Box>
          <Box width={10}>
            <Text color={step === 'line-credit' ? brass : inkSoft}>Credit</Text>
          </Box>
          <TextInput
            value={credit}
            onChange={(v) => {
              setCredit(v);
              if (v) setDebit('');
            }}
            focus={step === 'line-credit'}
            onSubmit={addLine}
          />
        </Box>
        <Text color={inkSoft} dimColor>
          Enter moves to the next field · entering one of Debit/Credit clears the other · Escape cancels this line
        </Text>
      </Panel>
    );
  }

  if (step === 'posted') {
    return (
      <Panel title={`General Journal — ${businessName} / ${ledgerName}`} focused>
        <Text color={brass} bold>
          Posted — {reference}, {lines.length} line{lines.length === 1 ? '' : 's'}, ${formatMinor(debitTotal)} each side.
        </Text>
        <Text color={inkSoft} dimColor>
          Escape back to menu
        </Text>
      </Panel>
    );
  }

  // step === 'lines'
  return (
    <Panel title={`General Journal — ${reference}`} focused>
      <Box flexDirection="column">
        <Box>
          <Box width={24}>
            <Text color={inkSoft}>Account</Text>
          </Box>
          <Box width={14}>
            <Text color={inkSoft}>Debit</Text>
          </Box>
          <Box width={14}>
            <Text color={inkSoft}>Credit</Text>
          </Box>
        </Box>
        {lines.length === 0 && <Text color={inkSoft}>No lines staged yet — press I to add one.</Text>}
        {lines.map((l, i) => (
          <Box key={`${l.account}-${i}`}>
            <Box width={24}>
              <Text color={i === selected ? brass : ink}>{i === selected ? '› ' : '  '}{l.account}</Text>
            </Box>
            <Box width={14}>
              <Text color={ink}>{l.amount_minor > 0 ? `$${formatMinor(l.amount_minor)}` : ''}</Text>
            </Box>
            <Box width={14}>
              <Text color={ink}>{l.amount_minor < 0 ? `$${formatMinor(-l.amount_minor)}` : ''}</Text>
            </Box>
          </Box>
        ))}
        <Box marginTop={1}>
          <Box width={24}>
            <Text bold>Total</Text>
          </Box>
          <Box width={14}>
            <MoneyText minorUnits={debitTotal} />
          </Box>
          <Box width={14}>
            <MoneyText minorUnits={creditTotal} />
          </Box>
        </Box>
        {!balanced && lines.length > 0 && <Text color="yellow">Not yet balanced — debits and credits must match before posting.</Text>}
        {error && <Text color="red">{error}</Text>}
        {busy && <Text color={inkSoft}>Working…</Text>}
        <Text color={inkSoft} dimColor>
          I add a line · ↑/↓ select · D delete selected · P post (once balanced) · Escape back to menu
        </Text>
      </Box>
    </Panel>
  );
}

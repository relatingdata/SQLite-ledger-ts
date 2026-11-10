<!--
  The real, live General Journal stage-then-post flow - mirrors
  frontend/src/routes/post/+page.svelte's own two-step mechanism
  exactly: each line is staged individually (POST /journal/staging),
  then the whole, balanced entry is posted in one, final, separate
  step (POST /journal/post) - never one, combined, artificial call.
  Debit/Credit are two separate fields, mutually exclusive, the same
  way the web screen's own two columns work; amount_minor = debit -
  credit, the same real sign convention the backend expects.
-->
<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import {
    ApiError,
    asAccountName,
    asBusinessName,
    asLedgerName,
    postJournalEntry,
    removeStagedLine,
    stageLine,
    type StagedLine,
  } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import { formatMinor } from '../components/MoneyText.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  type Step = 'reference' | 'lines' | 'line-account' | 'line-debit' | 'line-credit' | 'posted';

  let { businessName, ledgerName, onBack }: { businessName: string; ledgerName: string; onBack: () => void } = $props();

  function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
  function dollarsToMinor(text: string): number {
    const n = Number(text.trim());
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100);
  }

  let step: Step = $state('reference');
  let reference = $state('');
  let lines: StagedLine[] = $state([]);
  let selected = $state(0);
  let error: string | null = $state(null);
  let busy = $state(false);

  let account = $state('');
  let debit = $state('');
  let credit = $state('');

  // Debit/Credit are mutually exclusive, same as the web screen's own
  // two columns: typing into one clears the other.
  $effect(() => {
    if (debit) credit = '';
  });
  $effect(() => {
    if (credit) debit = '';
  });

  const debitTotal = $derived(lines.reduce((sum, l) => sum + Math.max(l.amount_minor, 0), 0));
  const creditTotal = $derived(lines.reduce((sum, l) => sum + Math.max(-l.amount_minor, 0), 0));
  const balanced = $derived(lines.length > 0 && debitTotal === creditTotal);

  // Escape means the same thing - "back out one level" - on every step
  // of this screen, not just 'lines'. ↑/↓/I/D/Enter only apply while on
  // the 'lines' step; the line-entry sub-steps use TextInput's own Enter
  // (via onSubmit) to move between fields instead.
  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') {
      if (step === 'reference' || step === 'posted' || step === 'lines') {
        onBack();
      } else {
        step = 'lines';
      }
      return true;
    }
    if (step !== 'lines') return;
    switch (event.key) {
      case 'ArrowDown':
        selected = Math.min(selected + 1, Math.max(lines.length - 1, 0));
        return true;
      case 'ArrowUp':
        selected = Math.max(selected - 1, 0);
        return true;
      case 'Enter':
        if (balanced) void post();
        return true;
      default:
        if (event.key === 'i') {
          account = '';
          debit = '';
          credit = '';
          step = 'line-account';
          return true;
        }
        if (event.key === 'd' && lines[selected]) {
          void removeLine(selected);
          return true;
        }
        return false;
    }
  });
  onDestroy(unsubscribe);

  async function addLine() {
    const debitMinor = dollarsToMinor(debit);
    const creditMinor = dollarsToMinor(credit);
    if (!account.trim() || (debitMinor === 0 && creditMinor === 0)) {
      error = 'A line needs an account and a debit or credit amount.';
      step = 'lines';
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
    busy = true;
    error = null;
    try {
      await stageLine(line);
      lines = [...lines, line];
      step = 'lines';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not stage that line.';
      step = 'lines';
    } finally {
      busy = false;
    }
  }

  async function removeLine(index: number) {
    const line = lines[index];
    busy = true;
    error = null;
    try {
      await removeStagedLine(line.reference, line.business, line.ledger, line.account);
      lines = lines.filter((_, i) => i !== index);
      selected = Math.max(0, Math.min(selected, lines.length - 1));
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not remove that line.';
    } finally {
      busy = false;
    }
  }

  async function post() {
    busy = true;
    error = null;
    try {
      await postJournalEntry(reference, asBusinessName(businessName), asLedgerName(ledgerName));
      step = 'posted';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not post this entry.';
    } finally {
      busy = false;
    }
  }
</script>

{#if step === 'reference'}
  <Panel title={`General Journal — ${businessName} / ${ledgerName}`} focused>
    <Box flexDirection="row">
      <Box width={14}>
        <Text text="Reference" color={brass} />
      </Box>
      <TextInput bind:value={reference} focused onSubmit={() => { if (reference.trim()) step = 'lines'; }} />
    </Box>
    <Text text="Enter to continue · Escape back to menu" color={inkSoft} dim />
  </Panel>
{:else if step === 'line-account' || step === 'line-debit' || step === 'line-credit'}
  <Panel title={`New line — ${reference}`} focused>
    <Box flexDirection="row">
      <Box width={10}>
        <Text text="Account" color={step === 'line-account' ? brass : inkSoft} />
      </Box>
      <TextInput bind:value={account} focused={step === 'line-account'} onSubmit={() => (step = 'line-debit')} />
    </Box>
    <Box flexDirection="row">
      <Box width={10}>
        <Text text="Debit" color={step === 'line-debit' ? brass : inkSoft} />
      </Box>
      <TextInput
        bind:value={debit}
        focused={step === 'line-debit'}
        onSubmit={() => (step = 'line-credit')}
      />
    </Box>
    <Box flexDirection="row">
      <Box width={10}>
        <Text text="Credit" color={step === 'line-credit' ? brass : inkSoft} />
      </Box>
      <TextInput
        bind:value={credit}
        focused={step === 'line-credit'}
        onSubmit={addLine}
      />
    </Box>
    <Text text="Enter moves to the next field · entering one of Debit/Credit clears the other · Escape cancels this line" color={inkSoft} dim />
  </Panel>
{:else if step === 'posted'}
  <Panel title={`General Journal — ${businessName} / ${ledgerName}`} focused>
    <Text text={`Posted — ${reference}, ${lines.length} line${lines.length === 1 ? '' : 's'}, $${formatMinor(debitTotal)} each side.`} color={brass} bold />
    <Text text="Escape back to menu" color={inkSoft} dim />
  </Panel>
{:else}
  <Panel title={`General Journal — ${reference}`} focused>
    <Box flexDirection="column">
      <Text text={`${'Account'.padEnd(26)}Debit / Credit`} color={inkSoft} />
      <Text text={`${'Total'.padEnd(26)}$${formatMinor(debitTotal)} debit / $${formatMinor(creditTotal)} credit`} bold />
      <Text
        text={
          lines.length === 0
            ? 'No lines staged yet — press I to add one.'
            : lines
                .map((l, i) => {
                  const amount =
                    l.amount_minor > 0 ? `$${formatMinor(l.amount_minor)} debit` : l.amount_minor < 0 ? `$${formatMinor(-l.amount_minor)} credit` : '';
                  return `${i === selected ? '› ' : '  '}${l.account.padEnd(24)}${amount}`;
                })
                .join('\n')
        }
        color={ink}
      />
      <Text text="I add a line · ↑/↓ select · D delete selected · Enter posts (once balanced) · Escape back to menu" color={inkSoft} dim />
      <Text text={!balanced && lines.length > 0 ? 'Not yet balanced — debits and credits must match before posting.' : ''} color="yellow" />
      <Text text={error ?? ''} color="red" />
      {#if busy}<Text text="Working…" color={inkSoft} />{/if}
    </Box>
  </Panel>
{/if}

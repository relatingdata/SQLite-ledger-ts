<!--
  The real, live General Journal stage-then-post flow - mirrors
  frontend/src/routes/post/+page.svelte's own two-step mechanism
  exactly: each line is staged individually (POST /journal/staging),
  then the whole, balanced entry is posted in one, final, separate
  step (POST /journal/post) - never one, combined, artificial call.
  Debit/Credit are two separate fields, mutually exclusive, the same
  way the web screen's own two columns work; amount_minor = debit -
  credit, the same real sign convention the backend expects.

  It opens on the entry's lines, as the web screen opens on its grid. I
  adds a line, asking for the web screen's fields in its order:
  reference (blank keeps the entry's), account (picked from the
  business's postable accounts), debit, credit; Enter on the credit
  stages the line. Lines are staged on the server as they are added, and
  the entry being written is remembered while the TUI runs, so leaving
  the screen and coming back finds its lines again. Enter on the lines
  posts the entry, read back from the server's staged lines, once it
  balances.
-->
<script lang="ts" module>
  // The entry being written in each business and ledger, kept while the
  // TUI runs so the screen finds its staged lines again when reopened.
  const currentReference = new Map<string, string>();
</script>

<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { keyboard } from 'sveltui';
  import { onDestroy } from 'svelte';
  import {
    ApiError,
    asAccountName,
    asBusinessName,
    asLedgerName,
    getPostableAccounts,
    getStagedLines,
    postJournalEntry,
    removeStagedLine,
    stageLine,
    type EntityNode,
    type StagedLine,
  } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import SelectList from '../components/SelectList.svelte';
  import { formatMinor } from '../components/MoneyText.svelte';
  import { brass, ink, inkSoft } from '../theme.ts';

  type Step = 'lines' | 'line-reference' | 'line-account' | 'line-debit' | 'line-credit' | 'posted';

  let { businessName, ledgerName, onBack }: { businessName: string; ledgerName: string; onBack: () => void } = $props();
  const entryKey = `${businessName}\u0000${ledgerName}`;

  function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
  function dollarsToMinor(text: string): number {
    const n = Number(text.trim());
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100);
  }

  let step: Step = $state('lines');
  let reference = $state(currentReference.get(entryKey) ?? '');
  let lines: StagedLine[] = $state([]);
  let selected = $state(0);
  let error: string | null = $state(null);
  let busy = $state(false);
  let postedLines = $state(0);
  let postedTotal = $state(0);

  let accounts: EntityNode[] | null = $state(null);
  let referenceInput = $state('');
  let account = $state('');
  let debit = $state('');
  let credit = $state('');

  $effect(() => {
    if (debit) credit = '';
  });
  $effect(() => {
    if (credit) debit = '';
  });

  getPostableAccounts(businessName)
    .then((rows) => (accounts = rows))
    .catch((err) => (error = err instanceof ApiError ? err.message : 'Could not load the accounts.'));

  async function loadLines() {
    if (!reference) { lines = []; return; }
    try {
      lines = await getStagedLines(reference, asBusinessName(businessName), asLedgerName(ledgerName));
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not read the staged lines.';
    }
  }
  void loadLines();

  const debitTotal = $derived(lines.reduce((sum, l) => sum + Math.max(l.amount_minor, 0), 0));
  const creditTotal = $derived(lines.reduce((sum, l) => sum + Math.max(-l.amount_minor, 0), 0));
  const balanced = $derived(lines.length > 0 && debitTotal === creditTotal);

  const unsubscribe = keyboard.on((event) => {
    if (event.key === 'Escape') {
      if (step === 'posted' || step === 'lines') onBack();
      else step = 'lines';
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
        void post();
        return true;
      default:
        if (event.key === 'i') {
          referenceInput = '';
          account = '';
          debit = '';
          credit = '';
          error = null;
          step = 'line-reference';
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

  async function chooseReference() {
    const next = referenceInput.trim() || reference;
    if (!next) return;
    if (next !== reference) {
      reference = next;
      currentReference.set(entryKey, next);
      await loadLines();
    }
    step = 'line-account';
  }

  async function addLine() {
    const debitMinor = dollarsToMinor(debit);
    const creditMinor = dollarsToMinor(credit);
    if (!account || (debitMinor === 0 && creditMinor === 0)) {
      error = 'A line needs an account and a debit or credit amount.';
      step = 'lines';
      return;
    }
    const line: StagedLine = {
      reference,
      business: asBusinessName(businessName),
      ledger: asLedgerName(ledgerName),
      transdate: todayIso(),
      account: asAccountName(account),
      amount_minor: debitMinor - creditMinor,
    };
    busy = true;
    error = null;
    step = 'lines';
    try {
      await stageLine(line);
      await loadLines();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not stage that line.';
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
      await loadLines();
      selected = Math.max(0, Math.min(selected, lines.length - 1));
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not remove that line.';
    } finally {
      busy = false;
    }
  }

  // Posts what the server has staged for this entry, read back first, so
  // Enter works however soon it comes after the screen opens.
  async function post() {
    if (busy || !reference) return;
    busy = true;
    error = null;
    try {
      await loadLines();
      if (!balanced) {
        error = 'Not yet balanced — debits and credits must match before posting.';
        return;
      }
      postedLines = lines.length;
      postedTotal = debitTotal;
      await postJournalEntry(reference, asBusinessName(businessName), asLedgerName(ledgerName));
      currentReference.delete(entryKey);
      step = 'posted';
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not post this entry.';
    } finally {
      busy = false;
    }
  }

  const accountLabel = (a: EntityNode) => (a.accountnumber ? `${a.accountnumber} — ${a.name}` : a.name);
</script>

<!-- Each step has a Panel of its own: content that appears inside a Panel
     that stays mounted draws blank (docs/tui-design.md, "Running on
     Svelte 5.56"). -->
{#if step === 'line-reference'}
  <Panel title={`New line — ${businessName} / ${ledgerName}`} focused>
    <Box flexDirection="row">
      <Box width={14}><Text text="Reference" color={brass} /></Box>
      <TextInput bind:value={referenceInput} focused onSubmit={() => void chooseReference()} />
    </Box>
    <Text text={reference ? `Blank keeps ${reference} · Enter continues · Escape cancels this line` : 'e.g. GJ-1001 · Enter continues · Escape cancels this line'} color={inkSoft} dim />
  </Panel>
{:else if step === 'line-account' && accounts}
  <Panel title={`New line — ${reference} — account`} focused>
    <SelectList limit={14} items={accounts.map((a) => ({ label: accountLabel(a), value: a.name }))} onSelect={(item) => { account = item.value; step = 'line-debit'; }} />
    <Text text="↑/↓ move · Enter choose · Escape cancels this line" color={inkSoft} dim />
  </Panel>
{:else if step === 'line-account'}
  <Panel title={`New line — ${reference} — account`} focused>
    <Text text={error ?? 'Loading…'} color={error ? 'red' : inkSoft} />
  </Panel>
{:else if step === 'line-debit' || step === 'line-credit'}
  <Panel title={`New line — ${reference} — ${account}`} focused>
    <Box flexDirection="row">
      <Box width={10}><Text text="Debit" color={step === 'line-debit' ? brass : inkSoft} /></Box>
      <TextInput bind:value={debit} focused={step === 'line-debit'} onSubmit={() => (step = 'line-credit')} />
    </Box>
    <Box flexDirection="row">
      <Box width={10}><Text text="Credit" color={step === 'line-credit' ? brass : inkSoft} /></Box>
      <TextInput bind:value={credit} focused={step === 'line-credit'} onSubmit={addLine} />
    </Box>
    <Text text="Dollars, e.g. 5000.00 · Enter moves to the next field, then stages the line · entering one of Debit/Credit clears the other · Escape cancels this line" color={inkSoft} dim />
  </Panel>
{:else if step === 'posted'}
  <Panel title={`General Journal — ${businessName} / ${ledgerName}`} focused>
    <Text text={`Posted — ${reference}, ${postedLines} line${postedLines === 1 ? '' : 's'}, $${formatMinor(postedTotal)} each side.`} color={brass} bold />
    <Text text="Escape back to menu" color={inkSoft} dim />
  </Panel>
{:else}
  <Panel title={`General Journal — ${businessName} / ${ledgerName}${reference ? ` — ${reference}` : ''}`} focused>
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
      <Text text={error ?? (busy ? 'Working…' : '')} color={error ? 'red' : inkSoft} />
    </Box>
  </Panel>
{/if}

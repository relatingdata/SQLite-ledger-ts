// A TUI port of the web app's "AR Sale" screen
// (frontend/src/routes/arap/ar-sale/+page.svelte) — a sale to a
// customer on credit, using the real, shared AR/AP invoice mechanism
// (createInvoice -> postInvoiceById). A line naming a real catalog item
// is dispatched from stock automatically, alongside the invoice, exactly
// like the web screen (dispatchStock, called only when at least one
// line matches a real item). Customer is a free-text field here, same
// stated v1 simplification the General Journal's own Account field
// already makes (docs/tui-design.md) — Location uses a real picker
// instead, since it's a small, bounded, per-business list.
//
// Deliberately out of scope for this v1 screen, same, real reasons as
// Payment.tsx's own omissions: the web screen's non-blocking
// over-credit-limit warning (getCreditStatus) and its customer picker
// drawn from the real entity tree (here, free-text, matching every
// other counterparty field in this TUI) — the sale itself still posts
// exactly the same either way, including against a provided but
// genuinely over-limit customer. The named customer must already
// exist — confirmed live, createInvoice resolves counterpartyName
// against an exact, existing entity name and does not create one on
// the fly, despite the Customers screen's own intro text (and this
// screen's web counterpart) suggesting otherwise; a real customer is
// created today only via the Structured Editor or an API-side fixture
// step, not from this screen or Customers.tsx.
import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import {
  ApiError,
  asBusinessName,
  asLedgerName,
  createInvoice,
  dispatchStock,
  listItems,
  listLocations,
  postInvoiceById,
  type ItemSummary,
  type LocationRecord,
} from '../api.js';
import { Panel } from '../components/Panel.js';
import { MoneyText } from '../components/MoneyText.js';
import { brass, ink, inkSoft } from '../theme.js';

type Step =
  | 'reference'
  | 'customer'
  | 'tax-rate'
  | 'location'
  | 'description'
  | 'lines'
  | 'line-item'
  | 'line-qty'
  | 'line-price'
  | 'saved';

type Line = { itemName: string; quantity: number; unitPriceMinor: number };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function dollarsToMinor(text: string): number {
  const n = Number(text.trim());
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

const NO_LOCATION = '__no_location__';

export function ARSale({ businessName, ledgerName, onBack }: { businessName: string; ledgerName: string; onBack: () => void }) {
  const [step, setStep] = useState<Step>('reference');
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [items, setItems] = useState<ItemSummary[]>([]);

  const [reference, setReference] = useState('');
  const [customer, setCustomer] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [locationName, setLocationName] = useState('');
  const [description, setDescription] = useState('');

  const [lines, setLines] = useState<Line[]>([]);
  const [selected, setSelected] = useState(0);
  const [lineItemName, setLineItemName] = useState('');
  // Both start blank, not pre-filled — see the matching note in
  // Purchase.tsx; ink-text-input's own TextInput appends at the cursor
  // rather than replacing on first keystroke the way a web <input> with
  // a bound value does.
  const [lineQty, setLineQty] = useState('');
  const [linePrice, setLinePrice] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ reference: string; totalMinor: number } | null>(null);

  useEffect(() => {
    void listLocations(asBusinessName(businessName)).then(setLocations).catch(() => {});
    void listItems(businessName)
      .then((r) => setItems(r.rows))
      .catch(() => {});
  }, [businessName]);

  const itemsByName = new Map(items.map((i) => [i.name, i]));
  const taxRateNumber = taxRate ? Number(taxRate) : 0;
  const subtotalMinor = lines.reduce((s, l) => s + l.quantity * l.unitPriceMinor, 0);
  const taxMinor = Number.isFinite(taxRateNumber) ? Math.round(subtotalMinor * (taxRateNumber / 100)) : 0;
  const totalMinor = subtotalMinor + taxMinor;

  useInput((input, key) => {
    if (key.escape) {
      if (step === 'reference' || step === 'saved') return onBack();
      if (step === 'customer') return setStep('reference');
      if (step === 'tax-rate') return setStep('customer');
      if (step === 'location') return setStep('tax-rate');
      if (step === 'description') return setStep('location');
      if (step === 'lines') return setStep('description');
      if (step === 'line-item' || step === 'line-qty' || step === 'line-price') return setStep('lines');
      return;
    }
    if (step !== 'lines') return;
    if (key.downArrow) setSelected((s) => Math.min(s + 1, Math.max(lines.length - 1, 0)));
    if (key.upArrow) setSelected((s) => Math.max(s - 1, 0));
    if (input === 'i') {
      setLineItemName('');
      setLineQty('');
      setLinePrice('');
      setStep('line-item');
    }
    if ((input === 'd' || key.backspace) && lines[selected]) {
      setLines((prev) => prev.filter((_, i) => i !== selected));
      setSelected((s) => Math.max(0, Math.min(s, lines.length - 2)));
    }
    // Enter finalizes - standardized across every TUI screen (see
    // Purchase.tsx's own comment on this same convention change).
    if (key.return && lines.length > 0) void save();
  });

  function addLine() {
    const name = lineItemName.trim();
    const qty = Number(lineQty);
    const priceMinor = dollarsToMinor(linePrice);
    if (!name || !Number.isFinite(qty) || qty <= 0) {
      setError('A line needs an item name and a positive quantity.');
      setStep('lines');
      return;
    }
    setLines((prev) => [...prev, { itemName: name, quantity: qty, unitPriceMinor: priceMinor }]);
    setError(null);
    setStep('lines');
  }

  async function save() {
    if (!reference.trim() || !customer.trim() || lines.length === 0) {
      setError('Reference, customer, and at least one item line are all required.');
      return;
    }
    const stockLines = lines.filter((l) => itemsByName.has(l.itemName));
    if (stockLines.length > 0 && !locationName) {
      setError('Select a location — these items will be dispatched from stock.');
      setStep('location');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const transdate = todayIso();
      const { id } = await createInvoice({
        invoiceType: 'AR',
        business: asBusinessName(businessName),
        ledger: asLedgerName(ledgerName),
        reference,
        counterpartyName: customer.trim(),
        invoiceDate: transdate,
        description: description || undefined,
        lines: lines.map((l) => ({
          description: l.itemName,
          quantity: l.quantity,
          unitPriceMinor: l.unitPriceMinor,
          amountMinor: l.quantity * l.unitPriceMinor,
          taxMinor: taxRate ? Math.round(l.quantity * l.unitPriceMinor * (taxRateNumber / 100)) : 0,
          itemName: l.itemName,
        })),
      });
      // Dispatch first, deliberately, same as the web screen and Cash
      // Sale — it's the step most likely to fail (not enough stock on
      // hand), and a failed dispatch must never leave a posted invoice
      // behind for stock that was never actually sent out.
      if (stockLines.length > 0) {
        await dispatchStock({
          business: asBusinessName(businessName),
          ledger: asLedgerName(ledgerName),
          reference,
          locationName,
          lines: stockLines.map((l) => ({ itemName: l.itemName, quantity: l.quantity })),
          transdate,
        });
      }
      await postInvoiceById(id, 'Sales Revenue', 'Sales Tax Payable');
      setSaved({ reference, totalMinor });
      setStep('saved');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record this sale.');
    } finally {
      setBusy(false);
    }
  }

  const title = `AR Sale — ${businessName} / ${ledgerName}`;

  if (step === 'reference') {
    return (
      <Panel title={title} focused>
        <Text color={inkSoft}>A sale to a customer on credit — debits their Accounts Receivable balance, credits Sales Revenue.</Text>
        <Box>
          <Box width={14}><Text color={brass}>Reference</Text></Box>
          <TextInput value={reference} onChange={setReference} onSubmit={() => reference.trim() && setStep('customer')} />
        </Box>
        <Text color={inkSoft} dimColor>Enter continues · Escape back to menu</Text>
      </Panel>
    );
  }
  if (step === 'customer') {
    return (
      <Panel title={`${title} — ${reference}`} focused>
        <Box><Box width={14}><Text color={brass}>Customer</Text></Box><TextInput value={customer} onChange={setCustomer} onSubmit={() => customer.trim() && setStep('tax-rate')} /></Box>
        <Text color={inkSoft} dimColor>Type an existing customer's exact name · Enter continues · Escape back</Text>
      </Panel>
    );
  }
  if (step === 'tax-rate') {
    return (
      <Panel title={`${title} — ${reference}`} focused>
        <Box><Box width={14}><Text color={brass}>Tax %</Text></Box><TextInput value={taxRate} onChange={setTaxRate} onSubmit={() => setStep('location')} /></Box>
        <Text color={inkSoft} dimColor>Optional, e.g. 10 for 10% · Enter continues (blank is fine) · Escape back</Text>
      </Panel>
    );
  }
  if (step === 'location') {
    const selectItems = [{ label: 'Not yet known', value: NO_LOCATION }, ...locations.map((l) => ({ label: l.name, value: l.name }))];
    return (
      <Panel title={`${title} — ${reference}`} focused>
        <SelectInput items={selectItems} onSelect={(item) => { setLocationName(item.value === NO_LOCATION ? '' : item.value); setStep('description'); }} />
        <Text color={inkSoft} dimColor>Where item lines will be dispatched from stock · Escape back</Text>
      </Panel>
    );
  }
  if (step === 'description') {
    return (
      <Panel title={`${title} — ${reference}`} focused>
        <Box><Box width={14}><Text color={brass}>Description</Text></Box><TextInput value={description} onChange={setDescription} onSubmit={() => setStep('lines')} /></Box>
        <Text color={inkSoft} dimColor>Optional · Enter continues · Escape back</Text>
      </Panel>
    );
  }
  if (step === 'line-item' || step === 'line-qty' || step === 'line-price') {
    return (
      <Panel title={`New line — ${reference}`} focused>
        <Box><Box width={10}><Text color={step === 'line-item' ? brass : inkSoft}>Item</Text></Box><TextInput value={lineItemName} onChange={setLineItemName} focus={step === 'line-item'} onSubmit={() => setStep('line-qty')} /></Box>
        <Box><Box width={10}><Text color={step === 'line-qty' ? brass : inkSoft}>Quantity</Text></Box><TextInput value={lineQty} onChange={setLineQty} focus={step === 'line-qty'} onSubmit={() => setStep('line-price')} /></Box>
        <Box><Box width={10}><Text color={step === 'line-price' ? brass : inkSoft}>Price</Text></Box><TextInput value={linePrice} onChange={setLinePrice} focus={step === 'line-price'} onSubmit={addLine} /></Box>
        {error && <Text color="red">{error}</Text>}
        <Text color={inkSoft} dimColor>Enter moves to the next field · Escape cancels this line</Text>
      </Panel>
    );
  }
  if (step === 'saved' && saved) {
    return (
      <Panel title={title} focused>
        <Text color={brass} bold>Sale {saved.reference} recorded — <MoneyText minorUnits={saved.totalMinor} /></Text>
        <Text color={inkSoft} dimColor>Escape back to menu</Text>
      </Panel>
    );
  }

  // step === 'lines'
  return (
    <Panel title={`${title} — ${reference}`} focused>
      <Box flexDirection="column">
        <Box>
          <Box width={24}><Text color={inkSoft}>Item</Text></Box>
          <Box width={12}><Text color={inkSoft}>Quantity</Text></Box>
          <Box width={14}><Text color={inkSoft}>Unit price</Text></Box>
        </Box>
        {lines.length === 0 && <Text color={inkSoft}>No lines yet — press I to add one.</Text>}
        {lines.map((l, i) => (
          <Box key={`${l.itemName}-${i}`}>
            <Box width={24}><Text color={i === selected ? brass : ink}>{i === selected ? '› ' : '  '}{l.itemName}</Text></Box>
            <Box width={12}><Text color={ink}>{l.quantity}</Text></Box>
            <Box width={14}><MoneyText minorUnits={l.unitPriceMinor} /></Box>
          </Box>
        ))}
        {lines.length > 0 && (
          <Box marginTop={1}>
            <Box width={24}><Text bold>Total owed</Text></Box>
            <MoneyText minorUnits={totalMinor} />
            <Text color={inkSoft}> (tax: <MoneyText minorUnits={taxMinor} />)</Text>
          </Box>
        )}
        {error && <Text color="red">{error}</Text>}
        {busy && <Text color={inkSoft}>Working…</Text>}
        <Text color={inkSoft} dimColor>
          I add a line · ↑/↓ select · D delete selected · Enter saves (once at least one line) · Escape back
        </Text>
      </Box>
    </Panel>
  );
}

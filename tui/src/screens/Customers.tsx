// A TUI port of the web app's "Customers" screen
// (frontend/src/routes/contacts/+page.svelte, focus=customers) — browse
// real, account-based customers and edit their contact details
// (getContact/setContact). Customer (and provider) contacts aren't
// scoped to one business — createContact's own backend implementation
// (backend/src/db.ts) places every real customer as a direct child of
// the one, real, global entity literally named "Customers", confirmed
// live (`GET /entities`, unscoped) — so this screen reads the
// unscoped entity tree and filters on that exact parent name, not a
// per-business one. Matching the real web screen's own intro text:
// customers aren't created here at all — on the real web app a new one
// is only ever created in passing, as a side effect of some other,
// real action (e.g. the first AR Sale naming it) — this screen only
// lists and edits ones that already exist.
//
// Deliberately out of scope for this v1 screen, same, real reason as
// every other simplification in this TUI: addresses, phone numbers,
// and counterparty transaction history (AddressList.svelte,
// PhoneList.svelte, ContactList.svelte, getCounterpartyHistory) are
// real, optional extras on the web screen; preferred-language and
// wage/salary fields are left out too (the latter only ever apply to
// employees, not customers, on the web screen itself). Email, payment
// terms, credit limit, and reminder level — enough to make the credit
// limit this screen itself can set actually mean something on the next
// AR Sale — are real and fully saved either way.
import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { ApiError, getContact, getCreditStatus, getEntityTree, setContact, type Contact, type CreditStatus, type EntityNode } from '../api.js';
import { Panel } from '../components/Panel.js';
import { MoneyText } from '../components/MoneyText.js';
import { brass, ink, inkSoft } from '../theme.js';

type Step = 'list' | 'email' | 'terms' | 'credit-limit' | 'reminder-level' | 'saved';

function dollarsToMinorOrNull(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
function intOrNull(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function Customers({ businessName, onBack }: { businessName: string; onBack: () => void }) {
  const [step, setStep] = useState<Step>('list');
  const [entities, setEntities] = useState<EntityNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedName, setSelectedName] = useState('');
  const [email, setEmail] = useState('');
  const [termsDays, setTermsDays] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [reminderLevel, setReminderLevel] = useState('');
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Unscoped — see the comment above: real customer contacts aren't
    // business-scoped, so this intentionally does not pass businessName
    // the way the Purchasing screens' own listLocations/listItems calls
    // do.
    getEntityTree()
      .then(setEntities)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load customers.'));
  }, []);

  // Real customer contacts only — excludes the generic link/tag child
  // records setEntityLink creates under the same "Customers" container
  // (e.g. "Customers — Hierarchy: Header Account"), always named
  // "<entity> — <linkType>" per that mechanism's own, real convention
  // (see setHierarchyParent/getEntityLinksPointingAt in backend/src/db.ts).
  const customers = (entities ?? []).filter(
    (e) => (entities ?? []).find((p) => p.id === e.parent_id)?.name === 'Customers' && !e.name.includes(' — ')
  );

  useInput((_input, key) => {
    if (key.escape) {
      if (step === 'list') return onBack();
      if (step === 'email') return setStep('list');
      if (step === 'terms') return setStep('email');
      if (step === 'credit-limit') return setStep('terms');
      if (step === 'reminder-level') return setStep('credit-limit');
      if (step === 'saved') return setStep('list');
      return;
    }
  });

  async function selectCustomer(name: string) {
    setSelectedName(name);
    setMessage(null);
    setError(null);
    try {
      const [contact, status] = await Promise.all([getContact(name), getCreditStatus(name)]);
      setEmail(contact?.email ?? '');
      setTermsDays(contact?.payment_terms_days != null ? String(contact.payment_terms_days) : '');
      setCreditLimit(contact?.credit_limit_minor != null ? (contact.credit_limit_minor / 100).toFixed(2) : '');
      setReminderLevel(contact?.reminder_level != null ? String(contact.reminder_level) : '0');
      setCreditStatus(status);
      setStep('email');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this customer.');
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const update: Partial<Contact> = {
        email: email.trim() || null,
        payment_terms_days: intOrNull(termsDays),
        credit_limit_minor: dollarsToMinorOrNull(creditLimit),
        reminder_level: intOrNull(reminderLevel) ?? 0,
      };
      await setContact(selectedName, update);
      setMessage(`Saved ${selectedName}.`);
      setStep('saved');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this customer.');
    } finally {
      setBusy(false);
    }
  }

  const title = `Customers — ${businessName}`;

  if (!entities) {
    return <Panel title={title} focused><Text color={inkSoft}>Loading…</Text></Panel>;
  }

  if (step === 'list') {
    return (
      <Panel title={title} focused>
        <Text color={inkSoft}>Real, account-based customers — created today only via the Structured Editor or an API-side fixture step, not from this screen.</Text>
        {customers.length === 0 ? (
          <Text color={inkSoft}>None yet.</Text>
        ) : (
          <SelectInput items={customers.map((c) => ({ label: c.name, value: c.name }))} onSelect={(item) => void selectCustomer(item.value)} />
        )}
        {error && <Text color="red">{error}</Text>}
        <Text color={inkSoft} dimColor>Enter opens a customer's details · Escape back to menu</Text>
      </Panel>
    );
  }

  if (step === 'saved') {
    return (
      <Panel title={title} focused>
        <Text color={brass} bold>{message}</Text>
        <Text color={inkSoft} dimColor>Escape back to the customer list</Text>
      </Panel>
    );
  }

  const creditLine = creditStatus
    ? creditStatus.limitMinor === null
      ? <Text color={inkSoft}>Current balance: <MoneyText minorUnits={creditStatus.balanceMinor} dim /> — no credit limit set.</Text>
      : creditStatus.overLimit
      ? <Text color="red">Over limit — balance <MoneyText minorUnits={creditStatus.balanceMinor} /> exceeds the <MoneyText minorUnits={creditStatus.limitMinor} /> limit.</Text>
      : <Text color={inkSoft}>Balance <MoneyText minorUnits={creditStatus.balanceMinor} dim /> of <MoneyText minorUnits={creditStatus.limitMinor} dim /> limit.</Text>
    : null;

  return (
    <Panel title={`${title} — ${selectedName}`} focused>
      <Box><Box width={22}><Text color={step === 'email' ? brass : ink}>Email</Text></Box><TextInput value={email} onChange={setEmail} focus={step === 'email'} onSubmit={() => setStep('terms')} /></Box>
      <Box><Box width={22}><Text color={step === 'terms' ? brass : ink}>Payment terms (days)</Text></Box><TextInput value={termsDays} onChange={setTermsDays} focus={step === 'terms'} onSubmit={() => setStep('credit-limit')} /></Box>
      <Box><Box width={22}><Text color={step === 'credit-limit' ? brass : ink}>Credit limit</Text></Box><TextInput value={creditLimit} onChange={setCreditLimit} focus={step === 'credit-limit'} onSubmit={() => setStep('reminder-level')} /></Box>
      <Box><Box width={22}><Text color={step === 'reminder-level' ? brass : ink}>Reminder level</Text></Box><TextInput value={reminderLevel} onChange={setReminderLevel} focus={step === 'reminder-level'} onSubmit={() => void save()} /></Box>
      {creditLine}
      {error && <Text color="red">{error}</Text>}
      {busy && <Text color={inkSoft}>Working…</Text>}
      <Text color={inkSoft} dimColor>
        0 payment terms means cash only · blank credit limit means no limit · Enter moves to the next field, saves on the last · Escape back
      </Text>
    </Panel>
  );
}

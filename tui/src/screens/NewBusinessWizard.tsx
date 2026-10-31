// A TUI port of frontend/src/routes/setup/new-business/+page.svelte's
// real flow: business basics -> POST /businesses (createBusiness) ->
// show the generated admin credentials exactly once -> the
// post-creation bank/currency wizard (nominateBankAccount, then
// buildBankCurrencyStructure). Same endpoints, same payload shapes —
// see tui/src/api.ts. Deliberately out of scope for this v1 screen,
// same as the rest of this TUI's stated scope (docs/tui-design.md):
// the business-type Q&A (saveBusinessTypeAnswers) and the live
// CoA-prototype preview — both are optional extras on the web screen,
// not required to create a working business.
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import {
  ApiError,
  buildBankCurrencyStructure,
  createBusiness,
  nominateBankAccount,
  type CreateBusinessResult,
  type EntityStructure,
  type ReportingFrequency,
} from '../api.js';
import { Panel } from '../components/Panel.js';
import { brass, ink, inkSoft } from '../theme.js';

type Step =
  | 'name'
  | 'fy-label'
  | 'fy-start'
  | 'reporting-frequency'
  | 'coa-prototype'
  | 'entity-structure'
  | 'partners'
  | 'home-currency'
  | 'secondary-currencies'
  | 'confirm'
  | 'created'
  | 'bank-name'
  | 'bank-routing'
  | 'bank-account-number'
  | 'banks-list'
  | 'combos'
  | 'done';

const REPORTING_FREQUENCIES: { label: string; value: ReportingFrequency }[] = [
  { label: 'Annual', value: 'annual' },
  { label: 'Biannual (every 6 months)', value: 'biannual' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Monthly', value: 'monthly' },
];
const COA_PROTOTYPES = [
  { label: 'English / generic', value: 'English CoA' },
  { label: 'German', value: 'German CoA' },
  { label: 'French', value: 'French CoA' },
];
const ENTITY_STRUCTURES: { label: string; value: EntityStructure; needsPartners: boolean }[] = [
  { label: 'Sole Trader', value: 'sole_trader', needsPartners: false },
  { label: 'Partnership', value: 'partnership', needsPartners: true },
  { label: 'Limited Liability Company', value: 'llc', needsPartners: true },
  { label: 'Unlimited Liability Company', value: 'unlimited_liability', needsPartners: false },
  { label: 'Publicly Traded Company', value: 'publicly_traded', needsPartners: false },
];

function defaultFyLabel(): string {
  const y = new Date().getFullYear();
  return `${y}-${String(y + 1).slice(2)}`;
}
function defaultFyStart(): string {
  return `${new Date().getFullYear()}-07-01`;
}

interface NominatedBank {
  name: string;
  routingDetail: string;
  accountNumber: string;
}

export function NewBusinessWizard({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>('name');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Business basics
  const [businessName, setBusinessName] = useState('');
  const [fyLabel, setFyLabel] = useState(defaultFyLabel());
  const [fyStart, setFyStart] = useState(defaultFyStart());
  const [reportingFrequency, setReportingFrequency] = useState<ReportingFrequency>('annual');
  const [coaPrototype, setCoaPrototype] = useState('English CoA');
  const [entityStructure, setEntityStructure] = useState<EntityStructure>('sole_trader');
  const [needsPartners, setNeedsPartners] = useState(false);
  const [partnerInput, setPartnerInput] = useState('');
  const [partnerNames, setPartnerNames] = useState<string[]>([]);
  const [homeCurrency, setHomeCurrency] = useState('AUD');
  const [currencyInput, setCurrencyInput] = useState('');
  const [secondaryCurrencies, setSecondaryCurrencies] = useState<string[]>([]);

  const [result, setResult] = useState<CreateBusinessResult | null>(null);

  // Bank wizard
  const [bankName, setBankName] = useState('');
  const [bankRouting, setBankRouting] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [nominatedBanks, setNominatedBanks] = useState<NominatedBank[]>([]);
  const [combos, setCombos] = useState<{ bankAccountName: string; currency: string; ticked: boolean }[]>([]);
  const [comboSelected, setComboSelected] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      if (step === 'banks-list' || step === 'combos') {
        onBack(); // the business itself already exists by this point — Escape just skips the rest of the optional bank wizard
        return;
      }
      if (step !== 'created' && step !== 'done') onBack();
      return;
    }
    if (step === 'banks-list') {
      if (input === 'i') setStep('bank-name');
      if (input === 'c' && nominatedBanks.length > 0) startCombos();
    }
    if (step === 'combos') {
      if (key.downArrow) setComboSelected((s) => Math.min(s + 1, combos.length - 1));
      if (key.upArrow) setComboSelected((s) => Math.max(s - 1, 0));
      if (input === ' ') {
        setCombos((prev) => prev.map((c, i) => (i === comboSelected ? { ...c, ticked: !c.ticked } : c)));
      }
      if (key.return) void buildCombos();
    }
    if (step === 'done' && key.return) onBack();
  });

  async function submitBusiness() {
    setBusy(true);
    setError(null);
    try {
      const created = await createBusiness(
        businessName.trim(),
        fyLabel.trim(),
        coaPrototype,
        secondaryCurrencies.length > 0 ? secondaryCurrencies : undefined,
        entityStructure,
        needsPartners && partnerNames.length > 0 ? partnerNames : undefined,
        fyStart || undefined,
        reportingFrequency
      );
      setResult(created);
      setStep('created');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create business.');
      setStep('confirm');
    } finally {
      setBusy(false);
    }
  }

  async function addBank() {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      await nominateBankAccount(result.business, bankName.trim(), bankRouting.trim(), bankAccountNumber.trim());
      setNominatedBanks((prev) => [...prev, { name: bankName.trim(), routingDetail: bankRouting.trim(), accountNumber: bankAccountNumber.trim() }]);
      setBankName('');
      setBankRouting('');
      setBankAccountNumber('');
      setStep('banks-list');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not nominate that bank account.');
      setStep('banks-list');
    } finally {
      setBusy(false);
    }
  }

  function startCombos() {
    const allCurrencies = [homeCurrency, ...secondaryCurrencies];
    const built = nominatedBanks.flatMap((b) =>
      allCurrencies.map((c) => ({ bankAccountName: b.name, currency: c, ticked: c === homeCurrency }))
    );
    setCombos(built);
    setComboSelected(0);
    setStep('combos');
  }

  async function buildCombos() {
    if (!result) return;
    const selections = combos.filter((c) => c.ticked).map(({ bankAccountName, currency }) => ({ bankAccountName, currency }));
    if (selections.length === 0) {
      setStep('done');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await buildBankCurrencyStructure(result.business, 'Cash at Bank', 'asset', selections, homeCurrency.trim().toUpperCase());
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not build the Cash at Bank structure.');
    } finally {
      setBusy(false);
    }
  }

  const hint = (text: string) => (
    <Text color={inkSoft} dimColor>
      {text}
    </Text>
  );

  if (step === 'name') {
    return (
      <Panel title="New Business — name" focused>
        <TextInput value={businessName} onChange={setBusinessName} onSubmit={() => businessName.trim() && setStep('fy-label')} />
        {hint('Enter continues · Escape cancels')}
      </Panel>
    );
  }
  if (step === 'fy-label') {
    return (
      <Panel title={`New Business — ${businessName} — financial year label`} focused>
        <TextInput value={fyLabel} onChange={setFyLabel} onSubmit={() => fyLabel.trim() && setStep('fy-start')} />
        {hint('Names the Budget ledger (e.g. "2026-27") · Enter continues · Escape cancels')}
      </Panel>
    );
  }
  if (step === 'fy-start') {
    return (
      <Panel title={`New Business — ${businessName} — financial year start date`} focused>
        <TextInput value={fyStart} onChange={setFyStart} onSubmit={() => setStep('reporting-frequency')} />
        {hint('YYYY-MM-DD · Enter continues · Escape cancels')}
      </Panel>
    );
  }
  if (step === 'reporting-frequency') {
    return (
      <Panel title={`New Business — ${businessName} — reporting frequency`} focused>
        <SelectInput
          items={REPORTING_FREQUENCIES}
          onSelect={(item) => {
            setReportingFrequency(item.value);
            setStep('coa-prototype');
          }}
        />
        {hint('↑/↓ move · Enter select · Escape cancels')}
      </Panel>
    );
  }
  if (step === 'coa-prototype') {
    return (
      <Panel title={`New Business — ${businessName} — Chart of Accounts prototype`} focused>
        <SelectInput
          items={COA_PROTOTYPES}
          onSelect={(item) => {
            setCoaPrototype(item.value);
            setStep('entity-structure');
          }}
        />
        {hint('↑/↓ move · Enter select · Escape cancels')}
      </Panel>
    );
  }
  if (step === 'entity-structure') {
    return (
      <Panel title={`New Business — ${businessName} — legal structure`} focused>
        <SelectInput
          items={ENTITY_STRUCTURES}
          onSelect={(item) => {
            const choice = ENTITY_STRUCTURES.find((s) => s.value === item.value) ?? ENTITY_STRUCTURES[0];
            setEntityStructure(choice.value);
            setNeedsPartners(choice.needsPartners);
            setStep(choice.needsPartners ? 'partners' : 'home-currency');
          }}
        />
        {hint('↑/↓ move · Enter select · Escape cancels')}
      </Panel>
    );
  }
  if (step === 'partners') {
    return (
      <Panel title={`New Business — ${businessName} — partners`} focused>
        {partnerNames.map((p) => (
          <Text key={p} color={ink}>
            • {p}
          </Text>
        ))}
        <TextInput
          value={partnerInput}
          onChange={setPartnerInput}
          onSubmit={() => {
            const name = partnerInput.trim();
            if (name) {
              setPartnerNames((prev) => [...prev, name]);
              setPartnerInput('');
            } else {
              setStep('home-currency');
            }
          }}
        />
        {hint('Enter a partner\'s name and press Enter to add another · empty Enter continues · Escape cancels')}
      </Panel>
    );
  }
  if (step === 'home-currency') {
    return (
      <Panel title={`New Business — ${businessName} — home currency`} focused>
        <TextInput value={homeCurrency} onChange={(v) => setHomeCurrency(v.toUpperCase())} onSubmit={() => homeCurrency.trim() && setStep('secondary-currencies')} />
        {hint('e.g. AUD · Enter continues · Escape cancels')}
      </Panel>
    );
  }
  if (step === 'secondary-currencies') {
    return (
      <Panel title={`New Business — ${businessName} — additional currencies (optional)`} focused>
        {secondaryCurrencies.map((c) => (
          <Text key={c} color={ink}>
            • {c}
          </Text>
        ))}
        <TextInput
          value={currencyInput}
          onChange={(v) => setCurrencyInput(v.toUpperCase())}
          onSubmit={() => {
            const code = currencyInput.trim();
            if (code && !secondaryCurrencies.includes(code)) {
              setSecondaryCurrencies((prev) => [...prev, code]);
              setCurrencyInput('');
            } else {
              setStep('confirm');
            }
          }}
        />
        {hint('e.g. EUR, press Enter to add another · empty Enter continues · Escape cancels')}
      </Panel>
    );
  }
  if (step === 'confirm') {
    return (
      <Panel title={`New Business — ${businessName} — review`} focused>
        <Text color={ink}>Financial year: {fyLabel} (starts {fyStart}, {reportingFrequency})</Text>
        <Text color={ink}>Chart of Accounts prototype: {coaPrototype}</Text>
        <Text color={ink}>Legal structure: {ENTITY_STRUCTURES.find((s) => s.value === entityStructure)?.label}</Text>
        {needsPartners && <Text color={ink}>Partners: {partnerNames.join(', ') || '(none entered)'}</Text>}
        <Text color={ink}>Home currency: {homeCurrency}{secondaryCurrencies.length > 0 ? `, also ${secondaryCurrencies.join(', ')}` : ''}</Text>
        {error && <Text color="red">{error}</Text>}
        {busy && <Text color={inkSoft}>Creating…</Text>}
        <Box marginTop={1}>
          <SelectInput items={[{ label: 'Create this business', value: 'create' }]} onSelect={() => void submitBusiness()} />
        </Box>
        {hint('Enter creates the business · Escape cancels')}
      </Panel>
    );
  }
  if (step === 'created' && result) {
    return (
      <Panel title={`${result.business} — created`} focused>
        <Text color={brass} bold>
          {result.business} created, with two real ledgers: {result.actualLedger} and {result.budgetLedger}.
        </Text>
        <Text color="yellow">A dedicated admin user was created for this business. Copy this password now — it is shown only once.</Text>
        <Text color={ink}>Username: {result.businessAdmin.username}</Text>
        <Text color={ink}>Password: {result.businessAdmin.password}</Text>
        <Box marginTop={1}>
          <SelectInput items={[{ label: 'Continue to bank accounts', value: 'go' }]} onSelect={() => setStep('bank-name')} />
        </Box>
        {hint('Enter continues to the optional bank/currency wizard')}
      </Panel>
    );
  }
  if (step === 'bank-name' || step === 'bank-routing' || step === 'bank-account-number') {
    return (
      <Panel title={`${result?.business} — nominate a bank account`} focused>
        <Box>
          <Box width={16}>
            <Text color={step === 'bank-name' ? brass : inkSoft}>Bank name</Text>
          </Box>
          <TextInput value={bankName} onChange={setBankName} focus={step === 'bank-name'} onSubmit={() => bankName.trim() && setStep('bank-routing')} />
        </Box>
        <Box>
          <Box width={16}>
            <Text color={step === 'bank-routing' ? brass : inkSoft}>BSB/routing</Text>
          </Box>
          <TextInput value={bankRouting} onChange={setBankRouting} focus={step === 'bank-routing'} onSubmit={() => setStep('bank-account-number')} />
        </Box>
        <Box>
          <Box width={16}>
            <Text color={step === 'bank-account-number' ? brass : inkSoft}>Account number</Text>
          </Box>
          <TextInput value={bankAccountNumber} onChange={setBankAccountNumber} focus={step === 'bank-account-number'} onSubmit={() => void addBank()} />
        </Box>
        {error && <Text color="red">{error}</Text>}
        {busy && <Text color={inkSoft}>Saving…</Text>}
        {hint('Enter moves to the next field, then saves · Escape cancels the bank wizard')}
      </Panel>
    );
  }
  if (step === 'banks-list') {
    return (
      <Panel title={`${result?.business} — nominated bank accounts`} focused>
        {nominatedBanks.length === 0 && <Text color={inkSoft}>No bank accounts nominated yet — press I to add one.</Text>}
        {nominatedBanks.map((b) => (
          <Text key={b.name} color={ink}>
            • {b.name} — {b.routingDetail} — {b.accountNumber}
          </Text>
        ))}
        {hint('I add a bank account · C continue to currency setup · Escape skip the rest of the bank wizard')}
      </Panel>
    );
  }
  if (step === 'combos') {
    const allCurrencies = [homeCurrency, ...secondaryCurrencies];
    return (
      <Panel title={`${result?.business} — Cash at Bank by currency`} focused>
        <Text color={inkSoft}>Tick which bank/currency pairs should get a real "Cash at Bank" account.</Text>
        {combos.map((c, i) => (
          <Text key={`${c.bankAccountName}-${c.currency}`} color={i === comboSelected ? brass : ink}>
            {i === comboSelected ? '› ' : '  '}[{c.ticked ? 'x' : ' '}] {c.bankAccountName} — {c.currency}
          </Text>
        ))}
        {allCurrencies.length === 1 && combos.length > 0 && <Text color={inkSoft}>(one currency — every bank account is ticked for it by default)</Text>}
        {error && <Text color="red">{error}</Text>}
        {busy && <Text color={inkSoft}>Building…</Text>}
        {hint('↑/↓ move · Space toggle · Enter build the real structure · Escape skip')}
      </Panel>
    );
  }
  // step === 'done'
  return (
    <Panel title={`${result?.business} — ready`} focused>
      <Text color={brass} bold>
        {result?.business} is set up and ready to post real transactions in.
      </Text>
      {hint('Enter/Escape back to menu')}
    </Panel>
  );
}

// A real, required prerequisite before Menu/Journal/Balance Sheet make
// sense — every one of them is scoped to one business (and, for
// Journal/Balance Sheet, one ledger), the same real constraint the web
// app has. See docs/tui-design.md, scope item 2.
import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { ApiError, getBusinesses, getLedgers, getSession, setSessionBusiness, setSession } from '../api.js';
import { Panel } from '../components/Panel.js';
import { inkSoft } from '../theme.js';

export function ChooseBusiness({ onChosen }: { onChosen: (businessName: string, ledgerName: string) => void }) {
  const [step, setStep] = useState<'business' | 'ledger'>('business');
  const [businesses, setBusinesses] = useState<{ id: number; name: string }[] | null>(null);
  const [ledgers, setLedgers] = useState<{ id: number; name: string }[] | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBusinesses()
      .then(setBusinesses)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load businesses.'));
  }, []);

  async function chooseBusiness(name: string) {
    setBusinessName(name);
    try {
      await setSessionBusiness(name);
      const rows = await getLedgers(name);
      setLedgers(rows);
      setStep('ledger');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load ledgers.');
    }
  }

  function chooseLedger(ledgerName: string) {
    const session = getSession();
    if (session) setSession({ ...session, businessName: businessName!, ledgerName });
    onChosen(businessName!, ledgerName);
  }

  if (error) return <Panel title="Choose a business"><Text color="red">{error}</Text></Panel>;

  if (step === 'business') {
    if (!businesses) return <Panel title="Choose a business"><Text color={inkSoft}>Loading…</Text></Panel>;
    return (
      <Panel title="Choose a business" focused>
        <SelectInput items={businesses.map((b) => ({ label: b.name, value: b.name }))} onSelect={(item) => chooseBusiness(item.value)} />
      </Panel>
    );
  }

  if (!ledgers) return <Panel title="Choose a ledger"><Text color={inkSoft}>Loading…</Text></Panel>;
  return (
    <Panel title={`Choose a ledger — ${businessName}`} focused>
      <SelectInput items={ledgers.map((l) => ({ label: l.name, value: l.name }))} onSelect={(item) => chooseLedger(item.value)} />
    </Panel>
  );
}

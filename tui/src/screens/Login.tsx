import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { apiLogin, ApiError, setSession } from '../api.js';
import { Panel } from '../components/Panel.js';
import { brass, inkSoft } from '../theme.js';

export function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [field, setField] = useState<'username' | 'password'>('username');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { token, user } = await apiLogin(username, password);
      setSession({ token, user });
      onLoggedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log in.');
      setBusy(false);
    }
  }

  return (
    <Panel title="sql-ledger-ts — Log in" focused>
      <Box flexDirection="column" gap={1}>
        <Box>
          <Box width={12}>
            <Text color={field === 'username' ? brass : inkSoft}>Username</Text>
          </Box>
          <TextInput
            value={username}
            onChange={setUsername}
            focus={field === 'username'}
            onSubmit={() => setField('password')}
          />
        </Box>
        <Box>
          <Box width={12}>
            <Text color={field === 'password' ? brass : inkSoft}>Password</Text>
          </Box>
          <TextInput value={password} onChange={setPassword} focus={field === 'password'} mask="*" onSubmit={submit} />
        </Box>
        {error && <Text color="red">{error}</Text>}
        {busy && <Text color={inkSoft}>Logging in…</Text>}
        <Text color={inkSoft} dimColor>
          Enter on Username moves to Password · Enter on Password logs in
        </Text>
      </Box>
    </Panel>
  );
}

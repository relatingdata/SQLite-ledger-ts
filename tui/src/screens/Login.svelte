<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { apiLogin, ApiError, setSession } from '../api.ts';
  import Panel from '../components/Panel.svelte';
  import TextInput from '../components/TextInput.svelte';
  import { inkSoft, brass } from '../theme.ts';

  let { onLoggedIn }: { onLoggedIn: () => void } = $props();

  let username = $state('');
  let password = $state('');
  let field: 'username' | 'password' = $state('username');
  let error: string | null = $state(null);
  let busy = $state(false);

  async function submit() {
    if (busy) return;
    busy = true;
    error = null;
    try {
      const { token, user } = await apiLogin(username, password);
      setSession({ token, user });
      onLoggedIn();
    } catch (err) {
      error = err instanceof ApiError ? err.message : 'Could not log in.';
      busy = false;
    }
  }
</script>

<Panel title="sql-ledger-ts — Log in" focused>
  <Box flexDirection="column" gap={1}>
    <Box flexDirection="row">
      <Box width={12}>
        <Text text="Username" color={field === 'username' ? brass : inkSoft} />
      </Box>
      <TextInput bind:value={username} focused={field === 'username'} onSubmit={() => (field = 'password')} />
    </Box>
    <Box flexDirection="row">
      <Box width={12}>
        <Text text="Password" color={field === 'password' ? brass : inkSoft} />
      </Box>
      <TextInput bind:value={password} focused={field === 'password'} mask="*" onSubmit={submit} />
    </Box>
    {#if error}<Text text={error} color="red" />{/if}
    {#if busy}<Text text="Logging in…" color={inkSoft} />{/if}
    <Text text="Enter on Username moves to Password · Enter on Password logs in" color={inkSoft} dim />
  </Box>
</Panel>

<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { brass, rule, ruleStrong } from '../theme.ts';
  import type { Snippet } from 'svelte';

  let { title, focused = false, children }: { title: string; focused?: boolean; children?: Snippet } = $props();
</script>

<Box flexDirection="column" border="rounded" borderColor={focused ? ruleStrong : rule} paddingX={1} marginY={0}>
  <Text text={title} color={brass} bold />
  <Box marginTop={1} flexDirection="column">
    {@render children?.()}
  </Box>
</Box>

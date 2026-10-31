// A bordered box echoing the web app's own card/panel chrome
// (frontend/src/lib/app.css's `--rule`/`--rule-strong`/`--brass`
// tokens) — see docs/tui-design.md's theme table.
import React from 'react';
import { Box, Text } from 'ink';
import { brass, rule, ruleStrong } from '../theme.js';

export function Panel({
  title,
  focused = false,
  children,
}: {
  title: string;
  focused?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={focused ? ruleStrong : rule}
      paddingX={1}
      marginBottom={1}
    >
      <Text color={brass} bold>
        {title}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {children}
      </Box>
    </Box>
  );
}

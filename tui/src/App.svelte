<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { getSession, whenSessionEnds } from './api.ts';
  import Login from './screens/Login.svelte';
  import ChooseBusiness from './screens/ChooseBusiness.svelte';
  import Menu, { type MenuScreenKey } from './screens/Menu.svelte';
  import GeneralJournal from './screens/GeneralJournal.svelte';
  import BusinessStructure from './screens/BusinessStructure.svelte';
  import NewBusinessWizard from './screens/NewBusinessWizard.svelte';
  import Payment from './screens/Payment.svelte';
  import Customers from './screens/Customers.svelte';
  import POS from './screens/POS.svelte';
  import ItemsBom from './screens/ItemsBom.svelte';
  import Locations from './screens/Locations.svelte';
  import { generatedScreens } from './generated/screens.ts';
  import { inkSoft } from './theme.ts';

  type ScreenState =
    | { name: 'login' }
    | { name: 'choose-business'; startWith?: string }
    | { name: 'first-business' }
    | { name: MenuScreenKey; businessName: string; ledgerName: string }
    | { name: 'menu'; businessName: string; ledgerName: string }
    | { name: 'generated'; route: string; businessName: string; ledgerName: string };

  function initialScreen(): ScreenState {
    const session = getSession();
    if (!session) return { name: 'login' };
    if (session.businessName && session.ledgerName) {
      return { name: 'menu', businessName: session.businessName, ledgerName: session.ledgerName };
    }
    return { name: 'choose-business' };
  }

  let screen: ScreenState = $state(initialScreen());
  // A saved session the backend no longer accepts (an old token, a
  // business since removed) goes back to the login screen.
  whenSessionEnds(() => (screen = { name: 'login' }));

  function backToMenu() {
    if ('businessName' in screen) screen = { name: 'menu', businessName: screen.businessName, ledgerName: screen.ledgerName };
  }
</script>

<Box flexDirection="column">
  <Text
    text="sql-ledger-ts — text user interface"
    color={inkSoft}
    dim
  />
  {#if screen.name === 'login'}
    <Login onLoggedIn={() => (screen = { name: 'choose-business' })} />
  {:else if screen.name === 'choose-business'}
    <ChooseBusiness
      startWith={screen.startWith}
      onChosen={(businessName, ledgerName) => (screen = { name: 'menu', businessName, ledgerName })}
      onNewBusiness={() => (screen = { name: 'first-business' })}
    />
  {:else if screen.name === 'first-business'}
    <NewBusinessWizard onBack={() => (screen = { name: 'choose-business' })} onWorkIn={(businessName) => (screen = { name: 'choose-business', startWith: businessName })} />
  {:else if screen.name === 'menu'}
    <Menu
      businessName={screen.businessName}
      onOpenScreen={(key) => (screen = { name: key, businessName: screen.businessName, ledgerName: screen.ledgerName })}
      onOpenGenerated={(route) => (screen = { name: 'generated', route, businessName: screen.businessName, ledgerName: screen.ledgerName })}
    />
  {:else if screen.name === 'generated'}
    {@const Generated = generatedScreens[screen.route]}
    <Generated businessName={screen.businessName} ledgerName={screen.ledgerName} onBack={backToMenu} />
  {:else if screen.name === 'general-journal'}
    <GeneralJournal businessName={screen.businessName} ledgerName={screen.ledgerName} onBack={backToMenu} />
  {:else if screen.name === 'business-structure'}
    <BusinessStructure businessName={screen.businessName} onBack={backToMenu} />
  {:else if screen.name === 'new-business-wizard'}
    <NewBusinessWizard onBack={backToMenu} onWorkIn={(businessName) => (screen = { name: 'choose-business', startWith: businessName })} />
  {:else if screen.name === 'payment'}
    <Payment businessName={screen.businessName} ledgerName={screen.ledgerName} onBack={backToMenu} />
  {:else if screen.name === 'customers'}
    <Customers businessName={screen.businessName} onBack={backToMenu} />
  {:else if screen.name === 'pos'}
    <POS businessName={screen.businessName} ledgerName={screen.ledgerName} onBack={backToMenu} />
  {:else if screen.name === 'items-bom'}
    <ItemsBom businessName={screen.businessName} onBack={backToMenu} />
  {:else if screen.name === 'locations'}
    <Locations businessName={screen.businessName} onBack={backToMenu} />
  {/if}
</Box>

<script lang="ts">
  import { Box, Text } from 'sveltui';
  import { getSession, whenSessionEnds } from './api.ts';
  import Login from './screens/Login.svelte';
  import ChooseBusiness from './screens/ChooseBusiness.svelte';
  import Menu, { type MenuScreenKey } from './screens/Menu.svelte';
  import BalanceSheet from './screens/BalanceSheet.svelte';
  import GeneralJournal from './screens/GeneralJournal.svelte';
  import BusinessStructure from './screens/BusinessStructure.svelte';
  import NewBusinessWizard from './screens/NewBusinessWizard.svelte';
  import Purchase from './screens/Purchase.svelte';
  import CashPurchase from './screens/CashPurchase.svelte';
  import PurchaseOrder from './screens/PurchaseOrder.svelte';
  import Payment from './screens/Payment.svelte';
  import ARSale from './screens/ARSale.svelte';
  import CashSale from './screens/CashSale.svelte';
  import Customers from './screens/Customers.svelte';
  import POS from './screens/POS.svelte';
  import ItemsBom from './screens/ItemsBom.svelte';
  import TransferItems from './screens/TransferItems.svelte';
  import Locations from './screens/Locations.svelte';
  import { inkSoft } from './theme.ts';

  type ScreenState =
    | { name: 'login' }
    | { name: 'choose-business'; startWith?: string }
    | { name: 'first-business' }
    | { name: MenuScreenKey; businessName: string; ledgerName: string }
    | { name: 'menu'; businessName: string; ledgerName: string };

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
    text="sql-ledger-ts — text user interface (SvelTUI: Login, Menu, General Journal, Balance Sheet, New Business, Business Structure, Purchase, Cash Purchase, Purchase Order, Payment, AR Sale, Cash Sale, Customers, POS Terminal, Items & BOM, Transfer Items, Locations)"
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
    <Menu businessName={screen.businessName} onOpenScreen={(key) => (screen = { name: key, businessName: screen.businessName, ledgerName: screen.ledgerName })} />
  {:else if screen.name === 'balance-sheet'}
    <BalanceSheet businessName={screen.businessName} ledgerName={screen.ledgerName} onBack={backToMenu} />
  {:else if screen.name === 'general-journal'}
    <GeneralJournal businessName={screen.businessName} ledgerName={screen.ledgerName} onBack={backToMenu} />
  {:else if screen.name === 'business-structure'}
    <BusinessStructure businessName={screen.businessName} onBack={backToMenu} />
  {:else if screen.name === 'new-business-wizard'}
    <NewBusinessWizard onBack={backToMenu} onWorkIn={(businessName) => (screen = { name: 'choose-business', startWith: businessName })} />
  {:else if screen.name === 'purchase'}
    <Purchase businessName={screen.businessName} ledgerName={screen.ledgerName} onBack={backToMenu} />
  {:else if screen.name === 'cash-purchase'}
    <CashPurchase businessName={screen.businessName} ledgerName={screen.ledgerName} onBack={backToMenu} />
  {:else if screen.name === 'purchase-order'}
    <PurchaseOrder businessName={screen.businessName} ledgerName={screen.ledgerName} onBack={backToMenu} />
  {:else if screen.name === 'payment'}
    <Payment businessName={screen.businessName} ledgerName={screen.ledgerName} onBack={backToMenu} />
  {:else if screen.name === 'ar-sale'}
    <ARSale businessName={screen.businessName} ledgerName={screen.ledgerName} onBack={backToMenu} />
  {:else if screen.name === 'cash-sale'}
    <CashSale businessName={screen.businessName} ledgerName={screen.ledgerName} onBack={backToMenu} />
  {:else if screen.name === 'customers'}
    <Customers businessName={screen.businessName} onBack={backToMenu} />
  {:else if screen.name === 'pos'}
    <POS businessName={screen.businessName} ledgerName={screen.ledgerName} onBack={backToMenu} />
  {:else if screen.name === 'items-bom'}
    <ItemsBom businessName={screen.businessName} onBack={backToMenu} />
  {:else if screen.name === 'locations'}
    <Locations businessName={screen.businessName} onBack={backToMenu} />
  {:else if screen.name === 'transfer-items'}
    <TransferItems businessName={screen.businessName} ledgerName={screen.ledgerName} onBack={backToMenu} />
  {/if}
</Box>

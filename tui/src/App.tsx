import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { getSession } from './api.js';
import { Login } from './screens/Login.js';
import { ChooseBusiness } from './screens/ChooseBusiness.js';
import { Menu, type MenuScreenKey } from './screens/Menu.js';
import { GeneralJournal } from './screens/GeneralJournal.js';
import { BalanceSheet } from './screens/BalanceSheet.js';
import { NewBusinessWizard } from './screens/NewBusinessWizard.js';
import { BusinessStructure } from './screens/BusinessStructure.js';
import { Purchase } from './screens/Purchase.js';
import { CashPurchase } from './screens/CashPurchase.js';
import { PurchaseOrder } from './screens/PurchaseOrder.js';
import { Payment } from './screens/Payment.js';
import { ARSale } from './screens/ARSale.js';
import { CashSale } from './screens/CashSale.js';
import { Customers } from './screens/Customers.js';
import { POS } from './screens/POS.js';
import { inkSoft } from './theme.js';

type Screen =
  | { name: 'login' }
  | { name: 'choose-business' }
  | { name: 'menu'; businessName: string; ledgerName: string }
  | { name: 'general-journal'; businessName: string; ledgerName: string }
  | { name: 'balance-sheet'; businessName: string; ledgerName: string }
  | { name: 'new-business-wizard'; businessName: string; ledgerName: string }
  | { name: 'business-structure'; businessName: string; ledgerName: string }
  | { name: 'purchase'; businessName: string; ledgerName: string }
  | { name: 'cash-purchase'; businessName: string; ledgerName: string }
  | { name: 'purchase-order'; businessName: string; ledgerName: string }
  | { name: 'payment'; businessName: string; ledgerName: string }
  | { name: 'ar-sale'; businessName: string; ledgerName: string }
  | { name: 'cash-sale'; businessName: string; ledgerName: string }
  | { name: 'customers'; businessName: string; ledgerName: string }
  | { name: 'pos'; businessName: string; ledgerName: string };

function initialScreen(): Screen {
  const session = getSession();
  if (!session) return { name: 'login' };
  if (session.businessName && session.ledgerName) {
    return { name: 'menu', businessName: session.businessName, ledgerName: session.ledgerName };
  }
  return { name: 'choose-business' };
}

export function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const { exit } = useApp();

  useInput((input, key) => {
    if (screen.name === 'menu' && !key.escape && input === 'q') exit();
  });

  return (
    <Box flexDirection="column">
      <Text color={inkSoft} dimColor>
        sql-ledger-ts — text user interface (test implementation: Login, Menu, General Journal, Balance Sheet, New Business, Business Structure, Purchase, Cash Purchase, Purchase Order, Payment, AR Sale, Cash Sale, Customers, POS Terminal)
      </Text>
      {screen.name === 'login' && <Login onLoggedIn={() => setScreen({ name: 'choose-business' })} />}
      {screen.name === 'choose-business' && (
        <ChooseBusiness onChosen={(businessName, ledgerName) => setScreen({ name: 'menu', businessName, ledgerName })} />
      )}
      {screen.name === 'menu' && (
        <Menu
          businessName={screen.businessName}
          onOpenScreen={(key: MenuScreenKey) =>
            setScreen({ name: key, businessName: screen.businessName, ledgerName: screen.ledgerName } as Screen)
          }
        />
      )}
      {screen.name === 'general-journal' && (
        <GeneralJournal
          businessName={screen.businessName}
          ledgerName={screen.ledgerName}
          onBack={() => setScreen({ name: 'menu', businessName: screen.businessName, ledgerName: screen.ledgerName })}
        />
      )}
      {screen.name === 'balance-sheet' && (
        <BalanceSheet
          businessName={screen.businessName}
          ledgerName={screen.ledgerName}
          onBack={() => setScreen({ name: 'menu', businessName: screen.businessName, ledgerName: screen.ledgerName })}
        />
      )}
      {screen.name === 'new-business-wizard' && (
        <NewBusinessWizard onBack={() => setScreen({ name: 'menu', businessName: screen.businessName, ledgerName: screen.ledgerName })} />
      )}
      {screen.name === 'business-structure' && (
        <BusinessStructure
          businessName={screen.businessName}
          onBack={() => setScreen({ name: 'menu', businessName: screen.businessName, ledgerName: screen.ledgerName })}
        />
      )}
      {screen.name === 'purchase' && (
        <Purchase
          businessName={screen.businessName}
          ledgerName={screen.ledgerName}
          onBack={() => setScreen({ name: 'menu', businessName: screen.businessName, ledgerName: screen.ledgerName })}
        />
      )}
      {screen.name === 'cash-purchase' && (
        <CashPurchase
          businessName={screen.businessName}
          ledgerName={screen.ledgerName}
          onBack={() => setScreen({ name: 'menu', businessName: screen.businessName, ledgerName: screen.ledgerName })}
        />
      )}
      {screen.name === 'purchase-order' && (
        <PurchaseOrder
          businessName={screen.businessName}
          ledgerName={screen.ledgerName}
          onBack={() => setScreen({ name: 'menu', businessName: screen.businessName, ledgerName: screen.ledgerName })}
        />
      )}
      {screen.name === 'payment' && (
        <Payment
          businessName={screen.businessName}
          ledgerName={screen.ledgerName}
          onBack={() => setScreen({ name: 'menu', businessName: screen.businessName, ledgerName: screen.ledgerName })}
        />
      )}
      {screen.name === 'ar-sale' && (
        <ARSale
          businessName={screen.businessName}
          ledgerName={screen.ledgerName}
          onBack={() => setScreen({ name: 'menu', businessName: screen.businessName, ledgerName: screen.ledgerName })}
        />
      )}
      {screen.name === 'cash-sale' && (
        <CashSale
          businessName={screen.businessName}
          ledgerName={screen.ledgerName}
          onBack={() => setScreen({ name: 'menu', businessName: screen.businessName, ledgerName: screen.ledgerName })}
        />
      )}
      {screen.name === 'customers' && (
        <Customers
          businessName={screen.businessName}
          onBack={() => setScreen({ name: 'menu', businessName: screen.businessName, ledgerName: screen.ledgerName })}
        />
      )}
      {screen.name === 'pos' && (
        <POS
          businessName={screen.businessName}
          ledgerName={screen.ledgerName}
          onBack={() => setScreen({ name: 'menu', businessName: screen.businessName, ledgerName: screen.ledgerName })}
        />
      )}
    </Box>
  );
}

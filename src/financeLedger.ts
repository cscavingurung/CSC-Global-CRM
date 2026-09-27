import { createContext, useContext } from 'react';
import { FinTransaction, ServicePrice } from './types';

// The branch finance ledger, shared app-wide so any Client Profile can show a client's
// financials and raise requests without every list that opens the profile passing it down.
// Mirrors CommunicationsContext.
interface FinanceLedgerValue {
  transactions: FinTransaction[];
  /** Adds a new ledger row — used for counselor requests (discounts, payment exceptions). */
  addTransaction: (t: FinTransaction) => void;
  /** The Super Admin's Service Charges price list. */
  servicePrices: ServicePrice[];
  /** A client's current counselor (by Client ID) — payments are credited to whoever holds the
   * client when the money is collected ("who collects it keeps it"). */
  counselorOf: (clientId: string) => string | undefined;
}

export const FinanceLedgerContext = createContext<FinanceLedgerValue>({ transactions: [], addTransaction: () => {}, servicePrices: [], counselorOf: () => undefined });

export function useFinanceLedger(): FinanceLedgerValue {
  return useContext(FinanceLedgerContext);
}

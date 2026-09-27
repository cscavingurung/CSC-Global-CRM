import { createContext, useContext } from 'react';
import { CommunicationEntry } from './types';

interface CommunicationsValue {
  entries: CommunicationEntry[];
  addEntry: (entry: CommunicationEntry) => void;
}

/** Communication Log entries for every client, shared so any profile can show and add to them. */
export const CommunicationsContext = createContext<CommunicationsValue>({ entries: [], addEntry: () => {} });

export function useCommunications(): CommunicationsValue {
  return useContext(CommunicationsContext);
}

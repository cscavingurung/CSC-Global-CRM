import { createContext, useContext } from 'react';
import { MockUser } from './types';

/** Signed-in user, shared so presentation pieces (greeting banner, menus) need no prop plumbing. */
export const CurrentUserContext = createContext<MockUser | null>(null);

export function useCurrentUser(): MockUser | null {
  return useContext(CurrentUserContext);
}

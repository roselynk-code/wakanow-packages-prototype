import { createContext, useContext } from 'react';

export const TripContext = createContext(null);

/** Read the shared search criteria and selected tier. */
export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used inside a <TripProvider>');
  return ctx;
}

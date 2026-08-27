import { useCallback, useMemo, useState } from 'react';

import { TripContext } from './useTrip.js';
import { addDays, formatRange, formatRangeWithYear, nightsBetween } from '../lib/dates.js';

/**
 * Carries the search criteria and the chosen tier across screens.
 *
 * Dates are the spine of the prototype: departure and return are real dates,
 * trip length is derived from them rather than stored, and every screen prices
 * hotels per night against that length. Change the dates anywhere — the search
 * bar, the builder's check-in field — and the whole flow re-prices.
 */

const DEFAULT_SEARCH = {
  fromCity: 'Lagos',
  fromCode: 'LOS',
  fromName: 'Murtala Muhammed',
  toCity: 'Dubai',
  toCode: 'DXB',
  toName: 'United Arab Emirates',
  departDate: '2026-10-12',
  returnDate: '2026-10-17',
  cabin: 'Economy',
  adults: 2,
  children: 0,
  infants: 0,
  rooms: 1,
  nationality: 'Nigeria',
  components: { flight: true, hotel: true, transfer: false, tours: false },
};

export function TripProvider({ children }) {
  const [search, setSearchState] = useState(DEFAULT_SEARCH);
  const [tier, setTier] = useState('Premium');
  // Which package is being taken to checkout. Set when the traveller books from
  // a detail screen or picks a tier, so checkout describes the trip they chose
  // rather than always assuming the Dubai tiers.
  const [bookingSlug, setBookingSlug] = useState('tier-premium');

  /** Merge a partial update into the search criteria. */
  const setSearch = useCallback((patch) => {
    setSearchState((prev) => {
      const next = {
        ...prev,
        ...patch,
        components: { ...prev.components, ...(patch.components ?? {}) },
      };
      // A return date can never precede departure. If a new departure would
      // invert the range, carry the old trip length forward instead.
      if (nightsBetween(next.departDate, next.returnDate) < 1) {
        const previousNights = Math.max(1, nightsBetween(prev.departDate, prev.returnDate));
        next.returnDate = addDays(next.departDate, previousNights);
      }
      return next;
    });
  }, []);

  /** Set both ends of the range at once — what the calendar hands back. */
  const setDates = useCallback((departDate, returnDate) => {
    setSearchState((prev) => ({ ...prev, departDate, returnDate }));
  }, []);

  /**
   * Hold the departure but run the trip for a set number of nights.
   * Opening a ready-made package uses this: the package has its own duration,
   * so a 10-night Umrah trip stops inheriting a 5-night search.
   */
  const setTripLength = useCallback((wantedNights) => {
    setSearchState((prev) =>
      nightsBetween(prev.departDate, prev.returnDate) === wantedNights
        ? prev
        : { ...prev, returnDate: addDays(prev.departDate, wantedNights) },
    );
  }, []);

  const value = useMemo(() => {
    const nights = nightsBetween(search.departDate, search.returnDate);

    /** "2 adults, 1 room" — the traveller field label on the landing page. */
    const travellerLabel = () => {
      const parts = [`${search.adults} adult${search.adults > 1 ? 's' : ''}`];
      if (search.children) parts.push(`${search.children} child${search.children > 1 ? 'ren' : ''}`);
      if (search.infants) parts.push(`${search.infants} infant${search.infants > 1 ? 's' : ''}`);
      parts.push(`${search.rooms} room${search.rooms > 1 ? 's' : ''}`);
      return parts.join(', ');
    };

    /** "2 adults · Nigeria passport" — the condensed summary-bar variant. */
    const travellerSummary = () =>
      `${search.adults} adult${search.adults > 1 ? 's' : ''} · ${search.nationality} passport`;

    return {
      search,
      setSearch,
      setDates,
      setTripLength,
      tier,
      setTier,
      bookingSlug,
      setBookingSlug,
      nights,
      dateLabel: formatRange(search.departDate, search.returnDate),
      dateLabelWithYear: formatRangeWithYear(search.departDate, search.returnDate),
      travellerLabel,
      travellerSummary,
      payingTravellers: search.adults + search.children,
    };
  }, [search, tier, bookingSlug, setSearch, setDates, setTripLength]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

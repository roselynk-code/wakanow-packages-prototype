import { useCallback, useMemo, useState } from 'react';

import { TripContext } from './useTrip.js';
import { findPackage } from '../data/packages.js';
import { addDays, formatRange, formatRangeWithYear, nightsBetween } from '../lib/dates.js';
import { buildItinerary, newLegId, routeLabel } from '../lib/itinerary.js';

/**
 * Carries the search criteria, the itinerary and the chosen tier across screens.
 *
 * Dates are the spine: departure and return are real dates, trip length is
 * derived rather than stored, and every screen prices hotels per night against
 * that length.
 *
 * A trip is a list of legs. One leg is the ordinary case and behaves exactly as
 * it always has — the search bar's date range is that leg's length. Adding a
 * destination appends a leg that starts the day the previous one ends, so the
 * search dates keep meaning "the first destination" rather than silently
 * becoming the whole trip.
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

const FIRST_LEG = { id: 'leg-0', slug: 'dubai-city-break', nights: 5 };

export function TripProvider({ children }) {
  const [search, setSearchState] = useState(DEFAULT_SEARCH);
  const [legs, setLegs] = useState([FIRST_LEG]);
  const [tier, setTier] = useState('Premium');
  const [bookingSlug, setBookingSlug] = useState('tier-premium');

  const setSearch = useCallback((patch) => {
    setSearchState((prev) => {
      const next = {
        ...prev,
        ...patch,
        components: { ...prev.components, ...(patch.components ?? {}) },
      };
      if (nightsBetween(next.departDate, next.returnDate) < 1) {
        const previousNights = Math.max(1, nightsBetween(prev.departDate, prev.returnDate));
        next.returnDate = addDays(next.departDate, previousNights);
      }
      return next;
    });
  }, []);

  const setDates = useCallback((departDate, returnDate) => {
    setSearchState((prev) => ({ ...prev, departDate, returnDate }));
  }, []);

  const setTripLength = useCallback((wantedNights) => {
    setSearchState((prev) =>
      nightsBetween(prev.departDate, prev.returnDate) === wantedNights
        ? prev
        : { ...prev, returnDate: addDays(prev.departDate, wantedNights) },
    );
  }, []);

  /** Append a destination. Its own package duration is a sensible starting length. */
  const addLeg = useCallback((slug) => {
    const pkg = findPackage(slug);
    setLegs((prev) => [...prev, { id: newLegId(), slug, nights: pkg.nights }]);
  }, []);

  /** Remove a destination. The first leg is the trip — it can be changed, not dropped. */
  const removeLeg = useCallback((id) => {
    setLegs((prev) => (prev.length > 1 ? prev.filter((leg) => leg.id !== id) : prev));
  }, []);

  const setLegSlug = useCallback((id, slug) => {
    setLegs((prev) => {
      const next = prev.map((leg) => (leg.id === id ? { ...leg, slug } : leg));
      // Changing the first destination is changing what the search is for, so
      // the search fields the other screens read follow it.
      if (next[0]?.id === id) {
        const pkg = findPackage(slug);
        setSearchState((s) => ({ ...s, toCity: pkg.city, toCode: pkg.code, toName: pkg.country }));
      }
      return next;
    });
  }, []);

  /**
   * The first leg's length is the search date range, so setting it moves the
   * return date rather than storing a number that would then disagree.
   */
  const setLegNights = useCallback(
    (id, wantedNights) => {
      const nights = Math.max(1, wantedNights);
      setLegs((prev) => {
        if (prev[0]?.id === id) {
          setTripLength(nights);
          return prev;
        }
        return prev.map((leg) => (leg.id === id ? { ...leg, nights } : leg));
      });
    },
    [setTripLength],
  );

  const value = useMemo(() => {
    const nights = nightsBetween(search.departDate, search.returnDate);

    // The first leg's length always mirrors the search dates.
    const effectiveLegs = legs.map((leg, i) => (i === 0 ? { ...leg, nights } : leg));
    const itinerary = buildItinerary(effectiveLegs, search);

    const travellerLabel = () => {
      const parts = [`${search.adults} adult${search.adults > 1 ? 's' : ''}`];
      if (search.children) parts.push(`${search.children} child${search.children > 1 ? 'ren' : ''}`);
      if (search.infants) parts.push(`${search.infants} infant${search.infants > 1 ? 's' : ''}`);
      parts.push(`${search.rooms} room${search.rooms > 1 ? 's' : ''}`);
      return parts.join(', ');
    };

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

      legs: effectiveLegs,
      itinerary,
      addLeg,
      removeLeg,
      setLegSlug,
      setLegNights,
      isMultiDestination: itinerary.length > 1,
      totalNights: itinerary.reduce((sum, e) => sum + e.nights, 0),
      tripStartDate: itinerary[0]?.startDate ?? search.departDate,
      tripEndDate: itinerary[itinerary.length - 1]?.endDate ?? search.returnDate,
      routeLabel: routeLabel(itinerary, search.fromCity),

      dateLabel: formatRange(search.departDate, search.returnDate),
      dateLabelWithYear: formatRangeWithYear(search.departDate, search.returnDate),
      travellerLabel,
      travellerSummary,
      payingTravellers: search.adults + search.children,
    };
  }, [
    search, legs, tier, bookingSlug,
    setSearch, setDates, setTripLength, addLeg, removeLeg, setLegSlug, setLegNights,
  ]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

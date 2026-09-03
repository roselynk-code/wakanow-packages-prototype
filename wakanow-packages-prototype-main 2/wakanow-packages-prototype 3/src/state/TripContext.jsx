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

  /* ── Visa documents ───────────────────────────────────────────────────────
     Collected in the builder, spent at checkout. They live here rather than in
     the builder's own state because checkout makes a claim about them — "your
     documents are already with us" — and a screen that asserts something it
     cannot see is how a prototype starts lying to the person reading it.

     `documents` is keyed `legId:documentId`. `deferred` is keyed by leg and
     records a deliberate "I'll send these later", which is a different thing
     from not having got round to it: it is the traveller choosing the second
     sequence, and it is what unblocks the step. */
  const [documents, setDocuments] = useState({});
  const [deferred, setDeferred] = useState({});

  /** Mark a set of `legId:documentId` keys as received, in one go. */
  const markDocuments = useCallback((keys) => {
    if (!keys?.length) return;
    setDocuments((prev) => {
      const next = { ...prev };
      for (const key of keys) next[key] = true;
      return next;
    });
  }, []);

  const toggleDocument = useCallback((legId, docId) => {
    setDocuments((prev) => ({ ...prev, [`${legId}:${docId}`]: !prev[`${legId}:${docId}`] }));
  }, []);

  /** Every document held for one destination, as `{ documentId: true }`. */
  const documentsFor = useCallback(
    (legId) =>
      Object.fromEntries(
        Object.entries(documents)
          .filter(([key]) => key.startsWith(`${legId}:`))
          .map(([key, value]) => [key.split(':')[1], value]),
      ),
    [documents],
  );

  const deferDocuments = useCallback((legId, on) => {
    setDeferred((prev) => ({ ...prev, [legId]: on }));
  }, []);

  /* ── The booking handed from the builder to checkout ──────────────────────
     The itinerary the customer actually built, priced once, stored whole.

     Checkout used to re-derive a price of its own by snapping the build to the
     nearest authored tier and multiplying by head count, which is why the two
     screens quoted different numbers for the same trip. It now reads this and
     only this. If it is null, nobody has been through the builder and checkout
     says so rather than inventing a trip. */
  const [booking, setBookingState] = useState(null);
  const confirmBooking = useCallback((snapshot) => setBookingState(snapshot), []);
  const clearBooking = useCallback(() => setBookingState(null), []);

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

      documents,
      documentsFor,
      markDocuments,
      toggleDocument,
      deferredDocuments: deferred,
      deferDocuments,

      /* The party every price is quoted for. One object, so no screen has to
         decide for itself whether a number is per person or for everyone. */
      party: {
        travellers: search.adults + search.children,
        rooms: search.rooms,
        adults: search.adults,
        children: search.children,
        infants: search.infants,
      },

      booking,
      confirmBooking,
      clearBooking,
    };
  }, [
    search, legs, tier, bookingSlug, documents, deferred, booking,
    setSearch, setDates, setTripLength, addLeg, removeLeg, setLegSlug, setLegNights,
    documentsFor, markDocuments, toggleDocument, deferDocuments, confirmBooking, clearBooking,
  ]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

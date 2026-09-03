/**
 * Multi-destination trips.
 *
 * A trip is an ordered list of legs. Each leg is a destination, a number of
 * nights, and everything that destination's package can supply — hotels,
 * flights in, transfers, tours and its own visa requirement. Legs run
 * back-to-back: leg two starts the day leg one ends, and you fly from wherever
 * you already are rather than from home.
 *
 * The single-leg case is deliberately special. One leg uses the destination's
 * authored return fare untouched, so a one-city trip prices exactly as it
 * always has and every published Phase 1 figure still reconciles. Only when a
 * second destination is added do flights become one-way hops plus a separate
 * journey home — a shape no authored figure covers, so nothing is contradicted.
 */

import { findPackage } from '../data/packages.js';
import { buildFares } from '../data/variants.js';
import { addDays, nightsBetween } from './dates.js';
import { PER_TRAVELLER, UNIT_PARTY, pricePackage } from './pricing.js';

const tidy = (value) => Math.round(value / 100) * 100;

/** One-way as a share of a return fare. Illustrative, like every price here. */
const ONE_WAY = 0.58;
/** A regional hop between two destinations, against that city's long-haul fare. */
const INTER_CITY = 0.42;

let legCounter = 0;
export function newLegId() {
  legCounter += 1;
  return `leg-${legCounter}`;
}

/**
 * Resolve the raw leg list into a dated itinerary.
 * Each entry knows where it starts from, because that is the previous leg's
 * destination rather than the traveller's home city.
 */
export function buildItinerary(legs, { departDate, fromCity, fromCode }) {
  let cursor = departDate;
  let originCity = fromCity;
  let originCode = fromCode;

  return legs.map((leg, index) => {
    const pkg = findPackage(leg.slug);
    const nights = Math.max(1, leg.nights ?? pkg.nights);
    const startDate = cursor;
    const endDate = addDays(startDate, nights);

    const entry = {
      ...leg,
      index,
      pkg,
      nights,
      startDate,
      endDate,
      fromCity: originCity,
      fromCode: originCode,
      toCity: pkg.city,
      toCode: pkg.code,
      country: pkg.country,
      isFirst: index === 0,
      isLast: index === legs.length - 1,
      isOnly: legs.length === 1,
    };

    cursor = endDate;
    originCity = pkg.city;
    originCode = pkg.code;
    return entry;
  });
}

/**
 * The flights offered for one leg.
 *
 * A single-destination trip keeps the authored return fares exactly. On a
 * multi-city trip every leg becomes a one-way into that city, and the journey
 * home is priced separately by `priceItinerary` — so no leg silently carries a
 * return the traveller is not taking.
 */
export function flightsForLeg(entry) {
  if (entry.isOnly) return entry.pkg.flights;

  const factor = entry.isFirst ? ONE_WAY : INTER_CITY;
  const route = `${entry.fromCity} (${entry.fromCode}) → ${entry.toCity} (${entry.toCode})`;

  return entry.pkg.flights.slice(0, 3).map((flight) => {
    const rebased = {
      ...flight,
      id: `${flight.id}-ow`,
      name: `${flight.name.split(' · ')[0]} · one way`,
      desc: `${route} · one way`,
      meta: `${route} · one way · ${flight.meta.split(' · ').slice(2).join(' · ')}`,
      price: tidy(flight.price * factor),
      separate: tidy(flight.separate * factor),
      legs: undefined,
    };
    // Fares are a function of the fare price, so the ladder is rebuilt against
    // the one-way figure rather than scaled from the return one.
    return { ...rebased, fares: buildFares(rebased) };
  });
}

/** The flight home from the final destination. Only exists on a multi-city trip. */
export function homewardFlight(itinerary, { fromCity, fromCode }, party = UNIT_PARTY) {
  if (itinerary.length < 2) return null;
  const last = itinerary[itinerary.length - 1];
  const base = last.pkg.flights[0];
  // A seat home is bought per traveller, like every other seat on the trip.
  const seats = Math.max(1, party.travellers ?? 1);
  const unitBundled = tidy(base.price * ONE_WAY);
  const unitSeparate = tidy(base.separate * ONE_WAY);
  return {
    key: 'home',
    label: `Return to ${fromCity}`,
    route: `${last.toCity} (${last.toCode}) → ${fromCity} (${fromCode})`,
    airline: base.name.split(' · ')[0],
    basis: PER_TRAVELLER,
    qty: seats,
    unitBundled,
    unitSeparate,
    bundled: unitBundled * seats,
    separate: unitSeparate * seats,
  };
}

/**
 * Price a whole itinerary: one composition per leg, aggregated.
 *
 * `selections` is keyed by leg id, each holding that leg's flight/fare/hotel/room
 * ids, which optional components are on, and its enabled add-ons.
 */
export function priceItinerary(itinerary, selections = {}, origin, party = UNIT_PARTY) {
  const legPrices = itinerary.map((entry) => {
    const chosen = selections[entry.id] ?? {};
    const options = flightsForLeg(entry);

    // pricePackage reads flights off the package, so a leg using derived
    // one-way flights is priced against a package view carrying those instead.
    const pkgForLeg = entry.isOnly ? entry.pkg : { ...entry.pkg, flights: options };

    const priced = pricePackage(pkgForLeg, {
      nights: entry.nights,
      flightId: chosen.flightId,
      fareId: chosen.fareId,
      hotelId: chosen.hotelId,
      roomId: chosen.roomId,
      includeTransfer: chosen.includeTransfer ?? true,
      includeTours: chosen.includeTours ?? true,
      addons: chosen.addons ?? [],
      party,
    });

    return { entry, priced, flightOptions: options };
  });

  const home = homewardFlight(itinerary, origin, party);

  const bundled = legPrices.reduce((sum, l) => sum + l.priced.bundled, 0) + (home?.bundled ?? 0);
  const separate = legPrices.reduce((sum, l) => sum + l.priced.separate, 0) + (home?.separate ?? 0);
  const eligible = legPrices.every((l) => l.priced.eligible);

  return {
    legPrices,
    home,
    party,
    bundled,
    separate,
    eligible,
    /* One saving, derived here, reused everywhere. Screens must not compute
       their own — that is how the builder and checkout came to disagree. */
    save: eligible ? separate - bundled : 0,
    perPerson: Math.round(bundled / Math.max(1, party.travellers ?? 1)),
    totalNights: itinerary.reduce((sum, e) => sum + e.nights, 0),
    startDate: itinerary[0]?.startDate,
    endDate: itinerary[itinerary.length - 1]?.endDate,
  };
}

/** Destinations on this trip that need a visa, one entry per leg. */
export function visaLegs(itinerary) {
  return itinerary.filter((entry) => entry.pkg.visa === 'add-on' || entry.pkg.visa === 'required');
}

/** "Lagos → Dubai → London → Lagos" */
export function routeLabel(itinerary, fromCity) {
  if (itinerary.length === 0) return fromCity;
  const cities = [fromCity, ...itinerary.map((e) => e.toCity)];
  if (itinerary.length > 1) cities.push(fromCity);
  return cities.join(' → ');
}

export { nightsBetween };

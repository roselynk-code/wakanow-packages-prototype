/**
 * One pricing function for the whole prototype.
 *
 * No package stores a total. Totals are always composed from the parts at the
 * current trip length, which is what makes every screen react when the dates
 * change: hotels are held as a nightly rate, so a 5-night trip and an 8-night
 * trip price themselves without anything else having to know.
 *
 * Two levels of choice, not one. A traveller picks a hotel *and* a room within
 * it, a flight *and* a fare class on it. The first room and the first fare are
 * always the ones the Phase 1 mockups authored.
 *
 * EVERY LINE HAS A UNIT. This is the correction that matters: flights are per
 * person, a hotel room is per room per night, a private transfer is per
 * vehicle. Multiplying all of them by the head count — which is what this file
 * used to do — charged a couple for two rooms and two cars, and charged a
 * family of four for four of everything. See src/lib/party.js.
 *
 * Because the units are right, the same arithmetic yields both quotes the
 * product needs:
 *
 *   bundled / separate   PER ADULT SHARING — the comparable headline, priced
 *                        for two adults in one room. Cards show this.
 *   party.bundled        what THIS party actually pays.
 *   singleSupplement     what one adult pays over the sharing basis, because
 *                        nobody is splitting the room with them.
 */

import {
  SHARING_BASIS,
  SOLO_BASIS,
  fareUnits,
  partyFrom,
  roomsFor,
  tourUnits,
  vehiclesFor,
  visaUnits,
} from './party.js';

export function findFlight(pkg, id) {
  return pkg.flights.find((f) => f.id === id) ?? pkg.flights[0];
}

export function findHotel(pkg, id) {
  return pkg.hotels.find((h) => h.id === id) ?? pkg.hotels[0];
}

/** Ladders are listed cheapest first, so the default is flagged, not index 0. */
export function findFare(flight, id) {
  const fares = flight.fares ?? [];
  return fares.find((f) => f.id === id) ?? fares.find((f) => f.isDefault) ?? fares[0];
}

export function findRoom(hotel, id) {
  const rooms = hotel.rooms ?? [];
  return rooms.find((r) => r.id === id) ?? rooms.find((r) => r.isDefault) ?? rooms[0];
}

/** An add-on's unit. A visa is per traveller; a tour is per person at the tour
 *  share; anything explicitly flagged per-traveller follows the head count. */
function addonUnit(addon) {
  if (addon.id === 'visa') return 'visa';
  if (addon.perTraveller) return 'head';
  return 'tour';
}

/**
 * The priced lines for one party. Called twice — once for the sharing basis
 * that every card quotes, once for the party actually booking.
 */
function composeLines(pkg, resolved, party, options) {
  const { flight, hotel, fare, room, nights } = resolved;
  const { includeTransfer = true, includeTours = true, addons = [] } = options;

  const flightPrice = fare?.price ?? flight.price;
  const flightSeparate = fare?.separate ?? flight.separate;
  const nightly = room?.nightly ?? hotel.nightly;
  const nightlySeparate = room?.nightlySeparate ?? hotel.nightlySeparate;

  const fares = fareUnits(party);
  const rooms = roomsFor(party, room);
  const roomNights = rooms * nights;

  const lines = [
    {
      key: 'flight',
      label: fare ? `Flights · ${fare.label}` : 'Flights',
      unit: 'person',
      qty: fares,
      unitBundled: flightPrice,
      unitSeparate: flightSeparate,
    },
    {
      key: 'hotel',
      label: `Hotel · ${nights} night${nights === 1 ? '' : 's'}`,
      unit: 'room',
      qty: rooms,
      // The nightly rate is per room, so a stay is rate × nights × rooms.
      unitBundled: nightly * nights,
      unitSeparate: nightlySeparate * nights,
      roomNights,
    },
  ];

  if (pkg.transfer && includeTransfer) {
    const vehicles = vehiclesFor(party, pkg.transfer);
    lines.push({
      key: 'transfer',
      label: 'Airport transfers',
      unit: 'vehicle',
      qty: vehicles,
      unitBundled: pkg.transfer.price,
      unitSeparate: pkg.transfer.separate,
    });
  }

  if (pkg.tours && includeTours) {
    lines.push({
      key: 'tours',
      label: pkg.tours.label,
      unit: 'place',
      qty: tourUnits(party),
      unitBundled: pkg.tours.price,
      unitSeparate: pkg.tours.separate,
    });
  }

  for (const id of addons) {
    const addon = pkg.addons?.find((a) => a.id === id);
    if (!addon) continue;
    const kind = addonUnit(addon);
    lines.push({
      key: `addon:${addon.id}`,
      label: addon.title,
      // A visa or an insurance policy is one per traveller; anything else on the
      // add-on shelf is a place on an excursion, at the tour share.
      unit: kind === 'tour' ? 'place' : 'person',
      qty: kind === 'visa' ? visaUnits(party) : kind === 'head' ? party.heads : tourUnits(party),
      unitBundled: addon.price,
      unitSeparate: addon.separate,
    });
  }

  // Quantities can be fractional once children travel, so every extended
  // amount is rounded to the nearest hundred — the convention the rest of the
  // catalogue uses — rather than leaving kobo on a headline figure.
  return lines.map((line) => ({
    ...line,
    bundled: Math.round((line.unitBundled * line.qty) / 100) * 100,
    separate: Math.round((line.unitSeparate * line.qty) / 100) * 100,
  }));
}

const sum = (lines, field) => lines.reduce((total, line) => total + line[field], 0);

/**
 * @param pkg      a record from src/data/packages.js
 * @param options  nights, the chosen flight/fare and hotel/room, which optional
 *                 parts are on, the enabled add-on ids, and `party` — who is
 *                 actually travelling. Without a party the sharing basis is
 *                 used, so a card can price itself without a search.
 */
export function pricePackage(pkg, options = {}) {
  const {
    nights = pkg.nights,
    flightId,
    fareId,
    hotelId,
    roomId,
    party: given,
  } = options;

  const flight = findFlight(pkg, flightId);
  const hotel = findHotel(pkg, hotelId);
  const fare = findFare(flight, fareId);
  const room = findRoom(hotel, roomId);
  const resolved = { flight, hotel, fare, room, nights };

  const party = given ? partyFrom(given) : SHARING_BASIS;

  const sharingLines = composeLines(pkg, resolved, SHARING_BASIS, options);
  const partyLines = composeLines(pkg, resolved, party, options);
  const soloLines = composeLines(pkg, resolved, SOLO_BASIS, options);

  // A flight or hotel that is not bundle-eligible takes the whole combination
  // out of the package price — the traveller pays each part on its own.
  const eligible = flight.eligible !== false && hotel.eligible !== false;

  // The headline: one adult's share when two adults share one room.
  const bundled = Math.round(sum(sharingLines, 'bundled') / 2 / 100) * 100;
  const separate = Math.round(sum(sharingLines, 'separate') / 2 / 100) * 100;

  const partyBundled = sum(partyLines, 'bundled');
  const partySeparate = sum(partyLines, 'separate');

  const singleSupplement = Math.max(0, sum(soloLines, 'bundled') - bundled);

  return {
    flight,
    hotel,
    fare,
    room,
    nights,
    party,
    rooms: roomsFor(party, room),

    // The comparable quote every card shows.
    lines: sharingLines,
    bundled,
    separate,
    eligible,
    save: eligible ? separate - bundled : 0,

    // What this party actually pays.
    partyLines,
    partyBundled,
    partySeparate,
    partySave: eligible ? partySeparate - partyBundled : 0,

    singleSupplement,
  };
}

/** The headline figures a package card shows, at its own natural duration. */
export function cardPrice(pkg, nights = pkg.nights) {
  const { bundled, separate, save } = pricePackage(pkg, { nights });
  return { now: bundled, was: separate, save };
}

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
 * always the ones the Phase 1 mockups authored, so leaving both alone
 * reproduces every published figure exactly.
 *
 * `bundled` is the package price; `separate` is what the same parts cost booked
 * individually. The difference is the saving the whole product is built around.
 */

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

/**
 * How a component's price scales.
 *
 * The old model had no answer to this, so a party of four cost exactly what a
 * party of two cost right up until checkout multiplied the whole package by
 * head count — which is wrong in the other direction, because a room and a
 * shared airport transfer do not double when two more people join.
 *
 *   traveller  a seat, a tour place, a visa application — one per person
 *   room       the hotel bill — one per room, however many sleep in it
 *   booking    a shared vehicle — one per trip, whoever is in it
 */
export const PER_TRAVELLER = 'traveller';
export const PER_ROOM = 'room';
export const PER_BOOKING = 'booking';

/** The party a price is quoted for. One traveller in one room is the unit. */
export const UNIT_PARTY = { travellers: 1, rooms: 1 };

function quantityFor(basis, party) {
  if (basis === PER_TRAVELLER) return Math.max(1, party.travellers ?? 1);
  if (basis === PER_ROOM) return Math.max(1, party.rooms ?? 1);
  return 1;
}

/**
 * @param pkg      a record from src/data/packages.js
 * @param options  nights, the chosen flight/fare and hotel/room, which optional
 *                 parts are on, and the set of enabled add-on ids
 */
export function pricePackage(pkg, options = {}) {
  const {
    nights = pkg.nights,
    flightId,
    fareId,
    hotelId,
    roomId,
    includeTransfer = true,
    includeTours = true,
    addons = [],
    party = UNIT_PARTY,
  } = options;

  const flight = findFlight(pkg, flightId);
  const hotel = findHotel(pkg, hotelId);
  const fare = findFare(flight, fareId);
  const room = findRoom(hotel, roomId);

  // Fall back to the flat authored price if a record predates the variant
  // lists, so nothing can crash on partially-migrated data.
  const flightPrice = fare?.price ?? flight.price;
  const flightSeparate = fare?.separate ?? flight.separate;
  const nightly = room?.nightly ?? hotel.nightly;
  const nightlySeparate = room?.nightlySeparate ?? hotel.nightlySeparate;

  /* Authored figures are UNIT prices — one seat, one room-night, one vehicle.
     `scale` turns each into what this party actually owes, and keeps the unit
     price on the line so a screen can show "₦x per person" without guessing. */
  const scale = (line) => {
    const qty = quantityFor(line.basis, party);
    return {
      ...line,
      qty,
      unitBundled: line.bundled,
      unitSeparate: line.separate,
      bundled: line.bundled * qty,
      separate: line.separate * qty,
    };
  };

  const lines = [
    {
      key: 'flight',
      label: fare ? `Flights · ${fare.label}` : 'Flights',
      basis: PER_TRAVELLER,
      bundled: flightPrice,
      separate: flightSeparate,
    },
    {
      key: 'hotel',
      label: `Hotel · ${nights} night${nights === 1 ? '' : 's'}`,
      basis: PER_ROOM,
      bundled: nightly * nights,
      separate: nightlySeparate * nights,
    },
  ].map(scale);

  if (pkg.transfer && includeTransfer) {
    lines.push(
      scale({
        key: 'transfer',
        label: 'Airport transfers',
        // A shared vehicle carries the party; it does not multiply with it.
        basis: PER_BOOKING,
        bundled: pkg.transfer.price,
        separate: pkg.transfer.separate,
      }),
    );
  }

  if (pkg.tours && includeTours) {
    lines.push(
      scale({
        key: 'tours',
        label: pkg.tours.label,
        basis: PER_TRAVELLER,
        bundled: pkg.tours.price,
        separate: pkg.tours.separate,
      }),
    );
  }

  for (const id of addons) {
    const addon = pkg.addons?.find((a) => a.id === id);
    if (addon) {
      lines.push(
        scale({
          key: `addon:${addon.id}`,
          label: addon.title,
          // A visa is filed per passport; an extra bag is bought per traveller.
          basis: addon.basis ?? PER_TRAVELLER,
          bundled: addon.price,
          separate: addon.separate,
        }),
      );
    }
  }

  // A flight or hotel that is not bundle-eligible takes the whole combination
  // out of the package price — the traveller pays each part on its own.
  const eligible = flight.eligible !== false && hotel.eligible !== false;

  const bundled = lines.reduce((sum, l) => sum + l.bundled, 0);
  const separate = lines.reduce((sum, l) => sum + l.separate, 0);

  const travellers = Math.max(1, party.travellers ?? 1);

  return {
    flight,
    hotel,
    fare,
    room,
    nights,
    lines,
    eligible,
    party,
    bundled,
    separate,
    save: eligible ? separate - bundled : 0,
    /* Per person is the total divided by heads — the travel convention — and
       never a component price pretending to be one. */
    perPerson: Math.round(bundled / travellers),
  };
}

/** The headline figures a package card shows, at its own natural duration. */
export function cardPrice(pkg, nights = pkg.nights, party = UNIT_PARTY) {
  const { bundled, separate, save, perPerson } = pricePackage(pkg, { nights, party });
  return { now: bundled, was: separate, save, perPerson };
}

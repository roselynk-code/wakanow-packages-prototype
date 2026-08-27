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

  const lines = [
    {
      key: 'flight',
      label: fare ? `Flights · ${fare.label}` : 'Flights',
      bundled: flightPrice,
      separate: flightSeparate,
    },
    {
      key: 'hotel',
      label: `Hotel · ${nights} night${nights === 1 ? '' : 's'}`,
      bundled: nightly * nights,
      separate: nightlySeparate * nights,
    },
  ];

  if (pkg.transfer && includeTransfer) {
    lines.push({
      key: 'transfer',
      label: 'Airport transfers',
      bundled: pkg.transfer.price,
      separate: pkg.transfer.separate,
    });
  }

  if (pkg.tours && includeTours) {
    lines.push({
      key: 'tours',
      label: pkg.tours.label,
      bundled: pkg.tours.price,
      separate: pkg.tours.separate,
    });
  }

  for (const id of addons) {
    const addon = pkg.addons?.find((a) => a.id === id);
    if (addon) {
      lines.push({
        key: `addon:${addon.id}`,
        label: addon.title,
        bundled: addon.price,
        separate: addon.separate,
      });
    }
  }

  // A flight or hotel that is not bundle-eligible takes the whole combination
  // out of the package price — the traveller pays each part on its own.
  const eligible = flight.eligible !== false && hotel.eligible !== false;

  const bundled = lines.reduce((sum, l) => sum + l.bundled, 0);
  const separate = lines.reduce((sum, l) => sum + l.separate, 0);

  return {
    flight,
    hotel,
    fare,
    room,
    nights,
    lines,
    eligible,
    bundled,
    separate,
    save: eligible ? separate - bundled : 0,
    perParty: (travellers) => bundled * travellers,
  };
}

/** The headline figures a package card shows, at its own natural duration. */
export function cardPrice(pkg, nights = pkg.nights) {
  const { bundled, separate, save } = pricePackage(pkg, { nights });
  return { now: bundled, was: separate, save };
}

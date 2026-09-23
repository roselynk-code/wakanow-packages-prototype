/**
 * Who is travelling, and what each part of a package is actually sold by.
 *
 * THE BUG THIS FIXES. Until now every line of a package was multiplied by the
 * head count: two adults paid for two hotel rooms, two airport transfers and
 * two of everything else. A room costs what it costs whether one person or two
 * sleep in it, and a private transfer with "up to 4 passengers" is one car. So
 * the old headline was not a per-person price and not a per-room price — it
 * double-charged the shared parts, and a family of four was charged four rooms.
 *
 * The fix is to give every line a UNIT and a QUANTITY:
 *
 *   per person   flights, tours, visas, insurance — each traveller needs one
 *   per room     the hotel — priced per room per night, shared by its occupants
 *   per vehicle  airport transfers — one car carries the whole party
 *
 * With units in place, two quotes fall out of the same arithmetic:
 *
 *   PER ADULT SHARING  the industry's comparable headline: what one adult pays
 *                      when two adults share one room. Every card shows this,
 *                      so packages compare like with like regardless of who is
 *                      actually searching.
 *   PARTY TOTAL        what THIS party pays, with its real ages and rooms.
 *
 * And the difference between a lone adult and the sharing basis is the single
 * supplement — a real number the flow can now state instead of hiding.
 */

/* ── Age bands ──────────────────────────────────────────────────────────────
   The bands the search bar already collects, and the ones airlines and hotels
   actually price on. */

export const AGE_BANDS = {
  adult: { id: 'adult', label: 'Adult', note: '12 and over' },
  child: { id: 'child', label: 'Child', note: '2–11' },
  infant: { id: 'infant', label: 'Infant', note: 'Under 2' },
};

/**
 * Fare shares by band. A child occupies a seat but travels at a discount; an
 * infant travels on an adult's lap with no seat of their own, at a nominal
 * fare. These are the conventional shares — illustrative here, like every
 * other figure in the prototype, and a Phase 2 contract question.
 */
export const FARE_SHARE = { adult: 1, child: 0.75, infant: 0.1 };

/** Tours and activities: children at a reduced rate, infants free. */
export const TOUR_SHARE = { adult: 1, child: 0.75, infant: 0 };

/** Naira to the nearest hundred, as everywhere else in the prototype. */
export const tidy = (value) => Math.round(value / 100) * 100;

/* ── The party ──────────────────────────────────────────────────────────── */

/**
 * Normalise the search into the counts pricing needs.
 *
 * `seated` is who needs a seat and a bed — adults and children. Infants are
 * counted separately because they need neither: they travel on a lap and sleep
 * in a cot, so they must not push a party into an extra room.
 */
export function partyFrom(search = {}) {
  const adults = Math.max(1, search.adults ?? 1);
  const children = Math.max(0, search.children ?? 0);
  const infants = Math.max(0, search.infants ?? 0);
  return {
    adults,
    children,
    infants,
    seated: adults + children,
    heads: adults + children + infants,
    roomsRequested: Math.max(1, search.rooms ?? 1),
  };
}

/** The comparable quote basis: two adults, one room. */
export const SHARING_BASIS = partyFrom({ adults: 2, children: 0, infants: 0, rooms: 1 });

/** One adult alone in a room — what the single supplement is measured against. */
export const SOLO_BASIS = partyFrom({ adults: 1, children: 0, infants: 0, rooms: 1 });

/** Is this the plain two-adults-sharing case the headline is quoted for? */
export const isSharingBasis = (party) =>
  party.adults === 2 && party.children === 0 && party.infants === 0 && party.roomsRequested === 1;

/* ── Quantities by unit ─────────────────────────────────────────────────── */

/**
 * Fare units. Not a head count: a child at 0.75 and an infant at 0.1 mean a
 * family of two adults and two children is 3.5 fares, not 4.
 */
export function fareUnits(party) {
  return (
    party.adults * FARE_SHARE.adult +
    party.children * FARE_SHARE.child +
    party.infants * FARE_SHARE.infant
  );
}

export function tourUnits(party) {
  return party.adults * TOUR_SHARE.adult + party.children * TOUR_SHARE.child;
}

/** A visa is per traveller, and an infant needs one too. */
export const visaUnits = (party) => party.heads;

/**
 * Rooms. Whichever is greater: the rooms the traveller asked for, or the rooms
 * the party physically needs at this room type's occupancy. Asking for one room
 * for five people cannot silently sleep five in a double.
 */
export function roomsFor(party, room, requested = party.roomsRequested) {
  const sleeps = Math.max(1, room?.sleeps ?? 2);
  return Math.max(1, requested, Math.ceil(party.seated / sleeps));
}

/**
 * Vehicles. The transfer record states its own capacity in prose — "up to 4
 * passengers" — so read it rather than assuming. An executive saloon that says
 * nothing takes the sedan default.
 */
export function transferCapacity(transfer) {
  const stated = /up to (\d+)\s*passenger/i.exec(`${transfer?.desc ?? ''} ${transfer?.meta ?? ''}`);
  return stated ? Number(stated[1]) : 4;
}

export function vehiclesFor(party, transfer) {
  return Math.max(1, Math.ceil(party.heads / transferCapacity(transfer)));
}

/* ── Labels ─────────────────────────────────────────────────────────────── */

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "2 adults · 1 child" — the composition, without the room count. */
export function partyLabel(party) {
  const parts = [plural(party.adults, 'adult')];
  if (party.children) parts.push(`${party.children} child${party.children === 1 ? '' : 'ren'}`);
  if (party.infants) parts.push(plural(party.infants, 'infant'));
  return parts.join(' · ');
}

/**
 * How a line's quantity should read next to its amount.
 *
 * Quantities go fractional as soon as children travel, so the word has to be
 * the one that makes the arithmetic legible: 3.6 of a thing is not 3.6 people,
 * it is 3.6 fares — two full ones, two at the child share and an infant at a
 * tenth. A tour sells places on the same footing, so it borrows the same shape
 * with its own noun rather than calling a safari seat a fare.
 */
export function unitLabel(unit, qty) {
  if (unit === 'room') return plural(qty, 'room');
  if (unit === 'vehicle') return plural(qty, 'vehicle');
  if (unit === 'place') return Number.isInteger(qty) ? plural(qty, 'place') : `${qty} places`;
  if (unit === 'person') {
    return Number.isInteger(qty) ? plural(qty, 'traveller') : `${qty} fares`;
  }
  return null;
}

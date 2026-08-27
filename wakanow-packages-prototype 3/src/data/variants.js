/**
 * Room types and fare classes.
 *
 * The mockups gave each hotel one rate and each flight one price. A traveller
 * needs to choose *within* the product too — which room, which cabin — so this
 * derives a variant list from each authored record.
 *
 * The authored option is always the base, at exactly ×1. That is deliberate:
 * every published figure in the Phase 1 mockups is the price of the default
 * room on the default fare, so those totals keep reconciling to the penny while
 * everything above and below them becomes selectable.
 *
 * Multipliers are illustrative, like the prices they scale.
 */

/** Naira to the nearest hundred, so derived fares don't read as machine output. */
const tidy = (value) => Math.round(value / 100) * 100;

/* ── Rooms ──────────────────────────────────────────────────────────────── */

const BOARD_ORDER = ['Room only', 'Breakfast included', 'Half board', 'Full board'];

/** Pull the room name out of the authored description, e.g. "Deluxe room". */
function baseRoomName(hotel) {
  if (hotel.roomName) return hotel.roomName;
  const first = (hotel.desc ?? '').split(' · ')[0]?.trim();
  const looksLikeARoom = /room|villa|suite|studio|tent|cabin|double|apartment/i.test(first ?? '');
  return looksLikeARoom ? first : 'Standard room';
}

/** Board basis, read from whichever authored string mentions it. */
function baseBoard(hotel) {
  if (hotel.board) return hotel.board;
  const text = `${hotel.desc ?? ''} ${hotel.meta ?? ''}`.toLowerCase();
  if (text.includes('full board')) return 'Full board';
  if (text.includes('half board')) return 'Half board';
  if (text.includes('breakfast')) return 'Breakfast included';
  return 'Room only';
}

function nextBoardUp(board) {
  const i = BOARD_ORDER.indexOf(board);
  return i === -1 || i === BOARD_ORDER.length - 1 ? null : BOARD_ORDER[i + 1];
}

/**
 * Four ways to take the same hotel: the authored room, the same room with twin
 * beds, a board upgrade, and a higher category. Bed configuration costs nothing
 * — it is a preference, not an upsell, and pricing it would be wrong.
 */
export function buildRooms(hotel) {
  const name = baseRoomName(hotel);
  const board = baseBoard(hotel);
  const { nightly, nightlySeparate } = hotel;

  const rooms = [
    {
      id: 'base',
      isDefault: true,
      name,
      board,
      beds: '1 double bed',
      sleeps: 2,
      nightly,
      nightlySeparate,
      refundable: true,
      note: 'The room included in this package',
    },
    {
      id: 'twin',
      name: `${name} · twin beds`,
      board,
      beds: '2 single beds',
      sleeps: 2,
      nightly,
      nightlySeparate,
      refundable: true,
      note: 'Same room, same price — twin beds instead of a double',
    },
  ];

  const upgraded = nextBoardUp(board);
  if (upgraded) {
    rooms.push({
      id: 'board',
      name: `${name} · ${upgraded.toLowerCase()}`,
      board: upgraded,
      beds: '1 double bed',
      sleeps: 2,
      nightly: tidy(nightly * 1.18),
      nightlySeparate: tidy(nightlySeparate * 1.18),
      refundable: true,
      note: `Meals upgraded to ${upgraded.toLowerCase()}`,
    });
  }

  rooms.push({
    id: 'suite',
    name: 'Suite',
    board: upgraded ?? board,
    beds: '1 king bed + sofa bed',
    sleeps: 3,
    nightly: tidy(nightly * 1.72),
    nightlySeparate: tidy(nightlySeparate * 1.72),
    refundable: true,
    note: 'Separate living area — sleeps three',
  });

  return rooms;
}

/* ── Fares ──────────────────────────────────────────────────────────────── */

/** The cabin the authored fare is sold in. */
function baseCabin(flight) {
  if (flight.cabin) return flight.cabin;
  const text = `${flight.name ?? ''} ${flight.meta ?? ''}`.toLowerCase();
  if (text.includes('business')) return 'Business';
  if (text.includes('premium economy')) return 'Premium economy';
  if (text.includes('first')) return 'First';
  return 'Economy';
}

/** Baggage wording from the authored meta, so the base fare stays truthful. */
function baseBags(flight) {
  const meta = flight.meta ?? '';
  const match = meta.match(/(\d\s*×\s*\d+kg|\d checked bags?|1 checked bag)/i);
  return match ? match[0] : '1 checked bag';
}

const ECONOMY_LADDER = [
  {
    id: 'saver', label: 'Saver', cabin: 'Economy', factor: 0.88,
    bags: 'Hand baggage only', seat: 'Assigned at check-in',
    changeable: false, refundable: false,
    note: 'Cheapest fare. No checked bag, no changes, no refund.',
  },
  {
    id: 'base', label: 'Economy', cabin: 'Economy', factor: 1,
    seat: 'Standard seat selection', changeable: 'Fee applies', refundable: false,
    note: 'The fare included in this package.',
  },
  {
    id: 'flex', label: 'Economy Flex', cabin: 'Economy', factor: 1.24,
    bags: '2 checked bags', seat: 'Free seat selection',
    changeable: 'Free changes', refundable: 'Refundable',
    note: 'Change dates or cancel without a fee.',
  },
  {
    id: 'premium', label: 'Premium economy', cabin: 'Premium economy', factor: 1.62,
    bags: '2 × 23kg', seat: 'Extra legroom · free selection',
    changeable: 'Free changes', refundable: 'Refundable',
    note: 'Wider seat, more legroom, priority boarding.',
  },
  {
    id: 'business', label: 'Business', cabin: 'Business', factor: 2.55,
    bags: '2 × 32kg', seat: 'Lie-flat seat',
    changeable: 'Free changes', refundable: 'Refundable',
    note: 'Lounge access and lie-flat seat where the aircraft has one.',
  },
];

const PREMIUM_LADDER = [
  {
    id: 'base', label: 'Business', cabin: 'Business', factor: 1,
    seat: 'Lie-flat seat', changeable: 'Fee applies', refundable: false,
    note: 'The fare included in this package.',
  },
  {
    id: 'flex', label: 'Business Flex', cabin: 'Business', factor: 1.18,
    bags: '3 × 32kg', seat: 'Lie-flat seat · free selection',
    changeable: 'Free changes', refundable: 'Refundable',
    note: 'Fully changeable and refundable.',
  },
  {
    id: 'first', label: 'First', cabin: 'First', factor: 1.55,
    bags: '3 × 32kg', seat: 'Private suite',
    changeable: 'Free changes', refundable: 'Refundable',
    note: 'Where the aircraft has a first cabin on this route.',
  },
];

/**
 * The fare ladder for one flight. An economy flight gets the full ladder up to
 * Business; a flight already sold in Business gets the shorter one above it,
 * rather than offering a "downgrade to economy" that would contradict the tier.
 */
export function buildFares(flight) {
  const cabin = baseCabin(flight);
  const bags = baseBags(flight);
  const ladder = cabin === 'Economy' ? ECONOMY_LADDER : PREMIUM_LADDER;

  return ladder.map((rung) => ({
    id: rung.id,
    label: rung.label,
    cabin: rung.cabin,
    // The ladder is listed cheapest first so it reads naturally, which means
    // the authored fare is not always index 0. Flag it instead of relying on
    // position — the default has to be the fare the published prices assume.
    isDefault: rung.factor === 1,
    bags: rung.bags ?? bags,
    seat: rung.seat,
    changeable: rung.changeable,
    refundable: rung.refundable,
    note: rung.note,
    price: rung.factor === 1 ? flight.price : tidy(flight.price * rung.factor),
    separate: rung.factor === 1 ? flight.separate : tidy(flight.separate * rung.factor),
  }));
}

/** Attach rooms and fares to every package in place. */
export function expandVariants(packages) {
  const seenHotels = new Set();
  const seenFlights = new Set();

  for (const pkg of packages) {
    for (const hotel of pkg.hotels) {
      if (seenHotels.has(hotel)) continue; // tiers share Dubai's objects
      seenHotels.add(hotel);
      hotel.rooms = buildRooms(hotel);
    }
    for (const flight of pkg.flights) {
      if (seenFlights.has(flight)) continue;
      seenFlights.add(flight);
      flight.fares = buildFares(flight);
    }
  }
  return packages;
}

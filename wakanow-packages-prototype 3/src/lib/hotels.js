/**
 * Hotel presentation, shaped to mirror wakanow.com's hotel results and the
 * "Choose your room" block on a hotel detail page.
 *
 * The live hotel card carries more than the mockups' one-line hotel option: a
 * photo flush to the card's left edge, a name over an address, amenity chips, a
 * rating badge, and the same three ways to pay the flight results card shows.
 * None of that is new *information* — it is all implied by what each hotel
 * record already holds — so rather than authoring it thirty times over, this
 * derives the card's shape from the authored strings.
 *
 * The authored strings are consistent by construction:
 *
 *   name  "Rove Downtown Dubai · 4★"
 *   desc  "Deluxe room · breakfast · 900m from Dubai Mall"
 *   meta  "Deluxe room · breakfast included · 900m from Dubai Mall"
 *
 * Everything below reads those three plus the `rooms` list that
 * src/data/variants.js hangs off each record. Nothing here invents a price:
 * the nightly rate comes from the record and the caller multiplies it by the
 * nights it has already resolved, so every published total still reconciles.
 */

import { PRIME_RATIO } from './flights.js';

/** Naira to the nearest hundred, matching src/data/variants.js. */
const tidy = (value) => Math.round(value / 100) * 100;

/* ── Reading the authored record ────────────────────────────────────────── */

/** "Rove Downtown Dubai · 4★" → 4. Null when a record carries no star rating. */
export function hotelStars(hotel) {
  const match = /(\d)\s*★/.exec(hotel?.name ?? '');
  return match ? Number(match[1]) : null;
}

/** The name without its star suffix — the badge carries the stars instead. */
export function hotelName(hotel) {
  return (hotel?.name ?? '')
    .split(' · ')
    .filter((part) => !/★/.test(part))
    .join(' · ');
}

/** The middot-separated clauses of `meta`, which is the fuller of the two. */
const metaParts = (hotel) =>
  (hotel?.meta ?? hotel?.desc ?? '')
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean);

/**
 * The location line under the name. The authored meta always ends on where the
 * hotel is ("900m from Dubai Mall", "on the Strand"), so the last clause is the
 * address — the catalogue has no street addresses to quote.
 */
export function hotelAddress(hotel) {
  const parts = metaParts(hotel);
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * Amenity chips. The live card shows a supplier's amenity list (`Bathrobe`,
 * `Telephone`, `Towels`); the catalogue has none, so the chips are the clauses
 * between the room name and the location — which is exactly what those clauses
 * are ("breakfast included", "Aquaventure waterpark passes", "private beach").
 * Capitalised, because they are written as sentence fragments.
 */
export function hotelAmenities(hotel) {
  const parts = metaParts(hotel);
  if (parts.length < 3) return [];
  return parts.slice(1, -1).map((part) => part.charAt(0).toUpperCase() + part.slice(1));
}

/** Board basis: the default room states it, otherwise scan the authored text. */
export function hotelBoard(hotel) {
  const fromRoom = (hotel?.rooms ?? []).find((room) => room.isDefault)?.board;
  if (fromRoom) return fromRoom;
  const text = `${hotel?.desc ?? ''} ${hotel?.meta ?? ''}`.toLowerCase();
  if (text.includes('full board')) return 'Full board';
  if (text.includes('half board')) return 'Half board';
  if (text.includes('breakfast')) return 'Breakfast included';
  return 'Room only';
}

/* ── The rating badge ───────────────────────────────────────────────────── */

/* A guest score is not in the catalogue — the records carry a star rating and a
   board basis, nothing that a review score could be read off. Rather than mint
   a random number that changes on every render (or, worse, differs between the
   results card and the detail page), the score is DERIVED from the two things
   the record does state, so a given hotel always reads the same:

     stars    3★ → 3.6   4★ → 4.2   5★ → 4.6      (the shape of a /5 guest score)
     board    room only +0 · breakfast +0.1 · half board +0.2 · full board +0.3

   It is a display figure only. Nothing prices off it. */

const STAR_BASE = { 3: 3.6, 4: 4.2, 5: 4.6 };
const BOARD_BONUS = {
  'Room only': 0,
  'Breakfast included': 0.1,
  'Half board': 0.2,
  'Full board': 0.3,
};

/** The word beside the number, on the live badge's own scale. */
function ratingWord(score) {
  if (score >= 4.6) return 'Exceptional';
  if (score >= 4.2) return 'Excellent';
  if (score >= 3.8) return 'Very good';
  if (score >= 3.4) return 'Good';
  return 'Pleasant';
}

export function hotelRating(hotel) {
  const stars = hotelStars(hotel);
  const base = STAR_BASE[stars] ?? 3.8;
  const score = Math.min(5, base + (BOARD_BONUS[hotelBoard(hotel)] ?? 0));
  return { stars, score: score.toFixed(1), word: ratingWord(score) };
}

/* ── The three ways to pay ──────────────────────────────────────────────── */

/**
 * Wakanow Prime members pay below the public rate on hotels exactly as they do
 * on flights, so the ratio measured off the live flight results
 * (see PRIME_RATIO in ./flights.js) is reused rather than re-derived — one
 * member ratio for the whole site. A *display* figure: the package total is
 * still built from the public rate, so nothing downstream moves.
 */
export const hotelPrimeRate = (stayPrice) => tidy(stayPrice * PRIME_RATIO);

/** Pay Small Small spreads a stay over six months, as it does a fare. */
export const PSS_MONTHS = 6;

/**
 * The live hotel card leads on the deposit — "₦6,152 down" — rather than the
 * monthly figure the flight card shows, so this returns the down payment. Same
 * arithmetic either way: the stay divided over six months.
 */
export function hotelPaySmallSmall(stayPrice) {
  return { months: PSS_MONTHS, down: tidy(stayPrice / PSS_MONTHS) };
}

/**
 * Everything the hotel results card needs, derived from one hotel record and
 * the stay length the caller has already resolved.
 */
export function hotelCard(hotel, { nights, stayPrice }) {
  return {
    id: hotel.id,
    name: hotelName(hotel),
    address: hotelAddress(hotel),
    amenities: hotelAmenities(hotel),
    rating: hotelRating(hotel),
    nights,
    stayPrice,
    prime: hotelPrimeRate(stayPrice),
    pss: hotelPaySmallSmall(stayPrice),
    eligible: hotel.eligible !== false,
  };
}

/* ── Rooms ─────────────────────────────────────────────────────────────── */

/**
 * The live "Choose your room" block filters on bed type with short pills
 * (`Double`, `King`, `Queen`, `King Double`). The rooms built in
 * src/data/variants.js state their beds in full ("1 double bed",
 * "2 single beds", "1 king bed + sofa bed"), so the pill shows a shortened
 * label while the filter matches the record's exact string — no room can be
 * lost to a label that rounds two configurations together.
 *
 * "2 single beds" reads as `Twin`, which is what the trade calls it and what a
 * traveller scanning for it would look for; a lone single bed stays `Single`.
 */
export function bedLabel(beds = '') {
  const text = beds.toLowerCase();
  const count = Number(/^(\d+)/.exec(text)?.[1] ?? 1);
  if (text.includes('king')) return 'King';
  if (text.includes('queen')) return 'Queen';
  if (text.includes('double')) return 'Double';
  if (text.includes('single') || text.includes('twin')) return count > 1 ? 'Twin' : 'Single';
  if (text.includes('sofa')) return 'Sofa bed';
  return beds;
}

/**
 * The bed pills actually present in this hotel's rooms, `All Beds` first — the
 * live page never offers a filter that would empty the grid. Labels that
 * collapse two bed strings into one pill (a king room and a king-plus-sofa
 * room) keep both strings, so the pill still shows every room it names.
 */
export function bedFilters(rooms = []) {
  const groups = [];
  for (const room of rooms) {
    const label = bedLabel(room.beds);
    const held = groups.find((group) => group.label === label);
    if (held) {
      if (!held.values.includes(room.beds)) held.values.push(room.beds);
    } else {
      groups.push({ id: label, label, values: [room.beds] });
    }
  }
  return [{ id: 'all', label: 'All Beds', values: null }, ...groups];
}

/** Rooms matching a pill. The `all` pill (no values) matches everything. */
export function roomsForBed(rooms = [], filter) {
  if (!filter?.values) return rooms;
  return rooms.filter((room) => filter.values.includes(room.beds));
}

/**
 * Flight presentation, shaped to mirror wakanow.com's flight results.
 *
 * The live results card carries a lot more than the mockups' one-line flight
 * option: an airline lockup, three ways to pay side by side, a departure AND
 * return timeline with codes, duration and stop, and baggage chips. None of
 * that is new *information* — it is all implied by what each flight record
 * already holds — so rather than hand-authoring sixty flights this derives the
 * card's shape from the authored strings.
 *
 * The authored strings are consistent by construction:
 *
 *   name  "Qatar Airways · 1 stop Doha"
 *   desc  "LOS 15:10 → DXB 07:40 · 11h 30m · 2 bags"
 *   meta  "Lagos (LOS) → Doha (DOH) → Dubai (DXB) · Economy · 2 checked bags"
 *
 * Everything below reads those three. Nothing here invents a price: the fare
 * comes from the record, so every published total still reconciles.
 */

/** Naira to the nearest hundred, matching src/data/variants.js. */
const tidy = (value) => Math.round(value / 100) * 100;

/* ── Time helpers ───────────────────────────────────────────────────────── */

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const toClock = (minutes) => {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** "7h 35m" → 455. Also copes with "11h" and "45m". */
export function durationToMinutes(text) {
  const h = /(\d+)\s*h/.exec(text ?? '');
  const m = /(\d+)\s*m/.exec(text ?? '');
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) * 60 : 0) / 60;
}

function parseDuration(text) {
  const h = /(\d+)\s*h/.exec(text ?? '');
  const m = /(\d+)\s*m/.exec(text ?? '');
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

/* ── Parsing the authored strings ───────────────────────────────────────── */

/** "LOS 22:40 → DXB 07:15 · 7h 35m · 1 bag" */
function parseDesc(desc = '') {
  const match = /([A-Z]{3})\s+(\d{2}:\d{2})\s*→\s*([A-Z]{3})\s+(\d{2}:\d{2})/.exec(desc);
  const durationText = /·\s*(\d+h(?:\s*\d+m)?|\d+m)\s*·/.exec(desc)?.[1] ?? null;
  const bags = /(\d+)\s*bags?/.exec(desc)?.[1] ?? null;
  if (!match) return { durationText, bags };
  return {
    fromCode: match[1],
    departTime: match[2],
    toCode: match[3],
    arriveTime: match[4],
    durationText,
    bags,
  };
}

/** The airline is everything before the first middot in the record's name. */
function parseAirline(name = '') {
  const [airline, ...rest] = name.split('·').map((part) => part.trim());
  return { airline, shape: rest.join(' · ') };
}

/**
 * Stops. The record's own name states the shape ("direct both ways",
 * "1 stop Doha"); `meta` carries the routing, whose middle segments are the
 * connection airports.
 */
function parseStops(name = '', meta = '') {
  const codes = [...meta.matchAll(/\(([A-Z]{3})\)/g)].map((m) => m[1]);
  const vias = codes.slice(1, -1);
  const stated = /(\d+)\s*stop/.exec(name)?.[1];
  const count = stated ? Number(stated) : vias.length;
  if (count === 0) return { count: 0, label: 'Direct', vias: [] };
  const named = vias.length ? vias.join(' · ') : /stop\s+(.+)$/.exec(name)?.[1] ?? '';
  return {
    count,
    label: named ? `${count} stop · ${named}` : `${count} stop`,
    vias,
  };
}

/**
 * Return timing. Only the authored Dubai record spells its return out; the rest
 * state the outbound only. Rather than leave half the cards without a return
 * leg — which the live site always shows for a round trip — the return is
 * derived from the outbound: it leaves the destination in the same part of the
 * day the outbound arrived, offset by a fixed turnaround, and flies the same
 * duration back. Deterministic, so a given flight always reads the same.
 */
function deriveReturn(outbound) {
  const TURNAROUND = 8 * 60; // hours between landing and the return departure
  const departMinutes = toMinutes(outbound.arriveTime) + TURNAROUND;
  return {
    departTime: toClock(departMinutes),
    arriveTime: toClock(departMinutes + outbound.durationMinutes),
  };
}

/** The authored `legs` array, when a record has one, wins over the derivation. */
function returnFromLegs(legs) {
  if (!Array.isArray(legs)) return null;
  const times = legs.filter((leg) => /departs|arrives/.test(leg.place ?? ''));
  if (times.length < 4) return null;
  return { departTime: times[2].time, arriveTime: times[3].time };
}

/* ── The three ways to pay ──────────────────────────────────────────────── */

/**
 * Wakanow Prime members pay below the public fare. The live results page runs
 * about 2% under Full Pay (₦1,287,468 → ₦1,261,719), which is the ratio used
 * here. It is a *display* figure: the package total is still built from the
 * public fare, so nothing downstream moves.
 */
export const PRIME_RATIO = 0.98;

export const primeFare = (price) => tidy(price * PRIME_RATIO);

/**
 * Pay Small Small spreads a fare over six months. The live site shows it as
 * "Available on selected fares" rather than universally, and the records
 * already carry the flag that decides it.
 */
export function paySmallSmall(flight) {
  if (flight.eligible === false) {
    return { eligible: false, note: 'Available on selected fares' };
  }
  return { eligible: true, months: 6, monthly: tidy(flight.price / 6) };
}

/* ── The card ───────────────────────────────────────────────────────────── */

/**
 * Everything the results card needs, derived from one flight record.
 * `oneWay` drops the return leg — a multi-destination hop has no return.
 */
export function flightCard(flight, { oneWay = false } = {}) {
  const { airline, shape } = parseAirline(flight.name);
  const desc = parseDesc(flight.desc);
  const stops = parseStops(flight.name, flight.meta);
  const durationMinutes = parseDuration(desc.durationText);

  const outbound = desc.departTime
    ? {
        departTime: desc.departTime,
        fromCode: desc.fromCode,
        arriveTime: desc.arriveTime,
        toCode: desc.toCode,
        durationText: desc.durationText,
        durationMinutes,
        // The live card marks a next-day arrival with a superscript +1.
        nextDay: toMinutes(desc.arriveTime) < toMinutes(desc.departTime),
      }
    : null;

  let inbound = null;
  if (outbound && !oneWay) {
    const times = returnFromLegs(flight.legs) ?? deriveReturn(outbound);
    inbound = {
      departTime: times.departTime,
      fromCode: outbound.toCode,
      arriveTime: times.arriveTime,
      toCode: outbound.fromCode,
      durationText: outbound.durationText,
      durationMinutes,
      nextDay: toMinutes(times.arriveTime) < toMinutes(times.departTime),
    };
  }

  const checked = Number(desc.bags ?? 1);

  return {
    id: flight.id,
    airline,
    shape,
    stops,
    outbound,
    inbound,
    durationMinutes,
    // Cabin allowance is standard across the catalogue; checked is authored.
    bags: {
      cabin: '1 × 7KG cabin',
      checked: `${checked} × 23KG checked`,
    },
    fullPay: flight.price,
    prime: primeFare(flight.price),
    pss: paySmallSmall(flight),
    separate: flight.separate,
    eligible: flight.eligible !== false,
    // The live card states the fare condition in orange under the legs.
    condition: flight.eligible === false
      ? 'Non-Refundable (Non-Refundable for No-Show)'
      : 'Partially refundable · changes from ₦48,000',
  };
}

/* ── The sort rail ──────────────────────────────────────────────────────── */

/**
 * The live results page heads the list with three summary cells — cheapest
 * fare, shortest duration, earliest departure — that double as the sort
 * control. Each shows the winning VALUE, not just a label.
 */
export const SORTS = [
  { id: 'cheapest', label: 'Cheapest' },
  { id: 'fastest', label: 'Fastest' },
  { id: 'earliest', label: 'Earliest' },
];

export function sortFlights(cards, sortId) {
  const list = [...cards];
  if (sortId === 'fastest') {
    list.sort((a, b) => a.durationMinutes - b.durationMinutes);
  } else if (sortId === 'earliest') {
    list.sort(
      (a, b) => toMinutes(a.outbound?.departTime ?? '23:59') - toMinutes(b.outbound?.departTime ?? '23:59'),
    );
  } else {
    list.sort((a, b) => a.fullPay - b.fullPay);
  }
  return list;
}

/** The winning value in each column, for the rail's second line. */
export function sortSummary(cards) {
  if (!cards.length) return {};
  const cheapest = Math.min(...cards.map((c) => c.fullPay));
  const fastest = Math.min(...cards.map((c) => c.durationMinutes));
  const earliest = cards
    .map((c) => c.outbound?.departTime)
    .filter(Boolean)
    .sort((a, b) => toMinutes(a) - toMinutes(b))[0];
  return {
    cheapest,
    fastest: `${Math.floor(fastest / 60)}h ${String(fastest % 60).padStart(2, '0')}m`,
    earliest,
  };
}

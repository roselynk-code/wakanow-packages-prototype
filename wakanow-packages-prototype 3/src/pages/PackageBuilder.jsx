import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import BackBar from '../components/BackBar.jsx';
import DateRangePicker from '../components/DateRangePicker.jsx';
import FlightCard from '../components/FlightCard.jsx';
import FlightSort from '../components/FlightSort.jsx';
import { addDays, formatShort, formatWeekday } from '../lib/dates.js';
import { flightCard, sortFlights, sortSummary } from '../lib/flights.js';
import { delta, naira, nairaShort } from '../lib/format.js';
import { flightsForLeg, priceItinerary, visaLegs } from '../lib/itinerary.js';
import { findFare, findRoom } from '../lib/pricing.js';
import { useTrip } from '../state/useTrip.js';
import './PackageBuilder.css';
import './PackageBuilder.multi.css';

/** The four steps every destination repeats, in the order they are walked. */
const LEG_STEPS = [
  { kind: 'hotel', label: 'Hotel' },
  { kind: 'flight', label: 'Flight' },
  { kind: 'transfer', label: 'Transfer' },
  { kind: 'tours', label: 'Tours' },
];

/** The card art in the generated stylesheet, cycled so every option gets one. */
const IMG = ['i1', 'i2', 'i3', 'i4', 'i5'];

const TIERS = [
  { name: 'Essential', mod: 'ess', slug: 'tier-essential', price: 1486000, save: 85000 },
  { name: 'Premium', mod: 'pre', slug: 'tier-premium', price: 1728000, save: 186000 },
  { name: 'Luxury', mod: 'lux', slug: 'tier-luxury', price: 3120000, save: 358000 },
];

const WHATSAPP_PATH =
  'M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2 0 .4-.1.6l-.4.5c-.1.2-.3.3-.1.6.1.3.6 1.1 1.4 1.8 1 .9 1.8 1.1 2 1.3.3.1.4.1.6-.1l.8-.9c.2-.2.4-.2.6-.1l2 1c.2.1.4.2.4.3.1.2.1.7-.1 1.3z';

/** "Emirates · direct both ways" → "Emirates". The running total has 260px. */
const shortName = (name) => name.split(' · ')[0];

/** Tours, in package terms, are every add-on that is not the visa. */
const tourAddons = (pkg) => (pkg.addons ?? []).filter((addon) => addon.id !== 'visa');

const visaAddon = (pkg) => (pkg.addons ?? []).find((addon) => addon.id === 'visa');

/**
 * The hotel a custom build ends on is the strongest signal of which tier it
 * resembles — the tiers differ most on where you stay. Ranked within the
 * package's own list rather than by hotel id, so it works for any destination.
 */
function closestTier(hotel, hotels) {
  const ranked = [...hotels].sort((a, b) => a.nightly - b.nightly);
  if (hotel.id === ranked[0]?.id) return TIERS[0];
  if (hotel.id === ranked[ranked.length - 1]?.id) return TIERS[2];
  return TIERS[1];
}

/** Everything the traveller can change on one leg of the trip. */
function defaultSelection(entry) {
  const flight = flightsForLeg(entry)[0];
  const hotel = entry.pkg.hotels[0];
  const tourIds = tourAddons(entry.pkg).map((addon) => addon.id);

  return {
    // The package this selection was built for, so a destination swapped on the
    // search bar cannot leave a hotel id from the city you no longer visit.
    slug: entry.pkg.slug,
    flightId: flight.id,
    // Resolved through the finders so the flagged default fare and room win
    // over the cheapest-first ordering of both ladders.
    fareId: findFare(flight)?.id,
    hotelId: hotel.id,
    roomId: findRoom(hotel)?.id,
    includeTransfer: true,
    includeTours: true,
    tourIds,
    addons: visaAddon(entry.pkg) ? [...tourIds, 'visa'] : tourIds,
  };
}

/**
 * `addons` is the list pricing actually reads, so every toggle rewrites it from
 * the two things that decide it: the remembered tour list (dropped while tours
 * are skipped, so skipping and restoring does not lose the choice) and the
 * visa, which is toggled on its own step.
 */
function applySelection(sel, patch, visaOn) {
  const next = { ...sel, ...patch };
  const visa = visaOn ?? (sel.addons ?? []).includes('visa');
  next.addons = [...(next.includeTours ? next.tourIds : []), ...(visa ? ['visa'] : [])];
  return next;
}

function reconcileSelections(itinerary, prev) {
  const next = {};
  for (const entry of itinerary) {
    const held = prev[entry.id];
    next[entry.id] = held && held.slug === entry.pkg.slug ? held : defaultSelection(entry);
  }
  return next;
}

/** The mockup's feature pills, derived from what the package record actually says. */
function hotelFeats(entry, hotel) {
  const room = findRoom(hotel);
  return [
    room?.board ?? 'Room only',
    `Free cancel until ${formatShort(addDays(entry.startDate, -entry.pkg.freeCancelDays))}`,
    hotel.eligible === false ? 'Not in the bundle' : 'Bundle eligible',
  ];
}

/** The stylesheet selects the mockup's clickable cards by tag (`.opt`, `.topt`,
 *  `.stp`, `.mo`), so they keep those elements and pick up button/radio
 *  semantics from props rather than becoming <button>s. */
function activatable(onActivate, extra) {
  return {
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onActivate();
      }
    },
    ...extra,
  };
}

/** Hotels and flights share one card shape. Hotel prices depend on the trip
 *  length, so the caller passes the resolved stay cost rather than the card
 *  reading a fixed figure off the record. */
function OptionCard({ item, img, feats, price, selectedPrice, selected, note, metaExtra, onSelect }) {
  const diff = price - selectedPrice;
  const caption = selected
    ? note
    : `${diff > 0 ? '+' : '−'} ${naira(Math.abs(diff))} vs selected`;

  return (
    <article
      className={selected ? 'opt sel' : 'opt'}
      {...activatable(onSelect, { role: 'radio', 'aria-checked': selected })}
    >
      <div className={`img ${img}`} />
      <div className="body">
        <h3>{item.name}</h3>
        <div className="meta">
          {item.meta}
          {metaExtra}
        </div>
        <div className="feats">
          {feats.map((feat) => (
            <span className="feat" key={feat}>
              {feat}
            </span>
          ))}
        </div>
      </div>
      <div className="price">
        <div className="amt">{naira(price)}</div>
        <div className="delta">{caption}</div>
        <span className="smark">Selected</span>
      </div>
    </article>
  );
}

export default function PackageBuilder() {
  const navigate = useNavigate();
  const {
    itinerary,
    isMultiDestination,
    routeLabel,
    payingTravellers,
    search,
    setDates,
    setTier,
    setBookingSlug,
    totalNights,
    dateLabel,
    travellerSummary,
  } = useTrip();

  const [stepKey, setStepKey] = useState(`${itinerary[0].id}-hotel`);
  const [completed, setCompleted] = useState(() => new Set());
  const [selections, setSelections] = useState(() => reconcileSelections(itinerary, {}));
  const [flightSort, setFlightSort] = useState('cheapest');
  const [visaModalLeg, setVisaModalLeg] = useState(null);
  const [visaReason, setVisaReason] = useState(null);

  // The itinerary is owned by the search bar, so a destination can be added,
  // dropped or swapped while this screen is mounted. Re-defaulting during
  // render rather than in an effect means no frame paints with a hotel id that
  // belongs to a city the trip no longer visits.
  const stale =
    Object.keys(selections).length !== itinerary.length ||
    itinerary.some((entry) => selections[entry.id]?.slug !== entry.pkg.slug);
  if (stale) setSelections((prev) => reconcileSelections(itinerary, prev));

  const selFor = (entry) => selections[entry.id] ?? defaultSelection(entry);

  const visas = visaLegs(itinerary);

  /** Hotel → Flight → Transfer → Tours for every destination, then one visa
   *  step for the whole trip. The number is the step within its destination. */
  const steps = [];
  for (const entry of itinerary) {
    LEG_STEPS.forEach((leg, i) => {
      steps.push({ key: `${entry.id}-${leg.kind}`, kind: leg.kind, label: leg.label, entry, n: i + 1 });
    });
  }
  steps.push({
    key: 'visa',
    kind: 'visa',
    label: visas.length > 1 ? 'Visas' : 'Visa',
    entry: null,
    n: LEG_STEPS.length + 1,
  });

  const stepIndex = Math.max(0, steps.findIndex((s) => s.key === stepKey));
  const current = steps[stepIndex];
  const previous = steps[stepIndex - 1];
  const following = steps[stepIndex + 1];

  const priced = priceItinerary(itinerary, selections, search);

  const entry = current.entry;
  const sel = entry ? selFor(entry) : null;
  const legPriced = entry ? priced.legPrices[entry.index] : null;
  const hotel = legPriced?.priced.hotel;
  const room = legPriced?.priced.room;
  const flight = legPriced?.priced.flight;
  const fare = legPriced?.priced.fare;
  const lineOf = (lp, key) => lp.priced.lines.find((l) => l.key === key);

  /* The results-card shape for this leg's flights. A leg that is not the whole
     trip is a one-way hop, so it gets no return timeline — the journey home is
     priced once, at the end. */
  const flightCards = (legPriced?.flightOptions ?? []).map((item) => ({
    item,
    card: flightCard(item, { oneWay: !entry?.isOnly }),
  }));
  const flightSummary = sortSummary(flightCards.map((f) => f.card));
  const sortedOrder = sortFlights(
    flightCards.map((f) => f.card),
    flightSort,
  );
  const sortedFlights = sortedOrder.map((card) =>
    flightCards.find((f) => f.card.id === card.id),
  );

  const total = priced.bundled;

  useEffect(() => {
    if (!visaModalLeg) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setVisaModalLeg(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visaModalLeg]);

  const goStep = (target) => {
    if (!target) return;
    // Moving forward banks the step you are leaving, so the rail can mark it
    // done and let you jump back to it later.
    if (steps.findIndex((s) => s.key === target.key) > stepIndex) {
      setCompleted((prev) => (prev.has(current.key) ? prev : new Set(prev).add(current.key)));
    }
    setStepKey(target.key);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goRail = (target) => {
    if (target.key === current.key || completed.has(target.key)) goStep(target);
  };

  const patchSel = (legId, patch, visaOn) =>
    setSelections((prev) => {
      const base = prev[legId] ?? defaultSelection(itinerary.find((e) => e.id === legId));
      return { ...prev, [legId]: applySelection(base, patch, visaOn) };
    });

  // A room id only means something inside its own hotel, and a fare id inside
  // its own flight, so each switch carries the sub-choice back to the new
  // product's default in the same update.
  const selectHotel = (id) => {
    const picked = entry.pkg.hotels.find((h) => h.id === id);
    patchSel(entry.id, { hotelId: id, roomId: findRoom(picked)?.id });
  };

  const selectFlight = (id) => {
    const picked = legPriced.flightOptions.find((f) => f.id === id);
    patchSel(entry.id, { flightId: id, fareId: findFare(picked)?.id });
  };

  const toggleTour = (id) => {
    const held = sel.tourIds;
    patchSel(entry.id, {
      tourIds: held.includes(id) ? held.filter((x) => x !== id) : [...held, id],
    });
  };

  const setVisaOn = (leg, on) => patchSel(leg.id, {}, on);

  const openVisaModal = (leg) => {
    setVisaReason(null);
    setVisaModalLeg(leg);
  };

  const removeVisa = () => {
    if (!visaReason) return;
    setVisaOn(visaModalLeg, false);
    setVisaModalLeg(null);
  };

  const keepVisa = () => {
    setVisaOn(visaModalLeg, true);
    setVisaModalLeg(null);
  };

  const selectTier = (tier) => {
    setTier(tier.name);
    setBookingSlug(tier.slug);
    navigate('/checkout');
  };

  const checkout = () => {
    if (isMultiDestination) {
      // No tier is a multi-city trip, so there is nothing to approximate here:
      // checkout reads the itinerary itself from context and prices every leg.
      setBookingSlug(itinerary[0].pkg.slug);
      navigate('/checkout');
      return;
    }
    // An approximation: the builder's exact custom combination has no catalogue
    // record, so checkout shows the closest tier.
    const only = itinerary[0];
    const closest = closestTier(priced.legPrices[0].priced.hotel, only.pkg.hotels);
    setTier(closest.name);
    setBookingSlug(closest.slug);
    navigate('/checkout');
  };

  const shareOnWhatsApp = () => {
    window.open(
      'https://wa.me/?text=' +
        encodeURIComponent('My Wakanow package — ' + naira(total) + ' per person'),
      '_blank',
      'noopener',
    );
  };

  /** The running total's lines for one leg, priced whether or not they are on —
   *  a skipped component still shows, struck through, at what it would cost. */
  const totalLines = (legEntry, lp) => {
    const choice = selFor(legEntry);
    const pkg = legEntry.pkg;
    const rows = [
      {
        key: 'hotel',
        label: `${shortName(lp.priced.hotel.name)} · ${lp.priced.room?.name ?? 'Room'}`,
        amount: lineOf(lp, 'hotel').bundled,
      },
      {
        key: 'flight',
        label: `${shortName(lp.priced.flight.name)} · ${legEntry.isOnly ? 'return' : 'one way'}`,
        amount: lineOf(lp, 'flight').bundled,
      },
    ];

    if (pkg.transfer) {
      rows.push({
        key: 'transfer',
        // "Careem · private airport transfers" is the supplier and the product.
        // Where the name splits, the supplier is the half worth 260px.
        label: pkg.transfer.name.includes(' · ')
          ? `${shortName(pkg.transfer.name)} transfer`
          : pkg.transfer.name,
        amount: pkg.transfer.price,
        off: !choice.includeTransfer,
      });
    }

    const chosen = tourAddons(pkg).filter((addon) => choice.tourIds.includes(addon.id));
    const toursAmount =
      chosen.reduce((sum, addon) => sum + addon.price, 0) + (pkg.tours?.price ?? 0);
    const toursLabel =
      chosen.length === 0
        ? (pkg.tours?.label ?? 'Tours')
        : chosen.length === 1
          ? shortName(chosen[0].title)
          : `${chosen.length} tours & extras`;
    rows.push({
      key: 'tours',
      label: toursLabel,
      amount: toursAmount,
      off: !choice.includeTours || toursAmount === 0,
    });

    const visa = visaAddon(pkg);
    if (visa) {
      rows.push({
        key: 'visa',
        label: shortName(visa.title),
        amount: visa.price,
        off: !choice.addons.includes('visa'),
      });
    }

    return rows;
  };

  // Crossing into another destination is the change worth naming on the button.
  const crossesTo = (s) =>
    isMultiDestination && s?.entry && current.entry && s.entry !== current.entry;
  const nextLabel =
    following && (crossesTo(following) ? following.entry.toCity : following.label.toLowerCase());
  const backLabel = previous && (crossesTo(previous) ? previous.entry.toCity : previous.label);

  const cityIn = (city) => (isMultiDestination ? ` in ${city}` : '');

  /** The rail is the step list with a city label opening each destination's
   *  group — on a single-destination trip there is nothing to label. */
  const railItems = [];
  for (const s of steps) {
    if (isMultiDestination && s.entry && s.entry !== railItems[railItems.length - 1]?.entry) {
      railItems.push({ key: `city-${s.entry.id}`, city: s.entry.toCity, entry: s.entry });
    }
    railItems.push({ key: s.key, step: s, entry: s.entry });
  }

  return (
    <div className="pg-builder">
      <nav className="nav">
        <div className="wrap">
          <Link to="/" className="logo">
            waka<i>now</i>
          </Link>
          {/* The site's header control set, same markup as the landing page:
              locale cluster, then a single orange account pill. */}
          <div className="navauth">
            <div className="navloc">
              <span className="navflag" aria-hidden="true">
                <i /><i /><i />
              </span>
              <span>EN</span>
              <span className="navcart" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 8h14l-1.2 11.2A2 2 0 0 1 15.8 21H8.2a2 2 0 0 1-2-1.8L5 8z" />
                  <path d="M9 8V6a3 3 0 0 1 6 0v2" />
                </svg>
              </span>
            </div>
            <button className="btn-orange">Log in/Sign up</button>
          </div>
        </div>
      </nav>

      <BackBar
        backLabel="Back"
        trail={[
          { label: 'Packages', to: '/' },
          { label: 'Search results', to: '/results' },
          { label: 'Build your own' },
        ]}
      />

      <div className="sumbar">
        <div className="wrap">
          <span>
            <b>{isMultiDestination ? routeLabel : `${search.fromCity} → ${search.toCity}`}</b> ·{' '}
            {totalNights} nights · {travellerSummary()}
          </span>
          {/* The dates live in the bar on every step, so the trip can be
              re-dated from the last step without going back to the search. */}
          <DateRangePicker
            departDate={search.departDate}
            returnDate={search.returnDate}
            onChange={setDates}
            triggerClassName="modbtn"
            // Opens rightward: this trigger sits near the left of the summary
            // bar, so a right-aligned panel would sweep back across the step rail.
            align="left"
            label="Travel dates"
          >
            {dateLabel}
          </DateRangePicker>
          <button className="modbtn" onClick={() => navigate('/')}>
            Modify
          </button>
        </div>
      </div>

      <div className="rail">
        <div className="wrap">
          {railItems.map((item, i) => (
            <Fragment key={item.key}>
              {i > 0 && <span className="arr">→</span>}
              {item.city ? (
                // A heading, not a destination: no number and nothing to click.
                <div className="stp">{item.city}</div>
              ) : (
                <div
                  className={`stp${
                    item.step.key === current.key ? ' cur' : completed.has(item.step.key) ? ' done' : ''
                  }`}
                  {...activatable(() => goRail(item.step), {
                    role: 'button',
                    'aria-current': item.step.key === current.key ? 'step' : undefined,
                  })}
                >
                  <span className="n">{item.step.n}</span> {item.step.label}
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="wrap">
        <div className="layout">
          <aside className="lside">
            <div className="tierbox">
              {isMultiDestination ? (
                <>
                  <div className="tierbox-h">Your itinerary</div>
                  {priced.legPrices.map((leg) => (
                    <div className="tm" key={leg.entry.id}>
                      <div className="tn">{leg.entry.toCity}</div>
                      <b>{naira(leg.priced.bundled)}</b>
                      <small>
                        {leg.entry.nights} night{leg.entry.nights === 1 ? '' : 's'}
                      </small>
                    </div>
                  ))}
                  <div className="tierbox-f">
                    Auto-generated tiers cover single-destination trips only. A multi-city trip is
                    priced from the legs above.
                  </div>
                </>
              ) : (
                <>
                  <div className="tierbox-h">Auto-generated packages</div>
                  {TIERS.map((tier) => (
                    <div className={`tm ${tier.mod}`} key={tier.name}>
                      <div className="tn">{tier.name}</div>
                      <b>{naira(tier.price)}</b>
                      <small>Save {nairaShort(tier.save)}</small>
                      <button className="go" onClick={() => selectTier(tier)}>
                        Select
                      </button>
                    </div>
                  ))}
                  <div className="tierbox-f">Selecting a tier goes straight to checkout.</div>
                </>
              )}
            </div>
          </aside>

          <div className="main">
            {current.kind === 'hotel' && (
              <div className="panel active">
                <div className="sthead">
                  <h1>Choose your hotel{cityIn(entry.toCity)}</h1>
                  <span className="cnt">
                    {entry.pkg.hotels.length} options for your dates
                  </span>
                </div>
                {entry.isFirst ? (
                  <p className="stnote">
                    Your stay dates default to your search dates. Adjust below if needed — you don't
                    have to check in the same day you fly.
                  </p>
                ) : (
                  <p className="stnote">
                    You arrive from {entry.fromCity} on {formatShort(entry.startDate)} and stay{' '}
                    {entry.nights} night{entry.nights === 1 ? '' : 's'}. Change the length of this
                    stop on the search bar's destination list — everything after it shifts to match.
                  </p>
                )}

                {entry.isFirst ? (
                  <div className="datebar">
                    <DateRangePicker
                      departDate={search.departDate}
                      returnDate={search.returnDate}
                      onChange={setDates}
                      triggerClassName="datefield"
                      anchorStyle={{ flex: 1 }}
                      align="left"
                      label="Check-in"
                    >
                      <div className="dl">Check-in</div>
                      <div className="dv">{formatWeekday(search.departDate)}</div>
                    </DateRangePicker>
                    <DateRangePicker
                      departDate={search.departDate}
                      returnDate={search.returnDate}
                      onChange={setDates}
                      triggerClassName="datefield"
                      anchorStyle={{ flex: 1 }}
                      align="left"
                      label="Check-out"
                    >
                      <div className="dl">Check-out</div>
                      <div className="dv">{formatWeekday(search.returnDate)}</div>
                    </DateRangePicker>
                    <span className="datenights">{entry.nights} nights</span>
                  </div>
                ) : (
                  // A later leg's dates are the previous leg's end plus its own
                  // length, so they are shown rather than offered for editing.
                  <div className="datebar">
                    <div className="datefield" style={{ flex: 1 }}>
                      <div className="dl">Check-in</div>
                      <div className="dv">{formatWeekday(entry.startDate)}</div>
                    </div>
                    <div className="datefield" style={{ flex: 1 }}>
                      <div className="dl">Check-out</div>
                      <div className="dv">{formatWeekday(entry.endDate)}</div>
                    </div>
                    <span className="datenights">{entry.nights} nights</span>
                  </div>
                )}
                {entry.isFirst && (
                  <p className="datenote">
                    💡 Your flight arrives {formatShort(search.departDate)} at 08:30. If you're
                    arriving late or staying with family the first night, move check-in to{' '}
                    {formatShort(addDays(search.departDate, 1))} — you'll save one night's hotel cost.
                  </p>
                )}

                <div role="radiogroup" aria-label="Hotel">
                  {entry.pkg.hotels.map((item, i) => (
                    <Fragment key={item.id}>
                      <OptionCard
                        item={item}
                        img={IMG[i % IMG.length]}
                        feats={hotelFeats(entry, item)}
                        price={item.nightly * entry.nights}
                        selected={item.id === hotel.id}
                        // Every hotel is quoted at its own default room, so the
                        // cards stay comparable with each other; the package
                        // carries the chosen room's cost.
                        selectedPrice={hotel.nightly * entry.nights}
                        note={
                          item.eligible === false
                            ? 'not in the bundle'
                            : `${naira(item.nightlySeparate * entry.nights)} separately`
                        }
                        metaExtra={` · ${naira(item.nightly)} a night`}
                        onSelect={() => selectHotel(item.id)}
                      />
                      {/* The rooms hang under the hotel they belong to, so the
                          second choice reads as part of that card rather than
                          as three more hotels. */}
                      {item.id === hotel.id && (
                        <>
                          <p className="stnote">Room type</p>
                          <div role="radiogroup" aria-label="Room type">
                            {item.rooms.map((r) => (
                              <article
                                key={r.id}
                                className={r.id === room.id ? 'topt sel' : 'topt'}
                                {...activatable(() => patchSel(entry.id, { roomId: r.id }), {
                                  role: 'radio',
                                  'aria-checked': r.id === room.id,
                                })}
                              >
                                <div className="body">
                                  <h3>{r.name}</h3>
                                  <div className="meta">
                                    {r.board} · {r.beds} · sleeps {r.sleeps}
                                  </div>
                                </div>
                                <div className="price">
                                  <div className="amt">{naira(r.nightly * entry.nights)}</div>
                                  <div className="ref" style={{ textDecoration: 'none' }}>
                                    {naira(r.nightly)} a night
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        </>
                      )}
                    </Fragment>
                  ))}
                </div>

                <div className="snav">
                  {previous && (
                    <button className="backb" onClick={() => goStep(previous)}>
                      ← {backLabel}
                    </button>
                  )}
                  <button className="nextb" onClick={() => goStep(following)}>
                    Continue to {nextLabel} →
                  </button>
                </div>
              </div>
            )}

            {current.kind === 'flight' && (
              <div className="panel active">
                <div className="sthead">
                  <h1>Choose your flight{isMultiDestination ? ` to ${entry.toCity}` : ''}</h1>
                  <span className="cnt">{legPriced.flightOptions.length} of 14 options</span>
                </div>
                <p className="stnote">
                  {isMultiDestination ? (
                    <>
                      {entry.fromCity} → {entry.toCity}. One way — your flight home is priced
                      separately at the end.
                    </>
                  ) : (
                    <>
                      Your hotel is locked in. Every price below already includes your bundle
                      discount.
                    </>
                  )}
                </p>

                {/* Mirrors wakanow.com's flight results: a summary rail that
                    doubles as the sort, then a card per flight carrying the
                    three ways to pay, both timelines and the baggage. */}
                <FlightSort
                  value={flightSort}
                  onChange={setFlightSort}
                  summary={flightSummary}
                  count={legPriced.flightOptions.length}
                />

                <div role="radiogroup" aria-label="Flight">
                  {sortedFlights.map(({ item, card }) => (
                    <FlightCard
                      key={item.id}
                      card={card}
                      selected={item.id === flight.id}
                      onSelect={() => selectFlight(item.id)}
                      priceNote={
                        item.eligible === false
                          ? 'Not in the bundle'
                          : `${naira(item.separate)} booked separately`
                      }
                    >
                      {item.id === flight.id && (
                        <div className="fareladder">
                          <p className="stnote">Cabin and fare</p>
                          <div role="radiogroup" aria-label="Cabin and fare">
                            {item.fares.map((f) => {
                              const diff = f.price - fare.price;
                              return (
                                <article
                                  key={f.id}
                                  className={f.id === fare.id ? 'topt sel' : 'topt'}
                                  {...activatable(() => patchSel(entry.id, { fareId: f.id }), {
                                    role: 'radio',
                                    'aria-checked': f.id === fare.id,
                                  })}
                                >
                                  <div className="body">
                                    <h3>
                                      {f.cabin === f.label ? f.label : `${f.label} · ${f.cabin}`}
                                    </h3>
                                    <div className="meta">
                                      {f.bags} · {f.seat} · {f.changeable || 'No changes'}
                                    </div>
                                  </div>
                                  <div className="price">
                                    <div className="amt">{naira(f.price)}</div>
                                    {diff !== 0 && (
                                      <div className="ref" style={{ textDecoration: 'none' }}>
                                        {delta(diff)}
                                      </div>
                                    )}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </FlightCard>
                  ))}
                </div>

                <div className="snav">
                  <button className="backb" onClick={() => goStep(previous)}>
                    ← {backLabel}
                  </button>
                  <button className="nextb" onClick={() => goStep(following)}>
                    Continue to {nextLabel} →
                  </button>
                </div>
              </div>
            )}

            {current.kind === 'transfer' && (
              <div className="panel active">
                <div className="sthead">
                  <h1>Airport transfer{cityIn(entry.toCity)}</h1>
                </div>
                <p className="stnote">
                  Both ways — airport to hotel and back. Included in your package by default. Toggle
                  off if you're arranging your own.
                </p>

                {!entry.pkg.transfer ? (
                  <div className="skipbanner" style={{ display: 'block' }}>
                    <p>No transfer is offered in {entry.toCity} — nothing to add here.</p>
                  </div>
                ) : sel.includeTransfer ? (
                  <article className="topt sel">
                    <span className="ic">🚐</span>
                    <div className="body">
                      <h3>{entry.pkg.transfer.name}</h3>
                      <div className="meta">{entry.pkg.transfer.desc}</div>
                    </div>
                    <div className="price">
                      <div className="amt">{naira(entry.pkg.transfer.price)}</div>
                      <div className="ref">{naira(entry.pkg.transfer.separate)} separately</div>
                    </div>
                  </article>
                ) : (
                  <div className="skipbanner" style={{ display: 'block' }}>
                    <p>Transfer skipped — not in your package</p>
                    <button onClick={() => patchSel(entry.id, { includeTransfer: true })}>
                      Add transfer back
                    </button>
                  </div>
                )}

                <div className="snav">
                  <button className="backb" onClick={() => goStep(previous)}>
                    ← {backLabel}
                  </button>
                  {entry.pkg.transfer && sel.includeTransfer && (
                    <button
                      className="skipb"
                      onClick={() => patchSel(entry.id, { includeTransfer: false })}
                    >
                      Skip transfer
                    </button>
                  )}
                  <button className="nextb" onClick={() => goStep(following)}>
                    Continue to {nextLabel} →
                  </button>
                </div>
              </div>
            )}

            {current.kind === 'tours' && (
              <div className="panel active">
                <div className="sthead">
                  <h1>Tours &amp; experiences{cityIn(entry.toCity)}</h1>
                </div>
                <p className="stnote">
                  Add as many as you like — each one adds to your bundle discount. All pre-selected
                  by default. Toggle any off.
                </p>

                {sel.includeTours ? (
                  <div>
                    {entry.pkg.tours && (
                      <article className="topt sel">
                        <span className="ic">🗺</span>
                        <div className="body">
                          <h3>{entry.pkg.tours.label}</h3>
                          <div className="meta">{entry.pkg.tours.desc}</div>
                        </div>
                        <div className="price">
                          <div className="amt">{naira(entry.pkg.tours.price)}</div>
                          <div className="ref">{naira(entry.pkg.tours.separate)} separately</div>
                        </div>
                      </article>
                    )}
                    {tourAddons(entry.pkg).map((item) => {
                      const on = sel.tourIds.includes(item.id);
                      return (
                        <article key={item.id} className={on ? 'topt sel' : 'topt'}>
                          <button
                            className={on ? 'tgl on' : 'tgl'}
                            role="switch"
                            aria-checked={on}
                            aria-label={item.title}
                            onClick={() => toggleTour(item.id)}
                          />
                          <div className="body">
                            <h3>{item.title}</h3>
                            <div className="meta">{item.meta}</div>
                          </div>
                          <div className="price">
                            <div className="amt">{naira(item.price)}</div>
                            <div className="ref">{naira(item.separate)} separately</div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="skipbanner" style={{ display: 'block' }}>
                    <p>Tours skipped — not in your package</p>
                    <button onClick={() => patchSel(entry.id, { includeTours: true })}>
                      Add tours back
                    </button>
                  </div>
                )}

                <div className="snav">
                  <button className="backb" onClick={() => goStep(previous)}>
                    ← {backLabel}
                  </button>
                  {sel.includeTours && (
                    <button
                      className="skipb"
                      onClick={() => patchSel(entry.id, { includeTours: false })}
                    >
                      Skip all tours
                    </button>
                  )}
                  <button className="nextb" onClick={() => goStep(following)}>
                    Continue to {nextLabel} →
                  </button>
                </div>
              </div>
            )}

            {current.kind === 'visa' && (
              <div className="panel active">
                <div className="sthead">
                  <h1>{visas.length > 1 ? 'Visas' : 'Visa'}</h1>
                </div>
                {visas.length === 0 ? (
                  <>
                    <p className="stnote">
                      Nothing to arrange here — none of the destinations on this trip needs a visa on
                      a {search.nationality} passport.
                    </p>
                    <div className="skipbanner" style={{ display: 'block' }}>
                      <p>No visas required for this trip</p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="stnote">
                      {visas.length > 1
                        ? `Each destination is applied for separately. Wakanow can handle all ${visas.length}.`
                        : `A visa is required for ${search.nationality} passport holders entering ${visas[0].country}. Wakanow can apply for you.`}
                    </p>

                    {visas.map((leg) => {
                      const addon = visaAddon(leg.pkg);
                      const on = selFor(leg).addons.includes('visa');

                      if (!addon) {
                        // The destination requires a visa the catalogue does not
                        // price, so it is stated rather than offered for sale.
                        return (
                          <div className="visacard" key={leg.id}>
                            <h3>🛂 {leg.toCity} · visa required</h3>
                            <div className="visabanner">
                              <b>Required for {search.nationality} passports entering {leg.country}.</b>{' '}
                              Wakanow does not process this one — arrange it before you travel.
                            </div>
                          </div>
                        );
                      }

                      if (!on) {
                        return (
                          <div className="skipbanner" style={{ display: 'block' }} key={leg.id}>
                            <p>
                              {leg.toCity} visa skipped — you confirmed you hold a valid visa
                            </p>
                            <button onClick={() => setVisaOn(leg, true)}>Add visa back</button>
                          </div>
                        );
                      }

                      return (
                        <div className="visacard" key={leg.id}>
                          <h3>
                            🛂 {addon.title}
                            {isMultiDestination ? ` · ${leg.toCity}` : ''}
                          </h3>
                          <div className="visabanner">
                            <b>Required for {search.nationality} passports entering {leg.country}.</b>{' '}
                            Wakanow applies for you — documents collected by email after payment. If
                            you already hold a valid visa, you can remove this.
                          </div>
                          <div className="visarow">
                            <div className="body">
                              <h3 style={{ fontSize: '13px' }}>{addon.title}</h3>
                              <div className="meta">{addon.meta}</div>
                            </div>
                            <div className="price">
                              <div className="amt">{naira(addon.price)}</div>
                              <div className="ref">{naira(addon.separate)} separately</div>
                            </div>
                            <button
                              className="tgl on"
                              role="switch"
                              aria-checked="true"
                              aria-label={`${addon.title} for ${leg.toCity}`}
                              onClick={() => openVisaModal(leg)}
                            />
                          </div>
                          <div className="visanote">
                            ⚠ Documents must be submitted within 5 working days of booking.
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                <div className="snav">
                  <button className="backb" onClick={() => goStep(previous)}>
                    ← {backLabel}
                  </button>
                  <button
                    className="nextb"
                    style={{ background: 'var(--brand-500)' }}
                    onClick={checkout}
                  >
                    Proceed to checkout →
                  </button>
                </div>
              </div>
            )}
          </div>

          <aside className="rside">
            <div className="totbox">
              <div className="totbox-h">
                {isMultiDestination ? routeLabel : 'Your package'}{' '}
                <small>{payingTravellers} travellers</small>
              </div>
              <div className="totbox-b">
                {priced.legPrices.map((leg) => (
                  <Fragment key={leg.entry.id}>
                    {isMultiDestination && (
                      <div className="tl">
                        <span>
                          <b>{leg.entry.toCity}</b>
                        </span>
                      </div>
                    )}
                    {totalLines(leg.entry, leg).map((row) => (
                      <div className={row.off ? 'tl off' : 'tl'} key={row.key}>
                        <span>{row.label}</span>
                        <b>{naira(row.amount)}</b>
                      </div>
                    ))}
                  </Fragment>
                ))}
                {priced.home && (
                  <div className="tl">
                    <span>{priced.home.label}</span>
                    <b>{naira(priced.home.bundled)}</b>
                  </div>
                )}
                <div className="tsv">
                  {priced.eligible
                    ? `You save ${naira(priced.save)} vs booking separately`
                    : 'No bundle price on this combination'}
                </div>
                <div className="tg">
                  <span>Total /person</span>
                  <b>{naira(total)}</b>
                </div>
                <div className="pssl">
                  Or <b>{naira(Math.round(total / 6))}/month</b> × 6 with PSS
                </div>
                <button className="wab" onClick={shareOnWhatsApp}>
                  <svg viewBox="0 0 24 24">
                    <path d={WHATSAPP_PATH} />
                  </svg>{' '}
                  Share on WhatsApp
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {visaModalLeg && (
        <div
          className="overlay open"
          onClick={(event) => {
            if (event.target === event.currentTarget) setVisaModalLeg(null);
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Before you remove the ${visaModalLeg.toCity} visa`}
          >
            <div className="mhead">
              <div className="mic">🛂</div>
              <h2>Before you remove the {visaModalLeg.toCity} visa</h2>
              <p>
                {search.nationality} passport holders need a visa to enter {visaModalLeg.country}.
                Removing it means Wakanow will not arrange one for you.
              </p>
            </div>
            <div className="mbody">
              <div role="radiogroup" aria-label="Why are you removing the visa?">
                <div
                  className={visaReason === 'have' ? 'mo sel' : 'mo'}
                  {...activatable(() => setVisaReason('have'), {
                    role: 'radio',
                    'aria-checked': visaReason === 'have',
                  })}
                >
                  <span className="rad" />
                  <div>
                    <div className="mt">
                      I already hold a valid {visaModalLeg.country} visa
                    </div>
                    <div className="ms">Your visa covers your travel dates.</div>
                  </div>
                </div>
                <div
                  className={visaReason === 'free' ? 'mo sel' : 'mo'}
                  {...activatable(() => setVisaReason('free'), {
                    role: 'radio',
                    'aria-checked': visaReason === 'free',
                  })}
                >
                  <span className="rad" />
                  <div>
                    <div className="mt">My passport doesn't need a visa</div>
                    <div className="ms">We'll check this against your nationality.</div>
                  </div>
                </div>
              </div>
              <div className={visaReason === 'free' ? 'mwarn show' : 'mwarn'}>
                <b>Our records disagree.</b> {search.nationality} passport holders require a visa
                for {visaModalLeg.country}. We strongly recommend keeping the visa in your package.
              </div>
              <div className="macts">
                <button className="mkeep" onClick={keepVisa}>
                  Keep visa in package
                </button>
                <button
                  className="mskip"
                  disabled={!visaReason}
                  style={{ opacity: visaReason ? 1 : 0.5 }}
                  onClick={removeVisa}
                >
                  Remove visa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

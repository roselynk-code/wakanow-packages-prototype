import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import BackBar from '../components/BackBar.jsx';
import DateRangePicker from '../components/DateRangePicker.jsx';
import FlightCard from '../components/FlightCard.jsx';
import FlightSort from '../components/FlightSort.jsx';
import HotelCard from '../components/HotelCard.jsx';
import RoomGrid from '../components/RoomGrid.jsx';
import VisaCheck from '../components/VisaCheck.jsx';
import {
  APPLICATION_LANGUAGE,
  DEFERRED_LANGUAGE,
  DOCUMENT_DEADLINE,
  SHARED_DOCUMENT_IDS,
  documentStatus,
  fulfilmentRule,
  hotelsForLeg,
  outstandingDocuments,
} from '../data/fulfilment.js';
import { addDays, formatShort, formatWeekday } from '../lib/dates.js';
import { flightCard, sortFlights, sortSummary } from '../lib/flights.js';
import { delta, naira, nairaShort } from '../lib/format.js';
import { flightsForLeg, priceItinerary, visaLegs } from '../lib/itinerary.js';
import { findFare, findRoom } from '../lib/pricing.js';
import { tiersFor } from '../lib/tiers.js';
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

/** The passport countries the search offers, mirrored on the visa step's
 *  Check Requirements panel — nationality is what the visa rule turns on. */
const NATIONALITIES = ['Nigeria', 'Ghana', 'United Kingdom', 'United States', 'South Africa'];

/** Only the closest-tier approximation at checkout needs the authored slugs. */
const TIER_SLUGS = { Essential: 'tier-essential', Premium: 'tier-premium', Luxury: 'tier-luxury' };

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
  if (hotel.id === ranked[0]?.id) return { name: 'Essential', slug: TIER_SLUGS.Essential };
  if (hotel.id === ranked[ranked.length - 1]?.id) return { name: 'Luxury', slug: TIER_SLUGS.Luxury };
  return { name: 'Premium', slug: TIER_SLUGS.Premium };
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

export default function PackageBuilder() {
  const navigate = useNavigate();
  const {
    itinerary,
    isMultiDestination,
    routeLabel,
    payingTravellers,
    search,
    setSearch,
    setDates,
    setTier,
    setBookingSlug,
    totalNights,
    dateLabel,
    travellerSummary,
    documentsFor,
    markDocuments,
    toggleDocument,
    deferredDocuments,
    deferDocuments,
  } = useTrip();

  const [stepKey, setStepKey] = useState(`${itinerary[0].id}-hotel`);
  const [completed, setCompleted] = useState(() => new Set());
  const [selections, setSelections] = useState(() => reconcileSelections(itinerary, {}));
  const [flightSort, setFlightSort] = useState('cheapest');
  const [visaModalLeg, setVisaModalLeg] = useState(null);
  const [visaReason, setVisaReason] = useState(null);
  // The last bulk upload, per leg, so the panel can say what it just took
  // rather than silently ticking four rows and leaving the traveller to spot
  // the difference.
  const [lastUpload, setLastUpload] = useState({});
  // Premium opens by default — it is the recommended tier, and one open card
  // teaches the shape of the other two without three lists fighting for the rail.
  const [openTier, setOpenTier] = useState('Premium');
  const [appliedTier, setAppliedTier] = useState(null);

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

  /* Destination Fulfilment Rules. The rule is keyed on destination × passport,
     so it is resolved per leg and re-resolved whenever the passport changes on
     the visa step's Check Requirements panel. Null is the ordinary case. */
  const legRule = entry ? fulfilmentRule(entry.pkg, search.nationality) : null;
  const legHotels = entry
    ? hotelsForLeg(entry.pkg, legRule)
    : { hotels: [], hidden: 0, partner: null };

  /* A channel rule can start applying mid-build — change the passport on the
     visa step and walk back to the hotel step and the inventory has changed
     under you. Re-pointing during render rather than in an effect means no
     frame paints a price for a hotel we cannot sell this traveller. */
  if (
    entry &&
    legRule?.landChannel &&
    legHotels.hotels.length &&
    !legHotels.hotels.some((item) => item.id === sel.hotelId)
  ) {
    const first = legHotels.hotels[0];
    patchSel(entry.id, { hotelId: first.id, roomId: findRoom(first)?.id });
  }

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

  /* The three auto-generated packages for this search. Dubai returns the
     authored records; every other destination is composed from its own
     inventory, so the rail cannot show a Dubai hotel in front of a Doha trip. */
  const tiers = isMultiDestination
    ? []
    : tiersFor(itinerary[0].pkg, {
        nights: itinerary[0].nights,
        nationality: search.nationality,
      });

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

  /** Documents for one destination, uploaded before payment. */
  const uploadedFor = (legId) => documentsFor(legId);

  /**
   * Send everything in one go.
   *
   * One picker, every outstanding document for this destination, and a file
   * count that decides how many rows it can honestly tick — pick two files
   * against four requirements and two rows stay open, because a checklist that
   * marks itself complete on a partial upload is worse than no checklist.
   *
   * Shared documents fan out. A passport bio page is the same file in Doha and
   * in Singapore, so uploading it here satisfies it on every destination of
   * this trip that asks for it; only destination-specific paperwork (Form 14A)
   * stays on its own leg.
   */
  const uploadAllDocuments = (leg, rule, fileList) => {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;

    const outstanding = outstandingDocuments(rule, uploadedFor(leg.id));
    const taken = outstanding.slice(0, files.length);
    if (!taken.length) return;

    const keys = [];
    for (const doc of taken) {
      keys.push(`${leg.id}:${doc.id}`);
      if (!SHARED_DOCUMENT_IDS.includes(doc.id)) continue;
      for (const other of routedVisas) {
        if (other.leg.id === leg.id) continue;
        if (other.rule.documents.some((d) => d.id === doc.id)) keys.push(`${other.leg.id}:${doc.id}`);
      }
    }

    markDocuments(keys);
    setLastUpload((prev) => ({
      ...prev,
      [leg.id]: { count: files.length, matched: taken.map((doc) => doc.label) },
    }));
    // A picker that keeps its last selection cannot fire onChange for the same
    // file twice, and the traveller reads that as the button being broken.
    setDocumentsDeferredOff(leg.id);
  };

  /** Uploading is the answer to "later", so it retires the deferral. */
  const setDocumentsDeferredOff = (legId) => {
    if (deferredDocuments[legId]) deferDocuments(legId, false);
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

  /**
   * An authored tier is a package in its own right and still goes straight to
   * checkout. A composed tier has no catalogue record — it is this
   * destination's inventory arranged three ways — so choosing one fills the
   * build with its choices and leaves the traveller here, which is what a
   * starting point means.
   */
  const selectTier = (tier) => {
    setTier(tier.name);
    if (tier.composed) {
      setAppliedTier(tier.name);
      patchSel(itinerary[0].id, tier.selection);
      setStepKey(`${itinerary[0].id}-hotel`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
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

  /* Destinations on this trip whose visa is routed through a partner and is
     still switched on. Collecting their documents before payment is the
     default, because the whole point is that the Holidays team never chases a
     customer who has already paid. */
  const routedVisas = visas
    .map((leg) => ({ leg, rule: fulfilmentRule(leg.pkg, search.nationality) }))
    .filter(({ leg, rule }) => rule && selFor(leg).addons.includes('visa'));

  /* Missing is a fact; blocking is a choice. A destination whose documents are
     not in yet is missing them either way — but once the traveller has said
     "I'll send these later", they have chosen the deferred sequence and the
     step lets them through with the deadline stated. Only the ones who have
     neither uploaded nor chosen are still standing at a closed door. */
  const docsMissing = routedVisas.filter(
    ({ leg, rule }) => !documentStatus(rule, uploadedFor(leg.id)).complete,
  );
  const docsDeferred = docsMissing.filter(({ leg }) => deferredDocuments[leg.id]);
  const docsOutstanding = docsMissing.filter(({ leg }) => !deferredDocuments[leg.id]);

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
                  <div className="tierbox-h">
                    Built for your search
                    <span>{search.toCity} · {totalNights} nights · {payingTravellers} travellers</span>
                  </div>
                  {tiers.map((tier) => {
                    const open = openTier === tier.name;
                    return (
                      <div className={`tm ${tier.mod}${open ? ' open' : ''}`} key={tier.name}>
                        <div className="tm-h">
                          <div className="tn">
                            {tier.name}
                            {tier.mod === 'pre' && <span className="tm-rec">Recommended</span>}
                          </div>
                          <div className="tm-tag">{tier.tagline}</div>
                        </div>
                        <b>{naira(tier.price)}</b>
                        <div className="tm-ref">{naira(tier.separate)} booked separately</div>
                        <small>Save {nairaShort(tier.save)}</small>

                        {open && (
                          <ul className="tm-inc">
                            {tier.inclusions.map((line) => (
                              <li className={line.off ? 'off' : ''} key={line.title}>
                                <span className="ic" aria-hidden="true">{line.icon}</span>
                                <span className="tx">
                                  <b>{line.title}</b>
                                  <em>{line.sub}</em>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}

                        <button
                          className="tm-more"
                          aria-expanded={open}
                          onClick={() => setOpenTier(open ? null : tier.name)}
                        >
                          {open ? 'Hide what’s included' : 'What’s included'}
                        </button>
                        <button className="go" onClick={() => selectTier(tier)}>
                          {appliedTier === tier.name
                            ? `${tier.name} applied · edit below`
                            : tier.composed
                              ? `Use ${tier.name}`
                              : `Select ${tier.name}`}
                        </button>
                      </div>
                    );
                  })}
                  <div className="tierbox-f">
                    {tiers[0]?.composed
                      ? 'Composed just now from live prices for your dates. Choosing one fills the build below — everything stays editable.'
                      : 'Built just now from live prices for your dates. Selecting one goes straight to checkout — everything stays editable there.'}
                  </div>
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
                    {legHotels.hotels.length} options for your dates
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

                {/* Mirrors wakanow.com's hotel results: a card per hotel with
                    the image flush to its left edge, the rating badge opposite
                    the name and the three ways to pay across the bottom. The
                    chosen hotel opens the live "Choose your room" grid inside
                    its own card. */}
                {legRule?.landChannel && (
                  <div className="dfr">
                    <h4>
                      <span className="dfr-tag">{legRule.partner}</span>
                      {entry.toCity} hotels are booked through {legRule.partner}
                    </h4>
                    <p>
                      {legRule.summary} {legRule.partnerNote}, so this is arranged inside your
                      package — there is nothing separate for you to book.
                    </p>
                    {legHotels.hidden > 0 && (
                      <p className="dfr-hidden">
                        {legHotels.hidden} propert{legHotels.hidden === 1 ? 'y is' : 'ies are'}{' '}
                        hidden for a {search.nationality} passport because {legRule.partner} does
                        not contract {legHotels.hidden === 1 ? 'it' : 'them'}. Change the passport
                        on the visa step and the full list returns.
                      </p>
                    )}
                  </div>
                )}

                <div role="radiogroup" aria-label="Hotel">
                  {legHotels.hotels.map((item, i) => (
                    <HotelCard
                      key={item.id}
                      hotel={item}
                      nights={entry.nights}
                      // Every hotel is quoted at its own default room, so the
                      // cards stay comparable with each other; the package
                      // carries the chosen room's cost.
                      stayPrice={item.nightly * entry.nights}
                      plate={(i % 5) + 1}
                      selected={item.id === hotel.id}
                      onSelect={() => selectHotel(item.id)}
                      priceNote={
                        item.eligible === false
                          ? 'Not in the bundle'
                          : `${naira(item.nightlySeparate * entry.nights)} booked separately · free cancellation until ${formatShort(addDays(entry.startDate, -entry.pkg.freeCancelDays))}`
                      }
                    >
                      {item.id === hotel.id && (
                        <RoomGrid
                          hotel={item}
                          nights={entry.nights}
                          selectedRoomId={room.id}
                          onSelect={(roomId) => patchSel(entry.id, { roomId })}
                        />
                      )}
                    </HotelCard>
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

                <VisaCheck
                  nationality={search.nationality}
                  nationalities={NATIONALITIES}
                  onNationality={(country) => setSearch({ nationality: country })}
                  destinations={itinerary.map((leg) => leg.toCity).join(' · ')}
                  needed={visas}
                  travellerName="Adaeze Okonkwo"
                  email="adaeze.okonkwo@gmail.com"
                />
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
                      const rule = fulfilmentRule(leg.pkg, search.nationality);
                      const status = documentStatus(rule, uploadedFor(leg.id));

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

                      /* A routed destination. The application is filed through a
                         partner rather than by Wakanow directly, and the
                         documents are collected here — before payment — so the
                         Holidays team receives a complete submission and can
                         execute it rather than chase it. */
                      if (rule) {
                        return (
                          <div className="visacard" key={leg.id}>
                            <h3>
                              🛂 {addon.title}
                              {isMultiDestination ? ` · ${leg.toCity}` : ''}
                              <span className="dfr-tag">
                                {rule.visaRoute === 'managed' ? rule.partner : 'Authorised agent'}
                              </span>
                            </h3>
                            <div className="visabanner">
                              <b>
                                Required for {search.nationality} passports entering {leg.country}.
                              </b>{' '}
                              {rule.summary} {rule.partnerNote}. {APPLICATION_LANGUAGE}
                            </div>

                            <div className="visarow">
                              <div className="body">
                                <h3 style={{ fontSize: '13px' }}>{addon.title}</h3>
                                {/* addon.meta already ends with the lead time,
                                    so this adds what the lead time is measured
                                    from rather than printing it twice. */}
                                <div className="meta">
                                  {addon.meta}, from a complete submission
                                </div>
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

                            <div className="docs">
                              <div className="docs-h">
                                <h4>Documents for {leg.toCity}</h4>
                                <span className={status.complete ? 'docs-n done' : 'docs-n'}>
                                  {status.done} of {status.total} ready
                                </span>
                              </div>
                              <p className="docs-why">
                                Uploaded now, before you pay. A complete file is submitted the
                                moment payment clears, rather than an email chain starting after
                                it.
                              </p>

                              {/* One picker for the lot. The rows below stay —
                                  they are how a traveller sees WHAT is still
                                  missing — but nobody has to click four
                                  buttons to send four files they already have
                                  in one folder. */}
                              {!status.complete && (
                                <label className="docs-all">
                                  <input
                                    type="file"
                                    multiple
                                    accept="image/*,application/pdf"
                                    onChange={(event) => {
                                      uploadAllDocuments(leg, rule, event.target.files);
                                      event.target.value = '';
                                    }}
                                  />
                                  <span className="docs-all-ic" aria-hidden="true">
                                    ⇪
                                  </span>
                                  <span className="docs-all-b">
                                    <b>
                                      Upload all {status.total - status.done} at once
                                    </b>
                                    <span>
                                      Pick them together —{' '}
                                      {outstandingDocuments(rule, uploadedFor(leg.id))
                                        .map((doc) => doc.label.toLowerCase())
                                        .join(', ')}
                                      . Your passport and photograph carry across every
                                      destination on this trip, so they are only ever uploaded
                                      once.
                                    </span>
                                  </span>
                                </label>
                              )}

                              {lastUpload[leg.id] && (
                                <p className="docs-took">
                                  Took {lastUpload[leg.id].count} file
                                  {lastUpload[leg.id].count > 1 ? 's' : ''} ·{' '}
                                  {lastUpload[leg.id].matched.join(', ')}
                                </p>
                              )}

                              {rule.documents.map((doc) => {
                                const done = Boolean(uploadedFor(leg.id)[doc.id]);
                                return (
                                  <div className={done ? 'doc done' : 'doc'} key={doc.id}>
                                    <span className="doc-tick" aria-hidden="true">
                                      {done ? '✓' : ''}
                                    </span>
                                    <div className="doc-b">
                                      <h5>{doc.label}</h5>
                                      <div className="doc-m">{doc.note}</div>
                                    </div>
                                    <button
                                      className={done ? 'doc-btn done' : 'doc-btn'}
                                      onClick={() => toggleDocument(leg.id, doc.id)}
                                    >
                                      {done ? 'Uploaded · replace' : 'Upload'}
                                    </button>
                                  </div>
                                );
                              })}

                              {/* Later is a real answer. Stated here, next to
                                  the thing being deferred, rather than only as
                                  an escape hatch on a blocked button. */}
                              {!status.complete && (
                                <div className="docs-later">
                                  <button
                                    type="button"
                                    className="docs-later-b"
                                    onClick={() =>
                                      deferDocuments(leg.id, !deferredDocuments[leg.id])
                                    }
                                  >
                                    {deferredDocuments[leg.id]
                                      ? 'Actually, upload them now'
                                      : 'I’ll upload these later'}
                                  </button>
                                  <span>
                                    {deferredDocuments[leg.id]
                                      ? `Due ${DOCUMENT_DEADLINE}. ${DEFERRED_LANGUAGE}`
                                      : `Sending them now is faster. If you don’t have them to hand, they are due ${DOCUMENT_DEADLINE}.`}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="visanote">
                              ⚠ {rule.refund}
                            </div>
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

                {docsOutstanding.length > 0 && (
                  <div className="docgate">
                    <b>
                      Documents outstanding for{' '}
                      {docsOutstanding.map(({ leg }) => leg.toCity).join(' and ')}
                    </b>
                    <p>
                      {docsOutstanding.length === 1
                        ? `${docsOutstanding[0].leg.toCity} files through ${docsOutstanding[0].rule.partner}, and the application goes in as soon as your payment clears. Uploading them now is the fastest route — paying without them only means we come back to you for them.`
                        : 'Each of these files through a partner, and the applications go in as soon as your payment clears. Uploading them now is the fastest route.'}
                    </p>
                    {/* The way past this box without the documents. It exists
                        because the alternative is a traveller who cannot
                        continue, and a booking that ends here. */}
                    <button
                      type="button"
                      className="docgate-later"
                      onClick={() => {
                        for (const { leg } of docsOutstanding) deferDocuments(leg.id, true);
                      }}
                    >
                      I’ll upload{' '}
                      {docsOutstanding.length === 1 ? 'them' : 'these'} later — continue
                    </button>
                  </div>
                )}

                {/* Deferred, and said out loud. Not a warning: the traveller
                    picked this, so the box states the deadline and what the
                    choice actually changes. */}
                {docsOutstanding.length === 0 && docsDeferred.length > 0 && (
                  <div className="docdue">
                    <b>
                      Documents for {docsDeferred.map(({ leg }) => leg.toCity).join(' and ')} are
                      due {DOCUMENT_DEADLINE}
                    </b>
                    <p>
                      You can carry on and pay. {DEFERRED_LANGUAGE} We’ll send you a link to
                      upload{' '}
                      {docsDeferred
                        .flatMap(({ leg, rule }) =>
                          outstandingDocuments(rule, uploadedFor(leg.id)).map((doc) =>
                            doc.label.toLowerCase(),
                          ),
                        )
                        .filter((label, i, all) => all.indexOf(label) === i)
                        .join(', ')}
                      .
                    </p>
                  </div>
                )}

                <div className="snav">
                  <button className="backb" onClick={() => goStep(previous)}>
                    ← {backLabel}
                  </button>
                  <button
                    className="nextb"
                    style={{
                      background: docsOutstanding.length ? 'var(--bdr2)' : 'var(--brand-500)',
                      cursor: docsOutstanding.length ? 'not-allowed' : 'pointer',
                    }}
                    disabled={docsOutstanding.length > 0}
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

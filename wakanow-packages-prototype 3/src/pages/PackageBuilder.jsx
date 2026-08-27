import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import BackBar from '../components/BackBar.jsx';
import DateRangePicker from '../components/DateRangePicker.jsx';
import { buildFares, buildRooms } from '../data/variants.js';
import { addDays, formatShort, formatWeekday } from '../lib/dates.js';
import { delta, naira, nairaShort } from '../lib/format.js';
import { findFare, findRoom } from '../lib/pricing.js';
import { useTrip } from '../state/useTrip.js';
import './PackageBuilder.css';

const STEP_LABELS = ['Hotel', 'Flight', 'Transfer', 'Tours', 'Visa'];

/** The builder's own catalogue predates the room and fare lists, so the variants
 *  are derived with the same helpers the package data uses. Those helpers read
 *  the board basis, the cabin and the baggage allowance out of the record's own
 *  prose, which here lives in `feats` rather than `meta`. */
function withRooms(hotel) {
  return {
    ...hotel,
    rooms: buildRooms({
      ...hotel,
      nightlySeparate: hotel.refNightly,
      meta: `${hotel.meta} · ${hotel.feats.join(' · ')}`,
    }),
  };
}

function withFares(flight) {
  const ladder = buildFares({
    ...flight,
    meta: `${flight.meta} · ${flight.feats.join(' · ')}`,
  });

  return {
    ...flight,
    // The ladder also derives a separate-booking price. These flight records
    // carry no such figure and the builder never shows one, so the fares are
    // copied field by field rather than inheriting a price derived from nothing.
    fares: ladder.map((fare) => ({
      id: fare.id,
      isDefault: fare.isDefault,
      label: fare.label,
      cabin: fare.cabin,
      bags: fare.bags,
      seat: fare.seat,
      changeable: fare.changeable,
      refundable: fare.refundable,
      note: fare.note,
      price: fare.price,
    })),
  };
}

/** `short` is the name the running total uses. Hotels are priced per night, so
 *  the stay cost tracks the dates: `nightly` is the bundled rate and
 *  `refNightly` the price of booking the same room separately. `quoteRef` marks
 *  the one option whose card the mockup captions with that separate price —
 *  every other option's caption is derived from the current selection. */
const HOTELS = [
  {
    id: 'rove-downtown',
    name: 'Rove Downtown · 4★',
    short: 'Rove Downtown',
    roomName: 'Deluxe room',
    img: 'i1',
    nightly: 66800,
    refNightly: 70400,
    quoteRef: true,
    meta: 'Downtown Dubai · 850m to Dubai Mall · free WiFi',
    feats: ['Breakfast incl.', 'Free cancel until 5 Oct', 'Bundle eligible'],
  },
  {
    id: 'rove-city-centre',
    name: 'Rove City Centre · 3★',
    short: 'Rove City Centre',
    roomName: 'Standard room',
    img: 'i3',
    nightly: 57600,
    refNightly: 64000,
    meta: 'Deira · near City Centre Mall · free WiFi',
    feats: ['Room only', 'Bundle eligible'],
  },
  {
    id: 'address-downtown',
    name: 'Address Downtown · 5★',
    short: 'Address Downtown',
    roomName: 'Burj view room',
    img: 'i5',
    nightly: 104000,
    refNightly: 115000,
    meta: 'Downtown Dubai · Burj Khalifa view · pool & spa',
    feats: ['Half board', 'Bundle eligible'],
  },
].map(withRooms);

const FLIGHTS = [
  {
    id: 'ek784',
    name: 'Emirates · EK 784',
    short: 'Emirates',
    img: 'i1',
    price: 1142000,
    note: 'in your bundle',
    meta: 'LOS 14:45 → DXB 08:30 · direct · 7h 45m · return 22:05 → 04:15',
    feats: ['2 × 23kg', 'Meals', 'Bundle eligible'],
  },
  {
    id: 'tk624',
    name: 'Turkish Airlines · TK 624',
    short: 'Turkish Airlines',
    img: 'i2',
    price: 988000,
    meta: 'LOS 11:20 → DXB 09:40 · 1 stop IST · 13h 20m',
    feats: ['2 × 23kg', 'Bundle eligible'],
  },
  {
    id: 'p47570',
    name: 'Air Peace · P4 7570',
    short: 'Air Peace',
    img: 'i3',
    price: 904000,
    meta: 'LOS 09:00 → DXB 19:45 · direct · 7h 45m',
    feats: ['1 × 23kg', 'Bundle eligible'],
  },
].map(withFares);

const TRANSFERS = [
  {
    id: 'careem-private',
    icon: '🚐',
    name: 'Careem · private car',
    short: 'Careem transfer',
    meta: 'Meet & greet at arrivals · up to 4 passengers · both ways',
    price: 90000,
    ref: 94000,
  },
  {
    id: 'careem-shuttle',
    icon: '🚌',
    name: 'Careem · shared shuttle',
    short: 'Careem shuttle',
    meta: 'Airport shuttle · shared with other guests · both ways',
    price: 42000,
    ref: 48000,
  },
  {
    id: 'blacklane',
    icon: '🚘',
    name: 'Blacklane · premium sedan',
    short: 'Blacklane transfer',
    meta: 'Private chauffeur · Mercedes E-Class · both ways',
    price: 156000,
    ref: 172000,
  },
];

const TOURS = [
  {
    id: 'safari',
    name: 'Desert safari with BBQ dinner',
    short: 'Desert safari',
    meta: 'Arabian Adventures · dune drive, camel ride, BBQ · 6hrs · hotel pickup',
    price: 62000,
    ref: 74000,
  },
  {
    id: 'burj',
    name: 'Burj Khalifa · At The Top',
    short: 'Burj Khalifa',
    meta: 'Tickets + skip-the-line · 124th & 125th floor · sunset slot',
    price: 38000,
    ref: 42000,
  },
  {
    id: 'dhow',
    name: 'Dhow dinner cruise',
    short: 'Dhow cruise',
    meta: 'Dubai Marina · 2hr cruise · buffet dinner · live music',
    price: 44000,
    ref: 52000,
  },
];

const VISA = { price: 96000, ref: 105000 };

const TIERS = [
  { name: 'Essential', mod: 'ess', slug: 'tier-essential', price: 1486000, save: 85000 },
  { name: 'Premium', mod: 'pre', slug: 'tier-premium', price: 1728000, save: 186000 },
  { name: 'Luxury', mod: 'lux', slug: 'tier-luxury', price: 3120000, save: 358000 },
];

/** The hotel a custom build ends on is the strongest signal of which tier it
 *  resembles — the tiers differ most on where you stay. */
const HOTEL_TIER = {
  'address-downtown': TIERS[2],
  'rove-city-centre': TIERS[0],
  'rove-downtown': TIERS[1],
};

/** The mockup's savings figure, kept verbatim: a flat base scaled by how many
 *  components are still in the bundle. */
const SAVE_BASE = 186000;

const WHATSAPP_PATH =
  'M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2 0 .4-.1.6l-.4.5c-.1.2-.3.3-.1.6.1.3.6 1.1 1.4 1.8 1 .9 1.8 1.1 2 1.3.3.1.4.1.6-.1l.8-.9c.2-.2.4-.2.6-.1l2 1c.2.1.4.2.4.3.1.2.1.7-.1 1.3z';

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
function OptionCard({ item, price, selectedPrice, selected, note, metaExtra, onSelect }) {
  const diff = price - selectedPrice;
  const caption = selected
    ? (note ?? 'in your bundle')
    : `${diff > 0 ? '+' : '−'} ${naira(Math.abs(diff))} vs selected`;

  return (
    <article
      className={selected ? 'opt sel' : 'opt'}
      {...activatable(onSelect, { role: 'radio', 'aria-checked': selected })}
    >
      <div className={`img ${item.img}`} />
      <div className="body">
        <h3>{item.name}</h3>
        <div className="meta">
          {item.meta}
          {metaExtra}
        </div>
        <div className="feats">
          {item.feats.map((feat) => (
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
    search,
    setDates,
    nights,
    dateLabel,
    travellerSummary,
    payingTravellers,
    setTier,
    setBookingSlug,
  } = useTrip();

  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(() => new Set());
  const [hotelId, setHotelId] = useState(HOTELS[0].id);
  const [roomId, setRoomId] = useState(() => findRoom(HOTELS[0]).id);
  const [flightId, setFlightId] = useState(FLIGHTS[0].id);
  const [fareId, setFareId] = useState(() => findFare(FLIGHTS[0]).id);
  const [transferId, setTransferId] = useState(TRANSFERS[0].id);
  const [tourIds, setTourIds] = useState(() => new Set(['safari']));
  const [has, setHas] = useState({ transfer: true, tours: true, visa: true });
  const [modalOpen, setModalOpen] = useState(false);
  const [visaReason, setVisaReason] = useState(null);

  const hotel = HOTELS.find((h) => h.id === hotelId);
  const flight = FLIGHTS.find((f) => f.id === flightId);
  const room = findRoom(hotel, roomId);
  const fare = findFare(flight, fareId);
  const transfer = TRANSFERS.find((t) => t.id === transferId);
  const chosenTours = TOURS.filter((t) => tourIds.has(t.id));
  const toursTotal = chosenTours.reduce((sum, t) => sum + t.price, 0);
  // Hotel cards quote every hotel at its own default room, so they stay
  // comparable with each other; the package carries the chosen room's cost.
  const hotelFrom = hotel.nightly * nights;
  const stayCost = room.nightly * nights;

  const total =
    stayCost +
    fare.price +
    (has.transfer ? transfer.price : 0) +
    (has.tours ? toursTotal : 0) +
    (has.visa ? VISA.price : 0);

  const comps = 2 + (has.transfer ? 1 : 0) + (has.tours ? 1 : 0);
  // The mockup's flat base, scaled by how many components are still bundled. A
  // bundle discount is a share of what you spend, so it also rides on the room
  // and fare: the chosen pair against each product's default pair, which leaves
  // the authored figure untouched while both are left alone.
  const defaultCore = findRoom(hotel).nightly * nights + findFare(flight).price;
  const save = Math.round(
    SAVE_BASE * ((comps - 1) / 3 + 0.34) * ((stayCost + fare.price) / defaultCore),
  );

  useEffect(() => {
    if (!modalOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setModalOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [modalOpen]);

  const goStep = (n) => {
    // Moving forward banks the step you are leaving, so the rail can mark it
    // done and let you jump back to it later.
    if (n > step) {
      setCompleted((prev) => (prev.has(step) ? prev : new Set(prev).add(step)));
    }
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goRail = (n) => {
    if (n === step || completed.has(n)) goStep(n);
  };

  const setKept = (key, kept) => setHas((prev) => ({ ...prev, [key]: kept }));

  // A room id only means something inside its own hotel, and a fare id inside
  // its own flight, so each switch carries the sub-choice back to the new
  // product's default in the same click.
  const selectHotel = (id) => {
    setHotelId(id);
    setRoomId(findRoom(HOTELS.find((h) => h.id === id)).id);
  };

  const selectFlight = (id) => {
    setFlightId(id);
    setFareId(findFare(FLIGHTS.find((f) => f.id === id)).id);
  };

  const toggleTour = (id) =>
    setTourIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleVisa = () => {
    if (has.visa) {
      setVisaReason(null);
      setModalOpen(true);
    } else {
      setKept('visa', true);
    }
  };

  const removeVisa = () => {
    if (!visaReason) return;
    setModalOpen(false);
    setKept('visa', false);
  };

  const keepVisa = () => {
    setModalOpen(false);
    setKept('visa', true);
  };

  const selectTier = (tier) => {
    setTier(tier.name);
    setBookingSlug(tier.slug);
    navigate('/checkout');
  };

  const checkout = () => {
    // An approximation: the builder's exact custom combination has no catalogue
    // record, so checkout shows the closest tier.
    const closest = HOTEL_TIER[hotelId] ?? TIERS[1];
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

  const toursLabel = chosenTours.length
    ? chosenTours.map((t) => t.short).join(' + ')
    : 'Tours';

  return (
    <div className="pg-builder">
      <nav className="nav">
        <div className="wrap">
          <Link to="/" className="logo">
            waka<i>now</i>
          </Link>
          <span className="navr">Log in</span>
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
            <b>
              {search.fromCity} → {search.toCity}
            </b>{' '}
            · {nights} nights · {travellerSummary()}
          </span>
          {/* The dates live in the bar on every step, so the trip can be
              re-dated from step 5 without going back to the search. */}
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
          {STEP_LABELS.map((label, i) => {
            const state = i === step ? ' cur' : completed.has(i) ? ' done' : '';
            return (
              <Fragment key={label}>
                <div
                  className={`stp${state}`}
                  {...activatable(() => goRail(i), {
                    role: 'button',
                    'aria-current': i === step ? 'step' : undefined,
                  })}
                >
                  <span className="n">{i + 1}</span> {label}
                </div>
                {i < STEP_LABELS.length - 1 && <span className="arr">→</span>}
              </Fragment>
            );
          })}
        </div>
      </div>

      <div className="wrap">
        <div className="layout">
          <aside className="lside">
            <div className="tierbox">
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
            </div>
          </aside>

          <div className="main">
            {step === 0 && (
              <div className="panel active">
                <div className="sthead">
                  <h1>Choose your hotel</h1>
                  <span className="cnt">12 options for your dates</span>
                </div>
                <p className="stnote">
                  Your stay dates default to your search dates. Adjust below if needed — you don't
                  have to check in the same day you fly.
                </p>

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
                  <span className="datenights">{nights} nights</span>
                </div>
                <p className="datenote">
                  💡 Your flight arrives {formatShort(search.departDate)} at 08:30. If you're
                  arriving late or staying with family the first night, move check-in to{' '}
                  {formatShort(addDays(search.departDate, 1))} — you'll save one night's hotel cost.
                </p>

                <div role="radiogroup" aria-label="Hotel">
                  {HOTELS.map((item) => (
                    <Fragment key={item.id}>
                      <OptionCard
                        item={item}
                        price={item.nightly * nights}
                        selected={item.id === hotelId}
                        selectedPrice={hotelFrom}
                        note={
                          item.quoteRef
                            ? `${naira(item.refNightly * nights)} separately`
                            : undefined
                        }
                        metaExtra={` · ${naira(item.nightly)} a night`}
                        onSelect={() => selectHotel(item.id)}
                      />
                      {/* The rooms hang under the hotel they belong to, so the
                          second choice reads as part of that card rather than
                          as three more hotels. */}
                      {item.id === hotelId && (
                        <>
                          <p className="stnote">Room type</p>
                          <div role="radiogroup" aria-label="Room type">
                            {item.rooms.map((r) => (
                              <article
                                key={r.id}
                                className={r.id === room.id ? 'topt sel' : 'topt'}
                                {...activatable(() => setRoomId(r.id), {
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
                                  <div className="amt">{naira(r.nightly * nights)}</div>
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
                  <button className="nextb" onClick={() => goStep(1)}>
                    Continue to flight →
                  </button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="panel active">
                <div className="sthead">
                  <h1>Choose your flight</h1>
                  <span className="cnt">3 of 14 options</span>
                </div>
                <p className="stnote">
                  Your hotel is locked in. Every price below already includes your bundle discount.
                </p>

                <div role="radiogroup" aria-label="Flight">
                  {FLIGHTS.map((item) => (
                    <Fragment key={item.id}>
                      <OptionCard
                        item={item}
                        price={item.price}
                        selected={item.id === flightId}
                        selectedPrice={flight.price}
                        note={item.note}
                        onSelect={() => selectFlight(item.id)}
                      />
                      {item.id === flightId && (
                        <>
                          <p className="stnote">Cabin and fare</p>
                          <div role="radiogroup" aria-label="Cabin and fare">
                            {item.fares.map((f) => {
                              const diff = f.price - fare.price;
                              return (
                                <article
                                  key={f.id}
                                  className={f.id === fare.id ? 'topt sel' : 'topt'}
                                  {...activatable(() => setFareId(f.id), {
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
                        </>
                      )}
                    </Fragment>
                  ))}
                </div>

                <div className="snav">
                  <button className="backb" onClick={() => goStep(0)}>
                    ← Hotel
                  </button>
                  <button className="nextb" onClick={() => goStep(2)}>
                    Continue to transfer →
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="panel active">
                <div className="sthead">
                  <h1>Airport transfer</h1>
                </div>
                <p className="stnote">
                  Both ways — airport to hotel and back. Included in your package by default. Toggle
                  off if you're arranging your own.
                </p>

                {has.transfer ? (
                  <div role="radiogroup" aria-label="Airport transfer">
                    {TRANSFERS.map((item) => (
                      <article
                        key={item.id}
                        className={item.id === transferId ? 'topt sel' : 'topt'}
                        {...activatable(() => setTransferId(item.id), {
                          role: 'radio',
                          'aria-checked': item.id === transferId,
                        })}
                      >
                        <span className="ic">{item.icon}</span>
                        <div className="body">
                          <h3>{item.name}</h3>
                          <div className="meta">{item.meta}</div>
                        </div>
                        <div className="price">
                          <div className="amt">{naira(item.price)}</div>
                          <div className="ref">{naira(item.ref)} separately</div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="skipbanner" style={{ display: 'block' }}>
                    <p>Transfer skipped — not in your package</p>
                    <button onClick={() => setKept('transfer', true)}>Add transfer back</button>
                  </div>
                )}

                <div className="snav">
                  <button className="backb" onClick={() => goStep(1)}>
                    ← Flight
                  </button>
                  {has.transfer && (
                    <button className="skipb" onClick={() => setKept('transfer', false)}>
                      Skip transfer
                    </button>
                  )}
                  <button className="nextb" onClick={() => goStep(3)}>
                    Continue to tours →
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="panel active">
                <div className="sthead">
                  <h1>Tours &amp; experiences</h1>
                </div>
                <p className="stnote">
                  Add as many as you like — each one adds to your bundle discount. All pre-selected
                  by default. Toggle any off.
                </p>

                {has.tours ? (
                  <div>
                    {TOURS.map((item) => {
                      const on = tourIds.has(item.id);
                      return (
                        <article key={item.id} className={on ? 'topt sel' : 'topt'}>
                          <button
                            className={on ? 'tgl on' : 'tgl'}
                            role="switch"
                            aria-checked={on}
                            aria-label={item.name}
                            onClick={() => toggleTour(item.id)}
                          />
                          <div className="body">
                            <h3>{item.name}</h3>
                            <div className="meta">{item.meta}</div>
                          </div>
                          <div className="price">
                            <div className="amt">{naira(item.price)}</div>
                            <div className="ref">{naira(item.ref)} separately</div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="skipbanner" style={{ display: 'block' }}>
                    <p>Tours skipped — not in your package</p>
                    <button onClick={() => setKept('tours', true)}>Add tours back</button>
                  </div>
                )}

                <div className="snav">
                  <button className="backb" onClick={() => goStep(2)}>
                    ← Transfer
                  </button>
                  {has.tours && (
                    <button className="skipb" onClick={() => setKept('tours', false)}>
                      Skip all tours
                    </button>
                  )}
                  <button className="nextb" onClick={() => goStep(4)}>
                    Continue to visa →
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="panel active">
                <div className="sthead">
                  <h1>Visa</h1>
                </div>
                <p className="stnote">
                  A visa is required for {search.nationality} passport holders entering the UAE.
                  Wakanow can apply for you.
                </p>

                {has.visa ? (
                  <div className="visacard">
                    <h3>🛂 UAE tourist visa · 30-day single entry</h3>
                    <div className="visabanner">
                      <b>Required for {search.nationality} passports.</b> Wakanow applies for you —
                      5–7 working days. Documents collected by email after payment. If you already
                      hold a valid UAE visa, you can remove this.
                    </div>
                    <div className="visarow">
                      <div className="body">
                        <h3 style={{ fontSize: '13px' }}>Visa processing by Wakanow</h3>
                        <div className="meta">
                          Applied for on your behalf · approval 5–7 working days
                        </div>
                      </div>
                      <div className="price">
                        <div className="amt">{naira(VISA.price)}</div>
                        <div className="ref">{naira(VISA.ref)} separately</div>
                      </div>
                      <button
                        className="tgl on"
                        role="switch"
                        aria-checked="true"
                        aria-label="Visa processing by Wakanow"
                        onClick={toggleVisa}
                      />
                    </div>
                    <div className="visanote">
                      ⚠ Documents must be submitted within 5 working days of booking.
                    </div>
                  </div>
                ) : (
                  <div className="skipbanner" style={{ display: 'block' }}>
                    <p>Visa skipped — you confirmed you hold a valid visa</p>
                    <button onClick={() => setKept('visa', true)}>Add visa back</button>
                  </div>
                )}

                <div className="snav">
                  <button className="backb" onClick={() => goStep(3)}>
                    ← Tours
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
                Your package <small>{payingTravellers} travellers</small>
              </div>
              <div className="totbox-b">
                <div className="tl">
                  <span>
                    {hotel.short} · {room.name}
                  </span>
                  <b>{naira(stayCost)}</b>
                </div>
                <div className="tl">
                  <span>{flight.short} · return</span>
                  <b>{naira(fare.price)}</b>
                </div>
                <div className={has.transfer ? 'tl' : 'tl off'}>
                  <span>{transfer.short}</span>
                  <b>{naira(transfer.price)}</b>
                </div>
                <div className={has.tours && chosenTours.length ? 'tl' : 'tl off'}>
                  <span>{toursLabel}</span>
                  <b>{naira(toursTotal)}</b>
                </div>
                <div className={has.visa ? 'tl' : 'tl off'}>
                  <span>UAE visa</span>
                  <b>{naira(VISA.price)}</b>
                </div>
                <div className="tsv">You save {naira(save)} vs booking separately</div>
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

      {modalOpen && (
        <div
          className="overlay open"
          onClick={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-label="Before you remove the visa">
            <div className="mhead">
              <div className="mic">🛂</div>
              <h2>Before you remove the visa</h2>
              <p>
                {search.nationality} passport holders need a visa to enter the UAE. Removing it
                means Wakanow will not arrange one for you.
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
                    <div className="mt">I already hold a valid UAE visa</div>
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
                for the UAE. We strongly recommend keeping the visa in your package.
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

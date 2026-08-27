import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useTrip } from '../state/useTrip.js';
import { naira, delta } from '../lib/format.js';
import { addDays, formatShort } from '../lib/dates.js';
import { findPackage, isTier } from '../data/packages.js';
import { pricePackage, findFlight, findHotel, findFare, findRoom } from '../lib/pricing.js';
import BackBar from '../components/BackBar.jsx';
import DateRangePicker from '../components/DateRangePicker.jsx';
import './PackageDetail.css';

const NAV = ['Flights', 'Hotels', 'Packages', 'Tours', 'Visa', 'Business'];

const EXIT_WARNING =
  'Not part of the bundle. Choosing this drops the package price and you pay each part separately.';

/**
 * Lay the authored itinerary entries across the trip the traveller actually
 * booked. The entries are written for the package's own length, but the dates
 * are free, so a 5-entry itinerary has to stretch over eight days or shrink
 * into three without ever claiming a day the trip does not have.
 */
function layOutItinerary(entries, days) {
  if (!entries?.length || days < 1) return [];

  const span = (from, to) => (from === to ? `Day ${from}` : `Days ${from}–${to}`);

  if (entries.length === 1) return [{ key: 'i0', day: span(1, days), entry: entries[0] }];

  if (days === entries.length) {
    return entries.map((entry, i) => ({ key: `i${i}`, day: `Day ${i + 1}`, entry }));
  }

  if (days < entries.length) {
    // Arrival and departure always survive; the trimming happens in between.
    const first = entries[0];
    const last = entries[entries.length - 1];
    if (days === 1) return [{ key: 'i0', day: 'Day 1', entry: first }];

    const middle = entries.slice(1, -1);
    const keep = days - 2;
    const picked = [];
    for (let i = 0; i < keep; i += 1) {
      const at = keep === 1 ? 0 : Math.round((i * (middle.length - 1)) / (keep - 1));
      picked.push(middle[at]);
    }
    return [first, ...picked, last].map((entry, i) => ({
      key: `i${i}`,
      day: `Day ${i + 1}`,
      entry,
    }));
  }

  // More days than entries: everything but the last two keeps its own day, and
  // the second-to-last entry stretches over the surplus in the middle.
  const head = entries.slice(0, -2).map((entry, i) => ({ key: `i${i}`, day: `Day ${i + 1}`, entry }));
  const bridge = entries[entries.length - 2];
  const last = entries[entries.length - 1];
  return [
    ...head,
    { key: 'ibridge', day: span(head.length + 1, days - 1), entry: bridge },
    { key: 'ilast', day: `Day ${days}`, entry: last },
  ];
}

/** Everything the traveller can change on this screen, scoped to one package. */
function freshSelection(pkg) {
  const flight = pkg.flights[0];
  const hotel = pkg.hotels[0];
  return {
    slug: pkg.slug,
    flightId: flight.id,
    // Resolved through the finders so the fare ladder's flagged default wins
    // over its cheapest-first ordering.
    fareId: findFare(flight)?.id,
    hotelId: hotel.id,
    roomId: findRoom(hotel)?.id,
    addonIds: [],
    flightDrawerOpen: false,
    fareDrawerOpen: false,
    hotelDrawerOpen: false,
    roomDrawerOpen: false,
    saved: false,
  };
}

function visaCopy(pkg, nationality, hasVisaAddon) {
  if (pkg.visa === 'included') {
    return (
      <>
        <b>Your visa for {pkg.country} is already part of this package.</b> Wakanow files the
        application on a {nationality} passport and collects your documents after payment — there
        is nothing to add below.
      </>
    );
  }
  return (
    <>
      <b>
        You need a visa for {pkg.country} on a {nationality} passport.
      </b>{' '}
      Wakanow can apply on your behalf
      {hasVisaAddon ? " — turn it on below and we'll collect your documents after payment" : ''}. If
      you already hold a valid visa, leave it off.
    </>
  );
}

export default function PackageDetail() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const pkg = findPackage(slug);
  const {
    search,
    setDates,
    setTripLength,
    setTier,
    setBookingSlug,
    nights,
    dateLabel,
    dateLabelWithYear,
    payingTravellers,
  } = useTrip();

  const [ui, setUi] = useState(() => freshSelection(pkg));

  // One screen serves every package, so nothing chosen on one may be carried
  // into the next. Resetting during render rather than in an effect means the
  // new package never paints with the previous one's selection.
  if (ui.slug !== pkg.slug) setUi(freshSelection(pkg));

  // Opening a curated package adopts its authored duration: a 10-night Umrah
  // trip should not claim five nights because the search said so. Keyed on the
  // slug alone, so the date picker below stays free to re-price afterwards.
  // The tiers are built from the traveller's own search and keep its length.
  useEffect(() => {
    const opened = findPackage(slug);
    if (!isTier(opened)) setTripLength(opened.nights);
  }, [slug, setTripLength]);

  const {
    flightId,
    fareId,
    hotelId,
    roomId,
    addonIds,
    flightDrawerOpen,
    fareDrawerOpen,
    hotelDrawerOpen,
    roomDrawerOpen,
    saved,
  } = ui;
  const patchUi = (patch) => setUi((prev) => ({ ...prev, ...patch }));

  // A fare id belongs to one flight and a room id to one hotel, so the child
  // selection is re-defaulted in the very same update that changes the parent —
  // an effect would let one frame paint with a meaningless id.
  const setFlightId = (id) =>
    patchUi({ flightId: id, fareId: findFare(findFlight(pkg, id))?.id });
  const setFareId = (id) => patchUi({ fareId: id });
  const setHotelId = (id) => patchUi({ hotelId: id, roomId: findRoom(findHotel(pkg, id))?.id });
  const setRoomId = (id) => patchUi({ roomId: id });
  const toggleSaved = () => setUi((prev) => ({ ...prev, saved: !prev.saved }));

  const priced = pricePackage(pkg, { nights, flightId, fareId, hotelId, roomId, addons: addonIds });
  const { flight, hotel, fare, room, eligible } = priced;
  // The rail's lines already carry the chosen fare and room, so the component
  // rows read their figures from there rather than re-deriving them.
  const lineOf = (key) => priced.lines.find((l) => l.key === key);
  const flightLine = lineOf('flight');
  const hotelLine = lineOf('hotel');

  const total = priced.bundled * payingTravellers;
  const paxLabel = `${payingTravellers} ${payingTravellers === 1 ? 'traveller' : 'travellers'}`;
  const nightsLabel = `${nights} night${nights === 1 ? '' : 's'}`;
  const days = nights + 1;
  const itinerary = layOutItinerary(pkg.itinerary, days);
  const freeCancelDate = formatShort(addDays(search.departDate, -pkg.freeCancelDays));
  const hasVisaAddon = Boolean(pkg.addons?.some((a) => a.id === 'visa'));

  const toggleAddon = (id) =>
    setUi((prev) => ({
      ...prev,
      addonIds: prev.addonIds.includes(id)
        ? prev.addonIds.filter((x) => x !== id)
        : [...prev.addonIds, id],
    }));

  const shareOnWhatsApp = () =>
    window.open(
      'https://wa.me/?text=' + encodeURIComponent(`${pkg.name} — Wakanow Packages`),
      '_blank',
      'noopener',
    );

  const book = () => {
    setTier(pkg.tier ?? null);
    setBookingSlug(pkg.slug);
    navigate('/checkout');
  };

  // `render` lets rooms and fares describe themselves in the same markup —
  // they carry structured fields rather than the hotels' single `desc` string.
  const renderOptions = (list, selectedId, select, priceOf, groupLabel, render) => {
    const nameOf = render?.name ?? ((o) => o.name);
    const descOf = render?.desc ?? ((o) => o.desc);
    const current = list.find((o) => o.id === selectedId) ?? list[0];
    return (
      <div role="radiogroup" aria-label={groupLabel}>
        {list.map((o) => {
          const d = priceOf(o) - priceOf(current);
          const selected = o.id === current.id;
          const choose = () => select(o.id);
          return (
            <div
              key={o.id}
              className={'opt' + (selected ? ' sel' : '') + (o.eligible === false ? ' exits' : '')}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              onClick={choose}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  choose();
                }
              }}
            >
              <span className="radio" />
              <div>
                <div className="oname">{nameOf(o)}</div>
                <div className="odesc">{descOf(o)}</div>
                {o.eligible === false && <div className="exitwarn">{EXIT_WARNING}</div>}
              </div>
              <div className={'odelta ' + (d < 0 ? 'down' : 'up')}>{delta(d)}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="pg-detail">
      <nav className="nav">
        <div className="wrap">
          <Link to="/" className="logo">
            waka<i>now</i>
          </Link>
          <div className="navlinks">
            {NAV.map((link) => (
              <a
                key={link}
                href="#"
                className={link === 'Packages' ? 'on' : undefined}
                onClick={(e) => e.preventDefault()}
              >
                {link}
              </a>
            ))}
          </div>
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
            <button type="button" className="btn-orange">Log in/Sign up</button>
          </div>
        </div>
      </nav>

      {/* No backTo: this screen is reached from results, the catalogue and the
          landing page, so history is the honest way back. */}
      <BackBar
        trail={[
          { label: 'Packages', to: '/' },
          { label: 'Ready-made trips', to: '/packages' },
          { label: pkg.name },
        ]}
      />

      <div className="wrap">
        <div className="gallery">
          {pkg.gallery.map((shot, i) => (
            <div className="shot" key={shot.caption} style={{ background: shot.gradient }}>
              <span>{shot.caption}</span>
              {i === 0 && pkg.gallery[0].skyline && (
                <svg viewBox="0 0 400 80" preserveAspectRatio="none" fill="#001845">
                  <path d="M0 80V54h22V30h10V14h8v16h12v24h26V40h30v14h18V26h12v28h34V46h24v8h30V22h10v32h28V44h30v10h26V34h14v20h36v26z" />
                </svg>
              )}
              {i === pkg.gallery.length - 1 && (
                <button type="button" className="morephotos">+18 photos</button>
              )}
            </div>
          ))}
        </div>

        <div className="title">
          <div>
            <h1>{pkg.name}</h1>
            <div className="sub">
              {nightsLabel} · {dateLabelWithYear} · departing {search.fromCity} · {paxLabel}
            </div>
            <div className="pills">
              {eligible && <span className="pill deal">Save {naira(priced.save)} as a package</span>}
              <span className="pill ok">✓ Free cancellation until {freeCancelDate}</span>
              {/* The flight and hotel names are already the component headings
                  below, so the pills carry what the drawers now decide. */}
              <span className="pill">{fare ? fare.cabin : flight.name}</span>
              <span className="pill">{room ? room.board : hotel.name}</span>
              {pkg.transfer && <span className="pill">{pkg.transfer.name}</span>}
            </div>
          </div>
          <div className="titleacts">
            <DateRangePicker
              departDate={search.departDate}
              returnDate={search.returnDate}
              onChange={setDates}
              triggerClassName="iconbtn"
              align="right"
              label="Trip dates"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#4A6078" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
              {dateLabel}
            </DateRangePicker>
            <button type="button" className="iconbtn" onClick={shareOnWhatsApp}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#4A6078" strokeWidth="2" strokeLinecap="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
              </svg>
              Share
            </button>
            <button type="button" className="iconbtn" onClick={toggleSaved}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4A6078"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
              </svg>
              {saved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>

        <div className="layout">
          <main>
            <section className="sec">
              <div className="sechead">
                <h2>What's in this package</h2>
                <span className="note">Change the flight or hotel and keep the bundle price</span>
              </div>

              <div className="comp">
                <div className="comphead">
                  <div className="cicon">✈</div>
                  <div>
                    <h3>{flight.name}</h3>
                    <div className="meta">
                      {/* The authored meta already names the cabin on most fares, so
                          only append the fare when it adds something. */}
                      {fare && !flight.meta.includes(fare.label)
                        ? `${flight.meta} · ${fare.label}`
                        : flight.meta}
                    </div>
                  </div>
                  <div className="price">
                    <b>{naira(flightLine.bundled)}</b>
                    <s>
                      {eligible ? naira(flightLine.separate) + ' separately' : 'not in the bundle'}
                    </s>
                  </div>
                </div>
                {/* Only some flights are authored down to the timetable. */}
                {flight.legs && (
                  <div className="legdetail">
                    {flight.legs.map((leg) => (
                      <div className="leg" key={leg.time + leg.place}>
                        <b>{leg.time}</b>
                        {leg.place}
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="swapbtn"
                  onClick={() => patchUi({ flightDrawerOpen: !flightDrawerOpen })}
                >
                  {flightDrawerOpen ? 'Close flight' : 'Change flight'}
                </button>{' '}
                {fare && (
                  <button
                    type="button"
                    className="swapbtn"
                    onClick={() => patchUi({ fareDrawerOpen: !fareDrawerOpen })}
                  >
                    {fareDrawerOpen ? 'Close cabin' : 'Change cabin'}
                  </button>
                )}
                <div className={'swapbox' + (flightDrawerOpen ? ' open' : '')}>
                  {renderOptions(pkg.flights, flight.id, setFlightId, (o) => o.price, 'Choose a flight')}
                </div>
                {fare && (
                  <div className={'swapbox' + (fareDrawerOpen ? ' open' : '')}>
                    {renderOptions(
                      flight.fares,
                      fare.id,
                      setFareId,
                      (o) => o.price,
                      'Choose a cabin',
                      {
                        name: (f) => (f.cabin === f.label ? f.label : `${f.label} · ${f.cabin}`),
                        desc: (f) => (
                          <>
                            {`${f.bags} · ${f.seat}`}
                            <br />
                            {`${f.changeable || 'No changes'} · ${f.refundable || 'Non-refundable'}`}
                          </>
                        ),
                      },
                    )}
                  </div>
                )}
              </div>

              <div className="comp">
                <div className="comphead">
                  <div className="cicon">🏨</div>
                  <div>
                    <h3>{hotel.name}</h3>
                    <div className="meta">
                      {room
                        ? `${nightsLabel} · ${room.name} · ${room.board} · ${naira(room.nightly)} a night`
                        : `${nightsLabel} · ${hotel.meta} · ${naira(hotel.nightly)} a night`}
                    </div>
                  </div>
                  <div className="price">
                    <b>{naira(hotelLine.bundled)}</b>
                    <s>
                      {eligible ? naira(hotelLine.separate) + ' separately' : 'not in the bundle'}
                    </s>
                  </div>
                </div>
                <button
                  type="button"
                  className="swapbtn"
                  onClick={() => patchUi({ hotelDrawerOpen: !hotelDrawerOpen })}
                >
                  {hotelDrawerOpen ? 'Close hotel' : 'Change hotel'}
                </button>{' '}
                {room && (
                  <button
                    type="button"
                    className="swapbtn"
                    onClick={() => patchUi({ roomDrawerOpen: !roomDrawerOpen })}
                  >
                    {roomDrawerOpen ? 'Close room' : 'Change room'}
                  </button>
                )}
                <div className={'swapbox' + (hotelDrawerOpen ? ' open' : '')}>
                  {/* A nightly difference is worth the whole stay, not one night. */}
                  {renderOptions(
                    pkg.hotels,
                    hotel.id,
                    setHotelId,
                    (o) => o.nightly * nights,
                    'Choose a hotel',
                  )}
                </div>
                {room && (
                  <div className={'swapbox' + (roomDrawerOpen ? ' open' : '')}>
                    {/* Same reasoning as the hotel list: the delta is the whole stay. */}
                    {renderOptions(
                      hotel.rooms,
                      room.id,
                      setRoomId,
                      (o) => o.nightly * nights,
                      'Choose a room',
                      {
                        desc: (r) => (
                          <>
                            {`${r.board} · ${r.beds} · sleeps ${r.sleeps}`}
                            <br />
                            {r.note}
                          </>
                        ),
                      },
                    )}
                  </div>
                )}
              </div>

              {pkg.transfer && (
                <div className="comp">
                  <div className="comphead">
                    <div className="cicon">🚐</div>
                    <div>
                      <h3>{pkg.transfer.name}</h3>
                      <div className="meta">{pkg.transfer.desc}</div>
                    </div>
                    <div className="price">
                      <b>{naira(pkg.transfer.price)}</b>
                      <s>{naira(pkg.transfer.separate)} separately</s>
                    </div>
                  </div>
                </div>
              )}

              {pkg.tours && (
                <div className="comp">
                  <div className="comphead">
                    <div className="cicon">🗺</div>
                    <div>
                      <h3>{pkg.tours.label}</h3>
                      <div className="meta">{pkg.tours.desc}</div>
                    </div>
                    <div className="price">
                      <b>{naira(pkg.tours.price)}</b>
                      <s>{naira(pkg.tours.separate)} separately</s>
                    </div>
                  </div>
                </div>
              )}

              {pkg.bundledExtras?.map((extra) => (
                <div className="comp" key={extra}>
                  <div className="comphead">
                    <div className="cicon">✓</div>
                    <div>
                      <h3>{extra}</h3>
                      <div className="meta">Already counted in the package price</div>
                    </div>
                    <div className="price">
                      <b>Included</b>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <section className="sec">
              <div className="sechead">
                <h2>Add anything else you need</h2>
                <span className="note">Price updates as you go</span>
              </div>

              {pkg.visa !== 'none' && (
                <div className="visabar">{visaCopy(pkg, search.nationality, hasVisaAddon)}</div>
              )}

              {pkg.addons?.map((addon) => (
                <div className="addon" key={addon.id}>
                  {/* A real button handles Space and Enter natively, which is what the
                      mockup's keydown handler was reproducing by hand. */}
                  <button
                    type="button"
                    className={'tgl' + (addonIds.includes(addon.id) ? ' on' : '')}
                    role="switch"
                    aria-checked={addonIds.includes(addon.id)}
                    aria-label={addon.title}
                    onClick={() => toggleAddon(addon.id)}
                  />
                  <div>
                    <h3>{addon.title}</h3>
                    <div className="meta">{addon.meta}</div>
                  </div>
                  <div className="ap">
                    <b>+{naira(addon.price)}</b>
                    <s>{naira(addon.separate)} separately</s>
                  </div>
                </div>
              ))}
            </section>

            <section className="sec">
              <div className="sechead"><h2>Your {days} days</h2></div>
              {itinerary.map((row) => (
                <div className="itin" key={row.key}>
                  <div className="day">{row.day}</div>
                  <p>
                    <b>{row.entry.title}</b> {row.entry.body}
                  </p>
                </div>
              ))}
            </section>
          </main>

          <aside className="rail">
            <div className="pricecard">
              <div className="priceledger">
                <div className="lbl">Booked separately</div>
                <div className="was">{eligible ? naira(priced.separate) : '—'}</div>
                <div className="lbl" style={{ marginTop: '12px' }}>As a package</div>
                <div className="now">{naira(priced.bundled)}</div>
                <div className="pp">per person · {paxLabel}</div>
                <div
                  className="savechip"
                  style={{ background: eligible ? 'var(--accent-400)' : 'rgba(255,255,255,.18)' }}
                >
                  {eligible
                    ? 'You save ' + naira(priced.save) + ' per person'
                    : 'No bundle price on this combination'}
                </div>
              </div>
              <div className="pcbody">
                {priced.lines.map((line) => (
                  <div className="line" key={line.key}>
                    <span>{line.label}</span>
                    <b>{naira(line.bundled)}</b>
                  </div>
                ))}
                <div className="line total">
                  <span>Total for {paxLabel}</span><b>{naira(total)}</b>
                </div>

                <div className="pssbox">
                  <div className="t"><em>PSS</em> Pay Small Small</div>
                  <p>
                    Spread this booking over 6 months from <b>{naira(total / 6)}</b> a month. Nothing
                    extra to pay — your travel documents are issued on the final instalment.
                  </p>
                </div>

                <button type="button" className="booknow" onClick={book}>
                  Book this package
                </button>
                <div className="railacts">
                  <button type="button" onClick={shareOnWhatsApp}>Share</button>
                  <button type="button" onClick={toggleSaved}>
                    {saved ? 'Saved' : 'Save for later'}
                  </button>
                </div>

                <div className="whats">
                  <div className="wi">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2 0 .4-.1.6l-.4.5c-.1.2-.3.3-.1.6.1.3.6 1.1 1.4 1.8 1 .9 1.8 1.1 2 1.3.3.1.4.1.6-.1l.8-.9c.2-.2.4-.2.6-.1l2 1c.2.1.4.2.4.3.1.2.1.7-.1 1.3z" />
                    </svg>
                  </div>
                  <div>
                    <div className="wt">Talk to a person on WhatsApp</div>
                    <div className="ws">Usually replies in a few minutes</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.open('https://wa.me/', '_blank', 'noopener')}
                  >
                    Chat
                  </button>
                </div>

                <p className="railfoot">
                  Price shown is the price charged. Naira only — no exchange rate adjustment between
                  now and payment.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

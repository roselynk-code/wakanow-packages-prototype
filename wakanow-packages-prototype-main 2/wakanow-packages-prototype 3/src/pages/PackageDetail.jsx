import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useTrip } from '../state/useTrip.js';
import { naira, delta } from '../lib/format.js';
import { addDays, formatShort, formatWeekday } from '../lib/dates.js';
import { findPackage, isTier } from '../data/packages.js';
import { pricePackage, findFlight, findHotel, findFare, findRoom } from '../lib/pricing.js';
import BackBar from '../components/BackBar.jsx';
import DateRangePicker from '../components/DateRangePicker.jsx';
import './PackageDetail.css';

const NAV = ['Flights', 'Hotels', 'Packages', 'Tours', 'Visa', 'Business'];

const EXIT_WARNING =
  'Not part of the bundle. Choosing this drops the package price and you pay each part separately.';

/**
 * The live hotel page's sticky sub-nav. `Rooms` points at "What's in this
 * package" — that section is where this screen lets you change the hotel and
 * the room, so it is the honest target for the pill even though the package
 * page has no room grid of its own.
 */
const SUBNAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'about', label: 'About' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'policies', label: 'Policies' },
];

/**
 * The live page prints a measured distance under the title — "4690m from
 * Murtala Muhammed International Airport". A package record holds no
 * coordinates and no distance field, so there is nothing here to measure.
 * What the hotels *do* carry is a location clause inside their own authored
 * `meta` / `desc`: "900m from Dubai Mall", "a minute from Souq Waqif", "ten
 * minutes from the Blue Mosque". Where one segment states a separation from a
 * named place it is quoted back verbatim; where none does, the link is
 * dropped. Nothing is converted into metres and no number is invented — most
 * hotels in the catalogue simply do not get the link.
 */
const DISTANCE_CLAUSE =
  /^(?:\d+(?:\.\d+)?\s?(?:m|km)|(?:\d+|a|an|one|two|three|four|five|ten|fifteen|twenty)\s+(?:minutes?|mins?|metres?|meters?))\s+(?:walk\s+)?from\s+.+$/i;

function distanceFrom(hotel) {
  const segments = `${hotel.meta ?? ''} · ${hotel.desc ?? ''}`.split(' · ');
  const hit = segments.map((s) => s.trim()).find((s) => DISTANCE_CLAUSE.test(s));
  return hit ?? null;
}

/**
 * The live rating card carries a guest score ("3.0 / Good"). No package or
 * hotel record in this prototype holds a review score, and putting one on the
 * page would be fabricating a rating for a named hotel. The one rating a
 * record does state is the star classification written into the hotel's own
 * name — "Rove Downtown Dubai · 4★" — so that is what the card shows, said
 * plainly as a star rating. A hotel whose name carries no star drops the card.
 */
function starsOf(hotel) {
  const match = (hotel.name ?? '').match(/(\d)\s?★/);
  return match ? Number(match[1]) : null;
}

/** The hotel's name without the trailing star classification. */
function hotelPlainName(hotel) {
  return (hotel.name ?? '').replace(/\s*·\s*\d\s?★/, '');
}

const VISA_POLICY = {
  included: (pkg, nationality) =>
    `The visa for ${pkg.country} is part of this package. Wakanow files the application on a ${nationality} passport and collects your documents after payment.`,
  default: (pkg, nationality, hasVisaAddon) =>
    `You need a visa for ${pkg.country} on a ${nationality} passport. Wakanow can apply on your behalf${
      hasVisaAddon ? ' — the application is one of the add-ons above' : ''
    }. If you already hold a valid visa, leave it off.`,
};

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
  const [activeSection, setActiveSection] = useState(SUBNAV[0].id);

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

  // The sub-nav's active pill follows the scroll. A section counts as current
  // once its top has passed under the sticky rail, so the last one whose top
  // is above that line wins — which keeps the pill honest at the bottom of the
  // page too, where the final section can never reach the top of the viewport.
  useEffect(() => {
    const mark = () => {
      const line = 96; // nav-independent: the sticky rail's own bottom edge
      let current = SUBNAV[0].id;
      for (const item of SUBNAV) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= line) current = item.id;
      }
      setActiveSection(current);
    };
    mark();
    window.addEventListener('scroll', mark, { passive: true });
    window.addEventListener('resize', mark);
    return () => {
      window.removeEventListener('scroll', mark);
      window.removeEventListener('resize', mark);
    };
  }, [slug]);

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

  const stars = starsOf(hotel);
  const distance = distanceFrom(hotel);
  const board = room?.board ?? null;

  /**
   * The live page's chip row lists hotel facilities — Free Wifi, Parking,
   * Non smoking rooms. A package record carries no facility list, and putting
   * one on the page would be inventing amenities for a named hotel. These
   * chips are instead the things the record actually states about this trip:
   * the bundle saving, the free-cancellation window, the cabin, the board
   * basis, the transfer, the visa handling and the package's own vibes.
   */
  const chips = [
    eligible && { key: 'deal', tone: 'deal', label: `Save ${naira(priced.save)} as a package` },
    { key: 'cancel', tone: 'ok', label: `Free cancellation until ${freeCancelDate}` },
    fare && { key: 'cabin', label: fare.cabin },
    board && { key: 'board', label: board },
    pkg.transfer && { key: 'transfer', label: pkg.transfer.name },
    pkg.visa !== 'none' && {
      key: 'visa',
      label: pkg.visa === 'included' ? 'Visa included' : 'Visa handled by Wakanow',
    },
    ...(pkg.vibes ?? []).map((vibe) => ({ key: `vibe-${vibe}`, label: vibe })),
  ].filter(Boolean);

  /** The description panel's tick list — one line per part the package states. */
  const inclusions = [
    flight.meta,
    `${nightsLabel} at ${hotel.name}`,
    room && `${room.name} · ${room.board} · sleeps ${room.sleeps}`,
    pkg.transfer && pkg.transfer.name,
    pkg.tours && `${pkg.tours.label} — ${pkg.tours.desc}`,
    ...(pkg.bundledExtras ?? []),
    `Free cancellation until ${freeCancelDate}`,
    pkg.visa === 'included' ? `Visa for ${pkg.country} included` : null,
  ].filter(Boolean);

  /**
   * The spec's policy panels are `Meals`, `Children and information about extra
   * beds`, `Special living conditions`, `Transfer` and `Extra info`. Only the
   * ones a real field can fill are built: board fills Meals, the transfer
   * record fills Transfer, the room's bed and occupancy fill Extra info, and
   * the free-cancellation window and visa status get panels of their own
   * because those are the two policies this product genuinely has. Children /
   * extra beds and special living conditions are dropped — nothing in the
   * catalogue states either, and a policy is the last thing to guess at.
   */
  const policyPanels = [
    board && {
      title: 'Meals',
      body:
        board === 'Room only'
          ? `No meals are included — the rate at ${hotel.name} is room only.`
          : `${board}, every night of the stay at ${hotel.name}.`,
    },
    {
      title: 'Free cancellation',
      body: `Cancel free until ${freeCancelDate} — ${pkg.freeCancelDays} days before departure.`,
    },
    pkg.visa !== 'none' && {
      title: 'Visa',
      body:
        pkg.visa === 'included'
          ? VISA_POLICY.included(pkg, search.nationality)
          : VISA_POLICY.default(pkg, search.nationality, hasVisaAddon),
    },
    pkg.transfer && {
      title: 'Transfer',
      body: `${pkg.transfer.name}. ${pkg.transfer.desc}.`,
    },
    room && {
      title: 'Extra info',
      body: `${room.name} — ${room.beds}, sleeps ${room.sleeps}. ${room.note}.`,
    },
  ].filter(Boolean);

  const goToSection = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActiveSection(id);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const viewOnMap = () =>
    window.open(
      'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(`${pkg.city}, ${pkg.country}`),
      '_blank',
      'noopener',
    );

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

      {/* The live hotel page's sticky sub-nav, sitting between the main nav and
          the breadcrumbs. Its far-right action is the page's booking verb — the
          same `book` the rail's button calls — standing in for the live page's
          orange "Select a room". */}
      <nav className="subnav" aria-label="On this page">
        <div className="wrap">
          <div className="subpills">
            {SUBNAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={'subpill' + (activeSection === item.id ? ' on' : '')}
                aria-current={activeSection === item.id ? 'true' : undefined}
                onClick={() => goToSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" className="subcta" onClick={book}>
            Book this package
          </button>
        </div>
      </nav>

      {/* The breadcrumb row the live page carries under the sub-nav. BackBar is
          already that row on every screen below the landing page, and it keeps
          the explicit way back that the live crumbs leave to the browser.
          No backTo: this screen is reached from results, the catalogue and the
          landing page, so history is the honest way back. */}
      <BackBar
        trail={[
          { label: 'Packages', to: '/' },
          { label: 'Ready-made trips', to: '/packages' },
          { label: pkg.name },
        ]}
      />

      <div className="wrap">
        <div className="title anchor" id="overview">
          <div>
            <h1>{pkg.name}</h1>
            <div className="sub">
              {nightsLabel} · {dateLabelWithYear} · departing {search.fromCity} · {paxLabel}
            </div>
            {/* The live page's blue distance link. Rendered only when the chosen
                hotel's own record states a separation from a named place —
                see `distanceFrom`. Most hotels do not, and then there is no
                link rather than a guessed number. */}
            {distance && (
              <button type="button" className="distlink" onClick={() => goToSection('about')}>
                {hotelPlainName(hotel)} — {distance}
              </button>
            )}
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

        {/* Photo mosaic — one tall plate left, four smaller right. There are no
            photographs in this prototype, so each plate is the gallery entry's
            own `gradient` with its authored caption over it, exactly as the
            gallery strip used them. */}
        <div className={'herorow' + (stars ? '' : ' norate')}>
          <div className="mosaic">
            {pkg.gallery.map((shot, i) => (
              <div className="plate" key={shot.caption} style={{ background: shot.gradient }}>
                <span>{shot.caption}</span>
                {i === 0 && shot.skyline && (
                  <svg viewBox="0 0 400 80" preserveAspectRatio="none" fill="#001845">
                    <path d="M0 80V54h22V30h10V14h8v16h12v24h26V40h30v14h18V26h12v28h34V46h24v8h30V22h10v32h28V44h30v10h26V34h14v20h36v26z" />
                  </svg>
                )}
              </div>
            ))}
          </div>

          {/* The rating card. `stars` is read out of the hotel's own name; the
              sub-line says so, because a star classification is not the guest
              score the live card shows and must not be dressed as one. */}
          {stars ? (
            <aside className="ratecard">
              <div className="ratebadge">{stars.toFixed(1)}</div>
              <div className="ratebody">
                <b>{stars}-star hotel</b>
                <span>{hotelPlainName(hotel)}</span>
                <em>Star classification, not a guest review score</em>
              </div>
            </aside>
          ) : null}
        </div>

        <div className="chiprow">
          {chips.map((chip) => (
            <span key={chip.key} className={'chip' + (chip.tone ? ' ' + chip.tone : '')}>
              {chip.label}
            </span>
          ))}
        </div>

        <div className="aboutrow anchor" id="about">
          <div className="descpanel">
            {stars ? (
              <div className="descrate">
                <b>{stars.toFixed(1)}</b> {stars}-star hotel
              </div>
            ) : null}
            {/* Every sentence here is the record's own copy: the package blurb,
                the chosen hotel's authored meta, and the chosen flight. The
                room and the rest of the parts are the tick list below, which is
                where the live panel puts them too. */}
            <p>
              {pkg.blurb} {nightsLabel} at {hotel.name} — {hotel.meta}. Flying {flight.name} from{' '}
              {search.fromCity}.
            </p>
            <ul className="ticks">
              {inclusions.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {/* The live link opens the property's own page. There is none here,
                so it goes to the section that describes the property — the same
                place the Rooms pill reaches. */}
            <button type="button" className="morelink" onClick={() => goToSection('rooms')}>
              See more about this property →
            </button>
          </div>

          {/* Map card. No map tile is available offline and a package record
              carries neither an address nor coordinates, so this is a plain
              placeholder panel naming the destination — not a picture of a map.
              The live card's address and lat/lng lines are dropped for want of
              the fields; `View on map` hands the destination to a real map. */}
          <div className="mapcard">
            <div className="mapplate" aria-hidden="true">
              <i className="mappin" />
            </div>
            <div className="mapfoot">
              <b>{pkg.city}</b>
              <span>{pkg.country}</span>
              <em>No map tile in this prototype — a package record holds no coordinates.</em>
              <button type="button" className="mapbtn" onClick={viewOnMap}>
                View on map
              </button>
            </div>
          </div>
        </div>

        <div className="layout">
          <main>
            <section className="sec anchor" id="rooms">
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

            <section className="sec anchor" id="addons">
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

            <section className="sec anchor" id="itinerary">
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

            <section className="sec anchor" id="policies">
              <div className="sechead"><h2>Policies</h2></div>

              {/* Check-in and check-out. No record holds a hotel's own hours, so
                  the values are the trip's real dates and the second line says
                  which date it is rather than inventing a "from 14:00". */}
              <div className="polrow">
                <span>Check-in</span>
                <div>
                  <b>{formatWeekday(search.departDate)}</b>
                  <em>Your outbound date · the hotel sets the hour</em>
                </div>
              </div>
              <div className="polrow">
                <span>Check-out</span>
                <div>
                  <b>{formatWeekday(search.returnDate)}</b>
                  <em>Your return date · the hotel sets the hour</em>
                </div>
              </div>

              <div className="polpanels">
                {policyPanels.map((panel) => (
                  <div className="polpanel" key={panel.title}>
                    <h3>{panel.title}</h3>
                    <p>{panel.body}</p>
                  </div>
                ))}
              </div>
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

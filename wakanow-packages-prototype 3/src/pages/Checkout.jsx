import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import BackBar from '../components/BackBar.jsx';
import { TIERS, findPackage, isTier } from '../data/packages.js';
import { formatRange, formatWeekday } from '../lib/dates.js';
import { naira, nairaShort } from '../lib/format.js';
import { priceItinerary, visaLegs } from '../lib/itinerary.js';
import { cardPrice, findFare, findRoom, pricePackage } from '../lib/pricing.js';
import { useTrip } from '../state/useTrip.js';
import './Checkout.css';

const NAV_LINKS = ['Flights', 'Hotels', 'Packages', 'Tours', 'Visa', 'Prime', 'Manage Booking'];

const WHATSAPP_PATH =
  'M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2 0 .4-.1.6l-.4.5c-.1.2-.3.3-.1.6.1.3.6 1.1 1.4 1.8 1 .9 1.8 1.1 2 1.3.3.1.4.1.6-.1l.8-.9c.2-.2.4-.2.6-.1l2 1c.2.1.4.2.4.3.1.2.1.7-.1 1.3z';

/** The mini card modifier each tier carries in the generated stylesheet. */
const TIER_MODIFIER = { Essential: 'ess', Premium: 'pre', Luxury: 'lux' };

/** One shared option list per field, so `value` alone decides what is selected —
 *  the mockup faked selection by reordering the options per traveller. */
const TITLES = ['Mrs', 'Mr', 'Ms'];
const GENDERS = ['Female', 'Male'];
const NATIONALITIES = ['Nigeria', 'Ghana', 'United Kingdom', 'United States', 'South Africa'];

/** Everything the toggles can add on top of the selected tier.
 *  `group` splits the breakdown the way the mockup did: packaging additions
 *  first, then the reminder-style add-ons that already exist on the live cart.
 *  A visa is bought per passport, so it alone scales with the party size. */
const OPTIONAL_ITEMS = [
  { key: 'transfer', label: 'Careem airport transfer', price: 90000, isNew: true, group: 'package' },
  { key: 'safari', label: 'Desert safari with dinner', price: 62000, isNew: true, group: 'package' },
  { key: 'visa', label: 'UAE tourist visa', price: 96000, isNew: true, group: 'package', perTraveller: true },
  { key: 'callReminder', label: 'Call reminder', price: 2500, isNew: false, group: 'existing' },
  { key: 'smsReminder', label: 'SMS reminder', price: 2000, isNew: false, group: 'existing' },
  { key: 'kalabash', label: 'Kalabash Platinum Travel Card', price: 4500, isNew: false, group: 'existing' },
];

const INITIAL_ADDONS = {
  transfer: true,
  safari: false,
  visa: false,
  callReminder: true,
  smsReminder: true,
  kalabash: false,
};

/** The tour the mockup authored for the Dubai tiers. */
const AUTHORED_TOUR = {
  title: 'Desert safari with dinner · Arabian Adventures',
  meta: 'Dune drive, camel ride, BBQ dinner · hotel pickup · 6 hours',
  price: 62000,
  separate: 74000,
};

const extraAmount = (item, travellers) => (item.perTraveller ? item.price * travellers : item.price);

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The two identities the mockup authored; anyone beyond them starts blank. */
const AUTHORED_TRAVELLERS = [
  { title: 'Mrs', firstName: 'Adaeze', lastName: 'Okonkwo', dob: '15 Mar 1990', gender: 'Female' },
  { title: 'Mr', firstName: 'Emeka', lastName: 'Okonkwo', dob: '22 Jul 1988', gender: 'Male' },
];

/** The two illustrative campaign codes checkout accepts. A percentage code is
 *  taken on the package subtotal only, so add-ons cannot inflate a discount. */
const PROMOS = {
  WAKA10: { label: 'Promo · WAKA10', amount: (packageSubtotal) => Math.round(packageSubtotal * 0.1) },
  NAIJA50: { label: 'Promo · NAIJA50', amount: () => 50000 },
};

const HOLD_SECONDS = 13 * 60 + 8;

function formatClock(totalSeconds) {
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function WhatsAppGlyph({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#fff">
      <path d={WHATSAPP_PATH} />
    </svg>
  );
}

/** A `.tgl` switch — a real switch button wearing the mockup's own classes.
 *  Declared at module scope so toggling does not remount it and drop focus. */
function Toggle({ on, label, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={on ? 'tgl on' : 'tgl'}
      onClick={onToggle}
    />
  );
}

/** The amber visa card. One destination shows one; a multi-city trip shows one
 *  per country that needs a visa, which is why it is a component and not inline
 *  markup — the copy and the price are the destination's own. */
function VisaCard({ heading, city, country, nationality, addon, on, onToggle }) {
  return (
    <div className="card" style={{ border: '2px solid #C77C00', background: '#FFFCF5' }}>
      <div className="cardhead">
        <h2>
          <span className="stepnum" style={{ background: '#C77C00' }}>
            !
          </span>
          {heading}
          <span className="new">New</span>
        </h2>
      </div>
      <div
        style={{
          background: '#FEF8ED',
          border: '1px solid rgba(199,124,0,.25)',
          borderRadius: 'var(--r)',
          padding: '12px 14px',
          marginBottom: '14px',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#C77C00',
            marginBottom: '4px',
          }}
        >
          You need a visa for {city} on a {nationality} passport
        </div>
        <div style={{ fontSize: '12px', color: '#7A5300', lineHeight: '18px' }}>
          Wakanow can apply for you. Turn it on below and we'll collect your documents by email
          after payment. If you already hold a valid {country} visa, leave it off — we will not add
          it to your price.
        </div>
      </div>
      <div className="addon" style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <Toggle on={on} label={`${addon.title} · ${city}`} onToggle={onToggle} />
        <div>
          <h4>{addon.title}</h4>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '2px',
              lineHeight: '15px',
            }}
          >
            {addon.meta} · documents collected after payment · priced per traveller
          </div>
        </div>
        <div className="price">
          <b>{naira(addon.price)}</b>
          <s>{naira(addon.separate)} separately</s>
        </div>
      </div>
      <div
        style={{
          fontSize: '10px',
          color: '#7A5300',
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(199,124,0,.15)',
          lineHeight: '15px',
        }}
      >
        ⚠ Documents must be submitted within 5 working days of booking. If you do not submit in
        time, Wakanow will contact you before your visa application expires.
      </div>
    </div>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const {
    search,
    nights,
    dateLabel,
    setTier,
    bookingSlug,
    setBookingSlug,
    payingTravellers,
    itinerary,
    isMultiDestination,
    routeLabel,
    totalNights,
    tripStartDate,
    tripEndDate,
  } = useTrip();

  // One destination is still a booked package and behaves exactly as it always
  // has. Two or more is an itinerary: the trip is priced leg by leg, and every
  // destination-shaped thing on this screen — the summary, the breakdown, the
  // visa card, the rail — is rendered once per leg instead of once.
  const trip = isMultiDestination ? priceItinerary(itinerary, {}, search) : null;

  // The booking drives the screen, not the tier: a curated package taken to
  // checkout must describe itself, not the Dubai tier that used to stand in.
  const selected = findPackage(bookingSlug);
  /** A tier is a one-city product, so a multi-city trip is never booking one. */
  const bookedTier = !isMultiDestination && isTier(selected);
  /** What the add-on card speaks for: the booked package, or the first stop. */
  const primaryPkg = isMultiDestination ? itinerary[0].pkg : selected;
  const hotel = selected.hotels[0];
  const flight = selected.flights[0];
  // Checkout books the package exactly as authored: the default room and the
  // default fare — the fare ladder is listed cheapest first, so its default is
  // the flagged rung rather than the first one.
  const room = findRoom(hotel);
  const fare = findFare(flight);
  /** A package that already includes transfers cannot also sell one as an add-on. */
  const offersTransferAddon = !primaryPkg.transfer;
  /** Destinations come off the package; only the origin is the traveller's own. */
  const destCode = isMultiDestination ? itinerary[0].toCode : selected.code;
  // A package that carries no visa add-on either needs none or already includes
  // one, so the whole visa card and its line drop out. On a multi-city trip the
  // visa is per country instead, so the single card gives way to `visaCards`.
  const visaAddon = isMultiDestination
    ? null
    : (selected.addons?.find((a) => a.id === 'visa') ?? null);
  /** One card per destination that needs a visa, each at its own price. */
  const visaCards = isMultiDestination
    ? visaLegs(itinerary)
        .map((entry) => ({ entry, addon: entry.pkg.addons?.find((a) => a.id === 'visa') }))
        .filter((card) => card.addon)
    : [];
  // The featured tour slot: the tiers keep the authored desert safari, a curated
  // destination offers its own headline excursion instead.
  const tourAddon = bookedTier
    ? null
    : (primaryPkg.addons?.find((a) => a.id !== 'visa' && a.id !== 'transfer') ?? null);
  const tourRow = bookedTier ? AUTHORED_TOUR : tourAddon;
  /** With several destinations in play, a tour has to say which city it is in. */
  const tourLabel =
    tourAddon &&
    (isMultiDestination ? `${tourAddon.title} · ${itinerary[0].toCity}` : tourAddon.title);

  const [email, setEmail] = useState('adaeze.okonkwo@gmail.com');
  const [phone, setPhone] = useState('+234 803 412 6690');
  const [createProfile, setCreateProfile] = useState(false);
  // Seeded once: the party size is fixed for the life of this screen, since the
  // only way to change it is to go back to the search.
  const [travellers, setTravellers] = useState(() =>
    Array.from({ length: payingTravellers }, (_, i) => ({
      title: 'Mr',
      firstName: '',
      lastName: '',
      dob: '',
      gender: 'Male',
      ...AUTHORED_TRAVELLERS[i],
      nationality: search.nationality,
    })),
  );

  const [addons, setAddons] = useState(INITIAL_ADDONS);
  /** Multi-city visas, one switch per leg id. Off to begin with, like the single
   *  visa toggle — nobody is charged for a visa they did not ask for. */
  const [legVisas, setLegVisas] = useState({});
  const [channel, setChannel] = useState('whatsapp');
  const [pssSelected, setPssSelected] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(HOLD_SECONDS);
  const [promoInput, setPromoInput] = useState('');
  /** The accepted code, or null. Kept separate from the field so an edit after
   *  applying cannot silently change what was accepted. */
  const [promo, setPromo] = useState(null);
  const [promoError, setPromoError] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!copied) return undefined;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const priced = pricePackage(selected, { nights });
  const { now: packageNow, save: packageSave } = cardPrice(selected, nights);

  const base = (isMultiDestination ? trip.bundled : packageNow) * payingTravellers;

  /** The party-sized label the mockup wrote on every component line. */
  const withParty = (label) =>
    payingTravellers > 1 ? `${label} × ${plural(payingTravellers, 'traveller')}` : label;

  const legLines = (entry, legPriced) =>
    legPriced.lines.map((line) => ({
      key: `${entry.id}:${line.key}`,
      label: withParty(line.label),
      amount: line.separate * payingTravellers,
    }));

  // Each component is listed at what it would cost booked separately, so the
  // package savings line below reconciles the list back to the package price:
  // Σ separate − save === bundled, per traveller. A multi-city trip keeps the
  // same identity, one group per destination plus the flight home.
  const componentGroups = isMultiDestination
    ? [
        ...trip.legPrices.map(({ entry, priced: legPriced }) => ({
          key: entry.id,
          title: `${entry.toCity} · ${plural(entry.nights, 'night')}`,
          strong: true,
          lines: legLines(entry, legPriced),
        })),
        ...(trip.home
          ? [
              {
                key: 'home',
                title: null,
                strong: false,
                lines: [
                  {
                    key: 'home',
                    label: withParty(trip.home.label),
                    amount: trip.home.separate * payingTravellers,
                  },
                ],
              },
            ]
          : []),
      ]
    : [
        {
          key: selected.slug,
          title: `${selected.name} · ${search.fromCode} → ${destCode}`,
          strong: false,
          lines: priced.lines.map((line) => ({
            key: line.key,
            label: withParty(line.label),
            amount: line.separate * payingTravellers,
          })),
        },
      ];

  const componentTotal = componentGroups.reduce(
    (sum, group) => sum + group.lines.reduce((legSum, line) => legSum + line.amount, 0),
    0,
  );
  // Taken as the difference rather than assumed, so the listed components always
  // reconcile to the package price however many legs are being added up.
  const packageSavings = isMultiDestination
    ? componentTotal - base
    : packageSave * payingTravellers;

  // The visa and tour lines take the booked package's own figures rather than
  // hardcoded UAE ones; for the three Dubai tiers those are the same numbers.
  const dynamicItems = {
    visa: visaAddon && { label: visaAddon.title, price: visaAddon.price },
    safari: tourAddon && { label: tourLabel, price: tourAddon.price },
  };
  const optionalItems = OPTIONAL_ITEMS.map((item) =>
    dynamicItems[item.key] ? { ...item, ...dynamicItems[item.key] } : item,
  );

  // A visa is bought per country, so across several destinations the one visa
  // row becomes one row per destination that needs one.
  const catalogueItems = isMultiDestination
    ? [
        ...optionalItems.filter((item) => item.key !== 'visa'),
        ...visaCards.map(({ entry, addon }) => ({
          key: `visa:${entry.id}`,
          legId: entry.id,
          label: `${addon.title} · ${entry.toCity}`,
          price: addon.price,
          isNew: true,
          group: 'package',
          perTraveller: true,
        })),
      ]
    : optionalItems;

  const isEnabled = (item) => (item.legId ? Boolean(legVisas[item.legId]) : addons[item.key]);

  const offered = (key) => {
    if (key === 'transfer') return offersTransferAddon;
    if (key === 'visa') return Boolean(visaAddon);
    if (key === 'safari') return Boolean(tourRow);
    return true;
  };

  const activeExtras = catalogueItems.filter((item) => isEnabled(item) && offered(item.key));
  const total = activeExtras.reduce((sum, item) => sum + extraAmount(item, payingTravellers), base);

  // A promo never takes the bill below zero, so a flat code on a small basket
  // discounts what is owed and no more.
  const promoDiscount = promo ? Math.min(PROMOS[promo].amount(base), total) : 0;
  const dueTotal = total - promoDiscount;

  const updateTraveller = (index, field, value) =>
    setTravellers((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));

  const toggleAddon = (key) => setAddons((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleLegVisa = (legId) => setLegVisas((prev) => ({ ...prev, [legId]: !prev[legId] }));

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (PROMOS[code]) {
      setPromo(code);
      setPromoError(false);
      return;
    }
    // Leave the field as typed — a rejected code is usually a typo to correct.
    setPromo(null);
    setPromoError(true);
  };

  const removePromo = () => {
    setPromo(null);
    setPromoError(false);
    setPromoInput('');
  };

  const inert = (e) => e.preventDefault();

  /** The trip in one line: the whole route on a multi-city trip, the booked
   *  package on a single-destination one. */
  const shareSummary = isMultiDestination
    ? `${routeLabel} · ${plural(totalNights, 'night')} · ${formatRange(tripStartDate, tripEndDate)}`
    : `${selected.name} · ${selected.city} · ${dateLabel}`;

  const shareOnWhatsApp = () =>
    window.open(
      'https://wa.me/?text=' +
        encodeURIComponent(`My Wakanow booking — ${shareSummary} — ${naira(dueTotal)}`),
      '_blank',
      'noopener',
    );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // Clipboard is unavailable outside a secure context — leave the label alone.
    }
  };

  const packageLines = activeExtras.filter((i) => i.group === 'package');
  const existingLines = activeExtras.filter((i) => i.group === 'existing');

  return (
    <div className="pg-checkout">
      <nav className="nav">
        <div className="wrap">
          <Link to="/" className="logo">
            waka<i>now</i>
          </Link>
          <div className="navlinks">
            {NAV_LINKS.map((link) => (
              <a
                key={link}
                href="#"
                className={link === 'Packages' ? 'on' : undefined}
                onClick={inert}
              >
                {link}
              </a>
            ))}
          </div>
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
        trail={[{ label: 'Packages', to: '/' }, { label: 'Your booking' }]}
      />

      <div className="wrap">
        <div className="pagetitle">
          <h1>Your Booking</h1>
          {isMultiDestination && (
            <div className="summeta">
              {routeLabel} · {plural(totalNights, 'night')} ·{' '}
              {formatRange(tripStartDate, tripEndDate)}
            </div>
          )}
        </div>

        <div className="layout">
          <div className="tierside">
            <div className="tierside-head">
              {isMultiDestination
                ? 'Your itinerary'
                : bookedTier
                  ? 'Your search options'
                  : 'Your trip'}
            </div>
            {isMultiDestination ? (
              // Tiers are a one-city product. A multi-city trip has legs to show
              // instead, so the rail lists the stops rather than offering a swap.
              trip.legPrices.map(({ entry, priced: legPriced }) => (
                <div className="tmini" key={entry.id}>
                  <div className="tn">{entry.toCity}</div>
                  <div className="tp">
                    <b>{naira(legPriced.bundled)}</b>
                    {legPriced.save > 0 && <small>Save {nairaShort(legPriced.save)}</small>}
                  </div>
                  <button type="button" className="go">
                    {plural(entry.nights, 'night')}
                  </button>
                </div>
              ))
            ) : bookedTier ? (
              TIERS.map((t) => {
                const isSelected = t.slug === selected.slug;
                const modifier = TIER_MODIFIER[t.name];
                // Prices are composed at the current trip length, so the three
                // move with the dates exactly as they do on every other screen.
                const { now, save } = cardPrice(t, nights);
                // `pre` is the mockup's highlight class as well as Premium's own
                // name colour, so it goes on whichever tier is selected — and
                // Premium only carries it when it is the selected one.
                const classes = ['tmini'];
                if (modifier !== 'pre') classes.push(modifier);
                if (isSelected) classes.push('pre');
                return (
                  <div key={t.slug} className={classes.join(' ')}>
                    <div className="tn">{t.name}</div>
                    <div className="tp">
                      <b>{naira(now)}</b>
                      <small>Save {nairaShort(save)}</small>
                    </div>
                    <button
                      type="button"
                      className="go"
                      onClick={() => {
                        setTier(t.name);
                        setBookingSlug(t.slug);
                      }}
                    >
                      {isSelected ? 'Selected' : 'Switch'}
                    </button>
                  </div>
                );
              })
            ) : (
              // A curated package has no tier siblings to switch between, so the
              // rail simply states what is being booked.
              <div className="tmini pre">
                <div className="tn">{selected.country}</div>
                <div className="tp">
                  <b>{naira(packageNow)}</b>
                  <small>Save {nairaShort(packageSave)}</small>
                </div>
                <button type="button" className="go">
                  Selected
                </button>
              </div>
            )}
          </div>

          <main>
            <div className="card">
              <div className="cardhead">
                <h2>
                  <span className="stepnum">1</span>Traveller Details
                </h2>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Have an account?{' '}
                <a
                  href="#"
                  style={{ color: 'var(--brand-500)', fontWeight: 600 }}
                  onClick={inert}
                >
                  Log in for faster checkout
                </a>
              </div>

              <div className="frow">
                <div className="f">
                  <label htmlFor="contact-email">Email address</label>
                  <input
                    id="contact-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="f">
                  <label htmlFor="contact-phone">Phone number</label>
                  <input
                    id="contact-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              {travellers.map((t, i) => (
                <Fragment key={i}>
                  <div className="travname">
                    {i === 0 ? 'Lead traveller · Adult 1' : `Adult ${i + 1}`}
                  </div>
                  <div className="upload">
                    📄{' '}
                    <div>
                      <b>Upload passport to auto-fill</b>
                      <br />
                      <small>AI will extract name, DOB, nationality & passport details</small>
                    </div>
                    <button type="button" className="addbtn">
                      Upload
                    </button>
                  </div>
                  <div className="frow3">
                    <div className="f">
                      <label htmlFor={`t${i}-title`}>Title</label>
                      <select
                        id={`t${i}-title`}
                        value={t.title}
                        onChange={(e) => updateTraveller(i, 'title', e.target.value)}
                      >
                        {TITLES.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div className="f">
                      <label htmlFor={`t${i}-first`}>First name</label>
                      <input
                        id={`t${i}-first`}
                        value={t.firstName}
                        onChange={(e) => updateTraveller(i, 'firstName', e.target.value)}
                      />
                    </div>
                    <div className="f">
                      <label htmlFor={`t${i}-last`}>Last name</label>
                      <input
                        id={`t${i}-last`}
                        value={t.lastName}
                        onChange={(e) => updateTraveller(i, 'lastName', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="frow3">
                    <div className="f">
                      <label htmlFor={`t${i}-dob`}>Date of birth</label>
                      <input
                        id={`t${i}-dob`}
                        value={t.dob}
                        onChange={(e) => updateTraveller(i, 'dob', e.target.value)}
                      />
                    </div>
                    <div className="f">
                      <label htmlFor={`t${i}-gender`}>Gender</label>
                      <select
                        id={`t${i}-gender`}
                        value={t.gender}
                        onChange={(e) => updateTraveller(i, 'gender', e.target.value)}
                      >
                        {GENDERS.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div className="f">
                      <label htmlFor={`t${i}-nationality`}>Nationality</label>
                      <select
                        id={`t${i}-nationality`}
                        value={t.nationality}
                        onChange={(e) => updateTraveller(i, 'nationality', e.target.value)}
                      >
                        {NATIONALITIES.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {i === 0 && (
                    <div className="prime">
                      <b>Prime perks:</b> Save your details for faster checkout next time, track
                      bookings from your dashboard, and unlock member-only fares.{' '}
                      <label style={{ marginLeft: '8px' }}>
                        <input
                          type="checkbox"
                          checked={createProfile}
                          onChange={(e) => setCreateProfile(e.target.checked)}
                        />{' '}
                        Create a profile for me
                      </label>
                    </div>
                  )}
                </Fragment>
              ))}

              <div className="terms">
                By proceeding, you agree you have read and accepted our{' '}
                <a href="#" onClick={inert}>
                  Stays
                </a>{' '}
                and our{' '}
                <a href="#" onClick={inert}>
                  Travel Terms & Conditions
                </a>{' '}
                and our{' '}
                <a href="#" onClick={inert}>
                  Privacy Policy
                </a>
                .
              </div>
            </div>

            <div className="card">
              <div className="cardhead">
                <h2>
                  <span className="stepnum">2</span>Enhance Your Trip
                </h2>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  All add-ons are optional
                </span>
              </div>

              {offersTransferAddon && (
                <div className="addon">
                  <Toggle
                    on={addons.transfer}
                    label="Careem private airport transfers"
                    onToggle={() => toggleAddon('transfer')}
                  />
                  <div>
                    <h4>
                      Careem · private airport transfers<span className="new">New</span>
                    </h4>
                    <p>
                      Both ways · meet and greet at {destCode} arrivals · up to 4 passengers
                    </p>
                  </div>
                  <div className="price">
                    <b>₦90,000</b>
                    <s>₦94,000 separately</s>
                  </div>
                </div>
              )}

              {tourRow && (
                <div className="addon">
                  <Toggle
                    on={addons.safari}
                    label={tourLabel ?? tourRow.title}
                    onToggle={() => toggleAddon('safari')}
                  />
                  <div>
                    <h4>
                      {tourLabel ?? tourRow.title}
                      <span className="new">New</span>
                    </h4>
                    <p>{tourRow.meta}</p>
                  </div>
                  <div className="price">
                    <b>{naira(tourRow.price)}</b>
                    <s>{naira(tourRow.separate)} separately</s>
                  </div>
                </div>
              )}

              <div className="addon">
                <Toggle
                  on={addons.callReminder}
                  label="Call Reminder"
                  onToggle={() => toggleAddon('callReminder')}
                />
                <div>
                  <h4>Call Reminder</h4>
                  <p>Receive call reminders for your flights and stay updated with schedule changes</p>
                </div>
                <div className="price">
                  <b>₦2,500</b>
                </div>
              </div>

              <div className="addon">
                <Toggle
                  on={addons.smsReminder}
                  label="SMS Reminder"
                  onToggle={() => toggleAddon('smsReminder')}
                />
                <div>
                  <h4>SMS Reminder</h4>
                  <p>Get SMS reminders for your flight and stay informed about changes</p>
                </div>
                <div className="price">
                  <b>₦2,000</b>
                </div>
              </div>

              <div className="addon">
                <Toggle
                  on={addons.kalabash}
                  label="Kalabash Platinum Travel Card"
                  onToggle={() => toggleAddon('kalabash')}
                />
                <div>
                  <h4>Kalabash Platinum Travel Card</h4>
                  <p>
                    Purchase the Kalabash USD Platinum card — global payment and cashback. Delivery
                    included.
                  </p>
                </div>
                <div className="price">
                  <b>₦4,500</b>
                </div>
              </div>
            </div>

            {visaAddon && (
              <VisaCard
                heading="Visa Requirement"
                city={selected.city}
                country={selected.country}
                nationality={search.nationality}
                addon={visaAddon}
                on={addons.visa}
                onToggle={() => toggleAddon('visa')}
              />
            )}

            {/* One card per country on the trip that needs a visa — each is its
                own application, at its own destination's price. */}
            {visaCards.map(({ entry, addon }) => (
              <VisaCard
                key={entry.id}
                heading={`Visa Requirement · ${entry.toCity}`}
                city={entry.toCity}
                country={entry.country}
                nationality={search.nationality}
                addon={addon}
                on={Boolean(legVisas[entry.id])}
                onToggle={() => toggleLegVisa(entry.id)}
              />
            ))}

            <div className="card">
              <div className="cardhead">
                <h2>
                  <span className="stepnum" style={{ background: 'var(--brand-500)' }}>
                    ✉
                  </span>
                  How should we reach you?<span className="new">New</span>
                </h2>
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  marginBottom: '14px',
                  lineHeight: '17px',
                }}
              >
                Choose how you'd like to receive booking confirmations, updates, and visa document
                requests.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className={channel === 'whatsapp' ? 'commpref sel' : 'commpref'}
                  aria-pressed={channel === 'whatsapp'}
                  onClick={() => setChannel('whatsapp')}
                >
                  <span className="cp-icon" style={{ background: '#25D366' }}>
                    <WhatsAppGlyph />
                  </span>
                  <span className="cp-label">WhatsApp</span>
                  <span className="cp-desc">Get updates on WhatsApp at {phone}</span>
                  <span className="cp-check">✓</span>
                </button>
                <button
                  type="button"
                  className={channel === 'email' ? 'commpref sel' : 'commpref'}
                  aria-pressed={channel === 'email'}
                  onClick={() => setChannel('email')}
                >
                  <span className="cp-icon" style={{ background: 'var(--brand-500)' }}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="M3 7l9 6 9-6" />
                    </svg>
                  </span>
                  <span className="cp-label">Email</span>
                  <span className="cp-desc">Get updates at {email}</span>
                  <span className="cp-check">✓</span>
                </button>
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  marginTop: '10px',
                  lineHeight: '14px',
                }}
              >
                We'll use this channel for your booking confirmation, itinerary, flight reminders,
                and any visa document requests. You can change this in your account settings after
                booking.
              </div>
            </div>

            <div className="card">
              <div className="cardhead">
                <h2>
                  <span className="stepnum">3</span>Payment
                </h2>
              </div>
              <div className="paylock">
                <svg viewBox="0 0 24 24" fill="none" stroke="#8E8EA9" strokeWidth="2">
                  <rect x="4" y="10" width="16" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 018 0v3" />
                </svg>
                🔒 Complete the traveller details above to continue to payment.
              </div>
            </div>
          </main>

          <aside className="sidebar">
            <div className="summary">
              <div className="sumhead">
                <h2>Booking Summary</h2>
                <div className="timer">
                  ⏱ Price held for <b>{formatClock(secondsLeft)}</b>
                </div>
              </div>

              <div className="sumbody">
                {isMultiDestination ? (
                  <>
                    {/* One group per destination: its hotel, its flight in, and
                        its transfer where the package carries one. */}
                    {trip.legPrices.map(({ entry, priced: legPriced }) => {
                      const lineOf = (key) => legPriced.lines.find((l) => l.key === key);
                      const transferLine = lineOf('transfer');
                      return (
                        <div className="sumgroup" key={entry.id}>
                          <h3>
                            <span className="ic">🌍</span> {entry.toCity} ·{' '}
                            {plural(entry.nights, 'night')}
                          </h3>
                          <div className="summeta">🏨 {legPriced.hotel.name}</div>
                          <div className="summeta">
                            {legPriced.room.name} · {legPriced.room.board} · {legPriced.room.beds}
                          </div>
                          <div className="summeta">
                            Check-in {formatWeekday(entry.startDate)} · Check-out{' '}
                            {formatWeekday(entry.endDate)}
                          </div>
                          <div className="sumprice">{naira(lineOf('hotel').bundled)}</div>

                          <div className="summeta" style={{ marginTop: '10px' }}>
                            ✈ {entry.fromCity} → {entry.toCity} ·{' '}
                            {legPriced.flight.name.split(' · ')[0]} · {legPriced.fare.label}
                          </div>
                          <div className="sumprice">{naira(lineOf('flight').bundled)}</div>

                          {transferLine && (
                            <>
                              <div className="summeta" style={{ marginTop: '10px' }}>
                                🚐 {entry.pkg.transfer.name}
                              </div>
                              <div className="sumprice">{naira(transferLine.bundled)}</div>
                            </>
                          )}
                        </div>
                      );
                    })}

                    {trip.home && (
                      <div className="sumgroup">
                        <h3>
                          <span className="ic">✈</span> {trip.home.label}
                        </h3>
                        <div className="summeta">
                          {trip.home.route} · {trip.home.airline}
                        </div>
                        <div className="sumprice">{naira(trip.home.bundled)}</div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="sumgroup">
                      <h3>
                        <span className="ic">🏨</span> Hotel
                      </h3>
                      <div className="summeta">
                        {hotel.name} · {plural(nights, 'night')}
                      </div>
                      <div className="summeta">
                        {room.name} · {room.board} · {room.beds}
                      </div>
                      <div className="summeta">
                        Check-in {formatWeekday(search.departDate)} · Check-out{' '}
                        {formatWeekday(search.returnDate)}
                      </div>
                      <div className="sumprice">{naira(room.nightly * nights)}</div>
                    </div>

                    <div className="sumgroup">
                      <h3>
                        <span className="ic">✈</span> Flight
                      </h3>
                      <div className="summeta">
                        {search.fromCode} → {destCode} · {flight.name} · {fare.label}
                      </div>
                      {/* Clock times stay as authored — the tiers carry fares, not a timetable. */}
                      <div className="leg">
                        <div>
                          <span className="time">14:45</span>
                          <br />
                          <span className="code">{search.fromCode}</span>
                        </div>
                        <div>
                          <span className="dur">14h 45m · 1 stop</span>
                        </div>
                        <div>
                          <span className="time">08:30</span>
                          <br />
                          <span className="code">{destCode}</span>
                        </div>
                      </div>
                      {/* What the cabin actually includes, rather than the flight's
                          authored baggage string — the fare is what was bought. */}
                      <div className="summeta" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {fare.bags} · {fare.seat} · {fare.changeable || 'No changes'} ·{' '}
                        {fare.refundable || 'Non-refundable'}
                      </div>
                      <div className="sumprice">{naira(fare.price)}</div>
                    </div>

                    {selected.transfer && (
                      <div className="sumgroup">
                        <h3>
                          <span className="ic">🚐</span> Airport transfer
                          <span className="new">New</span>
                        </h3>
                        <div className="summeta">{selected.transfer.name}</div>
                        <div className="sumprice">{naira(selected.transfer.price)}</div>
                      </div>
                    )}
                  </>
                )}

                <div className="savings">
                  <span className="ic">🏷</span>
                  <div>
                    <div className="t">
                      You save {naira(packageSavings)} as a package
                      <span className="new" style={{ marginLeft: '4px' }}>
                        New
                      </span>
                    </div>
                    {/* Reads off the live basket, before any promo: this line
                        compares booking separately with booking as a package,
                        which a campaign code is not part of. */}
                    <div className="s">
                      {naira(total + packageSavings)} booked separately → {naira(total)} as a
                      package
                    </div>
                  </div>
                </div>

                <div className="sumgroup" style={{ paddingBottom: 0 }}>
                  {/* A multi-city breakdown reads by destination: a bold city
                      line, that leg's components, then the flight home. */}
                  {componentGroups.map((group) => (
                    <Fragment key={group.key}>
                      {group.title && (
                        <div className="bline">
                          <span>{group.strong ? <b>{group.title}</b> : group.title}</span>
                        </div>
                      )}
                      {group.lines.map((line) => (
                        <div className="bline" key={line.key}>
                          <span>{line.label}</span>
                          <b>{naira(line.amount)}</b>
                        </div>
                      ))}
                    </Fragment>
                  ))}

                  <div className="bline disc">
                    <span>
                      Package savings
                      <span className="new" style={{ marginLeft: '4px' }}>
                        New
                      </span>
                    </span>
                    <b>−{naira(packageSavings)}</b>
                  </div>

                  {activeExtras.length > 0 && <div style={{ height: '8px' }} />}

                  {packageLines.map((item) => (
                    <div className="bline" key={item.key}>
                      <span>
                        {item.label}
                        {item.perTraveller && payingTravellers > 1
                          ? ` × ${payingTravellers}`
                          : ''}
                        {item.isNew && (
                          <span className="new" style={{ marginLeft: '4px' }}>
                            New
                          </span>
                        )}
                      </span>
                      <b>{naira(extraAmount(item, payingTravellers))}</b>
                    </div>
                  ))}
                  {packageLines.length > 0 && <div style={{ height: '4px' }} />}

                  {existingLines.map((item) => (
                    <div className="bline" key={item.key}>
                      <span>{item.label}</span>
                      <b>{naira(extraAmount(item, payingTravellers))}</b>
                    </div>
                  ))}
                  {existingLines.length > 0 && <div style={{ height: '4px' }} />}
                </div>

                <div className="bline" style={{ alignItems: 'center', gap: '8px' }}>
                  <div className="f" style={{ flex: 1 }}>
                    <input
                      aria-label="Promo code"
                      placeholder="Promo code"
                      value={promoInput}
                      disabled={Boolean(promo)}
                      onChange={(e) => {
                        setPromoInput(e.target.value.toUpperCase());
                        setPromoError(false);
                      }}
                    />
                  </div>
                  {promo ? (
                    <button type="button" className="rmbtn" onClick={removePromo}>
                      Remove
                    </button>
                  ) : (
                    <button type="button" className="addbtn" onClick={applyPromo}>
                      Apply
                    </button>
                  )}
                </div>
                {promoError && <div className="nohidden">That code isn't recognised.</div>}
                {promo && (
                  <div className="bline disc">
                    <span>{PROMOS[promo].label}</span>
                    <b>−{naira(promoDiscount)}</b>
                  </div>
                )}

                <div className="btotal">
                  <span>Total</span>
                  <b>{naira(dueTotal)}</b>
                </div>
                <div className="nohidden">No hidden fees — price includes all taxes</div>

                <div
                  className={pssSelected ? 'pssbox sel' : 'pssbox'}
                  role="button"
                  tabIndex={0}
                  aria-pressed={pssSelected}
                  onClick={() => setPssSelected((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setPssSelected((v) => !v);
                    }
                  }}
                >
                  <div className="t">
                    <em>PSS</em> Pay Small Small<span className="new">New</span>
                  </div>
                  <p>
                    Spread this over 6 months from <b>{naira(dueTotal / 6)}</b>/month. Nothing extra to
                    pay.
                  </p>
                </div>

                {handedOff ? (
                  <div
                    style={{
                      marginTop: '12px',
                      background: '#F5F7FA',
                      border: '1px solid #D1D1DB',
                      borderRadius: '8px',
                      padding: '14px',
                      fontSize: '12px',
                      color: '#555770',
                      lineHeight: '18px',
                    }}
                  >
                    Phase 1 ends here — this is where Packages hands off to the existing Wakanow
                    payment flow.
                    <button
                      type="button"
                      onClick={() => navigate('/')}
                      style={{
                        display: 'block',
                        marginTop: '10px',
                        background: '#EEF5FF',
                        color: '#004BBE',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      Back to packages
                    </button>
                  </div>
                ) : (
                  <button type="button" className="paybtn" onClick={() => setHandedOff(true)}>
                    Proceed to Pay {naira(dueTotal)}
                  </button>
                )}

                <div className="shareacts" style={{ flexDirection: 'column', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={shareOnWhatsApp}
                    style={{
                      flex: 'none',
                      width: '100%',
                      background: '#25D366',
                      color: '#fff',
                      borderRadius: 'var(--r)',
                      padding: '11px',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <WhatsAppGlyph />
                    Share itinerary via WhatsApp<span className="new">New</span>
                  </button>
                  <button
                    type="button"
                    onClick={copyLink}
                    style={{
                      flex: 'none',
                      width: '100%',
                      background: '#EEF5FF',
                      color: 'var(--brand-500)',
                      borderRadius: 'var(--r)',
                      padding: '9px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {copied ? 'Link copied' : 'Copy link · Download summary'}
                  </button>
                </div>

                <div className="whats">
                  <div className="wi">
                    <WhatsAppGlyph size={16} />
                  </div>
                  <div>
                    <div className="wt">Something not right?</div>
                    <div className="ws">Message us before you pay</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.open('https://wa.me/', '_blank', 'noopener')}
                  >
                    Chat
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

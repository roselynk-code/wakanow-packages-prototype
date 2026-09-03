import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import BackBar from '../components/BackBar.jsx';
import { TIERS, findPackage, isTier } from '../data/packages.js';
import { formatRange, formatWeekday } from '../lib/dates.js';
import { flightCard } from '../lib/flights.js';
import { naira, nairaShort } from '../lib/format.js';
import {
  APPLICATION_LANGUAGE,
  DEFERRED_LANGUAGE,
  DOCUMENT_DEADLINE,
  documentStatus,
  fulfilmentRule,
} from '../data/fulfilment.js';
import { priceItinerary, visaLegs } from '../lib/itinerary.js';
import { cardPrice, findFare, findRoom, pricePackage } from '../lib/pricing.js';
import { useTrip } from '../state/useTrip.js';
import './Checkout.css';

/**
 * Checkout, rebuilt to the anatomy of the live wakanow.com/cart.
 *
 * The structural move: the cart's first numbered section is the BOOKING SUMMARY
 * itself, in the main column — a line card per booked component, then an
 * itinerary card carrying the depart/return timeline, then the fare rules. The
 * right rail is left to do one job, which is the money. That is the opposite of
 * what this screen used to do (summary stuffed into a 360px rail, travellers
 * first), and it is better: you confirm what you bought before you type a name.
 *
 *   1  Booking Summary     line cards · itinerary timeline · fare rules
 *   2  Traveller Details   contact · lead traveller · passport upload · profile
 *   3  Enhance Your Trip   add-on rows with + Add / − Remove
 *   —  the visa, contact-channel and payment blocks this product adds, unnumbered
 *      because the live cart has no counterpart to number them against
 *
 * Nothing about the pricing moved. Every figure is the one the screen already
 * computed; see the rail comment for why the breakdown keeps this product's own
 * component lines rather than the live cart's Flights / Taxes / Service Charge.
 */

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

/** The live form puts a flag in the nationality select and beside the dial code. */
const FLAGS = {
  Nigeria: '🇳🇬',
  Ghana: '🇬🇭',
  'United Kingdom': '🇬🇧',
  'United States': '🇺🇸',
  'South Africa': '🇿🇦',
};

/** The dial codes the fused phone group offers, in the same order as the
 *  nationality list so the two read as one set. */
const DIAL_CODES = [
  { code: '+234', flag: '🇳🇬' },
  { code: '+233', flag: '🇬🇭' },
  { code: '+44', flag: '🇬🇧' },
  { code: '+1', flag: '🇺🇸' },
  { code: '+27', flag: '🇿🇦' },
];

/** Date of birth is three selects on the live cart, not a free-text field. The
 *  stored value stays the '15 Mar 1990' string the mockup authored, so the
 *  seeded travellers still display exactly as before. */
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const YEAR_OPTIONS = Array.from({ length: 101 }, (_, i) => String(new Date().getFullYear() - i));

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

/** The icon tile each add-on row wears. The live rows are illustrated; these are
 *  the same glyph vocabulary the summary line cards use. */
const ADDON_ICONS = {
  transfer: '🚐',
  safari: '🗺',
  callReminder: '📞',
  smsReminder: '💬',
  kalabash: '💳',
};

/** Product eyebrow and tile for each priced component of a package. */
const PRODUCTS = {
  flight: { eyebrow: 'Flight', icon: '✈' },
  hotel: { eyebrow: 'Hotel', icon: '🏨' },
  transfer: { eyebrow: 'Transfer', icon: '🚐' },
  tours: { eyebrow: 'Tour', icon: '🗺' },
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

/** The outbound clock the single-destination booking has always shown. It is the
 *  mockup's own authored timetable — the tiers carry fares, not a schedule — and
 *  no figure on this screen moves in the rebuild, so the timeline reads it
 *  rather than the flight record's departure. */
const AUTHORED_OUTBOUND = {
  departTime: '14:45',
  arriveTime: '08:30',
  durationText: '14h 45m',
  stopLabel: '1 stop',
};

function formatClock(totalSeconds) {
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/* ── Clock arithmetic for the timeline ──────────────────────────────────────
   The same rules src/lib/flights.js uses, kept local because the return leg of
   the single-destination trip is derived from the mockup's own authored clock
   times rather than from a flight record. */

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const toClock = (minutes) => {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
};

const durationMinutes = (text) => {
  const h = /(\d+)\s*h/.exec(text ?? '');
  const m = /(\d+)\s*m/.exec(text ?? '');
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
};

/** Eight hours on the ground, then the same duration home — lib/flights.js's
 *  own turnaround rule, so a derived return reads the same wherever it appears. */
function deriveReturnTimes({ arriveTime, durationText }) {
  const depart = toMinutes(arriveTime) + 8 * 60;
  return { departTime: toClock(depart), arriveTime: toClock(depart + durationMinutes(durationText)) };
}

const landsNextDay = (departTime, arriveTime) => toMinutes(arriveTime) < toMinutes(departTime);

/* ── Glyphs ─────────────────────────────────────────────────────────────── */

function WhatsAppGlyph({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#fff">
      <path d={WHATSAPP_PATH} />
    </svg>
  );
}

function PlaneGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M2 14l20-8-6 14-3-5-5-2z" strokeLinejoin="round" />
    </svg>
  );
}

function TrashGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M10 11.5v5.5M14 11.5v5.5" />
      <path d="M6.5 7l.9 12a2 2 0 002 1.9h5.2a2 2 0 002-1.9L17.5 7" />
      <path d="M9.5 7V5.2A1.2 1.2 0 0110.7 4h2.6a1.2 1.2 0 011.2 1.2V7" />
    </svg>
  );
}

/** A `.tgl` switch — a real switch button wearing the mockup's own classes.
 *  Declared at module scope so toggling does not remount it and drop focus.
 *  Still the control the visa card uses; the Enhance rows moved to + Add /
 *  − Remove buttons, which is what the live cart shows. */
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

/* ── Section 1: Booking Summary ─────────────────────────────────────────── */

/** The live cart's numbered section: the blue circle sits OUTSIDE the card, in
 *  the gutter to its left, with the heading beside it. */
function Section({ num, title, note, children }) {
  return (
    <section className="sec">
      <header className="sechead">
        <span className="stepnum" aria-hidden="true">
          {num}
        </span>
        <h2>{title}</h2>
        {note && <span className="secnote">{note}</span>}
      </header>
      {children}
    </section>
  );
}

/** One booked component: tile, product eyebrow, what it is, its price, and the
 *  delete control the live cart puts at the far right. */
function LineCard({ icon, eyebrow, title, meta = [], price, onRemove }) {
  return (
    <div className="linecard">
      <span className="lc-ic" aria-hidden="true">{icon}</span>
      <div className="lc-body">
        <div className="lc-eyebrow">{eyebrow}</div>
        <div className="lc-title">{title}</div>
        {meta.filter(Boolean).map((line) => (
          <div className="lc-meta" key={line}>{line}</div>
        ))}
      </div>
      <div className="lc-price">{naira(price)}</div>
      {/* Components are part of a package, so the cart's delete affordance sends
          you back to the builder to change it rather than silently unpicking a
          bundle whose price depends on what is in it. */}
      <button
        type="button"
        className="lc-del"
        aria-label={`Change or remove ${title}`}
        title="Change this in your package"
        onClick={onRemove}
      >
        <TrashGlyph />
      </button>
    </div>
  );
}

/** One direction of travel: the badge and date, the airline lockup, then the
 *  timeline — big time with code and city stacked under it at each end, the
 *  duration above the rule and the stop count below it. */
function ItineraryLeg({ badge, date, airline, detail, leg }) {
  return (
    <div className="itinleg">
      <div className="itin-when">
        <span className="itin-badge">{badge}</span>
        <span className="itin-date">{date}</span>
      </div>

      <div className="itin-air">
        <span className="itin-mark" aria-hidden="true">
          <PlaneGlyph />
        </span>
        <div className="itin-airname">
          <b>{airline}</b>
          {/* The live lockup carries flight numbers here. This catalogue holds
              none, so the slot states what the record does know: the shape of
              the routing and the fare that was bought. */}
          <span>{detail}</span>
        </div>
      </div>

      <div className="itin-row">
        <div className="itin-end">
          <b>{leg.departTime}</b>
          <span className="itin-code">{leg.fromCode}</span>
          <span className="itin-city">{leg.fromCity}</span>
        </div>

        <div className="itin-mid">
          <span className="itin-dur">{leg.durationText}</span>
          <span className="itin-line" aria-hidden="true">
            <i />
            <i />
          </span>
          <span className={leg.stopLabel === 'Direct' ? 'itin-stops itin-direct' : 'itin-stops'}>
            {leg.stopLabel}
          </span>
        </div>

        <div className="itin-end itin-arrive">
          <b>
            {leg.arriveTime}
            {leg.nextDay && <sup>+1</sup>}
          </b>
          <span className="itin-code">{leg.toCode}</span>
          <span className="itin-city">{leg.toCity}</span>
        </div>
      </div>
    </div>
  );
}

/** The itinerary card: one or two legs, the cabin and baggage line, and — on
 *  the last card of the section — the fare rules. */
function ItineraryCard({ legs, cabinLine, rules }) {
  return (
    <div className="card itincard">
      {legs.map((item) => (
        <ItineraryLeg key={item.badge} {...item} />
      ))}

      <div className="itin-cabin">{cabinLine}</div>

      {rules && (
        <div className="farerules">
          <h3>Fare Rules</h3>
          <div className="fr-grid">
            <div className="fr-policy">
              <span className="fr-ic" aria-hidden="true">🛡</span>
              <div>
                <div className="fr-label">Cancellation policy</div>
                <div className="fr-value">{rules.cancellation}</div>
              </div>
            </div>
            <div className="fr-panel">
              <div className="fr-title">{rules.airline} Fare Rules</div>
              {rules.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Section 3: Enhance Your Trip ───────────────────────────────────────── */

/** An add-on row on the live cart: icon tile, name and description, the price
 *  top-right, and the Add / Remove control under it. A row that is on takes the
 *  brand border and the pale blue ground. */
function AddonRow({ icon, title, isNew, desc, price, was, on, onToggle }) {
  return (
    <div className={on ? 'addonrow sel' : 'addonrow'}>
      <span className="ar-ic" aria-hidden="true">{icon}</span>
      <div className="ar-body">
        <h4>
          {title}
          {isNew && <span className="new">New</span>}
        </h4>
        <p>{desc}</p>
      </div>
      <div className="ar-side">
        <b>{price}</b>
        {was && <s>{was}</s>}
        <button
          type="button"
          className={on ? 'ar-btn ar-remove' : 'ar-btn ar-add'}
          aria-pressed={on}
          onClick={onToggle}
        >
          {on ? '− Remove' : '+ Add'}
        </button>
      </div>
    </div>
  );
}

/** The amber visa card. One destination shows one; a multi-city trip shows one
 *  per country that needs a visa, which is why it is a component and not inline
 *  markup — the copy and the price are the destination's own. */
function VisaCard({ heading, city, country, nationality, addon, on, onToggle, rule, docs }) {
  // What checkout may claim about documents is whatever the builder actually
  // holds — see the note in TripContext. A card that says "already with us"
  // over an empty file is the exact failure this whole flow exists to avoid.
  const status = documentStatus(rule, docs ?? {});
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
          {rule && status.complete ? (
            <>
              {rule.summary} Your documents are already with us — they were collected in the
              builder, before payment — so the application is filed through{' '}
              {rule.partner} as soon as this payment clears, and takes {rule.leadTime} from
              there. {APPLICATION_LANGUAGE}
            </>
          ) : rule ? (
            <>
              {rule.summary} You chose to send your documents later, so {status.done} of{' '}
              {status.total} are with us. They are due {DOCUMENT_DEADLINE}, and you can pay
              now. {DEFERRED_LANGUAGE} Filing through {rule.partner} takes {rule.leadTime}{' '}
              from a complete submission. {APPLICATION_LANGUAGE}
            </>
          ) : (
            <>
              Wakanow can apply for you. Turn it on below and we'll collect your documents by
              email after payment. If you already hold a valid {country} visa, leave it off — we
              will not add it to your price.
            </>
          )}
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
            {addon.meta} ·{' '}
            {rule
              ? status.complete
                ? 'documents already received'
                : `${status.done} of ${status.total} documents received`
              : 'documents collected after payment'}{' '}
            · priced per traveller
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
        {rule ? (
          <>⚠ {rule.refund}</>
        ) : (
          <>
            ⚠ Documents must be submitted within 5 working days of booking. If you do not submit
            in time, Wakanow will contact you before your visa application expires.
          </>
        )}
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
    documentsFor,
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
  /** The live cart gates its pay button on the terms box. Checked to begin with,
   *  so the prototype's flow is never blocked by default. */
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  // Seeded once: the party size is fixed for the life of this screen, since the
  // only way to change it is to go back to the search.
  const [travellers, setTravellers] = useState(() =>
    Array.from({ length: payingTravellers }, (_, i) => ({
      title: 'Mr',
      firstName: '',
      lastName: '',
      middleName: '',
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

  /** The three DOB selects write back into the one authored '15 Mar 1990' string. */
  const dobParts = (value) => {
    const [day = '', month = '', year = ''] = (value || '').split(' ');
    return { day, month, year };
  };
  const updateDob = (index, part, value) => {
    const next = { ...dobParts(travellers[index].dob), [part]: value };
    updateTraveller(index, 'dob', [next.day, next.month, next.year].filter(Boolean).join(' '));
  };

  /** The phone is one string in state. The fused group presents it as a dial
   *  code and a number and writes it back as one, so nothing downstream — the
   *  WhatsApp channel line included — has to know it was split. */
  const dialCode = DIAL_CODES.find((d) => phone.startsWith(d.code))?.code ?? DIAL_CODES[0].code;
  const localNumber = phone.startsWith(dialCode) ? phone.slice(dialCode.length).trim() : phone;
  const setDialCode = (code) => setPhone(`${code} ${localNumber}`.trim());
  const setLocalNumber = (value) => setPhone(`${dialCode} ${value}`.trim());

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

  /* ── The booking summary ────────────────────────────────────────────────
     Line cards and itinerary cards are built from the same priced lines the
     breakdown uses, so a component can never appear in one and not the other. */

  const editInBuilder = () => navigate('/builder');

  /** The line cards for one priced package: one per component it carries. */
  const linesToCards = (lines, ctx) =>
    lines
      .filter((line) => PRODUCTS[line.key])
      .map((line) => {
        const product = PRODUCTS[line.key];
        const detail = ctx[line.key] ?? {};
        return {
          key: ctx.prefix ? `${ctx.prefix}:${line.key}` : line.key,
          icon: product.icon,
          eyebrow: product.eyebrow,
          title: detail.title ?? line.label,
          meta: detail.meta ?? [],
          price: line.bundled,
        };
      });

  /** The fare the rules panel speaks for, and the airline whose rules they are. */
  const rulesFare = isMultiDestination ? trip.legPrices[0].priced.fare : fare;
  const rulesFlight = isMultiDestination ? trip.legPrices[0].priced.flight : flight;
  const rulesPkg = isMultiDestination ? itinerary[0].pkg : selected;
  const fareRules = {
    airline: rulesFlight.name.split(' · ')[0],
    cancellation: rulesFare.refundable || 'Non-refundable',
    lines: [
      `Changes: ${rulesFare.changeable || 'not permitted after ticketing'}.`,
      `Refunds: ${rulesFare.refundable || 'this fare is non-refundable, including for a no-show'}.`,
      rulesPkg.freeCancelDays
        ? `The package may be cancelled free of charge up to ${rulesPkg.freeCancelDays} days before departure.`
        : null,
      `Baggage: ${rulesFare.bags}. Seating: ${rulesFare.seat.toLowerCase()}.`,
      'Name changes are not permitted once the ticket is issued.',
    ].filter(Boolean),
  };

  /** The cabin and baggage row under the timeline — the same facts the rail
   *  used to carry under the flight group. */
  const cabinLine = [
    rulesFare.cabin,
    rulesFare.bags,
    rulesFare.seat,
    rulesFare.changeable || 'No changes',
    rulesFare.refundable || 'Non-refundable',
  ].join(' · ');

  // The depart leg keeps the authored clock exactly. The return leg the live
  // cart demands is derived from it by lib/flights.js's turnaround rule rather
  // than invented, so nothing on the screen contradicts anything else.
  const singleLegs = () => {
    const back = deriveReturnTimes(AUTHORED_OUTBOUND);
    // The live lockup carries flight numbers under the airline. This catalogue
    // holds none, so the slot states the direction and the fare that was bought
    // rather than the record's routing shape, which the authored clock above
    // does not always agree with.
    const detail = `Return · ${fare.label}`;
    const airline = flight.name.split(' · ')[0];
    return [
      {
        badge: 'DEPART',
        date: formatWeekday(search.departDate),
        airline,
        detail,
        leg: {
          ...AUTHORED_OUTBOUND,
          fromCode: search.fromCode,
          fromCity: search.fromCity,
          toCode: destCode,
          toCity: selected.city,
          nextDay: landsNextDay(AUTHORED_OUTBOUND.departTime, AUTHORED_OUTBOUND.arriveTime),
        },
      },
      {
        badge: 'RETURN',
        date: formatWeekday(search.returnDate),
        airline,
        detail,
        leg: {
          ...back,
          durationText: AUTHORED_OUTBOUND.durationText,
          stopLabel: AUTHORED_OUTBOUND.stopLabel,
          fromCode: destCode,
          fromCity: selected.city,
          toCode: search.fromCode,
          toCity: search.fromCity,
          nextDay: landsNextDay(back.departTime, back.arriveTime),
        },
      },
    ];
  };

  /** A multi-city hop has no authored timetable of its own — the one-way flights
   *  are derived — so the timeline reads the destination package's own flight
   *  for its times, and the leg for who is flying where. */
  const legTimeline = (entry, legPriced) => {
    const source =
      entry.pkg.flights.find((f) => `${f.id}-ow` === legPriced.flight.id) ?? entry.pkg.flights[0];
    const card = flightCard(source, { oneWay: true });
    if (!card.outbound) return null;
    return {
      badge: 'DEPART',
      date: formatWeekday(entry.startDate),
      airline: card.airline,
      detail: `One way · ${legPriced.fare.label}`,
      leg: {
        departTime: card.outbound.departTime,
        arriveTime: card.outbound.arriveTime,
        durationText: card.outbound.durationText,
        stopLabel: card.stops.label,
        nextDay: card.outbound.nextDay,
        fromCode: entry.fromCode,
        fromCity: entry.fromCity,
        toCode: entry.toCode,
        toCity: entry.toCity,
      },
    };
  };

  /** The journey home. The last destination's authored return leg IS that
   *  journey — its package flies out of the traveller's own origin — so the
   *  timeline uses it rather than deriving a second time. */
  const homeTimeline = () => {
    const last = itinerary[itinerary.length - 1];
    const card = flightCard(last.pkg.flights[0]);
    if (!card.inbound) return null;
    return {
      badge: 'RETURN',
      date: formatWeekday(last.endDate),
      airline: trip.home.airline,
      detail: `One way · ${trip.legPrices[trip.legPrices.length - 1].priced.fare.label}`,
      leg: {
        departTime: card.inbound.departTime,
        arriveTime: card.inbound.arriveTime,
        durationText: card.inbound.durationText,
        stopLabel: card.stops.label,
        nextDay: card.inbound.nextDay,
        fromCode: last.toCode,
        fromCity: last.toCity,
        toCode: search.fromCode,
        toCity: search.fromCity,
      },
    };
  };

  /** The whole of section 1, as data: a run of line cards, then an itinerary
   *  card, once for a package and once per destination for an itinerary. */
  const summaryBlocks = isMultiDestination
    ? [
        ...trip.legPrices.map(({ entry, priced: legPriced }) => ({
          key: entry.id,
          cards: linesToCards(legPriced.lines, {
            prefix: entry.id,
            flight: {
              title: `${entry.fromCode} → ${entry.toCode} · ${legPriced.flight.name.split(' · ')[0]}`,
              meta: [`${legPriced.fare.label} · ${legPriced.fare.bags}`],
            },
            hotel: {
              title: `${legPriced.hotel.name} · ${plural(entry.nights, 'night')}`,
              meta: [
                `${legPriced.room.name} · ${legPriced.room.board} · ${legPriced.room.beds}`,
                `Check-in ${formatWeekday(entry.startDate)} · Check-out ${formatWeekday(entry.endDate)}`,
              ],
            },
            transfer: { title: entry.pkg.transfer?.name ?? 'Airport transfers' },
            tours: { title: entry.pkg.tours?.label ?? 'Tours' },
          }),
          legs: [legTimeline(entry, legPriced)].filter(Boolean),
        })),
        ...(trip.home
          ? [
              {
                key: 'home',
                cards: [
                  {
                    key: 'home',
                    icon: PRODUCTS.flight.icon,
                    eyebrow: PRODUCTS.flight.eyebrow,
                    title: `${itinerary[itinerary.length - 1].toCode} → ${search.fromCode} · ${trip.home.airline}`,
                    meta: [trip.home.route],
                    price: trip.home.bundled,
                  },
                ],
                legs: [homeTimeline()].filter(Boolean),
              },
            ]
          : []),
      ]
    : [
        {
          key: selected.slug,
          cards: linesToCards(priced.lines, {
            flight: {
              title: `${search.fromCode} → ${destCode} · ${flight.name.split(' · ')[0]}`,
              meta: [`${fare.label} · ${fare.bags}`],
            },
            hotel: {
              title: `${hotel.name} · ${plural(nights, 'night')}`,
              meta: [
                `${room.name} · ${room.board} · ${room.beds}`,
                `Check-in ${formatWeekday(search.departDate)} · Check-out ${formatWeekday(search.returnDate)}`,
              ],
            },
            transfer: { title: selected.transfer?.name ?? 'Airport transfers' },
            tours: { title: selected.tours?.label ?? 'Tours' },
          }),
          legs: singleLegs(),
        },
      ];

  /** The rail's product line, one per flight on the trip. */
  const railProducts = isMultiDestination
    ? [
        ...trip.legPrices.map(({ entry, priced: legPriced }) => {
          const timeline = legTimeline(entry, legPriced);
          return {
            key: entry.id,
            title: `${legPriced.flight.name.split(' · ')[0]} · ${entry.fromCode} → ${entry.toCode}`,
            times: timeline ? `${timeline.leg.departTime} – ${timeline.leg.arriveTime}` : null,
          };
        }),
        ...(trip.home
          ? [
              {
                key: 'home',
                title: `${trip.home.airline} · ${itinerary[itinerary.length - 1].toCode} → ${search.fromCode}`,
                times: (() => {
                  const t = homeTimeline();
                  return t ? `${t.leg.departTime} – ${t.leg.arriveTime}` : null;
                })(),
              },
            ]
          : []),
      ]
    : [
        {
          key: 'flight',
          title: `${flight.name.split(' · ')[0]} · ${search.fromCode} → ${destCode}`,
          times: `${AUTHORED_OUTBOUND.departTime} – ${AUTHORED_OUTBOUND.arriveTime}`,
        },
      ];

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
          <div className="tierstrip">
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
            {/* ── 1 Booking Summary ──────────────────────────────────────── */}
            <Section
              num="1"
              title="Booking Summary"
              note={
                isMultiDestination
                  ? `${itinerary.length} destinations`
                  : `${selected.city} · ${dateLabel}`
              }
            >
              {/* Where a destination's land services were routed through a
                  partner, the summary says so. The traveller chose from that
                  partner's inventory in the builder; a booking summary that
                  did not mention it would read as though the choice had been
                  free. */}
              {(isMultiDestination
                ? itinerary.map((entry) => ({
                    key: entry.id,
                    city: entry.toCity,
                    rule: fulfilmentRule(entry.pkg, search.nationality),
                  }))
                : [
                    {
                      key: selected.slug,
                      city: selected.city,
                      rule: fulfilmentRule(selected, search.nationality),
                    },
                  ]
              )
                .filter((row) => row.rule?.landChannel)
                .map((row) => (
                  <div
                    key={row.key}
                    style={{
                      background: '#FFFDF8',
                      border: '1px solid rgba(199,124,0,.28)',
                      borderRadius: 'var(--r)',
                      padding: '11px 13px',
                      marginBottom: '12px',
                      fontSize: '11.5px',
                      color: '#7A5300',
                      lineHeight: '17px',
                    }}
                  >
                    <b style={{ color: '#8A5A00' }}>
                      {row.city} hotel and transfers booked through {row.rule.partner}
                    </b>
                    <div>
                      {row.rule.partnerNote}. Confirmation comes from Wakanow as usual — you have
                      nothing to arrange with {row.rule.partner} yourself.
                    </div>
                  </div>
                ))}

              {summaryBlocks.map((block, blockIndex) => (
                <Fragment key={block.key}>
                  {block.cards.map((card) => (
                    <LineCard key={card.key} {...card} onRemove={editInBuilder} />
                  ))}
                  {block.legs.length > 0 && (
                    <ItineraryCard
                      legs={block.legs}
                      cabinLine={cabinLine}
                      // The rules belong to the fare, and the fare is the same
                      // one all the way through, so they are stated once — under
                      // the last itinerary card on the trip.
                      rules={blockIndex === summaryBlocks.length - 1 ? fareRules : null}
                    />
                  )}
                </Fragment>
              ))}
            </Section>

            {/* ── 2 Traveller Details ────────────────────────────────────── */}
            <Section num="2" title="Traveller Details">
              <div className="card">
                <div className="loginline">
                  Have an account?{' '}
                  <a href="#" onClick={inert}>
                    Log in for faster checkout
                  </a>
                </div>

                <h3 className="blockhead">Contact Information</h3>
                <p className="blocksub">Booking confirmation will be sent to this email</p>

                <div className="frow">
                  <div className="f">
                    <label htmlFor="contact-email">Email Address</label>
                    <input
                      id="contact-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="f">
                    <label htmlFor="contact-phone">Phone Number</label>
                    {/* Flag, dial code and number read as one bordered control,
                        the way the live field does. */}
                    <div className="phonegroup">
                      <span className="pg-flag" aria-hidden="true">
                        {DIAL_CODES.find((d) => d.code === dialCode)?.flag}
                      </span>
                      <select
                        aria-label="Dial code"
                        value={dialCode}
                        onChange={(e) => setDialCode(e.target.value)}
                      >
                        {DIAL_CODES.map((d) => (
                          <option key={d.code}>{d.code}</option>
                        ))}
                      </select>
                      <input
                        id="contact-phone"
                        value={localNumber}
                        onChange={(e) => setLocalNumber(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {travellers.map((t, i) => {
                  const dob = dobParts(t.dob);
                  return (
                    <Fragment key={i}>
                      <h3 className="travhead">
                        {i === 0 ? 'Lead Traveller' : `Traveller ${i + 1}`}
                        <span>Adult {i + 1}</span>
                      </h3>

                      {/* Upload passport: the blue dashed panel from the live
                          form, with the extraction promise spelled out. */}
                      <div className="uploadpanel">
                        <span className="up-ic" aria-hidden="true">📄</span>
                        <div className="up-copy">
                          <b>Upload passport to auto-fill</b>
                          <span>
                            AI will extract name, DOB, nationality &amp; passport details for this
                            traveller
                          </span>
                        </div>
                        <button type="button" className="up-btn">
                          + Upload
                        </button>
                      </div>

                      <div className="frow4">
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
                          <label htmlFor={`t${i}-first`}>First Name</label>
                          <input
                            id={`t${i}-first`}
                            placeholder="As on passport/ID"
                            value={t.firstName}
                            onChange={(e) => updateTraveller(i, 'firstName', e.target.value)}
                          />
                        </div>
                        <div className="f">
                          <label htmlFor={`t${i}-last`}>Last Name</label>
                          <input
                            id={`t${i}-last`}
                            placeholder="As on passport/ID"
                            value={t.lastName}
                            onChange={(e) => updateTraveller(i, 'lastName', e.target.value)}
                          />
                        </div>
                        <div className="f">
                          <label htmlFor={`t${i}-middle`}>Middle Name (optional)</label>
                          <input
                            id={`t${i}-middle`}
                            placeholder="As on passport/ID"
                            value={t.middleName ?? ''}
                            onChange={(e) => updateTraveller(i, 'middleName', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="frow3">
                        <div className="f">
                          <label htmlFor={`t${i}-dob-day`}>Date of Birth</label>
                          <div className="dobgroup">
                            <select
                              id={`t${i}-dob-day`}
                              aria-label="Day of birth"
                              value={dob.day}
                              onChange={(e) => updateDob(i, 'day', e.target.value)}
                            >
                              <option value="">Day</option>
                              {DAY_OPTIONS.map((d) => (
                                <option key={d}>{d}</option>
                              ))}
                            </select>
                            <select
                              aria-label="Month of birth"
                              value={dob.month}
                              onChange={(e) => updateDob(i, 'month', e.target.value)}
                            >
                              <option value="">Month</option>
                              {MONTHS_SHORT.map((m) => (
                                <option key={m}>{m}</option>
                              ))}
                            </select>
                            <select
                              aria-label="Year of birth"
                              value={dob.year}
                              onChange={(e) => updateDob(i, 'year', e.target.value)}
                            >
                              <option value="">Year</option>
                              {YEAR_OPTIONS.map((y) => (
                                <option key={y}>{y}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="f">
                          <span className="flabel">Gender</span>
                          <div className="pillgroup" role="radiogroup" aria-label={`Gender, traveller ${i + 1}`}>
                            {GENDERS.map((g) => (
                              <button
                                key={g}
                                type="button"
                                role="radio"
                                aria-checked={t.gender === g}
                                className={t.gender === g ? 'pill on' : 'pill'}
                                onClick={() => updateTraveller(i, 'gender', g)}
                              >
                                <i aria-hidden="true" />
                                {g}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="f">
                          <label htmlFor={`t${i}-nationality`}>Nationality</label>
                          <div className="flagselect">
                            <span aria-hidden="true">{FLAGS[t.nationality] ?? '🌍'}</span>
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
                      </div>

                      {i === 0 && (
                        <label className={createProfile ? 'profilepanel on' : 'profilepanel'}>
                          <input
                            type="checkbox"
                            checked={createProfile}
                            onChange={(e) => setCreateProfile(e.target.checked)}
                          />
                          <div>
                            <div className="pp-head">
                              <b>Create a profile for me</b>
                              <span className="primechip">★ Prime Perks</span>
                            </div>
                            <div className="pp-sub">
                              Save your details for faster checkout next time, track bookings from
                              your dashboard, and unlock member-only fares.
                            </div>
                          </div>
                        </label>
                      )}
                    </Fragment>
                  );
                })}

                <label className="terms">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                  />
                  <span>
                    By proceeding, you agree you have read and accepted our{' '}
                    <a href="#" onClick={inert}>
                      Stays
                    </a>{' '}
                    and our{' '}
                    <a href="#" onClick={inert}>
                      Travel Terms &amp; Conditions
                    </a>{' '}
                    and our{' '}
                    <a href="#" onClick={inert}>
                      Privacy Policy
                    </a>
                    .
                  </span>
                </label>
              </div>
            </Section>

            {/* ── 3 Enhance Your Trip ────────────────────────────────────── */}
            <Section num="3" title="Enhance Your Trip" note="All add-ons are optional">
              <div className="card addoncard">
                {offersTransferAddon && (
                  <AddonRow
                    icon={ADDON_ICONS.transfer}
                    title="Careem · private airport transfers"
                    isNew
                    desc={`Both ways · meet and greet at ${destCode} arrivals · up to 4 passengers`}
                    price="₦90,000"
                    was="₦94,000 separately"
                    on={addons.transfer}
                    onToggle={() => toggleAddon('transfer')}
                  />
                )}

                {tourRow && (
                  <AddonRow
                    icon={ADDON_ICONS.safari}
                    title={tourLabel ?? tourRow.title}
                    isNew
                    desc={tourRow.meta}
                    price={naira(tourRow.price)}
                    was={`${naira(tourRow.separate)} separately`}
                    on={addons.safari}
                    onToggle={() => toggleAddon('safari')}
                  />
                )}

                <AddonRow
                  icon={ADDON_ICONS.callReminder}
                  title="Call Reminder"
                  desc="Receive call reminders for your flights and stay updated with schedule changes"
                  price="₦2,500"
                  on={addons.callReminder}
                  onToggle={() => toggleAddon('callReminder')}
                />

                <AddonRow
                  icon={ADDON_ICONS.smsReminder}
                  title="SMS Reminder"
                  desc="Get SMS reminders for your flight and stay informed about changes"
                  price="₦2,000"
                  on={addons.smsReminder}
                  onToggle={() => toggleAddon('smsReminder')}
                />

                <AddonRow
                  icon={ADDON_ICONS.kalabash}
                  title="Kalabash Platinum Travel Card"
                  desc="Purchase the Kalabash USD Platinum card — global payment and cashback. Delivery included."
                  price="₦4,500"
                  on={addons.kalabash}
                  onToggle={() => toggleAddon('kalabash')}
                />
              </div>
            </Section>

            {visaAddon && (
              <VisaCard
                heading="Visa Requirement"
                city={selected.city}
                country={selected.country}
                nationality={search.nationality}
                addon={visaAddon}
                on={addons.visa}
                onToggle={() => toggleAddon('visa')}
                rule={fulfilmentRule(selected, search.nationality)}
                docs={documentsFor(itinerary[0]?.id)}
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
                rule={fulfilmentRule(entry.pkg, search.nationality)}
                docs={documentsFor(entry.id)}
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

            {/* Payment keeps its card but loses its number: the live cart numbers
                exactly three sections, and payment is where this prototype hands
                off rather than a step it owns. */}
            <div className="card">
              <div className="cardhead">
                <h2>
                  <span className="stepnum stepglyph" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path d="M8.5 11V8a3.5 3.5 0 017 0v3" />
                    </svg>
                  </span>
                  Payment
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
            {/* The peach hold banner sits ABOVE the rail card on the live cart,
                not inside a dark summary header. */}
            <div className="holdbar">
              <span aria-hidden="true">⏱</span>
              Price held for <b>{formatClock(secondsLeft)}</b>
            </div>

            <div className="summary">
              <div className="sumbody">
                {railProducts.map((product) => (
                  <div className="railprod" key={product.key}>
                    <span className="rp-ic" aria-hidden="true">
                      <PlaneGlyph />
                    </span>
                    <div>
                      <b>{product.title}</b>
                      {product.times && <span>{product.times}</span>}
                    </div>
                  </div>
                ))}

                <div className="railrule" />

                {/* ── The fare breakdown ───────────────────────────────────
                    The live rail splits a flight fare into Flights / Taxes /
                    Service Charge. This prototype has no tax or service-charge
                    field and inventing one would either move the total or put a
                    made-up split in front of the team, so the block keeps the
                    live LAYOUT — label/value rows, a subtotal, the green fee
                    line, a dashed rule, the add-ons, then the total — and fills
                    it with this product's real component lines. Every figure
                    below is one the screen already computed. */}
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

                {/* The first of the live rail's two totals. Named for what it is
                    — the package before add-ons — rather than a bare "Total"
                    that would be untrue twice on one card. */}
                <div className="btotal">
                  <span>Package total</span>
                  <b>{naira(base)}</b>
                </div>
                <div className="nohidden">No hidden fees — price includes all taxes</div>

                {activeExtras.length > 0 && (
                  <>
                    <div className="railrule dashed" />
                    <h3 className="railhead">Selected add-ons</h3>

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

                    {existingLines.map((item) => (
                      <div className="bline" key={item.key}>
                        <span>{item.label}</span>
                        <b>{naira(extraAmount(item, payingTravellers))}</b>
                      </div>
                    ))}
                  </>
                )}

                <div className="railrule dashed" />

                <div className="bline promoline">
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
                {promoError && <div className="promoerr">That code isn't recognised.</div>}
                {promo && (
                  <div className="bline disc">
                    <span>{PROMOS[promo].label}</span>
                    <b>−{naira(promoDiscount)}</b>
                  </div>
                )}

                <div className="btotal grand">
                  <span>Total</span>
                  <b>{naira(dueTotal)}</b>
                </div>

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
                  <button
                    type="button"
                    className="paybtn"
                    disabled={!acceptedTerms}
                    title={acceptedTerms ? undefined : 'Accept the terms above to continue'}
                    onClick={() => setHandedOff(true)}
                  >
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

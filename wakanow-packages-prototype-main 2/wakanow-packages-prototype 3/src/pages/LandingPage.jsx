import './LandingPage.css';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import DateRangePicker from '../components/DateRangePicker.jsx';
import { FEATURED, VISA_LABEL } from '../data/packages.js';
import { addDays, formatRange } from '../lib/dates.js';
import { naira, nairaShort } from '../lib/format.js';
import { cardPrice } from '../lib/pricing.js';
import { useTrip } from '../state/useTrip.js';
import TripLegs from '../components/TripLegs.jsx';

const COMPONENTS = [
  { key: 'flight', icon: '✈', label: 'Flight' },
  { key: 'hotel', icon: '🏨', label: 'Stay' },
  { key: 'transfer', icon: '🚐', label: 'Transfer' },
  { key: 'tours', icon: '🗺', label: 'Tours' },
];

const CABINS = ['Economy', 'Premium economy', 'Business', 'First'];

const NATIONALITIES = ['Nigeria', 'Ghana', 'United Kingdom', 'United States', 'South Africa'];

const PAX_ROWS = [
  { key: 'adults', title: 'Adults', sub: '12 and over', min: 1 },
  { key: 'children', title: 'Children', sub: '2–11', min: 0 },
  { key: 'infants', title: 'Infants', sub: 'Under 2', min: 0 },
  { key: 'rooms', title: 'Rooms', sub: 'Hotel rooms', min: 1 },
];

const DEST_CHIPS = [
  'All',
  'City Break',
  'Beach & Island',
  'Culture & History',
  'Religious',
  'Family',
  'Romantic',
  'Adventure',
  'Food & Nightlife',
  'Festivals & Events',
  'Safari & Nature',
];

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#004BBE" strokeWidth="2" strokeLinecap="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

/* wakanow.com's product rail sits on top of the search card. Packages is the
   live tab here; the rest are shown so the widget reads as the site's, and are
   inert because this prototype only covers Packages. */
const PRODUCT_TABS = [
  { id: 'flights', label: 'Flights', d: 'M2 14l20-8-6 14-3-5-5-2z' },
  { id: 'hotels', label: 'Hotels', d: 'M3 20V6h8v6h10v8M3 12h8M7 9h.01' },
  { id: 'packages', label: 'Packages', d: 'M3 8h18v12H3zM8 8V5a2 2 0 012-2h4a2 2 0 012 2v3' },
  { id: 'tours', label: 'Tours', d: 'M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z M12 10h.01' },
  { id: 'visa', label: 'Visa', d: 'M3 6h18v12H3zM3 10h18M7 14h4' },
  { id: 'extras', label: 'Travel Add-ons', d: 'M12 5v14M5 12h14' },
];

const TRUST = [
  { value: '2M+', label: 'travellers', d: 'M16 20v-2a4 4 0 00-8 0v2M12 11a4 4 0 100-8 4 4 0 000 8z' },
  { value: '24/7', label: 'support', d: 'M4 14v-3a8 8 0 1116 0v3M4 14a2 2 0 002 2h1v-5H6a2 2 0 00-2 2zm16 0a2 2 0 01-2 2h-1v-5h1a2 2 0 012 2z' },
  { value: 'IATA', label: 'certified', d: 'M12 3l8 3v5c0 4.5-3.3 8.6-8 10-4.7-1.4-8-5.5-8-10V6z' },
  { value: 'Flexible', label: 'payment', d: 'M3 7h18v10H3zM3 11h18' },
];

function TabIcon({ d }) {
  return (
    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { search, setSearch, setDates, dateLabel, nights, travellerLabel } = useTrip();

  const [paxOpen, setPaxOpen] = useState(false);
  const [destChip, setDestChip] = useState('All');

  const paxBtnRef = useRef(null);
  const paxPopRef = useRef(null);

  useEffect(() => {
    if (!paxOpen) return undefined;

    const onPointerDown = (e) => {
      const insideTrigger = paxBtnRef.current?.contains(e.target);
      const insidePopover = paxPopRef.current?.contains(e.target);
      if (!insideTrigger && !insidePopover) setPaxOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setPaxOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [paxOpen]);

  const toggleComponent = (key) =>
    setSearch({ components: { [key]: !search.components[key] } });

  const stepPax = (key, delta, min) =>
    setSearch({ [key]: Math.max(min, search[key] + delta) });

  const sharePackage = (e, name) => {
    e.stopPropagation(); // the card itself navigates; sharing should not
    window.open(
      'https://wa.me/?text=' + encodeURIComponent(name + ' — Wakanow Packages'),
      '_blank',
      'noopener',
    );
  };

  const inert = (e) => e.preventDefault();

  const visiblePackages =
    destChip === 'All' ? FEATURED : FEATURED.filter((pkg) => pkg.vibes.includes(destChip));

  return (
    <div className="pg-landing">
      <nav className="nav">
        <div className="wrap">
          <div className="logo">
            waka<i>now</i>
          </div>
          <div className="navlinks">
            <a href="#" onClick={inert}>Flights</a>
            <a href="#" onClick={inert}>Hotels</a>
            <a href="#" className="on" onClick={inert}>Packages</a>
            <a href="#" onClick={inert}>Tours</a>
            <a href="#" onClick={inert}>Visa</a>
            <a href="#" onClick={inert}>Business</a>
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
            <button className="btn-orange">Log in/Sign up</button>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap">
          <div className="heroline">
            <span className="eyebrow">Your travel shop for the world</span>
            <h1>
              Build your trip. <em>Pay less</em> than booking each part.
            </h1>
            <p className="herosub">
              Flight, stay, transfers and tours in one price — no enquiry forms, and you
              can pay in instalments with Pay Small Small.
            </p>
            <div className="trustrow">
              {TRUST.map(({ value, label, d }, i) => (
                <span className="tr" key={value}>
                  {i > 0 && <span className="trdot">·</span>}
                  <TabIcon d={d} />
                  <b>{value}</b> {label}
                </span>
              ))}
            </div>
          </div>

          <div className="searchbox">
            <div className="prodtabs" role="tablist" aria-label="Product">
              {PRODUCT_TABS.map(({ id, label, d }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={id === 'packages'}
                  className={id === 'packages' ? 'ptab on' : 'ptab'}
                  onClick={inert}
                >
                  <TabIcon d={d} />
                  {label}
                </button>
              ))}
            </div>

          <div className="search">
            <div className="comps">
              {/* The site's segmented control: pills inside a single grey
                  track. The cabin select is a sibling of the track, not a
                  member of it. */}
              <div className="comptrack">
              {COMPONENTS.map(({ key, icon, label }) => {
                const on = search.components[key];
                return (
                  <button
                    key={key}
                    className={on ? 'comp on' : 'comp off'}
                    aria-pressed={on}
                    onClick={() => toggleComponent(key)}
                  >
                    <span className="compcheck" /> {`${icon} ${label}${on ? ' added' : ''}`}
                  </button>
                );
              })}
              </div>
              <select
                className="cabinsel"
                aria-label="Cabin"
                value={search.cabin}
                onChange={(e) => setSearch({ cabin: e.target.value })}
              >
                {CABINS.map((cabin) => (
                  <option key={cabin}>{cabin}</option>
                ))}
              </select>
            </div>

            <div className="fields">
              <button className="field">
                <span className="lab">From</span>
                <span className="val">{`${search.fromCity} (${search.fromCode})`}</span>
                <span className="hint">{search.fromName}</span>
              </button>
              <button className="field">
                <span className="lab">Going to</span>
                <span className="val">{`${search.toCity} (${search.toCode})`}</span>
                <span className="hint">{search.toName}</span>
              </button>
              {/* `.field` has flex:1, but the picker's own anchor div becomes the
                  flex item in its place, so the flex grow is passed to the anchor. */}
              <DateRangePicker
                departDate={search.departDate}
                returnDate={search.returnDate}
                onChange={setDates}
                triggerClassName="field"
                anchorStyle={{ flex: 1 }}
                align="left"
              >
                <span className="lab">Dates</span>
                <span className="val">{dateLabel}</span>
                <span className="hint">{`${nights} night${nights === 1 ? '' : 's'}`}</span>
              </DateRangePicker>
              <button
                className="field"
                ref={paxBtnRef}
                aria-expanded={paxOpen}
                aria-haspopup="dialog"
                onClick={() => setPaxOpen((open) => !open)}
              >
                <span className="lab">Travellers</span>
                <span className="val">{travellerLabel()}</span>
                <span className="hint">{`${search.nationality} passport`}</span>
              </button>
              <button className="searchgo" onClick={() => navigate('/builder')}>
                Search
              </button>
            </div>

            <div className="addDestRow">
              <TripLegs />
            </div>

            <div className={paxOpen ? 'pop open' : 'pop'} ref={paxPopRef}>
              {PAX_ROWS.map(({ key, title, sub, min }) => (
                <div className="poprow" key={key}>
                  <div>
                    <div className="t">{title}</div>
                    <div className="s">{sub}</div>
                  </div>
                  <div className="stepper">
                    <button
                      aria-label={`One fewer ${title.toLowerCase()}`}
                      onClick={() => stepPax(key, -1, min)}
                    >
                      −
                    </button>
                    <span>{search[key]}</span>
                    <button
                      aria-label={`One more ${title.toLowerCase()}`}
                      onClick={() => stepPax(key, 1, min)}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              <div className="natfield">
                <label htmlFor="nat">Passport nationality</label>
                <select
                  id="nat"
                  value={search.nationality}
                  onChange={(e) => setSearch({ nationality: e.target.value })}
                >
                  {NATIONALITIES.map((country) => (
                    <option key={country}>{country}</option>
                  ))}
                </select>
              </div>
              <p className="natnote">
                We check visa requirements for this passport when you search.
              </p>
            </div>
          </div>
          </div>
        </div>
      </header>

      <section className="blk">
        <div className="wrap">
          {/* Sections on wakanow.com are white rounded panels floating on the
              grey page rather than content sitting straight on it. */}
          <div className="panel">
          <div className="secintro">
            <h2>Start from a ready-made trip</h2>
            <button className="seeall" onClick={() => navigate('/packages')}>
              See all packages
            </button>
          </div>
          <p className="secnote">
            Curated by our team. Pick one and it opens with the hotel and flight already
            chosen — change anything or go straight to checkout.
          </p>

          <div className="destchips">
            {DEST_CHIPS.map((chip) => (
              <button
                key={chip}
                className={chip === destChip ? 'dc on' : 'dc'}
                aria-pressed={chip === destChip}
                onClick={() => setDestChip(chip)}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="grid">
            {visiblePackages.map((pkg) => {
              // The package prices itself at its own length, not the search's.
              const { now, was, save } = cardPrice(pkg);
              const route = `/package/${pkg.slug}`;
              return (
                // The whole card is clickable for convenience; the CTA below is the
                // keyboard- and screen-reader-reachable control for the same action.
                <article className="card" key={pkg.slug} onClick={() => navigate(route)}>
                  <div className="plate" style={{ background: pkg.gradient }}>
                    <button
                      className="sharebtn"
                      aria-label="Share"
                      onClick={(e) => sharePackage(e, pkg.name)}
                    >
                      <ShareIcon />
                    </button>
                    <span className="savebadge">{`Save ${nairaShort(save)}`}</span>
                  </div>
                  <div className="cbody">
                    {/* Blue uppercase eyebrow above the name — the live site's
                        card pattern ("443+ HOTELS" over "Dubai"). */}
                    <div className="ceyebrow">{`${pkg.nights} nights · ${pkg.country}`}</div>
                    <h3>{pkg.name}</h3>
                    <div className="dur">
                      {`${formatRange(
                        search.departDate,
                        addDays(search.departDate, pkg.nights),
                      )} · from ${search.fromCity}`}
                    </div>
                    <div className="ops">
                      <div className="op">
                        ✈ <b>{pkg.flights[0].name}</b>
                      </div>
                      <div className="op">
                        🏨 <b>{pkg.hotels[0].name}</b>
                      </div>
                      {pkg.transfer && (
                        <div className="op">
                          🚐 <b>{pkg.transfer.name}</b>
                        </div>
                      )}
                    </div>
                    <div className="incl">
                      {pkg.vibes.map((vibe) => (
                        <span className="vibe" key={vibe}>
                          {vibe}
                        </span>
                      ))}
                      <span className="tag">{VISA_LABEL[pkg.visa]}</span>
                    </div>
                    <div className="ledger">
                      <div className="was">{`${naira(was)} separately`}</div>
                      <div className="nowrow">
                        <span className="now">{naira(now)}</span>
                        <span className="pp">/person</span>
                      </div>
                      <div className="save">{`You save ${naira(save)}`}</div>
                    </div>
                    <button className="cta" onClick={() => navigate(route)}>
                      Start with this trip
                    </button>
                    <div className="ctahint">Opens builder with parts pre-filled</div>
                  </div>
                </article>
              );
            })}
          </div>

          {visiblePackages.length === 0 && (
            <p style={{ margin: '16px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Nothing featured for {destChip} yet — see all packages for more.
            </p>
          )}
          </div>

          {/* The site's promo band: deep navy panel, two-column checklist, an
              inset fare row, and the one solid orange button on the page. */}
          <div className="prime">
            <h2>Save up to 20% on every package</h2>
            <p>
              Join Wakanow Prime and unlock member fares on flights, hotels and holiday
              packages. Average members save ₦180,000 a year.
            </p>
            <div className="primeticks">
              {[
                'Up to 20% off flights & hotels',
                'Priority customer support',
                'Free cancellation on select bookings',
                'Early access to flash sales',
              ].map((t) => (
                <span className="ptick" key={t}>
                  <i>✓</i>
                  {t}
                </span>
              ))}
            </div>
            <div className="primefare">
              <span className="rt">Lagos → Dubai</span>
              <span className="old">₦385,000</span>
              <span className="new">₦308,000</span>
              <span className="sv">Save ₦77K</span>
            </div>
            <button className="primecta" onClick={inert}>
              Join Wakanow Prime
            </button>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          Wakanow Packages · Phase 1 wireframe · Prices are illustrative
        </div>
      </footer>
    </div>
  );
}

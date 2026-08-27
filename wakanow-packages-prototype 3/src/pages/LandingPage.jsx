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
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--wkn-blue-700)" strokeWidth="2" strokeLinecap="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
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
            <button className="btn-ghostw">Log in</button>
            <button className="btn-orange">Sign up</button>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap">
          <div className="heroline">
            <h1>
              Build your trip. <em>Pay less</em> than booking each part.
            </h1>
            <div className="trustpills">
              <span className="tp">No enquiry forms</span>
              <span className="tp">Named airlines & hotels</span>
              <span className="tp">Pay Small Small</span>
            </div>
          </div>

          <div className="search">
            <div className="comps">
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
              <button className="searchgo" onClick={() => navigate('/results')}>
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
      </header>

      <section className="blk">
        <div className="wrap">
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
                  <div className="plate" style={{ background: pkg.plate }}>
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
                    <h3>{pkg.name}</h3>
                    <div className="dur">
                      {`${pkg.nights} nights · ${formatRange(
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
      </section>

      <footer>
        <div className="wrap">
          Wakanow Packages · Phase 1 wireframe · Prices are illustrative
        </div>
      </footer>
    </div>
  );
}

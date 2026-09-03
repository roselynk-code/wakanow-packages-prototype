import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import './PackagesCatalogue.css';
import BackBar from '../components/BackBar.jsx';
import DateRangePicker from '../components/DateRangePicker.jsx';
import { CATALOGUE, VIBES, VISA_LABEL } from '../data/packages.js';
import { addDays, formatRange, formatShort } from '../lib/dates.js';
import { naira, nairaShort } from '../lib/format.js';
import { cardPrice } from '../lib/pricing.js';
import { useTrip } from '../state/useTrip.js';

const NAV = ['Flights', 'Hotels', 'Packages', 'Tours', 'Visa', 'Business'];

/** Twelve trips is past the point where a fixed order is enough to shop by. */
const SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'price-asc', label: 'Price · low to high' },
  { id: 'price-desc', label: 'Price · high to low' },
  { id: 'save', label: 'Biggest saving' },
  { id: 'short', label: 'Shortest trip' },
  { id: 'long', label: 'Longest trip' },
];

export default function PackagesCatalogue() {
  const navigate = useNavigate();
  const { search, setDates } = useTrip();
  const [vibe, setVibe] = useState('All');
  const [sort, setSort] = useState('featured');

  const shown = useMemo(() => {
    const filtered = vibe === 'All' ? CATALOGUE : CATALOGUE.filter((p) => p.vibes.includes(vibe));
    // Price and saving are computed, not stored, so sorting has to price each
    // package first rather than read a field off it.
    const priced = filtered.map((pkg) => ({ pkg, ...cardPrice(pkg) }));
    const by = {
      'price-asc': (a, b) => a.now - b.now,
      'price-desc': (a, b) => b.now - a.now,
      save: (a, b) => b.save - a.save,
      short: (a, b) => a.pkg.nights - b.pkg.nights,
      long: (a, b) => b.pkg.nights - a.pkg.nights,
    }[sort];
    if (by) priced.sort(by);
    return priced.map((entry) => entry.pkg);
  }, [vibe, sort]);

  return (
    <div className="pg-catalogue">
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
          {/* Locale cluster plus the single orange account pill — the live
              wakanow.com header, ported from LandingPage.jsx. */}
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

      <BackBar
        backTo="/"
        backLabel="Back to search"
        trail={[{ label: 'Packages', to: '/' }, { label: 'All ready-made trips' }]}
      />

      <div className="wrap">
        {/* Sections on wakanow.com are white rounded panels floating on the grey
            page. The header, date strip, filters and sort row are one section
            and share this panel; the listing grid below stays on the grey. */}
        <div className="panel">
        <header className="cathead">
          <h1>Ready-made trips, priced for your dates</h1>
          <p>
            Every trip below is put together by our Holidays team — the flight, the hotel and the
            transfers are already chosen. Open one and change any part of it, or go straight to
            checkout.
          </p>
        </header>

        {/* Departure date drives every price on this page, so it sits at the top
            rather than being buried back on the search screen. */}
        <div className="datestrip">
          <DateRangePicker
            departDate={search.departDate}
            returnDate={search.returnDate}
            onChange={setDates}
            triggerClassName="datefield"
            align="left"
          >
            <span className="dl">Departing</span>
            <span className="dv">{formatShort(search.departDate)}</span>
          </DateRangePicker>

          <p className="datenote">
            Each trip runs for its own length from <b>{formatShort(search.departDate)}</b>. Change
            the date and every price here moves with it.
          </p>
        </div>

        <div className="vibes">
          {VIBES.map((v) => (
            <button
              key={v}
              type="button"
              className={`vibe${v === vibe ? ' on' : ''}`}
              onClick={() => setVibe(v)}
              aria-pressed={v === vibe}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="countrow">
          <p className="count">
            {shown.length} {shown.length === 1 ? 'trip' : 'trips'}
            {vibe === 'All' ? '' : ` tagged ${vibe}`}
          </p>
          <label className="sortlab">
            Sort by
            <select className="sortsel" value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
        </div>

        <div className="grid">
          {shown.length === 0 && (
            <div className="empty">
              <p>Nothing in the catalogue is tagged {vibe} yet.</p>
              <button type="button" onClick={() => setVibe('All')}>
                Show every trip
              </button>
            </div>
          )}

          {shown.map((pkg) => (
            <PackageCard
              key={pkg.slug}
              pkg={pkg}
              departDate={search.departDate}
              onOpen={() => navigate(`/package/${pkg.slug}`)}
            />
          ))}
        </div>
      </div>

      <footer>
        <div className="wrap">Wakanow Packages · Prices are illustrative</div>
      </footer>
    </div>
  );
}

function PackageCard({ pkg, departDate, onOpen }) {
  const { now, was, save } = cardPrice(pkg);
  const returnDate = addDays(departDate, pkg.nights);
  const flight = pkg.flights[0];
  const hotel = pkg.hotels[0];

  return (
    <button type="button" className="card" onClick={onOpen}>
      <div className="plate" style={{ background: pkg.gradient }}>
        <span className="savebadge">Save {nairaShort(save)}</span>
        <span className="country">{pkg.country}</span>
        <span className="place">{pkg.city}</span>
      </div>

      <div className="cbody">
        <h3>{pkg.name}</h3>
        <div className="when">
          {pkg.nights} nights · {formatRange(departDate, returnDate)} · from {'Lagos'}
        </div>
        <p className="blurb">{pkg.blurb}</p>

        <div className="ops">
          <span className="op">
            <span className="oi" aria-hidden="true">✈</span>
            <span><b>{flight.name.split(' · ')[0]}</b> · {flight.name.includes('direct') ? 'direct' : flight.name.split(' · ')[1] ?? 'connecting'}</span>
          </span>
          <span className="op">
            <span className="oi" aria-hidden="true">🏨</span>
            <span><b>{hotel.name.split(' · ')[0]}</b>{hotel.name.includes('·') ? ` · ${hotel.name.split(' · ').slice(1).join(' · ')}` : ''}</span>
          </span>
          {pkg.transfer && (
            <span className="op">
              <span className="oi" aria-hidden="true">🚐</span>
              <span><b>{pkg.transfer.name.split(' · ')[0]}</b> included</span>
            </span>
          )}
        </div>

        <div className="tags">
          {pkg.vibes.map((v) => (
            <span key={v} className="tag">{v}</span>
          ))}
          <span className={`tag ${pkg.visa === 'none' ? 'novisa' : 'visa'}`}>
            {VISA_LABEL[pkg.visa]}
          </span>
        </div>

        <div className="ledger">
          <div className="was">{naira(was)} separately</div>
          <div className="nowrow">
            <span className="now">{naira(now)}</span>
            <span className="pp">/person</span>
          </div>
          <div className="save">You save {naira(save)}</div>
          <span className="cta">See this trip</span>
        </div>
      </div>
    </button>
  );
}

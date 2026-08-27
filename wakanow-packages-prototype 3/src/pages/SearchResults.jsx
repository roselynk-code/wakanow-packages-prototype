import { Link, useNavigate } from 'react-router-dom';

import BackBar from '../components/BackBar.jsx';
import { TIERS, findPackage } from '../data/packages.js';
import { naira } from '../lib/format.js';
import { cardPrice } from '../lib/pricing.js';
import { useTrip } from '../state/useTrip.js';
import './SearchResults.css';

/** The WhatsApp glyph, drawn once and shared by all three tier cards. */
const WHATSAPP_PATH =
  'M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2 0 .4-.1.6l-.4.5c-.1.2-.3.3-.1.6.1.3.6 1.1 1.4 1.8 1 .9 1.8 1.1 2 1.3.3.1.4.1.6-.1l.8-.9c.2-.2.4-.2.6-.1l2 1c.2.1.4.2.4.3.1.2.1.7-.1 1.3z';

const NAV_LINKS = ['Flights', 'Hotels', 'Packages', 'Tours', 'Visa'];

/** The card modifier each tier carries in the generated stylesheet. */
const TIER_MODIFIER = { Essential: 't-ess', Premium: 't-pre', Luxury: 't-lux' };

export default function SearchResults() {
  const navigate = useNavigate();
  const { search, nights, dateLabel, travellerSummary, setTier } = useTrip();

  // The tiers hold parts, not totals, so their headline prices are composed at
  // the current trip length — change the dates and all three move.
  const dubai = findPackage('dubai-city-break');
  const curated = cardPrice(dubai, nights);

  const selectTier = (tier) => {
    setTier(tier.name);
    navigate(`/package/${tier.slug}`);
  };

  const shareOnWhatsApp = (tier, price) => {
    const text = `${tier.name} package — ${naira(price)} per person — Wakanow`;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  };

  return (
    <div className="pg-results">
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
                onClick={(e) => e.preventDefault()}
              >
                {link}
              </a>
            ))}
          </div>
          <span className="navauth">Log in</span>
        </div>
      </nav>

      <BackBar
        backTo="/"
        backLabel="Back to search"
        trail={[{ label: 'Packages', to: '/' }, { label: `${search.toCity} — three ways` }]}
      />

      <div className="sumbar">
        <div className="wrap">
          <div className="sumchip">
            <span className="l">From</span>
            <span className="v">
              {search.fromCity} ({search.fromCode})
            </span>
          </div>
          <div className="sumchip">
            <span className="l">To</span>
            <span className="v">
              {search.toCity} ({search.toCode})
            </span>
          </div>
          <div className="sumchip">
            <span className="l">Dates</span>
            <span className="v">
              {dateLabel} · {nights} nights
            </span>
          </div>
          <div className="sumchip">
            <span className="l">Travellers</span>
            <span className="v">{travellerSummary()}</span>
          </div>
          <button className="modify" onClick={() => navigate('/')} aria-label="Modify this search">
            Modify
          </button>
        </div>
      </div>

      <section className="tierzone">
        <div className="wrap">
          <div className="tierhead">
            <h1>Your {search.toCity} trip, three ways</h1>
            <p>Built just now from live prices for your dates. Pick one, or build your own below.</p>
            <div className="visanote">
              ⚠ Visa required for {search.nationality} passports — included as an option in every package
            </div>
          </div>

          <div className="tiers">
            {TIERS.map((tier) => {
              const { now, was, save } = cardPrice(tier, nights);
              const premium = tier.name === 'Premium';
              return (
                <article
                  key={tier.slug}
                  className={`tier ${TIER_MODIFIER[tier.name]}${premium ? ' premium' : ''}`}
                >
                  {premium && <div className="ribbon">Recommended</div>}
                  <div className="tiertop">
                    <div className="tiername">{tier.name}</div>
                    <div className="tiertag">{tier.tagline}</div>
                    <div className="tierprice">
                      <span className="amt">{naira(now)}</span> <span className="pp">/person</span>
                    </div>
                    <div className="tierwas">{naira(was)} booked separately</div>
                    <span className="tiersave">Save {naira(save)}</span>
                  </div>
                  <div className="incl">
                    {tier.inclusions.map((inc) => (
                      <div key={inc.title} className={inc.off ? 'inc off' : 'inc'}>
                        <span className="ic" aria-hidden="true">
                          {inc.icon}
                        </span>
                        <div>
                          <b>{inc.title}</b>
                          <small>{inc.sub}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="tierfoot">
                    <button className="selbtn" onClick={() => selectTier(tier)}>
                      Select {tier.name}
                    </button>
                    <div className="selhint">See everything included</div>
                    <div className="tiershare">
                      <button
                        className="washare"
                        onClick={() => shareOnWhatsApp(tier, now)}
                        aria-label={`Share the ${tier.name} package on WhatsApp`}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d={WHATSAPP_PATH} />
                        </svg>{' '}
                        Share on WhatsApp
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="curated">
            <span className="badge">Curated by Wakanow</span>
            <div>
              <div className="t">Dubai City Break — our Holidays team&apos;s pick for these dates</div>
              <div className="s">
                Emirates direct · Rove Downtown 4★ · Careem transfers · Breakfast · hand-picked tours
              </div>
            </div>
            <div className="price">
              <b>{naira(curated.now)}</b>
              <small>Save {naira(curated.save)}</small>
            </div>
            <button
              onClick={() => navigate('/package/dubai-city-break')}
              aria-label="View the Dubai City Break package"
            >
              View package
            </button>
          </div>

          <div className="divider">
            <span>Or build it yourself</span>
          </div>

          <div className="builderentry">
            <div className="be-icon" aria-hidden="true">
              🛠
            </div>
            <div className="be-body">
              <h3>Build your own package</h3>
              <p>
                Choose your exact hotel, flight, transfers and tours step by step. Everything starts
                included — remove what you don&apos;t need. Bundle savings apply to any two or more
                parts.
              </p>
              <div className="be-steps">
                <span className="be-step">1 · Hotel</span>
                <span className="be-step">2 · Flight</span>
                <span className="be-step">3 · Transfer</span>
                <span className="be-step">4 · Tours</span>
                <span className="be-step">5 · Visa</span>
              </div>
            </div>
            <button className="be-cta" onClick={() => navigate('/builder')}>
              Start building
            </button>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          Wakanow Packages · Phase 1 wireframe · Prices composed from live inventory, illustrative
        </div>
      </footer>
    </div>
  );
}

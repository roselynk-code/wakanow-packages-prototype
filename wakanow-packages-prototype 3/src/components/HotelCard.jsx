import './HotelCard.css';
import { naira } from '../lib/format.js';
import { hotelCard } from '../lib/hotels.js';

/**
 * The hotel results card from wakanow.com/hotels/results, rebuilt.
 *
 * Anatomy, in the order the live card reads:
 *
 *   1. the photo, full-bleed to the card's left corners
 *   2. name over the address, with the rating badge opposite it
 *   3. amenity chips
 *   4. an `N nights` label over the three ways to pay — the same Full / Prime /
 *      Pay Small Small triple the flight results card carries
 *   5. the action, right of the fares
 *
 * The three-way price block is the point it shares with FlightCard: the live
 * site sells Prime by putting the member rate beside the public one at the
 * moment of choosing. On hotels the third column leads on the DEPOSIT
 * ("₦6,152 down") rather than the monthly figure flights show — a stay is
 * quoted as a whole, so what a traveller wants to know is what it takes to hold
 * it. Everything else is the same visual language.
 *
 * In this prototype the action selects the hotel for the package rather than
 * opening a deal page, so it is labelled `Select hotel` / `Selected`, matching
 * FlightCard.
 */

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <circle cx="17" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function HotelCard({
  hotel,
  nights,
  stayPrice,
  plate = 1,
  selected,
  onSelect,
  priceNote,
  children,
}) {
  const card = hotelCard(hotel, { nights, stayPrice });

  return (
    <article className={selected ? 'wk-ht wk-ht-sel' : 'wk-ht'}>
      <div className="wk-ht-main">
        {/* No photography ships with this prototype, so the image is a flat
            gradient plate cycled per position — the same stand-in the builder's
            option cards use. Real imagery drops straight in here: replace the
            plate div with an <img> at the same 190px width and the card's
            left-hand corners keep their radius from .wk-ht-photo. */}
        <div className={`wk-ht-photo wk-ht-p${plate}`} aria-hidden="true" />

        <div className="wk-ht-body">
          <div className="wk-ht-top">
            <div className="wk-ht-id">
              <h3>{card.name}</h3>
              {card.address && <p className="wk-ht-addr">{card.address}</p>}
              {/* The star rating is authored into the name ("· 4★"); the name
                  above has it stripped, so it is shown as marks instead. */}
              {card.rating.stars && (
                <span className="wk-ht-stars" aria-label={`${card.rating.stars} star hotel`}>
                  {Array.from({ length: card.rating.stars }, (_, i) => (
                    <StarIcon key={i} />
                  ))}
                </span>
              )}
            </div>

            {/* Rating badge, top-right: the score square then the word beside
                it. Derived from stars + board — see hotelRating() for why. */}
            <div className="wk-ht-rate">
              <b>{card.rating.score}</b>
              <span>{card.rating.word}</span>
            </div>
          </div>

          {card.amenities.length > 0 && (
            <div className="wk-ht-chips">
              {card.amenities.map((chip) => (
                <span className="wk-ht-chip" key={chip}>
                  {chip}
                </span>
              ))}
            </div>
          )}

          <div className="wk-ht-pay">
            <div className="wk-ht-fares">
              <div className="wk-ht-fare">
                <span className="wk-ht-farel">
                  {nights} night{nights === 1 ? '' : 's'}
                </span>
                <div className="wk-ht-farebox">
                  <b>{naira(card.stayPrice)}</b>
                  <span>Total stay · incl. taxes</span>
                </div>
              </div>

              <div className="wk-ht-fare wk-ht-fare-prime">
                <span className="wk-ht-farel">
                  <i className="wk-ht-primetag">★ Prime</i>
                  <i className="wk-ht-info" title="Member rate — included with WakaPrime">
                    ⓘ
                  </i>
                </span>
                <div className="wk-ht-farebox">
                  <b>{naira(card.prime)}</b>
                  <span>Member exclusive pricing</span>
                </div>
              </div>

              <div className="wk-ht-fare wk-ht-fare-pss">
                <span className="wk-ht-farel">
                  <i className="wk-ht-wallet" aria-hidden="true">
                    <WalletIcon />
                  </i>
                  Pay Small Small
                </span>
                <div className="wk-ht-farebox">
                  <b>
                    {naira(card.pss.down)}
                    <i> down</i>
                  </b>
                  <span>balance in instalments</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className={selected ? 'wk-ht-cta wk-ht-ctad' : 'wk-ht-cta'}
              onClick={onSelect}
              aria-pressed={selected}
            >
              {selected ? 'Selected' : 'Select hotel'}
            </button>
          </div>

          {/* Not on the live card, but the builder has always said what a hotel
              costs booked outside the bundle, and dropping it would lose real
              information from the step. */}
          {priceNote && <p className="wk-ht-note">{priceNote}</p>}
        </div>
      </div>

      {/* The rooms for the chosen hotel open inside its own card, so the second
          choice stays visually attached to the first — the same arrangement
          FlightCard uses for its fare ladder. */}
      {children}
    </article>
  );
}

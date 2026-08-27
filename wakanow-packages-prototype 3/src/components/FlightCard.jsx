import './FlightCard.css';
import { naira } from '../lib/format.js';

/**
 * The flight results card from wakanow.com, rebuilt.
 *
 * Anatomy, in the order the live card reads:
 *
 *   1. airline lockup, with the action on the right
 *   2. three ways to pay side by side — Full Pay, Prime, Pay Small Small
 *   3. the depart and return timelines, split by a hairline
 *   4. baggage chips under each leg
 *   5. the fare condition, and a link into the detail
 *
 * The middle column is the point of the whole component: the live site sells
 * Prime by putting the member fare next to the public one at the moment of
 * choosing, not on a separate page. That is a product decision worth carrying
 * into Packages, which is why it is here rather than being flattened into a
 * single price.
 */

function PlaneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M2 14l20-8-6 14-3-5-5-2z" strokeLinejoin="round" />
    </svg>
  );
}

function BagIcon({ checked }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="5" y="7" width="14" height="14" rx="2" />
      <path d="M9 7V4h6v3" />
      {checked && <path d="M9 12h6" />}
    </svg>
  );
}

/** One direction: the big times at each end, the duration and stop between. */
function Leg({ title, leg, airline, stops }) {
  if (!leg) return null;
  return (
    <div className="wk-fl-leg">
      <div className="wk-fl-legh">
        <b>{title}</b>
        <span>
          {leg.departTime} · {airline}
        </span>
      </div>

      <div className="wk-fl-row">
        <div className="wk-fl-end">
          <b>{leg.departTime}</b>
          <span>{leg.fromCode}</span>
        </div>

        <div className="wk-fl-mid">
          <span className="wk-fl-dur">{leg.durationText}</span>
          <span className="wk-fl-line" aria-hidden="true">
            <i />
            <i />
          </span>
          <span className={stops.count === 0 ? 'wk-fl-stops wk-fl-direct' : 'wk-fl-stops'}>
            {stops.label}
          </span>
        </div>

        <div className="wk-fl-end wk-fl-arrive">
          <b>
            {leg.arriveTime}
            {/* The live card marks a next-day arrival with a superscript. */}
            {leg.nextDay && <sup>+1</sup>}
          </b>
          <span>{leg.toCode}</span>
        </div>
      </div>

      <div className="wk-fl-bags">
        <span className="wk-fl-bag">
          <BagIcon /> 1 × 7KG cabin
        </span>
        <span className="wk-fl-bag">
          <BagIcon checked /> {leg.checked}
        </span>
      </div>
    </div>
  );
}

export default function FlightCard({ card, selected, onSelect, priceNote, children }) {
  const { airline, shape, stops, outbound, inbound, bags, fullPay, prime, pss } = card;

  return (
    <article className={selected ? 'wk-fl wk-fl-sel' : 'wk-fl'}>
      <header className="wk-fl-head">
        {/* The live site serves real marks from
            images-prod.wakanow.com/Images/Airline/Logos/{IATA}.gif — drop them
            in here and this chip becomes the fallback behind them. */}
        <span className="wk-fl-mark" aria-hidden="true">
          <PlaneIcon />
        </span>
        <div className="wk-fl-name">
          <b>{airline}</b>
          {shape && <span>{shape}</span>}
        </div>
        <button
          type="button"
          className={selected ? 'wk-fl-book wk-fl-booked' : 'wk-fl-book'}
          onClick={onSelect}
          aria-pressed={selected}
        >
          {selected ? 'Selected' : 'Select flight'}
        </button>
      </header>

      <div className="wk-fl-fares">
        <div className="wk-fl-fare">
          <span className="wk-fl-farel">Full pay</span>
          <div className="wk-fl-farebox">
            <b>{naira(fullPay)}</b>
            <span>Pay once · total fare</span>
          </div>
        </div>

        <div className="wk-fl-fare wk-fl-fare-prime">
          <span className="wk-fl-farel">
            <i className="wk-fl-primetag">★ Prime</i>
          </span>
          <div className="wk-fl-farebox">
            <b>{naira(prime)}</b>
            <span>Member exclusive pricing</span>
          </div>
        </div>

        <div className="wk-fl-fare wk-fl-fare-pss">
          <span className="wk-fl-farel">Pay Small Small</span>
          <div className="wk-fl-farebox">
            {pss.eligible ? (
              <>
                <b>{naira(pss.monthly)}</b>
                <span>
                  a month × {pss.months} · no interest
                </span>
              </>
            ) : (
              <>
                <b className="wk-fl-off">Not eligible</b>
                <span>{pss.note}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="wk-fl-legs">
        <Leg
          title="Depart"
          leg={{ ...outbound, checked: bags.checked }}
          airline={airline}
          stops={stops}
        />
        {inbound && (
          <Leg
            title="Return"
            leg={{ ...inbound, checked: bags.checked }}
            airline={airline}
            stops={stops}
          />
        )}
      </div>

      <footer className="wk-fl-foot">
        <span className="wk-fl-cond">{card.condition}</span>
        {priceNote && <span className="wk-fl-note">{priceNote}</span>}
      </footer>

      {/* The fare ladder for the selected flight opens inside its own card, so
          the choice and its cabins stay visually attached. */}
      {children}
    </article>
  );
}

import { useState } from 'react';

import './TripLegs.css';
import { CATALOGUE } from '../data/packages.js';
import { formatRange, formatShort } from '../lib/dates.js';
import { useTrip } from '../state/useTrip.js';

/**
 * The multi-destination control that "+ Add another destination" always
 * promised. Sits in the dark search bar, so it is styled for that ground.
 *
 * Legs run back-to-back and each row shows the dates it actually occupies, so
 * adding London after Dubai visibly pushes the trip out rather than quietly
 * overlapping it. The first leg's length is the search date range and is edited
 * with the date picker above, which is why only later legs get a nights stepper.
 */
export default function TripLegs() {
  const { search, itinerary, addLeg, removeLeg, setLegSlug, setLegNights, isMultiDestination } =
    useTrip();
  const [picking, setPicking] = useState(false);

  const used = new Set(itinerary.map((leg) => leg.slug));
  const available = CATALOGUE.filter((pkg) => !used.has(pkg.slug));

  return (
    <div className="wk-legs">
      {/* The leg list now renders for a single-destination trip too. It used to
          appear only once a second city was added, which left no way to change
          the destination without adding and removing one — and the destination
          is what the fulfilment rules turn on, so reaching Qatar or Singapore
          took four clicks through a state nobody wanted. One row, one select. */}
      {itinerary.length > 0 && (
        <ol className="wk-legs-list">
          {itinerary.map((leg) => (
            <li key={leg.id} className="wk-leg">
              <span className="wk-leg-n">{leg.index + 1}</span>

              <select
                className="wk-leg-city"
                value={leg.slug}
                onChange={(event) => setLegSlug(leg.id, event.target.value)}
                aria-label={`Destination ${leg.index + 1}`}
              >
                {CATALOGUE.filter((pkg) => pkg.slug === leg.slug || !used.has(pkg.slug)).map((pkg) => (
                  <option key={pkg.slug} value={pkg.slug}>
                    {pkg.city}
                  </option>
                ))}
              </select>

              <span className="wk-leg-dates">{formatRange(leg.startDate, leg.endDate)}</span>

              <span className="wk-leg-nights">
                <button
                  type="button"
                  onClick={() => setLegNights(leg.id, leg.nights - 1)}
                  disabled={leg.nights <= 1}
                  aria-label={`One night fewer in ${leg.toCity}`}
                >
                  −
                </button>
                <b>
                  {leg.nights}
                  <span className="wk-leg-nlab"> night{leg.nights === 1 ? '' : 's'}</span>
                </b>
                <button
                  type="button"
                  onClick={() => setLegNights(leg.id, leg.nights + 1)}
                  aria-label={`One night more in ${leg.toCity}`}
                >
                  +
                </button>
              </span>

              {leg.isFirst ? (
                <span className="wk-leg-note">from {search.fromCity}</span>
              ) : (
                <button
                  type="button"
                  className="wk-leg-drop"
                  onClick={() => removeLeg(leg.id)}
                  aria-label={`Remove ${leg.toCity} from this trip`}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
          {isMultiDestination && (
          <li className="wk-leg wk-leg-home">
            <span className="wk-leg-n" aria-hidden="true">↩</span>
            <span className="wk-leg-city-static">Back to {search.fromCity}</span>
            {/* An arrival, not a stay — a range would read as a zero-night stop. */}
            <span className="wk-leg-dates">arrive {formatShort(itinerary.at(-1).endDate)}</span>
          </li>
          )}
        </ol>
      )}

      {picking ? (
        <div className="wk-legs-pick">
          <label>
            Add a destination
            <select
              autoFocus
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) addLeg(event.target.value);
                setPicking(false);
              }}
            >
              <option value="" disabled>
                Choose a city…
              </option>
              {available.map((pkg) => (
                <option key={pkg.slug} value={pkg.slug}>
                  {pkg.city} · {pkg.country} · {pkg.nights} nights
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="wk-legs-cancel" onClick={() => setPicking(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="multidest"
          onClick={() => setPicking(true)}
          disabled={available.length === 0}
        >
          + Add another destination
          {isMultiDestination && <span className="wk-legs-count"> · {itinerary.length} cities</span>}
        </button>
      )}
    </div>
  );
}

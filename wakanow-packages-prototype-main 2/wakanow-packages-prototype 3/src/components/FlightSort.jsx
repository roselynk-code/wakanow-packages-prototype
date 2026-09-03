import './FlightSort.css';
import { naira } from '../lib/format.js';
import { SORTS } from '../lib/flights.js';

/**
 * The summary rail that heads wakanow.com's flight results.
 *
 * It is doing two jobs at once, which is what makes it worth copying: it is the
 * sort control, and it is also the answer to "what's the best I can get on each
 * axis" — each cell shows the winning VALUE, not just a label. So a traveller
 * learns the cheapest fare, the shortest hop and the earliest departure without
 * having to sort three times to find out.
 */
export default function FlightSort({ value, onChange, summary, count }) {
  const shown = {
    cheapest: summary.cheapest != null ? naira(summary.cheapest) : '—',
    fastest: summary.fastest ?? '—',
    earliest: summary.earliest ?? '—',
  };

  return (
    <div className="wk-fs">
      <span className="wk-fs-count">
        {count} flight{count === 1 ? '' : 's'} for your dates
      </span>

      <div className="wk-fs-rail" role="tablist" aria-label="Sort flights">
        {SORTS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === value}
            className={id === value ? 'wk-fs-cell wk-fs-on' : 'wk-fs-cell'}
            onClick={() => onChange(id)}
          >
            <span className="wk-fs-l">{label}</span>
            <b className="wk-fs-v">{shown[id]}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

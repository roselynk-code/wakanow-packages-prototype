import { useEffect, useId, useRef, useState } from 'react';

import './DateRangePicker.css';
import {
  addMonths,
  formatMonthLong,
  isBefore,
  monthGrid,
  nightsBetween,
  today,
  toDate,
  WEEKDAY_INITIALS,
} from '../lib/dates.js';

/**
 * A two-month range calendar in a popover.
 *
 * Self-contained: it owns its open state, closes on outside click and Escape,
 * and only reports a range once both ends are chosen. The host supplies the
 * trigger's markup through `children` so the same picker can sit in the dark
 * search bar on the landing page and in the light date field in the builder.
 *
 * Colours are literal rather than tokens because the five screens define
 * different token sets — the picker should look the same on all of them.
 */
export default function DateRangePicker({
  departDate,
  returnDate,
  onChange,
  align = 'left',
  triggerClassName = '',
  anchorClassName = '',
  anchorStyle,
  label = 'Dates',
  children,
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(departDate);
  // While picking, the first click is held here until a second click closes
  // the range. Null means "not mid-selection".
  const [pendingStart, setPendingStart] = useState(null);
  const [hovered, setHovered] = useState(null);

  const anchorRef = useRef(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!anchorRef.current?.contains(event.target)) close();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  });

  function close() {
    setOpen(false);
    setPendingStart(null);
    setHovered(null);
  }

  function toggle() {
    if (open) {
      close();
    } else {
      setViewMonth(departDate);
      setOpen(true);
    }
  }

  function pick(iso) {
    if (!pendingStart) {
      setPendingStart(iso);
      setHovered(null);
      return;
    }
    // Clicking earlier than the pending start restarts the range there rather
    // than producing a backwards one.
    if (isBefore(iso, pendingStart)) {
      setPendingStart(iso);
      return;
    }
    if (iso === pendingStart) return; // a trip needs at least one night
    onChange(pendingStart, iso);
    close();
  }

  // What to paint: the committed range, or the one being drawn right now.
  const rangeStart = pendingStart ?? departDate;
  const rangeEnd = pendingStart ? (hovered && !isBefore(hovered, pendingStart) ? hovered : null) : returnDate;

  const nights = rangeEnd ? nightsBetween(rangeStart, rangeEnd) : nightsBetween(departDate, returnDate);
  const minDate = today();

  return (
    <div className={`wk-dp-anchor ${anchorClassName}`} style={anchorStyle} ref={anchorRef}>
      <button
        type="button"
        className={triggerClassName}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? popoverId : undefined}
      >
        {children}
      </button>

      {open && (
        <div
          className={`wk-dp-pop wk-dp-${align}`}
          id={popoverId}
          role="dialog"
          aria-label={`${label} — choose your travel dates`}
        >
          <div className="wk-dp-head">
            <button
              type="button"
              className="wk-dp-nav"
              onClick={() => setViewMonth(addMonths(viewMonth, -1))}
              disabled={!isBefore(minDate, viewMonth)}
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className="wk-dp-months">
              <span>{formatMonthLong(viewMonth)}</span>
              <span className="wk-dp-month-2">{formatMonthLong(addMonths(viewMonth, 1))}</span>
            </div>
            <button
              type="button"
              className="wk-dp-nav"
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="wk-dp-grids" onMouseLeave={() => setHovered(null)}>
            <Month
              anchorISO={viewMonth}
              start={rangeStart}
              end={rangeEnd}
              minDate={minDate}
              onPick={pick}
              onHover={setHovered}
            />
            <div className="wk-dp-grid-2">
              <Month
                anchorISO={addMonths(viewMonth, 1)}
                start={rangeStart}
                end={rangeEnd}
                minDate={minDate}
                onPick={pick}
                onHover={setHovered}
              />
            </div>
          </div>

          <div className="wk-dp-foot">
            <span className="wk-dp-hint">
              {pendingStart ? 'Now pick your return date' : `${nights} night${nights === 1 ? '' : 's'}`}
            </span>
            <button type="button" className="wk-dp-done" onClick={close}>
              {pendingStart ? 'Cancel' : 'Done'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Month({ anchorISO, start, end, minDate, onPick, onHover }) {
  const cells = monthGrid(anchorISO);
  const anchorMonth = toDate(anchorISO).getMonth();

  return (
    <div className="wk-dp-grid">
      <div className="wk-dp-cap">{formatMonthLong(anchorISO)}</div>
      <div className="wk-dp-dow">
        {WEEKDAY_INITIALS.map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>
      <div className="wk-dp-days">
        {cells.map((cell) => {
          const past = isBefore(cell.iso, minDate);
          const disabled = cell.outside || past;
          const isStart = cell.iso === start;
          const isEnd = end != null && cell.iso === end;
          const inRange =
            end != null && !isBefore(cell.iso, start) && isBefore(cell.iso, end) && !isStart;

          const classes = ['wk-dp-day'];
          if (cell.outside) classes.push('wk-dp-out');
          if (past) classes.push('wk-dp-past');
          if (isStart || isEnd) classes.push('wk-dp-sel');
          if (inRange) classes.push('wk-dp-in');

          return (
            <button
              key={cell.iso + anchorMonth}
              type="button"
              className={classes.join(' ')}
              disabled={disabled}
              onClick={() => onPick(cell.iso)}
              onMouseEnter={() => onHover(cell.iso)}
              aria-label={cell.iso}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

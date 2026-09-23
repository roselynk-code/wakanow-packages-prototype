import { useState } from 'react';

import './RoomGrid.css';
import { naira } from '../lib/format.js';
import { bedFilters, bedLabel, hotelPaySmallSmall, roomsForBed } from '../lib/hotels.js';
import { SHARING_BASIS, roomsFor, tidy } from '../lib/party.js';

/**
 * "Choose your room", from wakanow.com/hotels/<id>, rebuilt.
 *
 * Anatomy, in the order the live block reads:
 *
 *   1. the heading with `N of M rooms shown` opposite it
 *   2. the green assurance banner — taxes and fees are already in the price
 *   3. bed-type filter pills, `All Beds` first and active by default
 *   4. a three-column grid: photo, name, `BEDTYPE · Sleeps N`, a free
 *      cancellation chip, the bordered rate row with its radio, the nightly
 *      price, the Pay Small Small deposit chip, and the reserve action
 *
 * The rate row is the part worth keeping: the live page puts the radio, the
 * rate's conditions and its price in ONE bordered box, so the thing you are
 * choosing and the terms you are choosing it on cannot drift apart. A room with
 * two rates would show two boxes; the catalogue gives each room one.
 *
 * Both the radio and the reserve button select the room — in this prototype
 * that means setting `roomId` on the leg's selection, which is why the action
 * reads `Selected` once it is chosen rather than navigating anywhere.
 */

function TickIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A room rate is per room per night, and a party needs as many rooms as its
 * seated travellers will not fit into one of. So every card prices the STAY —
 * rate × nights × the rooms this party needs of that type — rather than
 * implying one room covers everyone. A family of four looking at a double sees
 * two rooms here, which is the honest answer and the one checkout will charge.
 */
export default function RoomGrid({ hotel, nights, party, selectedRoomId, onSelect }) {
  // Without a party the grid still has to price something, so it falls back to
  // the basis every card in the prototype quotes: two adults in one room.
  const who = party ?? SHARING_BASIS;
  const rooms = hotel.rooms ?? [];
  const filters = bedFilters(rooms);
  const [bedId, setBedId] = useState('all');

  // A hotel swapped under the block can leave a pill selected that its rooms
  // do not offer, so an unknown id falls back to All Beds rather than emptying
  // the grid.
  const active = filters.find((filter) => filter.id === bedId) ?? filters[0];
  const shown = roomsForBed(rooms, active);

  return (
    <section className="wk-rg" aria-label="Choose your room">
      <header className="wk-rg-head">
        <h2>Choose your room</h2>
        <span>
          {shown.length} of {rooms.length} rooms shown
        </span>
      </header>

      <div className="wk-rg-assure">
        <span className="wk-rg-tick" aria-hidden="true">
          <TickIcon />
        </span>
        <div>
          <b>Prices shown are typical for these dates.</b>
          <span>We include all taxes and fees up front — no surprises at checkout.</span>
        </div>
      </div>

      <div className="wk-rg-pills" role="group" aria-label="Bed type">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={filter.id === active.id ? 'wk-rg-pill wk-rg-pillon' : 'wk-rg-pill'}
            aria-pressed={filter.id === active.id}
            onClick={() => setBedId(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="wk-rg-grid" role="radiogroup" aria-label="Room type">
        {shown.map((room, i) => {
          const on = room.id === selectedRoomId;
          const rooms = roomsFor(who, room);
          const stay = tidy(room.nightly * nights * rooms);
          const pss = hotelPaySmallSmall(stay);

          return (
            <article className={on ? 'wk-rg-card wk-rg-cardon' : 'wk-rg-card'} key={room.id}>
              {/* Flat plates stand in for room photography, cycled by position.
                  Real imagery drops in here as an <img> filling .wk-rg-photo —
                  the top corners' radius already lives on that element. */}
              <div className={`wk-rg-photo wk-rg-p${(i % 5) + 1}`} aria-hidden="true" />

              <div className="wk-rg-body">
                <h3>{room.name}</h3>
                <p className="wk-rg-meta">
                  {bedLabel(room.beds).toUpperCase()} · Sleeps {room.sleeps}
                </p>

                {room.refundable && (
                  <span className="wk-rg-free">
                    <TickIcon /> Free cancellation
                  </span>
                )}

                <label className={on ? 'wk-rg-rate wk-rg-rateon' : 'wk-rg-rate'}>
                  <input
                    type="radio"
                    name={`room-${hotel.id}`}
                    checked={on}
                    onChange={() => onSelect(room.id)}
                  />
                  <span className="wk-rg-rname">
                    {room.refundable ? 'Free cancellation' : 'Non-refundable rate'}
                  </span>
                  <span className="wk-rg-rmeta">
                    <PersonIcon /> Sleeps {room.sleeps} · {room.board}
                    {room.refundable ? ' · ✓ Refundable' : ''}
                    {rooms > 1 && ` · ${rooms} rooms for your party`}
                  </span>
                  <b className="wk-rg-rprice">
                    {naira(stay)}
                    <i>
                      {nights} night{nights === 1 ? '' : 's'}
                      {rooms > 1 ? ` × ${rooms} rooms` : ''}
                    </i>
                  </b>
                </label>

                <div className="wk-rg-price">
                  <b>{naira(room.nightly)}</b>
                  <span>/ night per room · incl. taxes</span>
                </div>

                <span className="wk-rg-pss">
                  Pay Small Small <b>{naira(pss.down)}</b> down
                </span>

                <button
                  type="button"
                  className={on ? 'wk-rg-go wk-rg-goon' : 'wk-rg-go'}
                  onClick={() => onSelect(room.id)}
                  aria-pressed={on}
                >
                  {on ? 'Selected' : 'Reserve →'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

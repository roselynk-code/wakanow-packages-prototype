import './VisaCheck.css';

/**
 * wakanow.com's "Check Requirements" panel, from the Visa tab.
 *
 * On the live site this is the *entry* to the visa product: you tell it a
 * passport and a destination and it tells you what you need. Inside a package
 * builder the trip already knows both, so rendering it as a blank lead-capture
 * form would be theatre.
 *
 * What it does here: the destination is stated (the trip decides it) and the
 * passport country is live — it is the passport the application is filed on,
 * and it names itself in every visa card below.
 *
 * ONE THING IT DOES NOT DO, deliberately. The live checker answers "does THIS
 * passport need a visa for THIS country". Phase 1 does not hold that matrix:
 * `pkg.visa` is a property of the destination, written for a Nigerian
 * passport. So this panel reports the requirement the catalogue actually
 * states, and says which passport it is stated for — it does not pretend to
 * re-derive the answer when you change the passport, because a visa answer
 * that is confidently wrong is worse than no answer. A real
 * passport × destination matrix is a Phase 2 integration.
 */
export default function VisaCheck({
  nationality,
  nationalities,
  onNationality,
  destinations,
  needed,
  travellerName,
  email,
}) {
  // Stated for the passport the catalogue was written against, not derived for
  // whichever passport is selected — see the note above.
  const verdict =
    needed.length === 0
      ? 'No visa needed for this trip.'
      : needed.length === 1
        ? `${needed[0].country} requires a visa.`
        : `${needed.length} of these destinations require a visa.`;

  return (
    <div className="wk-vc">
      <h2 className="wk-vc-h">Check Requirements</h2>

      {/* The live panel's passport shortcut. Nothing here reads a document — it
          says what it would fill, and the fields below stay the real input. */}
      <div className="wk-vc-upload">
        <span className="wk-vc-doc" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="11" r="2" />
            <path d="M5.5 16.5c.7-1.6 2-2.4 3.5-2.4s2.8.8 3.5 2.4M15 10h4M15 13.5h4" />
          </svg>
        </span>
        Upload Passport to Auto-Fill
      </div>

      <div className="wk-vc-grid">
        <label className="wk-vc-f">
          <span className="wk-vc-l">Full name</span>
          <input type="text" value={travellerName} readOnly placeholder="As shown on passport" />
        </label>

        <label className="wk-vc-f">
          <span className="wk-vc-l">Email address</span>
          <input type="email" value={email} readOnly placeholder="you@example.com" />
        </label>

        {/* Live: it is the passport every visa application below is filed on,
            and it names itself in each card's copy. */}
        <label className="wk-vc-f wk-vc-live">
          <span className="wk-vc-l">Passport country</span>
          <span className="wk-vc-pin" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.4" />
            </svg>
          </span>
          <select value={nationality} onChange={(e) => onNationality(e.target.value)}>
            {nationalities.map((country) => (
              <option key={country}>{country}</option>
            ))}
          </select>
        </label>

        <label className="wk-vc-f">
          <span className="wk-vc-l">Destination</span>
          <span className="wk-vc-pin" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.4" />
            </svg>
          </span>
          <input type="text" value={destinations} readOnly />
        </label>
      </div>

      {/* The live page's full-width pill. Here it reports rather than submits —
          the answer is already on screen, so the pill states it. */}
      <div className={needed.length ? 'wk-vc-out wk-vc-need' : 'wk-vc-out wk-vc-clear'}>
        {verdict}
      </div>
      <p className="wk-vc-note">
        Phase 1 holds the requirement per destination, written for a Nigeria
        passport. Checking it against the passport above needs the visa matrix —
        a Phase 2 integration.
      </p>
    </div>
  );
}

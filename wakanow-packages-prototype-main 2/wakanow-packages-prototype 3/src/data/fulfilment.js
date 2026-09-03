/**
 * Destination Fulfilment Rules (DFR).
 *
 * Some destinations cannot be fulfilled the ordinary way for some passports.
 * The constraint is never "this destination" on its own and never "this
 * passport" on its own — it is the pair. Qatar is bookable freely on a UK
 * passport and channel-restricted on a Nigerian one, so a rule is keyed on
 * destination × nationality, exactly as the visa matrix is.
 *
 * Two rules exist because two were found in the Holidays team immersion:
 *
 *   Qatar      A Nigerian passport holder cannot be sold Qatari land services
 *              through ordinary inventory. Hotels, transfers and tours must be
 *              booked through Discover Qatar, the state tourism partner, and
 *              the visa is applied for through that same booking. Wakanow is
 *              already a registered Discover Qatar trade partner, so this is a
 *              routing rule rather than a commercial negotiation.
 *
 *   Singapore  No booking-channel restriction — any hotel can be sold. The
 *              visa alone must be filed through an authorised agent; a
 *              traveller cannot lodge it themselves from Nigeria.
 *
 * The two shapes are deliberately different, and the difference is the reason
 * this is a table rather than a Qatar special case. `landChannel` constrains
 * what can be sold; `visaRoute` constrains how the visa is filed. A rule may
 * carry either, both, or a third combination a future destination needs.
 *
 * Every rule states its documents, because the operating decision taken after
 * the immersion is that documents are collected BEFORE payment. The Holidays
 * team receives a complete submission and executes it; it never chases a
 * customer who has already paid.
 *
 * Collected before payment is the DEFAULT, not a wall. A traveller who does not
 * have a stamped bank statement in the room with them cannot produce one by
 * being refused the next button, and a builder that dead-ends there loses a
 * booking it had already won. So the step offers both: send everything now in
 * one go, or say you will send it later and carry a stated deadline. What never
 * moves is the sequencing promise — the application is filed from a COMPLETE
 * file, and the lead time runs from that file, not from the payment.
 */

/* ── The table ──────────────────────────────────────────────────────────── */

export const FULFILMENT_RULES = [
  {
    id: 'qatar-discover-qatar',
    country: 'Qatar',
    /** Passports the rule bites on. Every other passport books normally. */
    nationalities: ['Nigeria', 'Ghana'],
    partner: 'Discover Qatar',
    partnerNote: 'Wakanow is a registered Discover Qatar trade partner',
    /** Land services must come from the partner's inventory. */
    landChannel: true,
    landComponents: ['hotel', 'transfer', 'tours'],
    /** The visa is filed by Wakanow through the partner, with the booking. */
    visaRoute: 'managed',
    leadTime: '4–6 working days',
    summary:
      'Qatar requires visitors on a Nigeria passport to book hotels, transfers and tours through Discover Qatar, the state tourism partner. The visa application is filed through that same booking.',
    documents: [
      { id: 'passport', label: 'Passport bio page', note: 'Valid for at least 6 months beyond travel' },
      { id: 'photo', label: 'Passport photograph', note: 'White background, taken within the last 6 months' },
      { id: 'funds', label: 'Bank statement', note: 'Last 3 months, stamped' },
    ],
    refund:
      'If the application is refused, the visa fee is refunded in full and the land arrangements are cancelled without penalty. Flights follow the airline’s own fare rules.',
  },
  {
    id: 'singapore-authorised-agent',
    country: 'Singapore',
    nationalities: ['Nigeria'],
    partner: 'an authorised visa agent',
    partnerNote: 'Wakanow files through its authorised agent in Singapore',
    /** Hotels are unconstrained — this is the whole point of the second rule. */
    landChannel: false,
    landComponents: [],
    visaRoute: 'agent',
    leadTime: '5–10 working days',
    summary:
      'Singapore does not accept visa applications filed directly by Nigeria passport holders. The application must be lodged by an authorised agent. Hotels, transfers and tours are unrestricted — book anything in the catalogue.',
    documents: [
      { id: 'passport', label: 'Passport bio page', note: 'Valid for at least 6 months beyond travel' },
      { id: 'photo', label: 'Passport photograph', note: '35mm × 45mm, white background' },
      { id: 'form14a', label: 'Completed Form 14A', note: 'We pre-fill it from your booking — you sign it' },
      { id: 'funds', label: 'Bank statement', note: 'Last 3 months, stamped' },
    ],
    refund:
      'If the application is refused, the agent’s filing fee is not recoverable and is stated separately at checkout. The Singapore government fee is refunded. Hotels remain cancellable under their own free-cancellation window.',
  },
];

/* ── Reading the table ──────────────────────────────────────────────────── */

/**
 * The rule for a destination on a given passport, or null when the ordinary
 * flow applies. Null is the common case and every caller treats it as "nothing
 * to say" rather than as an error.
 */
export function fulfilmentRule(pkg, nationality) {
  if (!pkg || !nationality) return null;
  return (
    FULFILMENT_RULES.find(
      (rule) => rule.country === pkg.country && rule.nationalities.includes(nationality),
    ) ?? null
  );
}

/** Every rule that bites on this itinerary, one entry per affected leg. */
export function fulfilmentLegs(itinerary, nationality) {
  return itinerary
    .map((entry) => ({ entry, rule: fulfilmentRule(entry.pkg, nationality) }))
    .filter((row) => row.rule);
}

/**
 * The hotels sellable on this leg.
 *
 * When a rule restricts the channel, only partner inventory can be sold — so
 * the picker shows partner inventory and nothing else. Filtering at the hotel
 * step rather than warning at the visa step is deliberate: a customer who
 * chooses a hotel we cannot sell them, and finds out four steps later, has
 * been wasting their own time with our encouragement.
 */
export function hotelsForLeg(pkg, rule) {
  const all = pkg?.hotels ?? [];
  if (!rule?.landChannel) return { hotels: all, hidden: 0, partner: null };
  const allowed = all.filter((hotel) => hotel.channel === rule.partner);
  return {
    // Never empty the grid: if the catalogue holds no partner inventory for a
    // destination, showing everything is wrong but showing nothing is worse,
    // and the admin gap is the thing to fix.
    hotels: allowed.length ? allowed : all,
    hidden: allowed.length ? all.length - allowed.length : 0,
    partner: rule.partner,
  };
}

/** Whether a component on this leg has to come through the partner. */
export function isChannelled(rule, component) {
  return Boolean(rule?.landChannel && rule.landComponents.includes(component));
}

/**
 * The one-line status a screen shows once documents are in.
 * Phase 1 has no upload backend; the prototype holds the state in the page.
 */
export function documentStatus(rule, uploaded = {}) {
  const total = rule?.documents?.length ?? 0;
  const done = (rule?.documents ?? []).filter((doc) => uploaded[doc.id]).length;
  return { done, total, complete: total > 0 && done === total };
}

/** The documents on a rule that have not arrived yet, in the rule's own order. */
export function outstandingDocuments(rule, uploaded = {}) {
  return (rule?.documents ?? []).filter((doc) => !uploaded[doc.id]);
}

/**
 * Documents that are the same file whatever the destination.
 *
 * A passport bio page is a passport bio page; a Nigerian traveller doing Doha
 * and Singapore in one trip should not upload it twice because our data model
 * happens to key documents by leg. Anything NOT in this list is destination
 * specific — Singapore's Form 14A is the live example — and is collected per
 * leg.
 */
export const SHARED_DOCUMENT_IDS = ['passport', 'photo', 'funds'];

/**
 * How long a traveller has when they choose to send documents later.
 *
 * Stated in one place because three surfaces say it — the visa step, the
 * outstanding-documents note and checkout — and a deadline that drifts between
 * screens is a deadline nobody believes.
 */
export const DOCUMENT_DEADLINE = 'within 5 working days of booking';

/**
 * What deferring actually costs, said plainly.
 *
 * Not a threat and not fine print: the traveller is choosing between two real
 * sequences, and the only honest way to let them choose is to state the second
 * one. The visa is not refused for being late — it simply is not filed until
 * the file is complete, and the lead time starts there.
 */
export const DEFERRED_LANGUAGE =
  'The application is filed once the file is complete, and the lead time runs from that point — not from your payment.';

/**
 * Application, never approval.
 *
 * Every surface that mentions a visa on a managed destination says the same
 * thing, and it says it in one place so that it cannot drift between the
 * builder and the checkout. A travel company that implies an approval it does
 * not control is writing a complaint it will later have to answer.
 */
export const APPLICATION_LANGUAGE =
  'This is a visa application. Approval is decided by the destination’s immigration authority, not by Wakanow, and is never guaranteed.';

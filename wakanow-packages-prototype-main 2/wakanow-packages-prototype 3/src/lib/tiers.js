/**
 * The three auto-generated packages.
 *
 * They used to live on a results page the traveller passed through on the way
 * to the builder. That page is gone, so the tiers now travel with the build in
 * the left rail — which means they have to hold for whatever destination the
 * trip is for, not only the one they were authored against.
 *
 * Two sources, one shape:
 *
 *   Dubai        The three authored tier records, whose figures the mockups and
 *                the PRD both publish (₦1,486,000 / ₦1,728,000 / ₦3,120,000).
 *                Composing these from inventory would move them, and a
 *                published number that quietly changes is worse than a special
 *                case that is written down.
 *
 *   Anywhere     Composed from that destination's own flights, hotels,
 *   else         transfer and tours against the tier rules Commercial owns:
 *                cheapest / mid / dearest, no transfer / shared / private,
 *                no tours / one / all. This is what the engine is specified to
 *                do on every search, and it is why the rail can now sit in
 *                front of a Doha or Singapore trip without lying about it.
 *
 * A composed tier is a starting point rather than a purchase: selecting one
 * fills the build with its choices and leaves the traveller in the builder.
 */

import { findPackage } from '../data/packages.js';
import { fulfilmentRule, hotelsForLeg } from '../data/fulfilment.js';
import { nairaShort } from './format.js';
import { findFare, findRoom, pricePackage } from './pricing.js';

const AUTHORED = [
  { name: 'Essential', mod: 'ess', slug: 'tier-essential', price: 1486000, save: 85000, separate: 1571000 },
  { name: 'Premium', mod: 'pre', slug: 'tier-premium', price: 1728000, save: 186000, separate: 1914000 },
  { name: 'Luxury', mod: 'lux', slug: 'tier-luxury', price: 3120000, save: 358000, separate: 3478000 },
];

/** The destination the authored tiers were composed for. */
const AUTHORED_CITY = 'Dubai';

/* A tier is a bundle, so it composes from bundle-eligible inventory only.
   Composing on price alone picks the cheapest flight on the shelf, which at
   several destinations is the one Commercial flagged out of the bundle — and a
   tier that lands the traveller on "no bundle price on this combination" is
   advertising a saving it then withdraws. */
const eligible = (list = []) => {
  const inBundle = list.filter((item) => item.eligible !== false);
  return inBundle.length ? inBundle : list;
};

const byPrice = (list) => [...eligible(list)].sort((a, b) => a.price - b.price);
const byNightly = (list) => [...eligible(list)].sort((a, b) => a.nightly - b.nightly);

/** Pick from a ranked list: 0 cheapest, 1 middle, 2 dearest. Short lists collapse. */
const pick = (ranked, position) => {
  if (ranked.length === 0) return null;
  if (position === 0) return ranked[0];
  if (position === 2) return ranked[ranked.length - 1];
  return ranked[Math.min(1, ranked.length - 1)];
};

/* A tier's tours are the destination's own experiences. Insurance, baggage and
   the visa are add-ons every package carries and none of them is a tour, so a
   Luxury tier that counted them would advertise "4 curated tours" and deliver
   two tours, a policy and a suitcase. */
const NOT_TOURS = new Set(['visa', 'insurance', 'extrabag']);
const tourAddons = (pkg) => (pkg.addons ?? []).filter((addon) => !NOT_TOURS.has(addon.id));
const visaAddon = (pkg) => (pkg.addons ?? []).find((addon) => addon.id === 'visa');

/** The rules each tier is composed against. Configuration, not code — this is
 *  the shape Commercial owns in admin. */
const RULES = [
  { name: 'Essential', mod: 'ess', tagline: 'The basics, handled', flight: 0, hotel: 0, transfer: false, tours: 0 },
  { name: 'Premium', mod: 'pre', tagline: 'Key logistics covered', flight: 1, hotel: 1, transfer: true, tours: 1 },
  { name: 'Luxury', mod: 'lux', tagline: 'Fully arranged', flight: 2, hotel: 2, transfer: true, tours: 'all' },
];

/** The visa line every tier carries, worded for how the visa is actually filed. */
function visaLine(pkg, nationality) {
  const addon = visaAddon(pkg);
  if (!addon) {
    return pkg.visa === 'none'
      ? { icon: '🛂', title: 'No visa needed', sub: `Not required on a ${nationality} passport`, off: true }
      : { icon: '🛂', title: 'Visa required', sub: 'Arrange before you travel', off: true };
  }
  const rule = fulfilmentRule(pkg, nationality);
  return {
    icon: '🛂',
    title: rule ? `Visa · via ${rule.partner}` : 'Visa · optional add-on',
    sub: rule
      ? `${nairaShort(addon.price)} · documents before payment`
      : `${nairaShort(addon.price)} if you need it`,
  };
}

/** One composed tier: its selection, its price and the lines the rail shows. */
function composeTier(pkg, rule, { nights, nationality }) {
  const flight = pick(byPrice(pkg.flights), rule.flight);
  /* Composition sells from the same shelf the builder does: where a fulfilment
     rule restricts the channel, a tier cannot offer a hotel the traveller is
     not allowed to book. */
  const dfr = fulfilmentRule(pkg, nationality);
  const hotel = pick(byNightly(hotelsForLeg(pkg, dfr).hotels), rule.hotel);
  const tours = tourAddons(pkg);
  const chosenTours =
    rule.tours === 'all' ? tours : rule.tours === 0 ? [] : tours.slice(0, rule.tours);
  const includeTransfer = Boolean(rule.transfer && pkg.transfer);

  const priced = pricePackage(pkg, {
    nights,
    flightId: flight?.id,
    hotelId: hotel?.id,
    includeTransfer,
    includeTours: chosenTours.length > 0,
    addons: chosenTours.map((tour) => tour.id),
  });

  const inclusions = [
    { icon: '✈', title: flight?.name ?? 'Flight', sub: flight?.desc ?? '' },
    { icon: '🏨', title: hotel?.name ?? 'Hotel', sub: hotel?.desc ?? '' },
    includeTransfer
      ? { icon: '🚐', title: pkg.transfer.name, sub: pkg.transfer.desc }
      : { icon: '🚐', title: 'No transfer', sub: 'Arrange your own', off: true },
    chosenTours.length
      ? {
          icon: '🗺',
          title:
            chosenTours.length === 1 ? '1 featured tour' : `${chosenTours.length} curated tours`,
          sub: chosenTours.map((tour) => tour.title.split(' — ')[0]).join(', '),
        }
      : { icon: '🗺', title: 'No tours', sub: 'Explore independently', off: true },
    visaLine(pkg, nationality),
  ];

  return {
    name: rule.name,
    mod: rule.mod,
    tagline: rule.tagline,
    price: priced.bundled,
    separate: priced.separate,
    save: priced.eligible ? priced.separate - priced.bundled : 0,
    inclusions,
    composed: true,
    /** What the builder applies when this tier is chosen. */
    selection: {
      flightId: flight?.id,
      fareId: findFare(flight)?.id,
      hotelId: hotel?.id,
      roomId: findRoom(hotel)?.id,
      includeTransfer,
      includeTours: chosenTours.length > 0,
      tourIds: chosenTours.map((tour) => tour.id),
    },
  };
}

/**
 * The three tiers for one destination at the trip's own length.
 * Dubai returns the authored records; everywhere else is composed.
 */
export function tiersFor(pkg, { nights, nationality }) {
  if (pkg.city === AUTHORED_CITY) {
    return AUTHORED.map((tier) => {
      const record = findPackage(tier.slug);
      return {
        ...tier,
        tagline: record.tagline,
        inclusions: record.inclusions ?? [],
        composed: false,
      };
    });
  }
  return RULES.map((rule) => composeTier(pkg, rule, { nights, nationality }));
}

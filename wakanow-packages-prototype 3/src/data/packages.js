/**
 * The package catalogue.
 *
 * No record stores a total. Each holds its parts — flight options, hotels at a
 * nightly rate, transfer, bundled tours, optional add-ons — and src/lib/pricing.js
 * composes them at the current trip length. That is what lets a change of dates
 * re-price the whole catalogue.
 *
 * The four packages the Phase 1 mockups authored (Dubai, London, Istanbul,
 * Makkah) are decomposed so that at their own duration they reproduce the
 * authored headline figures exactly. The remaining eight destinations, and the
 * option lists behind every package, are curated for this prototype.
 *
 * All prices are illustrative, as the original mockups state.
 */

import { expandVariants } from './variants.js';

/* Destination plates.
 *
 * These stand in for the destination photography the design system calls its
 * number-one hero motif; until real imagery lands in the package, each is one
 * FLAT colour. The system rules gradients out everywhere — "no bluish-purple
 * gradients, no mesh, no patterns" — and a plate may only draw on the two
 * brand ramps, which is why there is no green Zanzibar or maroon Istanbul.
 *
 * CARD is a six-colour cycle. The catalogue lays out three across, so a
 * six-cycle guarantees no two plates touch each other either horizontally or
 * vertically, and the landing strip's first four are all distinct too.
 *
 * SHOTS walks each card colour down its own ramp, so a destination's five
 * gallery tiles read as one set rather than five unrelated blocks.
 */
const CARD = ['#0b4fa8', '#d97315', '#062e66', '#1364c7', '#b45b0e', '#083e85'];

const SHOTS = {
  '#0b4fa8': ['#0b4fa8', '#083e85', '#062e66', '#1364c7', '#2f84e3'],
  '#d97315': ['#d97315', '#b45b0e', '#7f3f06', '#f58220', '#d97315'],
  '#062e66': ['#062e66', '#0b4fa8', '#083e85', '#1364c7', '#062e66'],
  '#1364c7': ['#1364c7', '#0b4fa8', '#083e85', '#2f84e3', '#062e66'],
  '#b45b0e': ['#b45b0e', '#7f3f06', '#d97315', '#f58220', '#b45b0e'],
  '#083e85': ['#083e85', '#062e66', '#0b4fa8', '#1364c7', '#2f84e3'],
};

const plate = (i) => CARD[i % CARD.length];
const shot = (i, n) => SHOTS[CARD[i % CARD.length]][n % 5];

/* ── The four authored packages ─────────────────────────────────────────── */

const DUBAI = {
  slug: 'dubai-city-break',
  name: 'Dubai city break',
  city: 'Dubai',
  code: 'DXB',
  country: 'United Arab Emirates',
  nights: 5,
  vibes: ['City Break', 'Food & Nightlife'],
  visa: 'add-on',
  freeCancelDays: 16,
  blurb: 'Downtown base, direct flights and the desert an hour away.',
  plate: plate(0),
  gallery: [
    { caption: 'Downtown Dubai', plate: shot(0, 0), skyline: true },
    { caption: 'Rove Downtown — deluxe room', plate: shot(0, 1) },
    { caption: 'Rooftop pool', plate: shot(0, 2) },
    { caption: 'Emirates cabin', plate: shot(0, 3) },
    { caption: 'Desert safari', plate: shot(0, 4) },
  ],
  flights: [
    {
      id: 'em', name: 'Emirates · direct both ways',
      desc: 'LOS 22:40 → DXB 07:15 · 7h 35m · 1 bag',
      meta: 'Lagos (LOS) → Dubai (DXB) · Economy · 1 checked bag',
      price: 1142000, separate: 1268000, eligible: true,
      legs: [
        { time: '22:40', place: 'LOS · departs' },
        { time: '07:15', place: 'DXB · arrives' },
        { time: '7h 35m', place: 'Direct outbound' },
        { time: '03:20', place: 'DXB · departs' },
        { time: '08:55', place: 'LOS · arrives' },
      ],
    },
    {
      id: 'ap', name: 'Air Peace · direct both ways',
      desc: 'LOS 09:20 → DXB 19:05 · 7h 45m · 1 bag',
      meta: 'Lagos (LOS) → Dubai (DXB) · Economy · 1 checked bag',
      price: 1036000, separate: 1140000, eligible: true,
    },
    {
      id: 'qr', name: 'Qatar Airways · 1 stop Doha',
      desc: 'LOS 15:10 → DXB 07:40 · 11h 30m · 2 bags',
      meta: 'Lagos (LOS) → Doha (DOH) → Dubai (DXB) · Economy · 2 checked bags',
      price: 1208000, separate: 1332000, eligible: true,
    },
    {
      id: 'tk', name: 'Turkish Airlines · 1 stop Istanbul',
      desc: 'LOS 05:45 → DXB 23:10 · 15h 25m · 2 bags',
      meta: 'Lagos (LOS) → Istanbul (IST) → Dubai (DXB) · Economy · 2 checked bags',
      price: 1395000, separate: 1395000, eligible: false,
    },
  ],
  hotels: [
    {
      id: 'rove', name: 'Rove Downtown Dubai · 4★',
      desc: 'Deluxe room · breakfast · 900m from Dubai Mall',
      meta: 'Deluxe room · breakfast included · 900m from Dubai Mall',
      nightly: 99200, nightlySeparate: 110400, eligible: true,
    },
    {
      id: 'ibis', name: 'Ibis Deira City Centre · 3★',
      desc: 'Standard room · room only · metro at the door',
      meta: 'Standard room · room only · Deira City Centre metro at the door',
      nightly: 70400, nightlySeparate: 79600, eligible: true,
    },
    {
      id: 'addr', name: 'Address Beach Resort · 5★',
      desc: 'Sea view room · half board · private beach',
      meta: 'Sea view room · half board · private beach at JBR',
      nightly: 188000, nightlySeparate: 207600, eligible: true,
    },
    {
      id: 'atl', name: 'Atlantis The Palm · 5★',
      desc: 'Ocean deluxe · breakfast · Aquaventure passes',
      meta: 'Ocean deluxe room · breakfast · Aquaventure waterpark passes',
      nightly: 256800, nightlySeparate: 256800, eligible: false,
    },
  ],
  transfer: {
    name: 'Careem · private airport transfers',
    desc: 'Both ways · meet and greet at arrivals · up to 4 passengers',
    price: 90000, separate: 94000,
  },
  addons: [
    { id: 'visa', title: 'UAE tourist visa', meta: '30-day single entry · Wakanow handles the application · 5–7 working days', price: 96000, separate: 105000 },
    { id: 'safari', title: 'Desert safari with dinner — Arabian Adventures', meta: 'Dune drive, camel ride, BBQ dinner · hotel pickup · 6 hours', price: 62000, separate: 74000 },
    { id: 'burj', title: 'Burj Khalifa: At the Top, levels 124 & 125', meta: 'Timed entry · sunset slot held for package guests', price: 48000, separate: 56000 },
  ],
  itinerary: [
    { title: 'Overnight flight and check-in.', body: 'Land at DXB in the morning, your driver meets you at arrivals, early check-in held at the hotel.' },
    { title: 'Downtown at your own pace.', body: 'Dubai Mall and the fountain show are a ten-minute walk from the hotel.' },
    { title: 'Free day.', body: 'Add the desert safari above if you want it filled — it runs from 15:00 with hotel pickup.' },
    { title: 'Old Dubai.', body: 'Abra crossing to the gold and spice souks in Deira, then back for the evening.' },
    { title: 'Late checkout and departure.', body: 'Room held until 18:00, transfer to DXB for the flight home.' },
  ],
};

const LONDON = {
  slug: 'london-in-autumn',
  name: 'London in autumn',
  city: 'London',
  code: 'LHR',
  country: 'United Kingdom',
  nights: 6,
  vibes: ['City Break', 'Culture & History'],
  visa: 'required',
  freeCancelDays: 21,
  blurb: 'Westminster base, walkable to the West End and the river.',
  plate: plate(1),
  gallery: [
    { caption: 'The South Bank', plate: shot(1, 0) },
    { caption: 'Park Plaza Westminster — river room', plate: shot(1, 1) },
    { caption: 'Borough Market', plate: shot(1, 2) },
    { caption: 'Air Peace cabin', plate: shot(1, 3) },
    { caption: 'West End evening', plate: shot(1, 4) },
  ],
  flights: [
    { id: 'ap', name: 'Air Peace · direct both ways', desc: 'LOS 23:30 → LHR 06:10 · 6h 40m · 2 bags', meta: 'Lagos (LOS) → London Heathrow (LHR) · Economy · 2 checked bags', price: 1560000, separate: 1716000, eligible: true },
    { id: 'ba', name: 'British Airways · direct both ways', desc: 'LOS 22:15 → LHR 05:05 · 6h 50m · 1 bag', meta: 'Lagos (LOS) → London Heathrow (LHR) · Economy · 1 checked bag', price: 1684000, separate: 1852000, eligible: true },
    { id: 'vs', name: 'Virgin Atlantic · direct both ways', desc: 'LOS 23:55 → LHR 06:40 · 6h 45m · 1 bag', meta: 'Lagos (LOS) → London Heathrow (LHR) · Economy · 1 checked bag', price: 1612000, separate: 1774000, eligible: true },
  ],
  hotels: [
    { id: 'ppw', name: 'Park Plaza Westminster Bridge · 4★', desc: 'Studio room · breakfast · opposite Big Ben', meta: 'Studio room · breakfast included · opposite the Houses of Parliament', nightly: 138000, nightlySeparate: 148000, eligible: true },
    { id: 'prem', name: 'Premier Inn County Hall · 3★', desc: 'Standard double · room only · on the South Bank', meta: 'Standard double · room only · South Bank, beside the London Eye', nightly: 92000, nightlySeparate: 101000, eligible: true },
    { id: 'sav', name: 'The Savoy · 5★', desc: 'Deluxe river room · breakfast · Strand', meta: 'Deluxe river-view room · breakfast · on the Strand', nightly: 268000, nightlySeparate: 292000, eligible: true },
  ],
  transfer: { name: 'Blacklane · private airport transfers', desc: 'Both ways · meet and greet at Heathrow · executive saloon', price: 60000, separate: 85000 },
  addons: [
    { id: 'visa', title: 'UK standard visitor visa', meta: 'Wakanow prepares and submits the application · biometrics appointment booked for you', price: 168000, separate: 195000 },
    { id: 'oyster', title: 'Travelcard for the week', meta: 'Zones 1–2 · loaded and posted before you fly', price: 22000, separate: 27000 },
    { id: 'tower', title: 'Tower of London and Crown Jewels', meta: 'Timed entry · skip the ticket queue', price: 34000, separate: 41000 },
  ],
  itinerary: [
    { title: 'Overnight flight and check-in.', body: 'Land at Heathrow early, driver meets you, rooms held for an early check-in on the South Bank.' },
    { title: 'Westminster and the river.', body: 'Parliament, the Abbey and a walk over the bridge — all of it within ten minutes of the hotel.' },
    { title: 'Museums.', body: 'The British Museum and the National Gallery are both free and both a short tube ride away.' },
    { title: 'Markets and the East End.', body: 'Borough Market for lunch, Spitalfields and Brick Lane in the afternoon.' },
    { title: 'Shopping and a show.', body: 'Oxford Street in the day, the West End in the evening.' },
    { title: 'Late checkout and departure.', body: 'Bags held after checkout, transfer to Heathrow for the evening flight.' },
  ],
};

const ISTANBUL = {
  slug: 'istanbul-long-weekend',
  name: 'Istanbul long weekend',
  city: 'Istanbul',
  code: 'IST',
  country: 'Türkiye',
  nights: 4,
  vibes: ['Culture & History', 'Food & Nightlife'],
  visa: 'add-on',
  freeCancelDays: 14,
  blurb: 'Old city on foot, the Bosphorus by boat, four nights is enough.',
  plate: plate(2),
  gallery: [
    { caption: 'Sultanahmet at dusk', plate: shot(2, 0) },
    { caption: 'Ramada Old City — deluxe room', plate: shot(2, 1) },
    { caption: 'The Grand Bazaar', plate: shot(2, 2) },
    { caption: 'Bosphorus ferry', plate: shot(2, 3) },
    { caption: 'Meze and raki', plate: shot(2, 4) },
  ],
  flights: [
    { id: 'tk', name: 'Turkish Airlines · direct both ways', desc: 'LOS 21:40 → IST 05:30 · 6h 50m · 2 bags', meta: 'Lagos (LOS) → Istanbul (IST) · Economy · 2 checked bags', price: 902000, separate: 990000, eligible: true },
    { id: 'ms', name: 'EgyptAir · 1 stop Cairo', desc: 'LOS 14:20 → IST 06:15 · 12h 55m · 2 bags', meta: 'Lagos (LOS) → Cairo (CAI) → Istanbul (IST) · Economy · 2 checked bags', price: 786000, separate: 864000, eligible: true },
    { id: 'pc', name: 'Pegasus · 1 stop via Doha', desc: 'LOS 16:05 → IST 11:40 · 15h 35m · 1 bag', meta: 'Lagos (LOS) → Doha (DOH) → Istanbul (SAW) · Economy · 1 checked bag', price: 704000, separate: 704000, eligible: false },
  ],
  hotels: [
    { id: 'ram', name: 'Ramada Old City · 4★', desc: 'Deluxe room · breakfast · walk to the Blue Mosque', meta: 'Deluxe room · breakfast included · ten minutes from the Blue Mosque', nightly: 85000, nightlySeparate: 94000, eligible: true },
    { id: 'sura', name: 'Sura Hagia Sophia · 5★', desc: 'Superior room · breakfast · rooftop terrace', meta: 'Superior room · breakfast · rooftop terrace over Sultanahmet', nightly: 128000, nightlySeparate: 141000, eligible: true },
    { id: 'karak', name: 'Karaköy Rooms · 3★', desc: 'Studio · room only · Galata side', meta: 'Studio · room only · Karaköy, below the Galata Tower', nightly: 58000, nightlySeparate: 66000, eligible: true },
  ],
  transfer: { name: 'Istanbul Tour Studio · private transfers', desc: 'Both ways · meet and greet at IST · English-speaking driver', price: 60000, separate: 70000 },
  addons: [
    { id: 'visa', title: 'Türkiye e-visa', meta: 'Single entry · Wakanow applies on your behalf · 2–3 working days', price: 38000, separate: 46000 },
    { id: 'bosph', title: 'Bosphorus dinner cruise', meta: 'Two hours · dinner and live music · hotel pickup', price: 46000, separate: 55000 },
    { id: 'hamam', title: 'Historic hamam, Çemberlitaş', meta: 'Traditional scrub and foam wash · 90 minutes', price: 32000, separate: 39000 },
  ],
  itinerary: [
    { title: 'Overnight flight and check-in.', body: 'Land at IST at dawn, transfer into the old city, room held for early check-in.' },
    { title: 'Sultanahmet on foot.', body: 'Hagia Sophia, the Blue Mosque and the Basilica Cistern are all within one square.' },
    { title: 'Bazaars and the Bosphorus.', body: 'Grand Bazaar in the morning, ferry to the Asian side in the afternoon.' },
    { title: 'Galata and Karaköy.', body: 'Cross the bridge for the tower, then the coffee houses and meze bars below it.' },
    { title: 'Late checkout and departure.', body: 'Bags held after checkout, transfer to IST for the evening flight.' },
  ],
};

const UMRAH = {
  slug: 'makkah-madinah-umrah',
  name: 'Makkah & Madinah Umrah',
  city: 'Makkah',
  code: 'JED',
  country: 'Saudi Arabia',
  nights: 10,
  vibes: ['Religious', 'Family'],
  visa: 'included',
  freeCancelDays: 30,
  blurb: 'Ten nights across both cities, walking distance to the Haram.',
  plate: plate(3),
  gallery: [
    { caption: 'The Haram at night', plate: shot(3, 0) },
    { caption: 'Swissôtel Makkah — family room', plate: shot(3, 1) },
    { caption: "Al-Masjid an-Nabawi, Madinah", plate: shot(3, 2) },
    { caption: 'Saudia cabin', plate: shot(3, 3) },
    { caption: 'Between the two cities', plate: shot(3, 4) },
  ],
  flights: [
    { id: 'sv', name: 'Saudia · 1 stop', desc: 'LOS 13:50 → JED 04:20 · 11h 30m · 2 bags · Zamzam allowance', meta: 'Lagos (LOS) → Jeddah (JED) · Economy · 2 checked bags · Zamzam allowance', price: 1268000, separate: 1395000, eligible: true },
    { id: 'ms', name: 'EgyptAir · 1 stop Cairo', desc: 'LOS 14:20 → JED 06:05 · 12h 45m · 2 bags', meta: 'Lagos (LOS) → Cairo (CAI) → Jeddah (JED) · Economy · 2 checked bags', price: 1142000, separate: 1256000, eligible: true },
    { id: 'et', name: 'Ethiopian · 1 stop Addis', desc: 'LOS 15:35 → JED 08:40 · 14h 05m · 2 bags', meta: 'Lagos (LOS) → Addis Ababa (ADD) → Jeddah (JED) · Economy · 2 checked bags', price: 1084000, separate: 1192000, eligible: true },
  ],
  hotels: [
    { id: 'swiss', name: 'Swissôtel Makkah · 5★ + Madinah Hilton', desc: 'Both cities · family room · half board · Haram-facing', meta: 'Family room · half board · Clock Tower complex, steps from the Haram', nightly: 142000, nightlySeparate: 155100, eligible: true },
    { id: 'pull', name: 'Pullman Zamzam · 5★ + Anwar Al Madinah', desc: 'Both cities · twin room · half board', meta: 'Twin room · half board · Abraj Al Bait, Haram courtyard entrance', nightly: 168000, nightlySeparate: 184000, eligible: true },
    { id: 'elaf', name: 'Elaf Al Mashaer · 4★ + Madinah Movenpick', desc: 'Both cities · quad room · room only', meta: 'Quad room · room only · shuttle to the Haram every fifteen minutes', nightly: 96000, nightlySeparate: 107000, eligible: true },
  ],
  transfer: { name: 'Al Mashaer · ground transport', desc: 'Jeddah airport, Makkah to Madinah, and return · air-conditioned coach', price: 160000, separate: 200000 },
  addons: [
    { id: 'ziyarat', title: 'Guided ziyarat in both cities', meta: 'Historic sites around Makkah and Madinah · English and Hausa guides', price: 88000, separate: 104000 },
    { id: 'laundry', title: 'Ihram and laundry service', meta: 'Two ihram sets per pilgrim · laundry throughout the stay', price: 34000, separate: 42000 },
  ],
  itinerary: [
    { title: 'Depart Lagos.', body: 'Evening departure, connecting onward to Jeddah overnight.' },
    { title: 'Arrive Jeddah, transfer to Makkah.', body: 'Met at the airport, coach to the hotel, first Umrah performed after rest.' },
    { title: 'Days in Makkah.', body: 'Prayers at the Haram, with guided ziyarat available on one of the free mornings.' },
    { title: 'Transfer to Madinah.', body: 'Coach to Madinah, check in near Al-Masjid an-Nabawi.' },
    { title: 'Days in Madinah.', body: 'Prayers at the Prophet’s Mosque, Quba and Uhud on the ziyarat route.' },
    { title: 'Return to Jeddah and fly home.', body: 'Coach to JED, Zamzam collected at the airport, overnight flight to Lagos.' },
  ],
};

/* ── Curated for this prototype ─────────────────────────────────────────── */

const ZANZIBAR = {
  slug: 'zanzibar-beach-escape',
  name: 'Zanzibar beach escape',
  city: 'Zanzibar', code: 'ZNZ', country: 'Tanzania',
  nights: 7, vibes: ['Beach & Island', 'Romantic'], visa: 'add-on', freeCancelDays: 21,
  blurb: 'Seven nights on the north coast, with Stone Town on the way through.',
  plate: plate(4),
  gallery: [
    { caption: 'Nungwi beach', plate: shot(4, 0) },
    { caption: 'Zuri Zanzibar — garden villa', plate: shot(4, 1) },
    { caption: 'Stone Town doorways', plate: shot(4, 2) },
    { caption: 'Dhow at sunset', plate: shot(4, 3) },
    { caption: 'Spice farm', plate: shot(4, 4) },
  ],
  flights: [
    { id: 'kq', name: 'Kenya Airways · 1 stop Nairobi', desc: 'LOS 13:15 → ZNZ 06:50 · 12h 35m · 2 bags', meta: 'Lagos (LOS) → Nairobi (NBO) → Zanzibar (ZNZ) · Economy · 2 checked bags', price: 1180000, separate: 1295000, eligible: true },
    { id: 'et', name: 'Ethiopian · 1 stop Addis', desc: 'LOS 15:35 → ZNZ 09:20 · 13h 45m · 2 bags', meta: 'Lagos (LOS) → Addis Ababa (ADD) → Zanzibar (ZNZ) · Economy · 2 checked bags', price: 1096000, separate: 1204000, eligible: true },
    { id: 'qr', name: 'Qatar Airways · 1 stop Doha', desc: 'LOS 15:10 → ZNZ 13:05 · 17h 55m · 2 bags', meta: 'Lagos (LOS) → Doha (DOH) → Zanzibar (ZNZ) · Economy · 2 checked bags', price: 1348000, separate: 1482000, eligible: true },
  ],
  hotels: [
    { id: 'zuri', name: 'Zuri Zanzibar · 5★', desc: 'Garden villa · breakfast · Kendwa beachfront', meta: 'Garden villa · breakfast included · on the sand at Kendwa', nightly: 128000, nightlySeparate: 141000, eligible: true },
    { id: 'ess', name: 'Essque Zalu · 4★', desc: 'Sea view suite · half board · Nungwi', meta: 'Sea view suite · half board · Nungwi, north coast', nightly: 104000, nightlySeparate: 115000, eligible: true },
    { id: 'ston', name: 'Emerson on Hurumzi · 3★', desc: 'Heritage room · breakfast · Stone Town', meta: 'Heritage room · breakfast · in the middle of Stone Town', nightly: 66000, nightlySeparate: 74000, eligible: true },
  ],
  transfer: { name: 'Island transfers', desc: 'Airport to the north coast and back · air-conditioned car · about 90 minutes', price: 48000, separate: 56000 },
  addons: [
    { id: 'visa', title: 'Tanzania e-visa', meta: 'Single entry · Wakanow applies on your behalf · 5–10 working days', price: 52000, separate: 62000 },
    { id: 'spice', title: 'Spice farm and Stone Town tour', meta: 'Half day · guided · lunch included', price: 38000, separate: 46000 },
    { id: 'safari', title: 'Safari Blue day trip', meta: 'Dhow sailing, snorkelling and a seafood lunch on the sandbank', price: 54000, separate: 65000 },
  ],
  itinerary: [
    { title: 'Fly out and connect.', body: 'Afternoon departure from Lagos with an overnight connection.' },
    { title: 'Arrive and transfer north.', body: 'Met at ZNZ, driven up to the north coast, rest of the day on the beach.' },
    { title: 'Beach days.', body: 'Nothing scheduled — swimming, diving and dhow trips arranged through the hotel.' },
    { title: 'Stone Town and the spice farms.', body: 'A half day inland for the plantations and the old town, back for sunset.' },
    { title: 'Check out and fly home.', body: 'Late checkout, transfer to the airport for the evening connection.' },
  ],
};

const CAPETOWN = {
  slug: 'cape-town-and-the-winelands',
  name: 'Cape Town & the Winelands',
  city: 'Cape Town', code: 'CPT', country: 'South Africa',
  nights: 7, vibes: ['Adventure', 'Food & Nightlife'], visa: 'required', freeCancelDays: 21,
  blurb: 'The mountain, the peninsula and two days out in Stellenbosch.',
  plate: plate(5),
  gallery: [
    { caption: 'Table Mountain from the bay', plate: shot(5, 0) },
    { caption: 'The Silo — loft room', plate: shot(5, 1) },
    { caption: 'Boulders Beach', plate: shot(5, 2) },
    { caption: 'Stellenbosch vineyards', plate: shot(5, 3) },
    { caption: 'V&A Waterfront', plate: shot(5, 4) },
  ],
  flights: [
    { id: 'sa', name: 'South African Airways · 1 stop Johannesburg', desc: 'LOS 08:40 → CPT 19:15 · 10h 35m · 2 bags', meta: 'Lagos (LOS) → Johannesburg (JNB) → Cape Town (CPT) · Economy · 2 checked bags', price: 1420000, separate: 1562000, eligible: true },
    { id: 'et', name: 'Ethiopian · 1 stop Addis', desc: 'LOS 15:35 → CPT 12:40 · 16h 05m · 2 bags', meta: 'Lagos (LOS) → Addis Ababa (ADD) → Cape Town (CPT) · Economy · 2 checked bags', price: 1284000, separate: 1412000, eligible: true },
    { id: 'ke', name: 'Kenya Airways · 1 stop Nairobi', desc: 'LOS 13:15 → CPT 11:55 · 17h 40m · 2 bags', meta: 'Lagos (LOS) → Nairobi (NBO) → Cape Town (CPT) · Economy · 2 checked bags', price: 1356000, separate: 1490000, eligible: true },
  ],
  hotels: [
    { id: 'silo', name: 'The Silo · 5★', desc: 'Loft room · breakfast · V&A Waterfront', meta: 'Loft room · breakfast included · in the grain silo above the Zeitz museum', nightly: 156000, nightlySeparate: 172000, eligible: true },
    { id: 'cadog', name: 'Cape Cadogan · 4★', desc: 'Classic room · breakfast · Gardens', meta: 'Classic room · breakfast · Gardens, below the mountain', nightly: 98000, nightlySeparate: 109000, eligible: true },
    { id: 'lodge', name: 'Camps Bay Retreat · 4★', desc: 'Garden suite · breakfast · Camps Bay', meta: 'Garden suite · breakfast · above Camps Bay beach', nightly: 122000, nightlySeparate: 135000, eligible: true },
  ],
  transfer: { name: 'Private transfers and a Winelands day', desc: 'Airport both ways, plus a driver for the Stellenbosch day', price: 74000, separate: 88000 },
  addons: [
    { id: 'visa', title: 'South Africa visitor visa', meta: 'Wakanow prepares the application and books your appointment', price: 96000, separate: 118000 },
    { id: 'cable', title: 'Table Mountain cableway, open return', meta: 'Skip the ticket queue · valid on any clear day of your stay', price: 24000, separate: 30000 },
    { id: 'penin', title: 'Cape Peninsula full-day tour', meta: 'Chapman’s Peak, Boulders Beach penguins and the Cape of Good Hope', price: 58000, separate: 70000 },
  ],
  itinerary: [
    { title: 'Fly out via Johannesburg.', body: 'Morning departure from Lagos, arriving into Cape Town the same evening.' },
    { title: 'The mountain.', body: 'Cableway up Table Mountain early, before the cloud comes in, then the Waterfront.' },
    { title: 'The peninsula.', body: 'Chapman’s Peak drive, the penguins at Boulders and the Cape itself.' },
    { title: 'The Winelands.', body: 'A driver takes you out to Stellenbosch and Franschhoek for the day.' },
    { title: 'Free days in the city.', body: 'Bo-Kaap, the Zeitz museum, and the beaches at Camps Bay and Clifton.' },
    { title: 'Check out and fly home.', body: 'Late checkout, transfer to CPT for the connection north.' },
  ],
};

const SAFARI = {
  slug: 'nairobi-and-masai-mara',
  name: 'Nairobi & Masai Mara safari',
  city: 'Masai Mara', code: 'NBO', country: 'Kenya',
  nights: 6, vibes: ['Safari & Nature', 'Adventure'], visa: 'add-on', freeCancelDays: 30,
  blurb: 'Two nights in the city, four in the Mara, light aircraft between them.',
  plate: plate(6),
  gallery: [
    { caption: 'The Mara at first light', plate: shot(6, 0) },
    { caption: 'Mara Serena — tented room', plate: shot(6, 1) },
    { caption: 'Game drive', plate: shot(6, 2) },
    { caption: 'Light aircraft to the reserve', plate: shot(6, 3) },
    { caption: 'Nairobi skyline', plate: shot(6, 4) },
  ],
  flights: [
    { id: 'kq', name: 'Kenya Airways · direct both ways', desc: 'LOS 13:15 → NBO 22:05 · 5h 50m · 2 bags', meta: 'Lagos (LOS) → Nairobi (NBO) · Economy · 2 checked bags', price: 986000, separate: 1084000, eligible: true },
    { id: 'et', name: 'Ethiopian · 1 stop Addis', desc: 'LOS 15:35 → NBO 07:40 · 10h 05m · 2 bags', meta: 'Lagos (LOS) → Addis Ababa (ADD) → Nairobi (NBO) · Economy · 2 checked bags', price: 884000, separate: 972000, eligible: true },
    { id: 'rw', name: 'RwandAir · 1 stop Kigali', desc: 'LOS 11:20 → NBO 23:15 · 11h 55m · 2 bags', meta: 'Lagos (LOS) → Kigali (KGL) → Nairobi (NBO) · Economy · 2 checked bags', price: 842000, separate: 842000, eligible: false },
  ],
  hotels: [
    { id: 'serena', name: 'Mara Serena Safari Lodge · 5★ + Nairobi Serena', desc: 'Both stays · full board in the Mara · game drives included', meta: 'Full board in the reserve, bed and breakfast in Nairobi · twice-daily game drives', nightly: 172000, nightlySeparate: 190000, eligible: true },
    { id: 'gov', name: "Governors' Camp · 5★ + Sankara Nairobi", desc: 'Both stays · full board · riverside tents', meta: 'Riverside tented suite, full board · Sankara in Westlands for the city nights', nightly: 214000, nightlySeparate: 236000, eligible: true },
    { id: 'sopa', name: 'Mara Sopa Lodge · 4★ + Eka Hotel Nairobi', desc: 'Both stays · full board in the Mara', meta: 'Full board at Sopa on the Oloolaimutia gate side · Eka in Nairobi', nightly: 128000, nightlySeparate: 142000, eligible: true },
  ],
  transfer: { name: 'Light aircraft and all ground transfers', desc: 'Nairobi ↔ Mara by air, plus airport and lodge transfers', price: 210000, separate: 245000 },
  addons: [
    { id: 'visa', title: 'Kenya electronic travel authorisation', meta: 'Wakanow applies on your behalf · 3–5 working days', price: 42000, separate: 52000 },
    { id: 'balloon', title: 'Balloon safari with champagne breakfast', meta: 'Dawn launch over the reserve · about an hour aloft', price: 286000, separate: 330000 },
    { id: 'elephant', title: 'Sheldrick elephant orphanage and Giraffe Centre', meta: 'Half day in Nairobi · private guide', price: 36000, separate: 44000 },
  ],
  itinerary: [
    { title: 'Fly to Nairobi.', body: 'Afternoon departure, arriving late evening. Transfer to the city hotel.' },
    { title: 'Nairobi.', body: 'The elephant orphanage and the Giraffe Centre, or the national park on the city edge.' },
    { title: 'Fly into the Mara.', body: 'Light aircraft from Wilson airport, met on the airstrip, afternoon game drive.' },
    { title: 'Days in the reserve.', body: 'Game drives at dawn and late afternoon, with the middle of the day at the lodge.' },
    { title: 'Back to Nairobi and home.', body: 'Morning drive, midday flight out of the reserve, evening connection to Lagos.' },
  ],
};

const ACCRA = {
  slug: 'accra-weekender',
  name: 'Accra weekender',
  city: 'Accra', code: 'ACC', country: 'Ghana',
  nights: 3, vibes: ['City Break', 'Food & Nightlife'], visa: 'none', freeCancelDays: 7,
  blurb: 'Three nights, no visa, and a direct flight under an hour.',
  plate: plate(7),
  gallery: [
    { caption: 'Labadi beach', plate: shot(7, 0) },
    { caption: 'Kempinski — deluxe room', plate: shot(7, 1) },
    { caption: 'Jamestown', plate: shot(7, 2) },
    { caption: 'Osu nightlife', plate: shot(7, 3) },
    { caption: 'Makola market', plate: shot(7, 4) },
  ],
  flights: [
    { id: 'aw', name: 'Africa World Airlines · direct both ways', desc: 'LOS 07:30 → ACC 08:15 · 55m · 1 bag', meta: 'Lagos (LOS) → Accra (ACC) · Economy · 1 checked bag', price: 312000, separate: 348000, eligible: true },
    { id: 'ap', name: 'Air Peace · direct both ways', desc: 'LOS 12:10 → ACC 12:55 · 55m · 1 bag', meta: 'Lagos (LOS) → Accra (ACC) · Economy · 1 checked bag', price: 296000, separate: 330000, eligible: true },
    { id: 'et', name: 'Ethiopian · direct both ways', desc: 'LOS 16:40 → ACC 17:30 · 1h · 2 bags', meta: 'Lagos (LOS) → Accra (ACC) · Economy · 2 checked bags', price: 344000, separate: 382000, eligible: true },
  ],
  hotels: [
    { id: 'kemp', name: 'Kempinski Gold Coast City · 5★', desc: 'Deluxe room · breakfast · Ridge', meta: 'Deluxe room · breakfast included · Ridge, near the Independence Arch', nightly: 118000, nightlySeparate: 130000, eligible: true },
    { id: 'labadi', name: 'Labadi Beach Hotel · 5★', desc: 'Garden room · breakfast · on the beach', meta: 'Garden room · breakfast · directly on Labadi beach', nightly: 104000, nightlySeparate: 116000, eligible: true },
    { id: 'osu', name: 'Villa Monticello · 4★', desc: 'Boutique suite · breakfast · Airport Residential', meta: 'Boutique suite · breakfast · Airport Residential Area', nightly: 74000, nightlySeparate: 83000, eligible: true },
  ],
  transfer: { name: 'Airport transfers', desc: 'Both ways · private car · about twenty minutes each way', price: 26000, separate: 32000 },
  addons: [
    { id: 'cape', title: 'Cape Coast and Elmina castles', meta: 'Full day · guided · lunch on the coast', price: 68000, separate: 82000 },
    { id: 'food', title: 'Accra food and market walk', meta: 'Evening · Makola, Osu and a chop bar dinner', price: 28000, separate: 35000 },
  ],
  itinerary: [
    { title: 'Morning flight and check-in.', body: 'Under an hour in the air. Met at Kotoka, in the hotel before lunch.' },
    { title: 'The city.', body: 'Jamestown and the lighthouse in the morning, Osu in the evening.' },
    { title: 'The coast.', body: 'Either Labadi for the day, or the drive out to Cape Coast and Elmina.' },
    { title: 'Fly home.', body: 'Late checkout, transfer to the airport for the afternoon flight.' },
  ],
};

const CAIRO = {
  slug: 'cairo-and-the-nile',
  name: 'Cairo & the Nile',
  city: 'Cairo', code: 'CAI', country: 'Egypt',
  nights: 6, vibes: ['Culture & History', 'Family'], visa: 'add-on', freeCancelDays: 21,
  blurb: 'Pyramids from your window, and three nights on the river at Luxor.',
  plate: plate(8),
  gallery: [
    { caption: 'Giza at sunrise', plate: shot(8, 0) },
    { caption: 'Mena House — pyramid view room', plate: shot(8, 1) },
    { caption: 'The Egyptian Museum', plate: shot(8, 2) },
    { caption: 'Felucca on the Nile', plate: shot(8, 3) },
    { caption: 'Khan el-Khalili', plate: shot(8, 4) },
  ],
  flights: [
    { id: 'ms', name: 'EgyptAir · direct both ways', desc: 'LOS 22:45 → CAI 05:30 · 5h 45m · 2 bags', meta: 'Lagos (LOS) → Cairo (CAI) · Economy · 2 checked bags', price: 848000, separate: 934000, eligible: true },
    { id: 'et', name: 'Ethiopian · 1 stop Addis', desc: 'LOS 15:35 → CAI 06:20 · 11h 45m · 2 bags', meta: 'Lagos (LOS) → Addis Ababa (ADD) → Cairo (CAI) · Economy · 2 checked bags', price: 762000, separate: 838000, eligible: true },
    { id: 'tk', name: 'Turkish Airlines · 1 stop Istanbul', desc: 'LOS 21:40 → CAI 09:55 · 10h 15m · 2 bags', meta: 'Lagos (LOS) → Istanbul (IST) → Cairo (CAI) · Economy · 2 checked bags', price: 908000, separate: 998000, eligible: true },
  ],
  hotels: [
    { id: 'mena', name: 'Marriott Mena House · 5★ + Nile cruise', desc: 'Pyramid-view room, then a cabin on the river', meta: 'Pyramid-view room in Giza · outside cabin on the Luxor–Aswan cruise, full board', nightly: 104000, nightlySeparate: 116000, eligible: true },
    { id: 'kemp', name: 'Kempinski Nile · 5★ + Nile cruise', desc: 'Deluxe river room, then a cabin on the river', meta: 'Deluxe Nile-view room in Garden City · full board on the cruise', nightly: 118000, nightlySeparate: 131000, eligible: true },
    { id: 'stein', name: 'Steigenberger Pyramids · 4★ + Nile cruise', desc: 'Standard room, then a cabin on the river', meta: 'Standard room in Giza · full board on the cruise', nightly: 82000, nightlySeparate: 92000, eligible: true },
  ],
  transfer: { name: 'Transfers and the Luxor connection', desc: 'Airport both ways, plus the internal flight down to Luxor', price: 58000, separate: 68000 },
  addons: [
    { id: 'visa', title: 'Egypt tourist visa', meta: 'Single entry · Wakanow applies on your behalf · 5–7 working days', price: 46000, separate: 56000 },
    { id: 'giza', title: 'Giza plateau and Saqqara, private guide', meta: 'Full day · Egyptologist guide · inside the Great Pyramid', price: 62000, separate: 75000 },
    { id: 'kings', title: 'Valley of the Kings and Karnak', meta: 'Full day on the west and east banks at Luxor', price: 54000, separate: 66000 },
  ],
  itinerary: [
    { title: 'Overnight flight and check-in.', body: 'Land at dawn, transfer to Giza, room held for early check-in.' },
    { title: 'The plateau.', body: 'Pyramids and the Sphinx early, the Grand Egyptian Museum in the afternoon.' },
    { title: 'Islamic and Coptic Cairo.', body: 'The Citadel, Khan el-Khalili, and the old churches south of the centre.' },
    { title: 'Fly to Luxor and board.', body: 'Short flight south, embark the cruise, Karnak in the late afternoon.' },
    { title: 'On the river.', body: 'The Valley of the Kings, Edfu and Kom Ombo as the boat works upstream.' },
    { title: 'Back to Cairo and home.', body: 'Disembark at Aswan, fly to Cairo, evening connection to Lagos.' },
  ],
};

const DOHA = {
  slug: 'doha-stopover',
  name: 'Doha stopover',
  city: 'Doha', code: 'DOH', country: 'Qatar',
  nights: 4, vibes: ['City Break', 'Culture & History'], visa: 'add-on', freeCancelDays: 14,
  blurb: 'Four nights, the museum, the souq and the dunes at Khor Al Adaid.',
  plate: plate(9),
  gallery: [
    { caption: 'The Corniche', plate: shot(9, 0) },
    { caption: 'Mondrian Doha — studio', plate: shot(9, 1) },
    { caption: 'Museum of Islamic Art', plate: shot(9, 2) },
    { caption: 'Souq Waqif', plate: shot(9, 3) },
    { caption: 'The inland sea', plate: shot(9, 4) },
  ],
  flights: [
    { id: 'qr', name: 'Qatar Airways · direct both ways', desc: 'LOS 15:10 → DOH 01:20 · 7h 10m · 2 bags', meta: 'Lagos (LOS) → Doha (DOH) · Economy · 2 checked bags', price: 968000, separate: 1062000, eligible: true },
    { id: 'tk', name: 'Turkish Airlines · 1 stop Istanbul', desc: 'LOS 21:40 → DOH 14:35 · 12h 55m · 2 bags', meta: 'Lagos (LOS) → Istanbul (IST) → Doha (DOH) · Economy · 2 checked bags', price: 884000, separate: 972000, eligible: true },
    { id: 'ms', name: 'EgyptAir · 1 stop Cairo', desc: 'LOS 22:45 → DOH 13:40 · 11h 55m · 2 bags', meta: 'Lagos (LOS) → Cairo (CAI) → Doha (DOH) · Economy · 2 checked bags', price: 806000, separate: 806000, eligible: false },
  ],
  hotels: [
    { id: 'mond', name: 'Mondrian Doha · 5★', desc: 'Studio room · breakfast · West Bay', meta: 'Studio room · breakfast included · West Bay', nightly: 112000, nightlySeparate: 124000, eligible: true },
    { id: 'msher', name: 'Al Najada by Tivoli · 4★', desc: 'Deluxe room · breakfast · beside the souq', meta: 'Deluxe room · breakfast · a minute from Souq Waqif', nightly: 84000, nightlySeparate: 94000, eligible: true },
    { id: 'ritz', name: 'The Ritz-Carlton Doha · 5★', desc: 'Marina room · half board · private beach', meta: 'Marina-view room · half board · private beach and marina', nightly: 168000, nightlySeparate: 186000, eligible: true },
  ],
  transfer: { name: 'Private airport transfers', desc: 'Both ways · meet and greet at Hamad International', price: 44000, separate: 52000 },
  addons: [
    { id: 'visa', title: 'Qatar tourist visa', meta: 'Wakanow applies on your behalf · 4–6 working days', price: 58000, separate: 70000 },
    { id: 'dunes', title: 'Khor Al Adaid desert safari', meta: 'Dune drive to the inland sea · lunch at the camp · half day', price: 52000, separate: 63000 },
    { id: 'mia', title: 'Museum of Islamic Art and the Corniche', meta: 'Guided morning, then the dhow harbour and Souq Waqif', price: 30000, separate: 37000 },
  ],
  itinerary: [
    { title: 'Evening flight and check-in.', body: 'Direct overnight, arriving after midnight. Driver waiting, straight to the hotel.' },
    { title: 'The waterfront.', body: 'Museum of Islamic Art in the morning, the Corniche and Souq Waqif after dark.' },
    { title: 'The desert.', body: 'Out to Khor Al Adaid, where the dunes run down into the inland sea.' },
    { title: 'Katara and the Pearl.', body: 'The cultural village, then the marina at the Pearl for the evening.' },
    { title: 'Late checkout and departure.', body: 'Room held until the afternoon, transfer to Hamad for the flight home.' },
  ],
};

const MAURITIUS = {
  slug: 'mauritius-family-holiday',
  name: 'Mauritius family holiday',
  city: 'Mauritius', code: 'MRU', country: 'Mauritius',
  nights: 7, vibes: ['Beach & Island', 'Family'], visa: 'none', freeCancelDays: 30,
  blurb: 'Half board on the west coast, kids club included, no visa needed.',
  plate: plate(10),
  gallery: [
    { caption: 'Flic en Flac', plate: shot(10, 0) },
    { caption: 'Sugar Beach — family suite', plate: shot(10, 1) },
    { caption: 'Le Morne', plate: shot(10, 2) },
    { caption: 'Catamaran day', plate: shot(10, 3) },
    { caption: 'Chamarel', plate: shot(10, 4) },
  ],
  flights: [
    { id: 'kq', name: 'Kenya Airways · 1 stop Nairobi', desc: 'LOS 13:15 → MRU 12:40 · 17h 25m · 2 bags', meta: 'Lagos (LOS) → Nairobi (NBO) → Mauritius (MRU) · Economy · 2 checked bags', price: 1344000, separate: 1478000, eligible: true },
    { id: 'et', name: 'Ethiopian · 1 stop Addis', desc: 'LOS 15:35 → MRU 13:20 · 17h 45m · 2 bags', meta: 'Lagos (LOS) → Addis Ababa (ADD) → Mauritius (MRU) · Economy · 2 checked bags', price: 1256000, separate: 1382000, eligible: true },
    { id: 'sa', name: 'South African Airways · 1 stop Johannesburg', desc: 'LOS 08:40 → MRU 09:55 · 19h 15m · 2 bags', meta: 'Lagos (LOS) → Johannesburg (JNB) → Mauritius (MRU) · Economy · 2 checked bags', price: 1428000, separate: 1570000, eligible: true },
  ],
  hotels: [
    { id: 'sugar', name: 'Sugar Beach · 5★', desc: 'Family suite · half board · kids club', meta: 'Family suite · half board · kids club and beach at Flic en Flac', nightly: 186000, nightlySeparate: 204000, eligible: true },
    { id: 'lux', name: 'LUX* Le Morne · 5★', desc: 'Junior suite · half board · under the mountain', meta: 'Junior suite · half board · beneath Le Morne Brabant', nightly: 214000, nightlySeparate: 236000, eligible: true },
    { id: 'veran', name: 'Veranda Grand Baie · 4★', desc: 'Family room · half board · north coast', meta: 'Family room · half board · Grand Baie, north coast', nightly: 128000, nightlySeparate: 142000, eligible: true },
  ],
  transfer: { name: 'Island transfers', desc: 'Airport to the resort and back · private minibus · about an hour', price: 62000, separate: 74000 },
  addons: [
    { id: 'cat', title: 'Catamaran day to Île aux Cerfs', meta: 'Full day · lunch on board · snorkelling stops', price: 74000, separate: 90000 },
    { id: 'south', title: 'Chamarel and the south-west', meta: 'Coloured earths, the waterfall and the Black River gorges', price: 46000, separate: 56000 },
  ],
  itinerary: [
    { title: 'Fly out and connect.', body: 'Morning departure with an onward connection the same day.' },
    { title: 'Arrive and transfer.', body: 'Met at MRU, driven across to the west coast, half board starts that evening.' },
    { title: 'Resort days.', body: 'Nothing scheduled — the kids club runs all day and the beach is at the door.' },
    { title: 'The south-west.', body: 'Chamarel, the gorges and Le Morne, out and back in a day.' },
    { title: 'Catamaran.', body: 'Sail out to Île aux Cerfs with lunch on board.' },
    { title: 'Check out and fly home.', body: 'Late checkout, transfer to the airport for the afternoon connection.' },
  ],
};

const KIGALI = {
  slug: 'kigali-and-gorilla-trekking',
  name: 'Kigali & gorilla trekking',
  city: 'Kigali', code: 'KGL', country: 'Rwanda',
  nights: 5, vibes: ['Safari & Nature', 'Adventure'], visa: 'none', freeCancelDays: 30,
  blurb: 'Two nights in Kigali, three at Volcanoes, permit sold separately.',
  plate: plate(11),
  gallery: [
    { caption: 'Volcanoes National Park', plate: shot(11, 0) },
    { caption: 'The Retreat — garden room', plate: shot(11, 1) },
    { caption: 'Kigali hills', plate: shot(11, 2) },
    { caption: 'Tea plantations', plate: shot(11, 3) },
    { caption: 'Lake Kivu', plate: shot(11, 4) },
  ],
  flights: [
    { id: 'wb', name: 'RwandAir · direct both ways', desc: 'LOS 11:20 → KGL 18:05 · 4h 45m · 2 bags', meta: 'Lagos (LOS) → Kigali (KGL) · Economy · 2 checked bags', price: 742000, separate: 816000, eligible: true },
    { id: 'kq', name: 'Kenya Airways · 1 stop Nairobi', desc: 'LOS 13:15 → KGL 01:40 · 9h 25m · 2 bags', meta: 'Lagos (LOS) → Nairobi (NBO) → Kigali (KGL) · Economy · 2 checked bags', price: 826000, separate: 908000, eligible: true },
    { id: 'et', name: 'Ethiopian · 1 stop Addis', desc: 'LOS 15:35 → KGL 05:55 · 10h 20m · 2 bags', meta: 'Lagos (LOS) → Addis Ababa (ADD) → Kigali (KGL) · Economy · 2 checked bags', price: 788000, separate: 866000, eligible: true },
  ],
  hotels: [
    { id: 'retreat', name: 'The Retreat Kigali · 5★ + Volcanoes lodge', desc: 'Both stays · breakfast in the city, full board at the park', meta: 'Garden room in Kigali · full board at the lodge below the volcanoes', nightly: 138000, nightlySeparate: 152000, eligible: true },
    { id: 'bisate', name: 'Bisate Lodge · 5★ + Kigali Serena', desc: 'Both stays · full board · forest villas', meta: 'Forest villa at Bisate, full board · Serena for the city nights', nightly: 298000, nightlySeparate: 326000, eligible: true },
    { id: 'muha', name: 'Hotel des Mille Collines · 4★ + Da Vinci Gorilla Lodge', desc: 'Both stays · breakfast in the city, half board at the park', meta: 'Classic room in Kigali · half board at Kinigi, near the park gate', nightly: 92000, nightlySeparate: 103000, eligible: true },
  ],
  transfer: { name: 'Transfers and park runs', desc: 'Airport both ways, Kigali to Musanze, and the dawn runs to the park gate', price: 96000, separate: 112000 },
  addons: [
    { id: 'permit', title: 'Gorilla trekking permit', meta: 'One trek per person · park fee set by the Rwanda Development Board · non-refundable once issued', price: 1240000, separate: 1240000 },
    { id: 'golden', title: 'Golden monkey trek', meta: 'Half day in the bamboo forest · separate permit', price: 168000, separate: 195000 },
    { id: 'memorial', title: 'Kigali Genocide Memorial, guided', meta: 'Half day with a guide · a serious and worthwhile morning', price: 26000, separate: 32000 },
  ],
  itinerary: [
    { title: 'Direct flight and check-in.', body: 'Under five hours from Lagos, arriving early evening. Driver waiting at KGL.' },
    { title: 'Kigali.', body: 'The memorial in the morning, the craft markets and the hills in the afternoon.' },
    { title: 'Drive to Musanze.', body: 'Two hours north through the terraces, arriving at the lodge for lunch.' },
    { title: 'Trekking day.', body: 'Briefing at the park gate at dawn, then anything from one to six hours on the mountain.' },
    { title: 'Back to Kigali and home.', body: 'Morning drive down, afternoon flight, back in Lagos the same evening.' },
  ],
};

/* ── The three auto-generated tiers ─────────────────────────────────────── */

/**
 * The tiers are the same Lagos → Dubai search, composed three ways. Their parts
 * are decomposed so that at five nights each reproduces the tier price the
 * mockup published — ₦1,486,000 / ₦1,728,000 / ₦3,120,000 — and its authored
 * "booked separately" figure.
 */

const TIER_ESSENTIAL = {
  slug: 'tier-essential',
  name: 'Essential',
  tier: 'Essential',
  tagline: 'The basics, handled',
  city: 'Dubai', code: 'DXB', country: 'United Arab Emirates',
  nights: 5, vibes: ['City Break'], visa: 'add-on', freeCancelDays: 16,
  blurb: 'Direct flight and a clean 3★ base. Nothing you will not use.',
  plate: plate(12),
  gallery: [
    { caption: 'Deira', plate: shot(12, 0) },
    { caption: 'Rove City Centre — standard room', plate: shot(12, 1) },
    { caption: 'City Centre metro', plate: shot(12, 2) },
    { caption: 'Air Peace cabin', plate: shot(12, 3) },
    { caption: 'The creek', plate: shot(12, 4) },
  ],
  flights: [
    { id: 'ap', name: 'Air Peace · Economy', desc: 'Direct · LOS → DXB return · 1 bag', meta: 'Lagos (LOS) → Dubai (DXB) · Economy · 1 checked bag', price: 1036000, separate: 1096000, eligible: true },
    { id: 'em', name: 'Emirates · Economy', desc: 'Direct · LOS → DXB return · 2×23kg', meta: 'Lagos (LOS) → Dubai (DXB) · Economy · 2 × 23kg', price: 1142000, separate: 1268000, eligible: true },
  ],
  hotels: [
    { id: 'rcc', name: 'Rove City Centre · 3★', desc: 'Standard room · room only', meta: 'Standard room · room only · Deira, metro at the door', nightly: 90000, nightlySeparate: 95000, eligible: true },
    { id: 'ibis', name: 'Ibis Deira City Centre · 3★', desc: 'Standard room · room only', meta: 'Standard room · room only · City Centre metro at the door', nightly: 70400, nightlySeparate: 79600, eligible: true },
  ],
  transfer: null,
  addons: [
    { id: 'visa', title: 'UAE tourist visa', meta: '30-day single entry · Wakanow handles the application · 5–7 working days', price: 96000, separate: 105000 },
    { id: 'transfer', title: 'Careem shared airport transfer', meta: 'Both ways · shared with other guests', price: 42000, separate: 48000 },
  ],
  inclusions: [
    { icon: '✈', title: 'Air Peace · Economy', sub: 'Direct · LOS → DXB return' },
    { icon: '🏨', title: 'Rove City Centre · 3★', sub: 'Room only' },
    { icon: '🚐', title: 'No transfer', sub: 'Arrange your own', off: true },
    { icon: '🗺', title: 'No tours', sub: 'Explore independently', off: true },
    { icon: '🛂', title: 'Visa · optional add-on', sub: '₦96,000 if you need it' },
  ],
  itinerary: DUBAI.itinerary,
};

const TIER_PREMIUM = {
  slug: 'tier-premium',
  name: 'Premium',
  tier: 'Premium',
  tagline: 'Key logistics covered',
  city: 'Dubai', code: 'DXB', country: 'United Arab Emirates',
  nights: 5, vibes: ['City Break', 'Food & Nightlife'], visa: 'add-on', freeCancelDays: 16,
  blurb: 'Downtown, breakfast, transfers both ways and a tour in the desert.',
  plate: DUBAI.plate,
  gallery: DUBAI.gallery,
  flights: DUBAI.flights,
  hotels: DUBAI.hotels,
  transfer: DUBAI.transfer,
  addons: DUBAI.addons,
  // The mockup lists a featured tour among Premium's inclusions but prices the
  // tier at flight + hotel + transfer. Kept as a bundled extra rather than a
  // priced line, so the authored ₦1,728,000 still holds.
  bundledExtras: ['1 featured tour — desert safari with BBQ dinner'],
  inclusions: [
    { icon: '✈', title: 'Emirates · Economy', sub: 'Direct · LOS → DXB return · 2×23kg' },
    { icon: '🏨', title: 'Rove Downtown · 4★', sub: 'Breakfast included' },
    { icon: '🚐', title: 'Careem shared transfer', sub: 'Airport ↔ hotel, both ways' },
    { icon: '🗺', title: '1 featured tour', sub: 'Desert safari with BBQ dinner' },
    { icon: '🛂', title: 'Visa · optional add-on', sub: '₦96,000 if you need it' },
  ],
  itinerary: DUBAI.itinerary,
};

const TIER_LUXURY = {
  slug: 'tier-luxury',
  name: 'Luxury',
  tier: 'Luxury',
  tagline: 'Fully arranged',
  city: 'Dubai', code: 'DXB', country: 'United Arab Emirates',
  nights: 5, vibes: ['City Break', 'Romantic'], visa: 'add-on', freeCancelDays: 16,
  blurb: 'Business class, a Burj view, a chauffeur and three curated tours.',
  plate: plate(13),
  gallery: [
    { caption: 'Burj Khalifa from Downtown', plate: shot(13, 0) },
    { caption: 'Address Downtown — Burj view', plate: shot(13, 1) },
    { caption: 'Emirates business cabin', plate: shot(13, 2) },
    { caption: 'Private chauffeur', plate: shot(13, 3) },
    { caption: 'Dhow cruise', plate: shot(13, 4) },
  ],
  flights: [
    { id: 'em-biz', name: 'Emirates · Business', desc: 'Direct · lounge access · 2×32kg', meta: 'Lagos (LOS) → Dubai (DXB) · Business · lounge access · 2 × 32kg', price: 1860000, separate: 2050000, eligible: true },
    { id: 'qr-biz', name: 'Qatar Airways · Business, 1 stop Doha', desc: 'Qsuite · lounge access · 2×32kg', meta: 'Lagos (LOS) → Doha (DOH) → Dubai (DXB) · Business · 2 × 32kg', price: 1988000, separate: 2192000, eligible: true },
  ],
  hotels: [
    { id: 'addr-dt', name: 'Address Downtown · 5★', desc: 'Burj-view room · half board', meta: 'Burj Khalifa view · half board · on the Downtown boulevard', nightly: 192000, nightlySeparate: 220000, eligible: true },
    { id: 'atl-royal', name: 'Atlantis The Royal · 5★', desc: 'Palm-view room · half board', meta: 'Palm-view room · half board · on the crescent at Atlantis The Royal', nightly: 268000, nightlySeparate: 302000, eligible: true },
  ],
  transfer: { name: 'Private chauffeur transfer', desc: 'Meet and greet at arrivals · Mercedes S-Class · both ways', price: 156000, separate: 172000 },
  tours: { label: '3 curated tours', price: 144000, separate: 156000, desc: 'Desert safari, Burj Khalifa At the Top, and a dhow dinner cruise' },
  addons: [
    { id: 'visa', title: 'UAE tourist visa', meta: '30-day single entry · Wakanow handles the application · 5–7 working days', price: 96000, separate: 105000 },
    { id: 'yacht', title: 'Private yacht afternoon, Dubai Marina', meta: 'Four hours · skipper and refreshments · up to eight guests', price: 420000, separate: 480000 },
  ],
  inclusions: [
    { icon: '✈', title: 'Emirates · Business', sub: 'Direct · lounge access · 2×32kg' },
    { icon: '🏨', title: 'Address Downtown · 5★', sub: 'Half board · Burj view' },
    { icon: '🚐', title: 'Private chauffeur transfer', sub: 'Meet & greet at arrivals' },
    { icon: '🗺', title: '3 curated tours', sub: 'Safari, Burj Khalifa, dhow cruise' },
    { icon: '🛂', title: 'Visa · optional add-on', sub: '₦96,000 if you need it' },
  ],
  itinerary: DUBAI.itinerary,
};

/* ── Exports ────────────────────────────────────────────────────────────── */

/** Curated destination packages, in the order the catalogue shows them. */
export const CATALOGUE = [
  DUBAI, LONDON, ISTANBUL, UMRAH,
  ZANZIBAR, CAPETOWN, SAFARI, ACCRA,
  CAIRO, DOHA, MAURITIUS, KIGALI,
];

/** The three packages the search results screen composes from a live search. */
export const TIERS = [TIER_ESSENTIAL, TIER_PREMIUM, TIER_LUXURY];

/**
 * Two add-ons every trip should offer and none of the mockups had.
 *
 * Insurance is the more serious omission: a bundled travel product that sells
 * flights, hotels and visas but never mentions cover is leaving both a
 * protection gap and an obvious margin line on the table. Baggage is here
 * because the fare ladder introduces hand-baggage-only fares, and a traveller
 * on one needs somewhere to buy a bag back.
 */
function universalAddons(pkg) {
  const perTraveller = Math.round((9000 + 2600 * pkg.nights) / 100) * 100;
  return [
    {
      id: 'insurance',
      title: 'Travel insurance',
      meta: `Medical, cancellation, delay and baggage cover for the whole trip · per traveller · underwritten by our partner`,
      price: perTraveller,
      separate: Math.round((perTraveller * 1.22) / 100) * 100,
      recommended: true,
    },
    {
      id: 'extrabag',
      title: 'Extra checked bag',
      meta: 'One additional 23kg bag each way · cheaper booked now than at the airport',
      price: 28000,
      separate: 41000,
    },
  ];
}

// Attach room lists, fare ladders and the universal add-ons. Assigning a fresh
// addons array per package matters: the tiers reuse Dubai's objects by
// reference, so pushing into the shared array would add insurance three times.
for (const pkg of [...CATALOGUE, ...TIERS]) {
  pkg.addons = [...(pkg.addons ?? []), ...universalAddons(pkg)];
}
expandVariants([...CATALOGUE, ...TIERS]);

/** The four the landing page features. */
export const FEATURED = [DUBAI, LONDON, ISTANBUL, UMRAH];

export const VIBES = [
  'All', 'City Break', 'Beach & Island', 'Culture & History', 'Religious',
  'Family', 'Romantic', 'Adventure', 'Food & Nightlife', 'Safari & Nature',
];

const BY_SLUG = new Map([...CATALOGUE, ...TIERS].map((p) => [p.slug, p]));

export function findPackage(slug) {
  return BY_SLUG.get(slug) ?? DUBAI;
}

export function isTier(pkg) {
  return Boolean(pkg.tier);
}

/** The label the visa pill and banner use. */
export const VISA_LABEL = {
  'add-on': 'Visa add-on',
  required: 'Visa required',
  included: 'Visa included',
  none: 'No visa needed',
};

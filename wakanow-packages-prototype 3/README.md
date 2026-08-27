# Wakanow Packages — Phase 1 prototype

A clickable React prototype of the Packages flow, built from the five Phase 1
mockups and extended into a linked journey.

| Route | Screen | Source |
| --- | --- | --- |
| `/` | Landing — search widget and featured trips | `1-landing-page.html` |
| `/packages` | **Catalogue — every ready-made trip** | new for the prototype |
| `/results` | Search results — three auto-generated tiers | `2-search-results-tiers.html` |
| `/package/:slug` | Package detail with swappable parts | `3-preset-package-detail.html` |
| `/builder` | Five-step custom builder | `4-custom-builder.html` |
| `/checkout` | Checkout and booking summary | `5-checkout-review.html` |

---

## The two ideas that hold it together

### 1. Dates are the spine

`TripContext` holds a real departure and return date. **Trip length is derived
from them, never stored**, and every hotel in the catalogue is held as a
*nightly rate*. So changing the dates anywhere re-prices everything: the tier
cards, the package detail rail, the builder's running total and the checkout
summary all move together.

You can change the dates from the landing search, the catalogue header, the
package detail title bar, or the builder — on any step, including step 5.

The one deliberate asymmetry: **the three tiers keep the length you searched
for**, because they are composed from your search. **A ready-made package
adopts its own duration** when you open it — a 10-night Umrah trip stops
pretending to be a 5-night one — and you can then change it freely.

### 2. Two levels of choice, not one

A traveller picks a **hotel and a room within it**, a **flight and a fare class on it**.
`hotel.rooms` and `flight.fares` are derived in `src/data/variants.js` from the
authored record rather than hand-written 270 times — and the authored option is
always the base at exactly ×1, which is why every published figure still
reconciles while everything above and below it became selectable.

Rooms vary by board basis, bed configuration and category. Bed configuration is
deliberately free: twin beds instead of a double is a preference, not an upsell.

Fares run Saver → Economy → Economy Flex → Premium economy → Business, differing
on baggage, seat selection, changeability and refundability. A flight already
sold in Business gets a shorter ladder above it (Business → Business Flex →
First) rather than being offered a downgrade that would contradict its tier.

The ladder is listed cheapest-first, so **the default fare is flagged, not
index 0** — Saver sits at index 0 and must never be what an untouched package
prices at.

### 3. Nothing stores a total

`src/data/packages.js` holds only parts: flight options, hotels at a nightly
rate, transfers, bundled tours, optional add-ons. `src/lib/pricing.js` composes
them at the current trip length. That is what makes the dates work, and it means
the "booked separately" figure and the saving can never drift out of step with
the price.

The four packages the mockups authored are decomposed so that at their own
duration they reproduce the published figures **exactly** — ₦1,728,000 for
Dubai, ₦2,448,000 for London, and so on — as do the three tiers
(₦1,486,000 / ₦1,728,000 / ₦3,120,000). Twelve destinations are in the
catalogue; eight are curated for this prototype.

---

## Running it locally

Needs **Node.js 20.19+ or 22.12+** (Node 22 LTS is the safe pick).

```bash
npm install
npm run dev
```

Then open the URL it prints — usually <http://localhost:5173>.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint the source |
| `npm run scope-css` | Regenerate the page stylesheets from `mockups/` |
| `npm run harden-css` | Re-raise the shared components' CSS specificity |
| `npm run artifact` | Fold `dist/` into one self-contained HTML file |

Deployment instructions are in **[DEPLOY.md](./DEPLOY.md)**.

---

## How it is put together

```
src/
  main.jsx                entry point
  App.jsx                 routes
  global.css              document background, font default, focus ring
  state/
    TripContext.jsx       provider: dates, party, tier, package being booked
    useTrip.js            the context object and the useTrip() hook
  lib/
    dates.js              date arithmetic and formatting
    pricing.js            pricePackage() — the single source of every total
    format.js             naira() / nairaShort() / delta()
  data/
    packages.js           the catalogue: 12 destinations + 3 tiers
  components/
    DateRangePicker.jsx   two-month range calendar, used on four screens
    BackBar.jsx           back button and breadcrumbs
  pages/
    LandingPage.jsx       + LandingPage.css      (generated)
    PackagesCatalogue.jsx + PackagesCatalogue.css (hand-written)
    SearchResults.jsx     + SearchResults.css    (generated)
    PackageDetail.jsx     + PackageDetail.css    (generated)
    PackageBuilder.jsx    + PackageBuilder.css   (generated)
    Checkout.jsx          + Checkout.css         (generated)
mockups/                  the five original mockups, kept as the source of truth
tools/
  scope-css.mjs           mockup <style> blocks -> scoped page stylesheets
  harden-component-css.mjs raises shared-component specificity (see below)
  make-artifact.mjs       dist/ -> one self-contained HTML file
```

### The page CSS is generated

Each mockup was authored standalone, so they reuse class names (`.opt`, `.tgl`,
`.comp`, `.rail`, `.wrap`) with *different* rules, and several redefine the same
custom properties with different values. `tools/scope-css.mjs` rewrites every
selector to sit under that page's root class — `.pg-landing`, `.pg-results`,
`.pg-detail`, `.pg-builder`, `.pg-checkout` — with `:root`, `html` and `body`
collapsing onto that same wrapper so each page keeps its own token values.

**To change a screen's styling, edit `src/pages/<Page>.css` directly.** Only run
`npm run scope-css` if you changed the original mockup — it overwrites those
five files. `PackagesCatalogue.css` is hand-written and is never regenerated.

### Why the shared components' CSS looks over-qualified

Every generated page stylesheet carries the mockups' `*{margin:0;padding:0}`
reset, scoped to `.pg-x *` — a single class, exactly the same specificity as a
component rule like `.wk-dp-done`. Which one won came down to the order Vite
happened to concatenate the stylesheets, and it differed per page: the date
picker's footer button silently lost its padding on the builder while keeping it
on the landing page.

So the shared components' rules carry an ancestor (`.wk-dp-pop .wk-dp-day`) and
their roots double their own class (`.wk-dp-pop.wk-dp-pop`). That takes them to
two classes, which beats the reset everywhere regardless of bundle order.
`npm run harden-css` reapplies it if you hand-edit those two files.

### Routing

`HashRouter`, so URLs look like `/#/builder` and the prototype works off disk and
on any static host with no rewrite rule. Switch to `BrowserRouter` for clean
URLs, but then the host must serve `index.html` for every path.

---

## Fixed since the first version

- **Checkout described a different trip.** Its sidebar named a hotel, dates and
  airline that appeared nowhere else. It now describes whatever package you
  actually booked, curated destination or tier.
- **Checkout's breakdown did not sum to its own total** — about ₦85,000 out. The
  total is now composed from the booked package plus the switched-on extras, so
  the lines and the total cannot disagree.
- **Only Dubai existed downstream.** Twelve destinations now have full detail
  pages.
- **The builder's running total ignored hotel and flight selection**, because the
  `data-p` price attributes were read by nothing.
- **No way back.** Every screen below the landing page now has a back button and
  breadcrumbs.
- **You could swap the product but not choose within it.** Rooms and fare classes
  are now selectable on the detail screen, in the builder, and named at checkout.
- **No travel insurance and no baggage add-on** — both now offered on every
  package. Insurance scales with trip length.
- **No promo code at checkout.** `WAKA10` (10%) and `NAIJA50` (flat ₦50,000) are
  wired as illustrative codes.
- **No way to sort the catalogue.** Twelve trips, now sortable by price, saving
  and trip length.

---

## Functionality gaps worth deciding on

Asked to name what else is missing. In rough order of how much they'd change the
product, not how hard they are:

1. **Room count doesn't affect price.** The search takes a room count and the
   builder ignores it — the whole bundle is priced per person, hotel included, as
   the mockups authored it. Two adults sharing one room and two adults in two
   rooms cost the same. This is a pricing-model decision, which is why it wasn't
   quietly changed.
2. **Children and infants pay adult prices.** `payingTravellers` counts adults and
   children identically, and infants are free everywhere. Real package pricing has
   child rates and infant fees.
3. **No flexible-date view.** Given that dates now drive every price, a ±3-day
   strip showing what moving the departure saves is the single highest-value
   addition left. It is also the cheapest to build on this pricing model.
4. **Seat selection and meal preference** are named in fare descriptions but not
   collectable. Meals matter for this market — halal and vegetarian on the Umrah
   and Gulf routes especially.
5. **No availability or urgency signal.** No "3 rooms left at this price", no
   sold-out state. The checkout hold timer is the only scarcity cue.
6. **Traveller details aren't validated.** Passport fields accept anything, and
   nothing checks passport expiry against the travel date — which is the single
   most common cause of a failed visa application.
7. **The visa document flow stops at the promise.** Checkout says documents are
   collected after payment; there is no upload step, no status, no reminder.
8. **No saved trips or price alerts.** "Save for later" is decorative.
9. **Multi-city is advertised and inert.** "+ Add another destination" on the
   landing page does nothing.
10. **No group path.** Nothing handles more than a handful of travellers, and
    group Umrah is a real Wakanow line of business.
11. **No comparison view.** Twelve catalogue trips and no way to hold two
    side by side.
12. **Prime is mentioned, never integrated.** It appears as a checkout upsell with
    no member pricing anywhere.

## Still open

1. **The same hotel is priced differently on two screens.** Rove Downtown is
   ₦99,200 a night on the package detail screen and ₦66,800 in the builder —
   both faithful to their own mockup, which published ₦496,000 and ₦334,000 for
   the same five nights. A pricing-model question, not a code one.
2. **Ineligible options have no separate price.** Bundle-ineligible flights and
   hotels carry `separate === bundled`, so a "booked separately" total including
   one would be understated. It never displays, because that combination shows an
   em dash instead.
3. **Static copy does not follow swaps.** On the detail screen the gallery
   captions and the itinerary text stay fixed after you change flight or hotel.
   The itinerary now stretches and contracts to fit the trip length, but its
   wording is per-package.
4. **The builder's custom combination has no catalogue record.** Proceeding to
   checkout from the builder maps to the closest tier by hotel class, which is an
   approximation.
5. **Checkout is the end.** There is no confirmation screen in the mockups and
   none was invented — "Proceed to Pay" explains the hand-off to the existing
   Wakanow payment flow.
6. **Flight timetables are illustrative.** Only Dubai's Emirates option has a
   real leg-by-leg timetable; other packages show departure and arrival summary
   text only.

---

Prices throughout are illustrative, as the original mockups state.

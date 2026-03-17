# AllDayTours Booking Widget

A self-contained booking widget for AllDayTours, a Miami-based bus transportation company. Handles three booking flows — transfers, guided tours, and charter requests — and embeds directly into a WordPress/Elementor page via an HTML widget.

## How it works

**Transfers** and **Tours** collect trip details, show an order summary, then redirect to a Square Payment Link for checkout. The booking is recorded in Formspree before the redirect so the submission is captured even if a customer abandons the payment page.

**Charters** skip payment entirely and send a quote request to Formspree. A team member follows up with a custom quote within 24 hours.

---

## Files

```
/
├── booking-embed.html      # English widget — paste this into Elementor
├── booking-embed-es.html   # Spanish widget — paste this into the Spanish Elementor page
└── src/
    ├── booking.html        # HTML markup (references external CSS/JS)
    ├── booking.css         # All styles
    └── booking.js          # All logic
```

The `src/` folder is for reference and development. The two `booking-embed-*.html` files are the production deliverables — each is fully self-contained with styles and scripts inlined, ready to paste into an Elementor HTML widget.

---

## Setup

### 1. Formspree

Create a free account at [formspree.io](https://formspree.io) and set up three forms:

- Transfers
- Tours  
- Charters

Each form gets a unique endpoint like `https://formspree.io/f/xxxxxxxx`. Open both embed files and replace the three placeholder URLs in the `FORMSPREE` config object near the top of the `<script>` block:

```js
const FORMSPREE = {
  transfers: 'https://formspree.io/f/YOUR_TRANSFERS_FORM_ID',
  tours:     'https://formspree.io/f/YOUR_TOURS_FORM_ID',
  charters:  'https://formspree.io/f/YOUR_CHARTERS_FORM_ID',
};
```

### 2. Square Payment Links

Create payment links at [squareup.com/dashboard/payment-links](https://squareup.com/dashboard/payment-links/new) — one for transfers and one per tour. Replace the placeholders in `SQUARE_LINKS`:

```js
const SQUARE_LINKS = {
  transfers: 'https://square.link/u/YOUR_TRANSFERS_LINK',
  tours: {
    1: 'https://square.link/u/YOUR_DOLPHIN_MALL_LINK',
    2: 'https://square.link/u/YOUR_KEY_WEST_LINK',
  },
};
```

### 3. Pricing

Set the per-person transfer rate and tour prices:

```js
const TRANSFER_PRICE_PER_PERSON = 0; // e.g. 50

const TOURS = [
  { ..., price: 0 }, // e.g. 25.00
  { ..., price: 0 }, // e.g. 38.99
];
```

### 4. Embed in WordPress

1. Open the target page in **Elementor**
2. Drag an **HTML** widget onto the page
3. Open `booking-embed.html` (or `booking-embed-es.html`) in any text editor
4. Select all → copy → paste into the Elementor HTML widget
5. Click **Update**

---

## Theme compatibility

The widget is scoped under `.adt-wrap` to avoid conflicts with the parent theme. The tab buttons include `!important` overrides specifically for the Astra theme, which applies global button styles that would otherwise bleed in. If you switch themes, those overrides can be removed from the bottom of the `<style>` block.

---

## Adding or editing tours

Tours are defined in the `TOURS` array in the script block. Each tour takes the following shape:

```js
{
  id: 1,
  name: 'Tour Name',
  dropoff: 'Drop-off address',
  pickups: [
    { label: 'Pickup location name', time: '09:00' },
    { label: 'Another location',     time: null },   // null if time TBD
  ],
  availableDays: 'any',      // 'any' or 'weekend' (fri/sat/sun)
  price: 25.00,
}
```

Remember to also create a matching Square Payment Link and add it to `SQUARE_LINKS.tours`.

---

## Transfer locations

The From/To dropdowns in the Transfers tab are driven by the `LOCATIONS` array. Add, remove, or reorder entries there to update both dropdowns simultaneously.

---

## Languages

Both embed files are functionally identical — `booking-embed-es.html` has all UI strings, error messages, and JS-generated text translated to Latin American Spanish. Both share the same Formspree endpoints and Square links, so submissions from either language land in the same inboxes.

/**
 * AllDayTours Booking Widget
 *
 * Three booking flows:
 *   Transfers  — point-to-point, one-way or round trip, paid via Square
 *   Tours      — scheduled group tours, paid via Square
 *   Charters   — large group quote requests, no upfront payment
 *
 * On submit, booking details are posted to Formspree before the Square
 * redirect fires. That way the submission is captured even if a customer
 * abandons the checkout page.
 */

// ─────────────────────────────────────────────
// Configuration — fill these in before deploying
// ─────────────────────────────────────────────

const FORMSPREE = {
  transfers: 'https://formspree.io/f/YOUR_TRANSFERS_FORM_ID',
  tours:     'https://formspree.io/f/YOUR_TOURS_FORM_ID',
  charters:  'https://formspree.io/f/YOUR_CHARTERS_FORM_ID',
};

// Create links at https://squareup.com/dashboard/payment-links/new
const SQUARE_LINKS = {
  transfers: 'https://square.link/u/YOUR_TRANSFERS_LINK',
  tours: {
    1: 'https://square.link/u/YOUR_DOLPHIN_MALL_LINK',
    2: 'https://square.link/u/YOUR_KEY_WEST_LINK',
  },
};

// ─────────────────────────────────────────────
// Tour definitions
// ─────────────────────────────────────────────

const TOURS = [
  {
    id: 1,
    name: 'Dolphin Mall Shopping Tour',
    dropoff: 'Dolphin Mall - 11401 NW 12st Miami',
    pickups: [
      { label: 'Collins Av & 5 St - South Beach',            time: '09:00' },
      { label: 'Bayside - Miami Downtown',                    time: '09:30' },
      { label: 'MIA International Airport - Terminal E & H',  time: '10:00' },
    ],
    availableDays: 'any',  // 'any' | 'weekend' (fri/sat/sun)
    price: 0,              // set before deploying, e.g. 25.00
  },
  {
    id: 2,
    name: 'Key West Full Day',
    dropoff: '908 Carolina Street Key West',
    pickups: [
      { label: 'Collins Av & 75 St',                         time: '06:00' },
      { label: 'Hilton Cabana Collins Av & 63 St',           time: '06:15' },
      { label: 'Hampton Inn Collins Av & 41 St',             time: '06:30' },
      { label: 'The Gate Hotel Collins Av & 23 St',          time: '06:45' },
      { label: 'Loews Miami Beach Collins Av & 16 St',       time: '07:00' },
      { label: 'Collins Av & 5 St - South Beach',            time: '07:15' },
      { label: 'Regency Hotel 1000NW Le June RD & 42 Av',    time: '07:45' },
      { label: 'Holiday Inn Miami Downtown',                  time: null   },
    ],
    availableDays: 'weekend',
    price: 0,  // set before deploying, e.g. 38.99
  },
];

// Per-person rate for transfers. Round trips are charged at 2×.
const TRANSFER_PRICE_PER_PERSON = 0; // set before deploying, e.g. 50

// ─────────────────────────────────────────────
// Transfer pickup/dropoff locations
// ─────────────────────────────────────────────

const LOCATIONS = [
  'Aventura Hotels / Aventura Mall - Aventura',
  'Bal Harbour - Miami',
  'Brickell Miami Downtown - Miami',
  'Brightline Train Station Miami Downtown - Miami',
  'Busch Gardens Tampa - Tampa',
  'Chase Stadium Inter Miami Fort Lauderdale - Fort Lauderdale',
  'Coconut Grove / Coral Gables - Miami',
  'Dolphin Mall or Area Hotels - Miami',
  'Doral - Doral',
  'Fort Lauderdale - Fort Lauderdale',
  'Fort Lauderdale Airport - Fort Lauderdale (FLL)',
  'Freedom Park Inter Miami Stadium (Miami Airport Area) - Miami',
  'Hallandale Beach or Hollywood Beach - Miami',
  'Miami Beach (40th to 96st) - Miami',
  'Miami Downtown - Miami',
  'Miami International Airport - Miami (MIA)',
  'Miami South Beach (5st to 40st) - Miami',
  'Miami To - Miami',
  'Miami to Orlando - Regular Service - Departure 08:00am from MIA Airport - Miami (MIA)',
  'Orlando - Orlando',
  'Orlando - Celebration - Celebration',
  'Orlando - Downtown (Amway Center-Winter Gardens and others) - Orlando',
  'Orlando - International Drive Hotels - Orlando',
  'Orlando - Kissimmee - Kissimmee',
  'Orlando - Lake Buena Vista - Orlando',
  'Orlando - MCO International Airport / Brightline Terminal C - Orlando (MCO)',
  'Orlando - SeaWorld - Aquatica - Discovery Cove Parks - Orlando',
  'Orlando - Transfer Hotel/Hotel - Orlando',
  'Orlando - Transfer Hotel/Premium Outlets Vinelad or Int. Drive/Hotel - Orlando',
  'Orlando - Transfer Hotel/Theme Park/Hotel - Orlando',
  'Orlando - Universal Orlando Resort - Orlando',
  'Orlando - Walt Disney World Resort - Orlando',
  'Port Canaveral - Orlando',
  'Port Everglades - Fort Lauderdale',
  'Port Miami - Miami',
  'Sawgrass Mills - Fort Lauderdale',
  'Seminole Hard Rock Hotel & Casino - Fort Lauderdale',
  'Sunny Isles - Sunny Isles',
  'Tallahassee - Tallahassee',
  'West Palm Beach - West Palm Beach',
];

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────

let tripType     = 'oneway';
let charterType  = 'oneway';
let selectedTour = null;
let pendingType  = null;
let pendingData  = null;
let pendingAmount = 0;

// ─────────────────────────────────────────────
// Tab switching
// ─────────────────────────────────────────────

function switchType(type) {
  ['transfers', 'tours', 'charters'].forEach(t => {
    document.getElementById('panel-' + t).classList.toggle('hidden', t !== type);
    document.querySelector('[data-type="' + t + '"]').classList.toggle('active', t === type);
  });
  if (type === 'tours') renderTourCards();
}

// ─────────────────────────────────────────────
// Transfers
// ─────────────────────────────────────────────

function setTripType(type) {
  tripType = type;
  document.getElementById('tt-oneway').classList.toggle('active', type === 'oneway');
  document.getElementById('tt-roundtrip').classList.toggle('active', type === 'roundtrip');
  document.getElementById('t-return-wrap').classList.toggle('hidden', type !== 'roundtrip');
}

function buildOptions(selectId, excludeValue) {
  const el = document.getElementById(selectId);
  const current = el.value;
  el.innerHTML = '<option value="" disabled selected>Select a location…</option>';
  LOCATIONS.forEach(loc => {
    if (loc === excludeValue) return;
    const opt = document.createElement('option');
    opt.value = loc;
    opt.textContent = loc;
    if (loc === current) opt.selected = true;
    el.appendChild(opt);
  });
}

// Keep From and To mutually exclusive
function updateDropoffOptions() {
  const pickup = document.getElementById('t-pickup').value;
  buildOptions('t-dropoff', pickup);
  if (document.getElementById('t-dropoff').value === pickup) {
    document.getElementById('t-dropoff').value = '';
  }
}

function updatePickupOptions() {
  const dropoff = document.getElementById('t-dropoff').value;
  buildOptions('t-pickup', dropoff);
  if (document.getElementById('t-pickup').value === dropoff) {
    document.getElementById('t-pickup').value = '';
  }
}

function initLocationDropdowns() {
  buildOptions('t-pickup', '');
  buildOptions('t-dropoff', '');
}

// ─────────────────────────────────────────────
// Charters
// ─────────────────────────────────────────────

function setCharterType(type) {
  charterType = type;
  ['oneway', 'roundtrip', 'multistop'].forEach(t => {
    document.getElementById('ct-' + t).classList.toggle('active', t === type);
  });
  document.getElementById('c-return-wrap').classList.toggle('hidden', type === 'oneway');
}

// ─────────────────────────────────────────────
// Passenger counter (shared across all tabs)
// ─────────────────────────────────────────────

function adjustCount(id, delta, max) {
  const el = document.getElementById(id);
  let val = parseInt(el.textContent) + delta;
  if (val < 1) val = 1;
  if (max && val > max) val = max;
  el.textContent = val;
  updateTourPrice();
}

// ─────────────────────────────────────────────
// Tours
// ─────────────────────────────────────────────

function renderTourCards() {
  const grid = document.getElementById('tour-cards');
  grid.innerHTML = TOURS.map(t => `
    <div class="adt-tour-card" id="tc-${t.id}" onclick="selectTour(${t.id})">
      <div class="adt-tour-name">${t.name}</div>
      <div class="adt-tour-meta">
        <span>📍 Drop-off: ${t.dropoff}</span>
        <span>🕐 ${t.pickups.length} pickup point${t.pickups.length > 1 ? 's' : ''}</span>
        <span>⏱ ${t.availableDays === 'weekend' ? 'Fri / Sat / Sun only' : 'Any day'}</span>
      </div>
      ${t.price > 0 ? `<div class="adt-tour-price">$${t.price.toFixed(2)} <span>/ person</span></div>` : ''}
    </div>
  `).join('');
}

function selectTour(id) {
  selectedTour = id;
  document.querySelectorAll('.adt-tour-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('tc-' + id).classList.add('selected');
  document.getElementById('err-tour-select').classList.remove('visible');

  const tour = TOURS.find(t => t.id === id);

  // Populate pickup dropdown for the selected tour
  const pickupSel = document.getElementById('tour-pickup');
  pickupSel.innerHTML = '<option value="" disabled selected>Select a pickup point…</option>';
  tour.pickups.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = p.time ? `${p.label} (${p.time})` : p.label;
    pickupSel.appendChild(opt);
  });
  pickupSel.value = '';

  // Minimum bookable date: day after tomorrow
  const dateInput = document.getElementById('tour-date');
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 2);
  dateInput.min = minDate.toISOString().split('T')[0];
  dateInput.value = '';

  document.getElementById('tour-info-dropoff').textContent = 'Drop-off: ' + tour.dropoff;
  document.getElementById('tour-info-avail').textContent   = tour.availableDays === 'weekend'
    ? 'Available: Fri, Sat & Sun only'
    : 'Available: Any day';
  document.getElementById('tour-info-pickup-time').textContent = '';

  document.getElementById('tour-details').classList.remove('hidden');
  updateTourPrice();
}

function updateTourPickupTime() {
  const tour = TOURS.find(t => t.id === selectedTour);
  if (!tour) return;
  const idx = parseInt(document.getElementById('tour-pickup').value);
  if (isNaN(idx)) return;
  const pickup = tour.pickups[idx];
  document.getElementById('tour-info-pickup-time').textContent =
    pickup.time ? 'Pickup time: ' + pickup.time : '';
  document.getElementById('sb-tour-pickup').classList.remove('invalid');
  document.getElementById('err-tour-pickup').classList.remove('visible');
}

function isDateAvailable(dateStr, availableDays) {
  // Use noon to sidestep DST edge cases flipping the date
  const day = new Date(dateStr + 'T12:00:00').getDay(); // 0 = Sun, 6 = Sat
  if (availableDays === 'weekend') return day === 0 || day === 5 || day === 6;
  return true;
}

function updateTourPrice() {
  const summary = document.getElementById('tour-price-summary');
  if (!selectedTour) { summary.classList.add('hidden'); return; }
  const tour = TOURS.find(t => t.id === selectedTour);
  if (!tour || tour.price === 0) { summary.classList.add('hidden'); return; }
  const pax   = parseInt(document.getElementById('tour-pax').textContent);
  const total = tour.price * pax;
  document.getElementById('tour-price-val').textContent = '$' + total.toFixed(2);
  document.getElementById('tour-price-label').textContent =
    `${tour.name} × ${pax} passenger${pax > 1 ? 's' : ''}`;
  summary.classList.remove('hidden');
}

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function isValidPhone(v) {
  const digits = v.replace(/[\s\-().+]/g, '');

  // Block obvious fakes
  if (/^(\d)\1{6,}$/.test(digits)) return false;
  if (/^(1234567|12345678|123456789|1234567890|0987654321)/.test(digits)) return false;

  // NANP — area code and exchange must start 2–9
  if (digits.length === 10) return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits);

  // +1 prefix variant
  if (digits.length === 11 && digits[0] === '1') return /^1[2-9]\d{2}[2-9]\d{6}$/.test(digits);

  // International fallback
  if (digits.length >= 7 && digits.length <= 15) return /^\d+$/.test(digits);

  return false;
}

function setFieldState(inputId, errId, valid, isSbCell) {
  const input = document.getElementById(inputId);
  const err   = document.getElementById(errId);
  if (!input || !err) return;
  if (isSbCell) {
    const cell = input.closest('.sb-cell');
    if (cell) cell.classList.toggle('invalid', !valid);
    err.classList.toggle('visible', !valid);
  } else {
    input.classList.toggle('invalid', !valid);
    input.classList.toggle('valid', valid);
    err.classList.toggle('visible', !valid);
  }
  return valid;
}

// Clears error state as soon as the user corrects a field they've
// already been shown an error for — no waiting until next submit.
function attachLiveValidation() {
  const rules = [
    { id: 't-pickup',        err: 'err-t-pickup',        check: v => v.trim().length > 0,  sb: true  },
    { id: 't-dropoff',       err: 'err-t-dropoff',       check: v => v.trim().length > 0,  sb: true  },
    { id: 't-date',          err: 'err-t-date',          check: v => v.length > 0,         sb: true  },
    { id: 't-dropoff-exact', err: 'err-t-dropoff-exact', check: v => v.trim().length > 0,  sb: false },
    { id: 't-return',        err: 'err-t-return',        check: v => v.length > 0,         sb: false },
    { id: 't-name',          err: 'err-t-name',          check: v => v.trim().length > 1,  sb: false },
    { id: 't-email',         err: 'err-t-email',         check: v => isValidEmail(v),      sb: false },
    { id: 't-phone',         err: 'err-t-phone',         check: v => isValidPhone(v),      sb: false },
    { id: 'tour-pickup',     err: 'err-tour-pickup',     check: v => v !== '',             sb: true  },
    { id: 'tour-date',       err: 'err-tour-date',       check: v => v.length > 0,         sb: true  },
    { id: 'tour-name',       err: 'err-tour-name',       check: v => v.trim().length > 1,  sb: false },
    { id: 'tour-email',      err: 'err-tour-email',      check: v => isValidEmail(v),      sb: false },
    { id: 'c-org',           err: 'err-c-org',           check: v => v.trim().length > 1,  sb: false },
    { id: 'c-pax',           err: 'err-c-pax',           check: v => parseInt(v) > 0,      sb: false },
    { id: 'c-buses',         err: 'err-c-buses',         check: v => parseInt(v) > 0,      sb: false },
    { id: 'c-pickup',        err: 'err-c-pickup',        check: v => v.trim().length > 0,  sb: true  },
    { id: 'c-dropoff',       err: 'err-c-dropoff',       check: v => v.trim().length > 0,  sb: true  },
    { id: 'c-date',          err: 'err-c-date',          check: v => v.length > 0,         sb: true  },
    { id: 'c-dropoff-exact', err: 'err-c-dropoff-exact', check: v => v.trim().length > 0,  sb: false },
    { id: 'c-return',        err: 'err-c-return',        check: v => v.length > 0,         sb: false },
    { id: 'c-name',          err: 'err-c-name',          check: v => v.trim().length > 1,  sb: false },
    { id: 'c-email',         err: 'err-c-email',         check: v => isValidEmail(v),      sb: false },
    { id: 'c-notes',         err: 'err-c-notes',         check: v => v.trim().length > 0,  sb: false },
    { id: 'c-phone',         err: 'err-c-phone',         check: v => isValidPhone(v),      sb: false },
  ];

  rules.forEach(({ id, err, check, sb }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const isMarked = el.classList.contains('invalid') ||
        (sb && el.closest('.sb-cell')?.classList.contains('invalid'));
      if (isMarked && check(el.value)) setFieldState(id, err, true, sb);
    });
    el.addEventListener('blur', () => {
      if (el.value !== '') setFieldState(id, err, check(el.value), sb);
    });
  });
}

function validateTransfers() {
  let ok = true;
  const v = (id, err, check, sb) => { if (!setFieldState(id, err, check, sb)) ok = false; };

  v('t-pickup',        'err-t-pickup',        document.getElementById('t-pickup').value.trim().length > 0,        true);
  v('t-dropoff',       'err-t-dropoff',       document.getElementById('t-dropoff').value.trim().length > 0,       true);
  v('t-date',          'err-t-date',          document.getElementById('t-date').value.length > 0,                 true);
  v('t-dropoff-exact', 'err-t-dropoff-exact', document.getElementById('t-dropoff-exact').value.trim().length > 0, false);

  if (tripType === 'roundtrip') {
    v('t-return', 'err-t-return', document.getElementById('t-return').value.length > 0, false);
  }

  v('t-name',  'err-t-name',  document.getElementById('t-name').value.trim().length > 1, false);
  v('t-email', 'err-t-email', isValidEmail(document.getElementById('t-email').value),    false);
  v('t-phone', 'err-t-phone', isValidPhone(document.getElementById('t-phone').value),    false);

  if (!ok) {
    document.querySelector('#transfers-form .invalid, #transfers-form .sb-cell.invalid')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return ok;
}

function validateTours() {
  let ok = true;
  const v = (id, err, check, sb) => { if (!setFieldState(id, err, check, sb)) ok = false; };

  const tourErr = document.getElementById('err-tour-select');
  if (!selectedTour) {
    tourErr.classList.add('visible');
    ok = false;
  } else {
    tourErr.classList.remove('visible');
  }

  if (selectedTour) {
    const pickupVal  = document.getElementById('tour-pickup').value;
    const pickupCell = document.getElementById('sb-tour-pickup');
    const pickupErr  = document.getElementById('err-tour-pickup');

    if (!pickupVal) {
      pickupCell.classList.add('invalid');
      pickupErr.classList.add('visible');
      ok = false;
    } else {
      pickupCell.classList.remove('invalid');
      pickupErr.classList.remove('visible');
    }

    const dateVal  = document.getElementById('tour-date').value;
    const tour     = TOURS.find(t => t.id === selectedTour);
    const dateCell = document.getElementById('sb-tour-date');
    const dateErr  = document.getElementById('err-tour-date');

    if (!dateVal) {
      dateCell.classList.add('invalid');
      dateErr.textContent = 'Required';
      dateErr.classList.add('visible');
      ok = false;
    } else if (!isDateAvailable(dateVal, tour.availableDays)) {
      dateCell.classList.add('invalid');
      dateErr.textContent = tour.availableDays === 'weekend'
        ? 'This tour runs Fri, Sat & Sun only'
        : 'Date not available';
      dateErr.classList.add('visible');
      ok = false;
    } else {
      dateCell.classList.remove('invalid');
      dateErr.classList.remove('visible');
    }
  }

  v('tour-name',  'err-tour-name',  document.getElementById('tour-name').value.trim().length > 1, false);
  v('tour-email', 'err-tour-email', isValidEmail(document.getElementById('tour-email').value),    false);

  if (!ok) {
    document.querySelector('#tours-form .invalid, #tours-form .sb-cell.invalid, #err-tour-select.visible')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return ok;
}

function validateCharters() {
  let ok = true;
  const v = (id, err, check, sb) => { if (!setFieldState(id, err, check, sb)) ok = false; };

  v('c-org',           'err-c-org',           document.getElementById('c-org').value.trim().length > 1,           false);
  v('c-pax',           'err-c-pax',           parseInt(document.getElementById('c-pax').value) > 0,               false);
  v('c-buses',         'err-c-buses',         parseInt(document.getElementById('c-buses').value) > 0,             false);
  v('c-pickup',        'err-c-pickup',        document.getElementById('c-pickup').value.trim().length > 0,        true);
  v('c-dropoff',       'err-c-dropoff',       document.getElementById('c-dropoff').value.trim().length > 0,       true);
  v('c-date',          'err-c-date',          document.getElementById('c-date').value.length > 0,                 true);
  v('c-dropoff-exact', 'err-c-dropoff-exact', document.getElementById('c-dropoff-exact').value.trim().length > 0, false);

  if (charterType !== 'oneway') {
    v('c-return', 'err-c-return', document.getElementById('c-return').value.length > 0, false);
  }

  v('c-name',  'err-c-name',  document.getElementById('c-name').value.trim().length > 1,  false);
  v('c-email', 'err-c-email', isValidEmail(document.getElementById('c-email').value),     false);
  v('c-notes', 'err-c-notes', document.getElementById('c-notes').value.trim().length > 0, false);
  v('c-phone', 'err-c-phone', isValidPhone(document.getElementById('c-phone').value),     false);

  if (!ok) {
    document.querySelector('#charters-form .invalid, #charters-form .sb-cell.invalid')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return ok;
}

// ─────────────────────────────────────────────
// Data collection
// Builds the Formspree payload and the order
// summary shown in the payment modal.
// ─────────────────────────────────────────────

function collectData(type) {
  if (type === 'transfers') {
    const pax   = parseInt(document.getElementById('t-pax').textContent);
    const total = pax * TRANSFER_PRICE_PER_PERSON * (tripType === 'roundtrip' ? 2 : 1);
    return {
      data: {
        'Trip Type':              tripType === 'oneway' ? 'One Way' : 'Round Trip',
        'Pickup':                 document.getElementById('t-pickup').value,
        'Dropoff (General)':      document.getElementById('t-dropoff').value,
        'Exact Drop-off Address': document.getElementById('t-dropoff-exact').value,
        'Departure Date':         document.getElementById('t-date').value,
        'Return Date':            tripType === 'roundtrip' ? document.getElementById('t-return').value : 'N/A',
        'Passengers':             pax,
        'Name':                   document.getElementById('t-name').value,
        'Email':                  document.getElementById('t-email').value,
        'Phone':                  document.getElementById('t-phone').value,
        '_subject':               `Transfer Booking — ${document.getElementById('t-name').value} (${pax} pax)`,
      },
      amount: total,
      summary: `
        <strong>${tripType === 'oneway' ? 'One Way' : 'Round Trip'} Transfer</strong><br>
        ${document.getElementById('t-pickup').value} → ${document.getElementById('t-dropoff').value}<br>
        Departure: ${document.getElementById('t-date').value}${tripType === 'roundtrip' ? ' · Return: ' + document.getElementById('t-return').value : ''}<br>
        ${pax} passenger${pax > 1 ? 's' : ''}
        <div class="adt-order-total"><span>Total</span><span>$${total.toFixed(2)}</span></div>
      `,
    };
  }

  if (type === 'tours') {
    const tour       = TOURS.find(t => t.id === selectedTour);
    const pax        = parseInt(document.getElementById('tour-pax').textContent);
    const total      = tour && tour.price > 0 ? tour.price * pax : 0;
    const pickupIdx  = parseInt(document.getElementById('tour-pickup').value);
    const pickup     = tour && !isNaN(pickupIdx) ? tour.pickups[pickupIdx] : null;
    const pickupLabel = pickup
      ? (pickup.time ? `${pickup.label} (${pickup.time})` : pickup.label)
      : '';
    return {
      data: {
        'Tour':          tour ? tour.name : 'Not selected',
        'Pickup Point':  pickupLabel,
        'Drop-off':      tour ? tour.dropoff : '',
        'Travel Date':   document.getElementById('tour-date').value,
        'Passengers':    pax,
        'Total Price':   total > 0 ? `$${total.toFixed(2)}` : 'TBD',
        'Name':          document.getElementById('tour-name').value,
        'Email':         document.getElementById('tour-email').value,
        '_subject':      `Tour Booking — ${tour ? tour.name : ''} on ${document.getElementById('tour-date').value}`,
      },
      amount: total,
      summary: `
        <strong>${tour ? tour.name : ''}</strong><br>
        Pickup: ${pickupLabel}<br>
        Drop-off: ${tour ? tour.dropoff : ''}<br>
        Date: ${document.getElementById('tour-date').value}<br>
        ${pax} passenger${pax > 1 ? 's' : ''}${total > 0 ? ` × $${tour.price.toFixed(2)}` : ''}
        ${total > 0 ? `<div class="adt-order-total"><span>Total</span><span>$${total.toFixed(2)}</span></div>` : ''}
      `,
    };
  }

  return null;
}

// ─────────────────────────────────────────────
// Submission
// ─────────────────────────────────────────────

function submitForm(type) {
  if (type === 'charters') {
    if (!validateCharters()) return;
    submitCharter();
    return;
  }

  if (type === 'transfers' && !validateTransfers()) return;
  if (type === 'tours'     && !validateTours())     return;

  const result = collectData(type);
  if (!result) return;

  pendingType   = type;
  pendingData   = result.data;
  pendingAmount = result.amount;

  document.getElementById('modal-order-summary').innerHTML = result.summary;
  document.getElementById('payment-modal').classList.add('open');
  const payBtn = document.getElementById('modal-pay-btn');
  payBtn.disabled = false;
  payBtn.innerHTML = '<span>Continue to Payment</span> <span>→</span>';
}

function closePaymentModal() {
  document.getElementById('payment-modal').classList.remove('open');
}

// Records the booking in Formspree first, then redirects to Square.
// Doing it in this order means the submission is captured even if
// the customer closes the browser on the Square checkout page.
async function processPayment() {
  const btn = document.getElementById('modal-pay-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="adt-spinner"></div> <span>Redirecting to Square…</span>';

  await sendToFormspree(pendingType, pendingData);

  let squareUrl = null;
  if (pendingType === 'transfers') {
    squareUrl = SQUARE_LINKS.transfers;
  } else if (pendingType === 'tours') {
    squareUrl = SQUARE_LINKS.tours[selectedTour] || null;
  }

  if (!squareUrl || squareUrl.includes('YOUR_')) {
    // Links not configured — skip redirect and show success (useful for testing)
    closePaymentModal();
    showSuccess(pendingType, pendingData);
    return;
  }

  window.location.href = squareUrl;
}

async function sendToFormspree(type, data) {
  try {
    await fetch(FORMSPREE[type], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (e) {
    // Non-fatal — the payment redirect still proceeds
    console.warn('Formspree notification failed:', e);
  }
}

async function submitCharter() {
  const btn = document.getElementById('c-submit');
  btn.disabled = true;
  btn.innerHTML = '<div class="adt-spinner"></div> <span>Sending…</span>';

  const data = {
    'Trip Type':              charterType === 'oneway' ? 'One Way' : charterType === 'roundtrip' ? 'Round Trip' : 'Multi-Stop',
    'Organization':           document.getElementById('c-org').value,
    'Total Passengers':       document.getElementById('c-pax').value,
    'Buses Needed':           document.getElementById('c-buses').value,
    'Pickup':                 document.getElementById('c-pickup').value,
    'Destination':            document.getElementById('c-dropoff').value,
    'Exact Drop-off Address': document.getElementById('c-dropoff-exact').value,
    'Departure Date':         document.getElementById('c-date').value,
    'Return Date':            charterType !== 'oneway' ? document.getElementById('c-return').value : 'N/A',
    'Notes':                  document.getElementById('c-notes').value,
    'Contact Name':           document.getElementById('c-name').value,
    'Email':                  document.getElementById('c-email').value,
    'Phone':                  document.getElementById('c-phone').value,
    '_subject':               `Charter Request — ${document.getElementById('c-org').value} (${document.getElementById('c-pax').value} pax)`,
  };

  try {
    const res = await fetch(FORMSPREE['charters'], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      showSuccess('charters', data);
    } else {
      throw new Error();
    }
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = '<span>Try Again</span> <span>→</span>';
    alert('Something went wrong. Please try again or contact us directly.');
  }
}

// ─────────────────────────────────────────────
// Success / reset
// ─────────────────────────────────────────────

function showSuccess(type, data) {
  document.getElementById(type + '-form').classList.add('hidden');
  document.getElementById(type + '-success').classList.remove('hidden');

  const msgs = {
    transfers: `Payment confirmed! Your ${data['Trip Type']} transfer for ${data['Passengers']} passenger(s) is booked.<br>A confirmation has been sent to <strong>${data['Email']}</strong>.`,
    tours:     `Payment confirmed! You're booked on <strong>${data['Tour']}</strong> on ${data['Travel Date']}.<br>Confirmation sent to <strong>${data['Email']}</strong>.`,
    charters:  `Thank you, ${data['Contact Name']}! Our team will review your request for <strong>${data['Organization']}</strong> and send a custom quote to <strong>${data['Email']}</strong> within 24 hours. Payment will be collected once your quote is confirmed.`,
  };

  document.getElementById(type + '-success-msg').innerHTML = msgs[type];
}

function resetForm(type) {
  document.getElementById(type + '-form').classList.remove('hidden');
  document.getElementById(type + '-success').classList.add('hidden');

  if (type === 'tours') {
    document.getElementById('tour-details').classList.add('hidden');
    selectedTour = null;
    document.querySelectorAll('.adt-tour-card').forEach(c => c.classList.remove('selected'));
  }

  const btnId = type === 'transfers' ? 't-submit' : type === 'tours' ? 'tour-submit' : 'c-submit';
  const labels = {
    transfers: 'Book Transfer',
    tours:     'Reserve Tour',
    charters:  'Submit Charter Request',
  };
  const btn = document.getElementById(btnId);
  btn.disabled = false;
  btn.innerHTML = `<span>${labels[type]}</span><span>→</span>`;
}

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────

renderTourCards();
initLocationDropdowns();

const today = new Date().toISOString().split('T')[0];
document.querySelectorAll('input[type="date"]').forEach(d => d.min = today);

attachLiveValidation();

/**
 * DesignDreams – Site Configuration
 * ============================================================
 * Update the values below to connect your business services.
 * ============================================================
 */

const DD_CONFIG = {

  // ── BUSINESS INFORMATION ──────────────────────────────────
  business: {
    name:     'DesignDreams',
    tagline:  'Luxury Stainless Steel Jewelry',
    email:    'designdreamsbysyeda@gmail.com',
    phone:    '+92 333 0492914',
    whatsapp: '923330492914',
    address:  'North Nazimabad Block L, Karachi, Pakistan',
    instagram:'https://www.instagram.com/designdreams87',
    facebook: 'https://www.facebook.com/profile.php?id=100069150127731',
  },

  // ── PAYPAL CONFIGURATION ─────────────────────────────────
  // Sign up at https://developer.paypal.com to get your Client ID
  // Switch to live credentials for production
  paypal: {
    enabled:    false,                         // ← Set to true when ready
    clientId:   'YOUR_PAYPAL_CLIENT_ID',       // ← Replace with your PayPal Client ID
    currency:   'USD',
    // Note: PayPal may have limited availability for Pakistan-based merchants.
    // International customers can use PayPal. For Pakistan, use EasyPaisa/JazzCash.
  },

  // ── EASYPAISA CONFIGURATION ──────────────────────────────
  easypaisa: {
    enabled:       true,
    accountNumber: '03333283122',
    accountTitle:  'DesignDreams',
  },

  // ── JAZZCASH CONFIGURATION ───────────────────────────────
  jazzcash: {
    enabled:       true,
    accountNumber: '03333283122',
    accountTitle:  'DesignDreams',
  },

  // ── BANK TRANSFER CONFIGURATION ──────────────────────────
  bank: {
    enabled:      true,
    bankName:     'Meezan Bank',
    accountTitle: 'DesignDreams',
    iban:         'PK47MEZN0001560108328509',
  },

  // ── SHIPPING ─────────────────────────────────────────────
  shipping: {
    freeThreshold: 10000,  // Free shipping above PKR 10,000
    flatRate:      400,    // Flat shipping rate in PKR
    codFee:        500,    // Cash on Delivery fee in PKR
  },

  // ── CURRENCY ─────────────────────────────────────────────
  currency: {
    pkrToUsd: 0.0035,  // Approximate exchange rate (update regularly)
  },

  // ── WEB3FORMS (order & inquiry email delivery) ───────────
  // Get a free key at https://web3forms.com (no signup — emailed to you).
  // The key is safe to ship in client-side code: Web3Forms enforces
  // per-key rate limits and spam filtering.
  web3forms: {
    accessKey: '771faed2-6460-4f1e-b084-0cf818ac46ef',  // Live key — DesignDreams (web3forms.com)
  },
};

// ── Helpers ─────────────────────────────────────────────────
window.DD_CONFIG = DD_CONFIG;

function formatPKR(amount) {
  return 'PKR ' + Number(amount).toLocaleString('en-PK');
}

function formatUSD(amount) {
  return '$' + (amount * DD_CONFIG.currency.pkrToUsd).toFixed(2);
}

function getWhatsAppUrl(message) {
  return `https://wa.me/${DD_CONFIG.business.whatsapp}?text=${encodeURIComponent(message)}`;
}

window.formatPKR = formatPKR;
window.formatUSD = formatUSD;
window.getWhatsAppUrl = getWhatsAppUrl;

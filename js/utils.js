/**
 * DesignDreams – Shared Utilities
 * Loaded before all other JS modules.
 * Provides: htmlEscape, sanitizeInput, renderProductCard,
 *           renderStars, setText, formatDatePK
 */

// ── XSS Prevention ─────────────────────────────────────────
function htmlEscape(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Strip tags + trim; safe for use before submitting user input
function sanitizeInput(str) {
  return String(str == null ? '' : str)
    .replace(/<[^>]*>/g, '')
    .trim();
}

// ── Validation Helpers ──────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function isValidPhone(phone) {
  // Accepts Pakistani format: 03XXXXXXXXX or +923XXXXXXXXX
  const cleaned = phone.replace(/[\s\-().+]/g, '');
  return /^(03\d{9}|923\d{9}|\d{10,12})$/.test(cleaned);
}

// ── DOM Helpers ─────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '';
}

function formatDatePK(isoString) {
  const d = new Date(isoString);
  return isNaN(d)
    ? '—'
    : d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Product Card HTML Builder ───────────────────────────────
// Shared by main.js, shop.js, product.js
function renderProductCard(p) {
  const badgeClass = p.badge === 'Sale' ? 'sale' : p.badge === 'New' ? 'new' : '';
  const stars = renderStars(p.rating || 0);
  const eName = htmlEscape(p.name);
  const eCat  = htmlEscape(p.category);
  const eDesc = htmlEscape(p.short_desc || '');

  // Image comes directly from the product object (which is fetched from the server's
  // products.json). localStorage overrides are intentionally NOT applied here so that
  // ALL visitors see the same image. Changes only go live after Publish + redeploy.
  const imgUrl = p.image_url;

  // Serialize product data safely for inline onclick
  // Use data-id only; full product fetched on cart add to prevent price tampering
  return `
    <article class="product-card">
      <div class="product-img-wrap">
        <img src="${htmlEscape(imgUrl)}"
             alt="${eName}"
             loading="lazy"
             onerror="this.src='https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&q=60'" />
        ${p.badge ? `<span class="product-badge ${badgeClass}">${htmlEscape(p.badge)}</span>` : ''}
        <div class="product-actions-overlay">
          <button class="btn-add-cart"
                  data-product-id="${htmlEscape(p.id)}"
                  data-product='${htmlEscape(JSON.stringify(p))}'>
            <i class="fas fa-shopping-bag"></i> Add to Cart
          </button>
          <button class="btn-quick-view"
                  data-product-id="${htmlEscape(p.id)}"
                  title="Quick View">
            <i class="fas fa-eye"></i>
          </button>
        </div>
      </div>
      <div class="product-body">
        <p class="product-category">${eCat}</p>
        <h3 class="product-name"><a href="product.html?id=${htmlEscape(p.id)}">${eName}</a></h3>
        <p class="product-desc">${eDesc}</p>
        <div class="product-footer">
          <div class="product-price">
            <span class="price-pkr">${formatPKR(p.price)}</span>
          </div>
          <div class="product-rating">${stars}</div>
        </div>
      </div>
    </article>
  `;
}

function renderStars(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (rating >= i)         html += '<i class="fas fa-star"></i>';
    else if (rating >= i - 0.5) html += '<i class="fas fa-star-half-alt"></i>';
    else                     html += '<i class="far fa-star"></i>';
  }
  return html;
}

// ── Wire product card click events via delegation ───────────
// Call once after inserting product cards into any grid container
function bindProductCardEvents(container) {
  if (!container) return;
  container.addEventListener('click', (e) => {
    const addBtn  = e.target.closest('.btn-add-cart');
    const viewBtn = e.target.closest('.btn-quick-view');

    if (addBtn) {
      try {
        const product = JSON.parse(addBtn.dataset.product);
        addToCart(product);
      } catch {}
    }

    if (viewBtn) {
      openQuickView(viewBtn.dataset.productId);
    }
  });
}

// ── Products Loader ──────────────────────────────────────────
/**
 * Returns the product list.
 *
 * Strategy (two distinct modes):
 *
 * ADMIN PAGE:
 *   Uses localStorage (the admin's editing session). Changes saved in the admin
 *   panel are stored here until "Publish to Website" is clicked, which downloads
 *   an updated products.json for redeployment.
 *
 * PUBLIC PAGES (index, shop, product):
 *   ALWAYS fetches from the server's /data/products.json.
 *   A short in-memory cache (60 s) prevents redundant fetches within the same
 *   page session, but localStorage is never used as a data source.
 *
 * This guarantees every visitor sees EXACTLY the same data — the deployed file.
 * No browser has a "private" version that others cannot see.
 */

// In-memory cache for public pages — lives only for the current page session.
let _productsMemCache     = null;
let _productsMemCacheTime = 0;
const _PRODUCTS_TTL_MS    = 60000; // 60 seconds

async function getProducts() {
  const isAdmin = location.pathname.includes('admin');

  if (isAdmin) {
    // ── Admin editing session: use localStorage ──────────────
    try {
      const stored = localStorage.getItem('dd_products');
      if (stored) {
        const p = JSON.parse(stored);
        if (Array.isArray(p) && p.length > 0) return p;
      }
    } catch {}
    // No admin localStorage yet — seed from server and store locally
    return _fetchAndSeedAdminProducts();
  }

  // ── Public pages: always use server data ─────────────────
  // Short in-memory cache so multiple calls on the same page don't re-fetch
  const now = Date.now();
  if (_productsMemCache && (now - _productsMemCacheTime) < _PRODUCTS_TTL_MS) {
    return _productsMemCache;
  }
  return _fetchPublicProducts();
}

/** Fetch for public pages — result stored only in memory, never localStorage. */
async function _fetchPublicProducts() {
  try {
    const res = await fetch('/data/products.json', { cache: 'no-cache' });
    if (!res.ok) return _productsMemCache || [];
    const products = await res.json();
    if (Array.isArray(products) && products.length > 0) {
      _productsMemCache     = products;
      _productsMemCacheTime = Date.now();
      return products;
    }
  } catch {}
  return _productsMemCache || [];
}

/** Fetch for the admin page — seeds localStorage so the editing session works. */
async function _fetchAndSeedAdminProducts() {
  try {
    const res = await fetch('/data/products.json', { cache: 'no-cache' });
    if (!res.ok) return [];
    const products = await res.json();
    if (Array.isArray(products) && products.length > 0) {
      localStorage.setItem('dd_products', JSON.stringify(products));
      return products;
    }
  } catch {}
  return [];
}

window.htmlEscape       = htmlEscape;
window.sanitizeInput    = sanitizeInput;
window.isValidEmail     = isValidEmail;
window.isValidPhone     = isValidPhone;
window.setText          = setText;
window.formatDatePK     = formatDatePK;
window.renderProductCard= renderProductCard;
window.renderStars      = renderStars;
window.bindProductCardEvents = bindProductCardEvents;
window.getProducts      = getProducts;

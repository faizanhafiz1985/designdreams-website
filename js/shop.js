/**
 * DesignDreams – Shop Page JS
 * Loads products, handles filtering / sorting / search.
 * Depends on: utils.js, config.js, cart.js, main.js
 */

document.addEventListener('DOMContentLoaded', initShop);

let allProducts = [];
let activeFilters = {
  category: 'all',
  badge:    null,
  maxPrice: 15000,
  search:   '',
  sort:     'default',
};

async function initShop() {
  const params = new URLSearchParams(window.location.search);
  const cat    = params.get('cat');
  const search = params.get('search');

  if (cat) {
    activeFilters.category = cat;
    highlightCategoryFilter(cat);
    updateBreadcrumb(cat);
  }
  if (search) {
    activeFilters.search = search;
    const inp = document.getElementById('search-input');
    if (inp) inp.value = search;
  }

  await fetchAllProducts();
  applyFiltersAndRender();
  bindFilterEvents();
}

async function fetchAllProducts() {
  try {
    const data  = await getProducts();
    allProducts = Array.isArray(data) ? data : [];
    updateCategoryCounts(allProducts);
  } catch {
    allProducts = [];
  }
}

function updateCategoryCounts(products) {
  const cats = ['Necklaces', 'Bracelets', 'Rings', 'Earrings', 'Sets'];
  if (document.getElementById('count-all')) {
    document.getElementById('count-all').textContent = products.length;
  }
  cats.forEach(cat => {
    const el = document.getElementById(`count-${cat}`);
    if (el) el.textContent = products.filter(p => p.category === cat).length;
  });
}

function applyFiltersAndRender() {
  let filtered = [...allProducts];

  if (activeFilters.category && activeFilters.category !== 'all') {
    filtered = filtered.filter(p => p.category === activeFilters.category);
  }
  if (activeFilters.badge) {
    filtered = filtered.filter(p => p.badge === activeFilters.badge);
  }
  filtered = filtered.filter(p => p.price <= activeFilters.maxPrice);

  if (activeFilters.search) {
    const q = activeFilters.search.toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.short_desc || '').toLowerCase().includes(q)
    );
  }

  switch (activeFilters.sort) {
    case 'price-asc':   filtered.sort((a, b) => a.price - b.price); break;
    case 'price-desc':  filtered.sort((a, b) => b.price - a.price); break;
    case 'name-asc':    filtered.sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'rating-desc': filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
  }

  renderShopProducts(filtered);
}

function renderShopProducts(products) {
  const grid  = document.getElementById('shop-products-grid');
  const empty = document.getElementById('no-products');
  const count = document.getElementById('toolbar-count');
  if (!grid) return;

  if (count) count.innerHTML = `Showing <strong>${products.length}</strong> products`;

  if (products.length === 0) {
    grid.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');
  grid.innerHTML = products.map(p => renderProductCard(p)).join('');
  bindProductCardEvents(grid);
}

function bindFilterEvents() {
  // Category buttons
  document.querySelectorAll('.filter-btn[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn[data-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilters.category = btn.dataset.cat;
      applyFiltersAndRender();
      updateBreadcrumb(btn.dataset.cat === 'all' ? null : btn.dataset.cat);
    });
  });

  // Badge buttons
  ['bestseller', 'new', 'sale'].forEach(key => {
    const btn = document.getElementById(`filter-${key}`);
    if (!btn) return;
    const badgeMap = { bestseller: 'Bestseller', new: 'New', sale: 'Sale' };
    btn.addEventListener('click', () => {
      const badge = badgeMap[key];
      if (activeFilters.badge === badge) {
        activeFilters.badge = null;
        btn.classList.remove('active');
      } else {
        document.querySelectorAll('.filter-btn[data-badge]').forEach(b => b.classList.remove('active'));
        activeFilters.badge = badge;
        btn.classList.add('active');
      }
      applyFiltersAndRender();
    });
  });

  // Price range slider
  const priceRange = document.getElementById('price-max');
  const priceLabel = document.getElementById('price-max-label');
  if (priceRange) {
    priceRange.addEventListener('input', () => {
      activeFilters.maxPrice = parseInt(priceRange.value, 10);
      if (priceLabel) priceLabel.textContent = formatPKR(activeFilters.maxPrice);
      applyFiltersAndRender();
    });
  }

  // Sort
  const sortEl = document.getElementById('sort-select');
  if (sortEl) {
    sortEl.addEventListener('change', () => {
      activeFilters.sort = sortEl.value;
      applyFiltersAndRender();
    });
  }

  // Clear all filters
  document.getElementById('clear-filters')?.addEventListener('click', () => {
    activeFilters = { category: 'all', badge: null, maxPrice: 15000, search: '', sort: 'default' };
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.filter-btn[data-cat="all"]')?.classList.add('active');
    const pr = document.getElementById('price-max');
    if (pr) pr.value = 15000;
    const pl = document.getElementById('price-max-label');
    if (pl) pl.textContent = 'PKR 15,000';
    const si = document.getElementById('sort-select');
    if (si) si.value = 'default';
    applyFiltersAndRender();
  });

  // Live search (shop page sidebar)
  const inp = document.getElementById('search-input');
  if (inp) {
    inp.addEventListener('input', () => {
      activeFilters.search = inp.value.trim();
      applyFiltersAndRender();
    });
  }
}

function highlightCategoryFilter(cat) {
  document.querySelectorAll('.filter-btn[data-cat]').forEach(b => b.classList.remove('active'));
  document.querySelector(`.filter-btn[data-cat="${CSS.escape(cat)}"]`)?.classList.add('active');
}

function updateBreadcrumb(cat) {
  const el = document.getElementById('breadcrumb-current');
  if (el) el.textContent = cat || 'All Jewelry';
  const h1 = document.querySelector('.shop-hero h1');
  if (h1) h1.textContent = cat || 'All Jewelry';
}

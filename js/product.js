/**
 * DesignDreams – Product Detail Page
 * Depends on: utils.js, config.js, cart.js, main.js
 */

document.addEventListener('DOMContentLoaded', () => {
  const id = new URLSearchParams(window.location.search).get('id');
  if (id) loadProduct(id);
  else window.location.href = 'shop.html';
});

let currentProduct = null;
let qty = 1;

async function loadProduct(id) {
  try {
    const all = await getProducts();
    window._ddAllProducts = all;   // cache for quick view on other pages
    currentProduct = (Array.isArray(all) ? all : []).find(p => p.id === id) || null;
    if (!currentProduct) throw new Error('Not found');
    renderProduct(currentProduct);
    loadRelated(currentProduct.category, currentProduct.id, all);
  } catch {
    const loadingEl = document.getElementById('product-loading');
    if (loadingEl) {
      loadingEl.innerHTML = `
        <i class="fas fa-exclamation-circle" style="font-size:2rem;color:var(--gold);display:block;margin-bottom:16px;"></i>
        <p>Product not found.</p>
        <a href="shop.html" class="btn btn-gold mt-16" style="display:inline-flex;">Back to Shop</a>`;
    }
  }
}

function renderProduct(p) {
  // Safe page title (no HTML injection risk in title, but good practice)
  document.title = `${p.name} – DesignDreams`;

  // Use textContent for all user-sourced strings
  setText('bc-product', p.name);
  setText('det-category', p.category);
  setText('det-name', p.name);
  setText('det-price-pkr', formatPKR(p.price));
  setText('det-material', p.material || '');

  // Description may contain safe rich text from admin; use textContent for safety
  // If rich HTML is needed from admin, validate/sanitize server-side first
  setText('det-desc', p.description || p.short_desc || '');

  const starsEl = document.getElementById('det-stars');
  if (starsEl) starsEl.innerHTML = renderStars(p.rating || 0);
  setText('det-rating-text', `${p.rating} / 5 ★`);

  const stockEl = document.getElementById('det-stock');
  if (stockEl) {
    // innerHTML is safe here — no user data; only a boolean flag
    stockEl.innerHTML = p.in_stock
      ? '<span style="color:green;"><i class="fas fa-check-circle"></i> In Stock</span>'
      : '<span style="color:#c0392b;"><i class="fas fa-times-circle"></i> Out of Stock</span>';
  }

  // Main image
  const mainImg = document.getElementById('main-image');
  if (mainImg) {
    mainImg.src = p.image_url;
    mainImg.alt = p.name;
    mainImg.onerror = () => {
      mainImg.src = 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600&q=80';
    };
  }

  // Thumbnails
  const thumbImages = [
    p.image_url,
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=200&q=70',
    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=200&q=70',
  ];
  const thumbsEl = document.getElementById('thumbnails');
  if (thumbsEl) {
    thumbsEl.innerHTML = thumbImages.map((url, i) => `
      <img class="product-thumbnail ${i === 0 ? 'active' : ''}"
           src="${htmlEscape(url)}"
           alt="View ${i + 1}"
           data-url="${htmlEscape(url)}"
           onerror="this.style.display='none'" />`
    ).join('');

    thumbsEl.addEventListener('click', (e) => {
      const thumb = e.target.closest('.product-thumbnail');
      if (!thumb) return;
      switchImage(thumb.dataset.url, thumb);
    });
  }

  // Add to Cart
  document.getElementById('det-add-cart')?.addEventListener('click', () => {
    addToCart(p, qty);
  });

  // WhatsApp order button
  const waBtn = document.getElementById('det-whatsapp-order');
  if (waBtn) {
    const msg = `Hi DesignDreams! I want to order: *${p.name}* (${formatPKR(p.price)}). Please help me complete my order.`;
    waBtn.href   = getWhatsAppUrl(msg);
    waBtn.target = '_blank';
    waBtn.rel    = 'noopener noreferrer';
  }

  // Buy Now
  document.getElementById('det-buy-now')?.addEventListener('click', (e) => {
    e.preventDefault();
    addToCart(p, qty);
    setTimeout(() => { window.location.href = 'checkout.html'; }, 400);
  });

  // Share buttons
  const pageUrl   = encodeURIComponent(window.location.href);
  const shareText = encodeURIComponent(`Check out ${p.name} at DesignDreams!`);

  const shareWa = document.getElementById('share-wa');
  const shareFb = document.getElementById('share-fb');
  const copyLink= document.getElementById('copy-link');

  if (shareWa) {
    shareWa.href = `https://wa.me/?text=${shareText}%20${pageUrl}`;
    shareWa.rel  = 'noopener noreferrer';
  }
  if (shareFb) {
    shareFb.href = `https://www.facebook.com/sharer/sharer.php?u=${pageUrl}`;
    shareFb.rel  = 'noopener noreferrer';
  }
  if (copyLink) {
    copyLink.addEventListener('click', (e) => {
      e.preventDefault();
      navigator.clipboard?.writeText(window.location.href).then(() => {
        showToast('Link copied!', 'success');
      });
    });
  }

  // Quantity controls
  const qtyEl    = document.getElementById('qty-val');
  document.getElementById('qty-minus')?.addEventListener('click', () => {
    if (qty > 1) { qty--; if (qtyEl) qtyEl.textContent = qty; }
  });
  document.getElementById('qty-plus')?.addEventListener('click', () => {
    qty++;
    if (qtyEl) qtyEl.textContent = qty;
  });

  // Show product, hide loading state
  document.getElementById('product-loading').style.display = 'none';
  document.getElementById('product-detail').style.display  = 'grid';
}

function switchImage(url, thumb) {
  const mainImg = document.getElementById('main-image');
  if (mainImg) mainImg.src = url;
  document.querySelectorAll('.product-thumbnail').forEach(t => t.classList.remove('active'));
  thumb?.classList.add('active');
}
window.switchImage = switchImage;

async function loadRelated(category, excludeId, cachedProducts) {
  try {
    // Use already-loaded array; avoid a second network request
    const all = cachedProducts || window._ddAllProducts || await getProducts();

    const related = (Array.isArray(all) ? all : [])
      .filter(p => p.category === category && p.id !== excludeId)
      .slice(0, 4);

    if (!related.length) return;

    const section = document.getElementById('related-section');
    const grid    = document.getElementById('related-grid');
    if (section && grid) {
      grid.innerHTML = related.map(p => renderProductCard(p)).join('');
      bindProductCardEvents(grid);
      section.style.display = 'block';
    }
  } catch {}
}

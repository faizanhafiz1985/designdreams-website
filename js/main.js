/**
 * DesignDreams – Main JS
 * Handles: header scroll, hero slider, mobile nav, search,
 *          featured products, quick view modal, inquiry form.
 * Depends on: utils.js, config.js, cart.js
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Header Scroll Effect ──────────────────────────────────
  const header = document.getElementById('site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 50);
    });
  }

  // ── Mobile Hamburger ──────────────────────────────────────
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('nav-links');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('mobile-open');
      hamburger.innerHTML = isOpen
        ? '<i class="fas fa-times"></i>'
        : '<i class="fas fa-bars"></i>';
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    document.querySelectorAll('.has-dropdown').forEach(item => {
      item.querySelector('.nav-link')?.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          item.classList.toggle('mobile-expanded');
        }
      });
    });

    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          navLinks.classList.remove('mobile-open');
          hamburger.innerHTML = '<i class="fas fa-bars"></i>';
          document.body.style.overflow = '';
        }
      });
    });
  }

  // ── Search Toggle ─────────────────────────────────────────
  const searchToggle  = document.getElementById('search-toggle');
  const searchWrapper = document.getElementById('search-bar-wrapper');
  const searchClose   = document.getElementById('search-close');
  const searchInput   = document.getElementById('search-input');

  if (searchToggle && searchWrapper) {
    searchToggle.addEventListener('click', () => {
      searchWrapper.classList.toggle('open');
      if (searchWrapper.classList.contains('open')) searchInput?.focus();
    });
    searchClose?.addEventListener('click', () => searchWrapper.classList.remove('open'));

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q) window.location.href = `shop.html?search=${encodeURIComponent(q)}`;
      }
    });
  }

  // ── Apply admin-saved hero images ─────────────────────────
  applyAdminHeroSlides();

  // ── Hero Slider ───────────────────────────────────────────
  const slides = document.querySelectorAll('.hero-slide');
  const dots   = document.querySelectorAll('.dot');
  let currentSlide = 0;
  let sliderTimer;

  if (slides.length > 1) {
    function goToSlide(n) {
      slides[currentSlide].classList.remove('active');
      dots[currentSlide]?.classList.remove('active');
      currentSlide = (n + slides.length) % slides.length;
      slides[currentSlide].classList.add('active');
      dots[currentSlide]?.classList.add('active');
    }

    function startSlider() {
      sliderTimer = setInterval(() => goToSlide(currentSlide + 1), 5000);
    }

    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        clearInterval(sliderTimer);
        goToSlide(parseInt(dot.dataset.slide, 10));
        startSlider();
      });
    });

    startSlider();
  }

  // ── Featured Products (homepage only) ────────────────────
  const featuredGrid = document.getElementById('featured-products-grid');
  if (featuredGrid) loadFeaturedProducts();

  // ── Inquiry Form ──────────────────────────────────────────
  document.getElementById('inquiry-form')?.addEventListener('submit', handleInquirySubmit);
});

// ── Apply Admin-Saved Hero Slides ─────────────────────────
function applyAdminHeroSlides() {
  try {
    const stored = localStorage.getItem('dd_hero_slides');
    if (!stored) return;
    const slides = JSON.parse(stored);
    const els = document.querySelectorAll('.hero-slide');
    slides.forEach((s, i) => {
      // Validate URL before applying to prevent CSS injection via background-image
      if (els[i] && s.url && (s.url.startsWith('http') || s.url.startsWith('data:image/'))) {
        els[i].style.backgroundImage = `url('${s.url.replace(/'/g, "\\'")}')`;
      }
    });
  } catch {}
}

// ── Load Featured Products ─────────────────────────────────
async function loadFeaturedProducts() {
  const grid = document.getElementById('featured-products-grid');
  if (!grid) return;

  try {
    const all      = await getProducts();
    const products = [...(Array.isArray(all) ? all : [])]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 4);

    // Cache globally so openQuickView can find by ID without a separate fetch
    window._ddAllProducts = all;

    if (products.length === 0) {
      grid.innerHTML = '<div class="loading-spinner">No products found.</div>';
      return;
    }

    grid.innerHTML = products.map(p => renderProductCard(p)).join('');
    bindProductCardEvents(grid);
  } catch {
    grid.innerHTML = `
      <div class="loading-spinner">
        <i class="fas fa-exclamation-circle" style="color:var(--gold)"></i>
        Could not load products. <a href="shop.html" style="color:var(--gold)">Visit shop →</a>
      </div>`;
  }
}

// ── Quick View Modal ──────────────────────────────────────
async function openQuickView(id) {
  try {
    // Use cached product list; fall back to getProducts() if not loaded yet
    let all = window._ddAllProducts;
    if (!all) {
      all = await getProducts();
      window._ddAllProducts = all;
    }
    const p = (Array.isArray(all) ? all : []).find(x => x.id === id);
    if (!p) throw new Error('Not found');

    let overlay = document.getElementById('quick-view-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'quick-view-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }

    // All dynamic values escaped; addToCart uses data attribute, not inline eval
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${htmlEscape(p.name)}</h3>
          <button class="btn-icon" id="qv-close"><i class="fas fa-times"></i></button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start;">
          <img src="${htmlEscape(p.image_url)}" alt="${htmlEscape(p.name)}"
               style="width:100%;border-radius:8px;aspect-ratio:4/5;object-fit:cover;"
               onerror="this.src='https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=300&q=60'" />
          <div>
            <p style="font-size:0.72rem;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:6px;"
               id="qv-category"></p>
            <div style="font-size:1.5rem;font-weight:700;margin-bottom:4px;">${formatPKR(p.price)}</div>
            <p style="font-size:0.875rem;color:var(--gray);line-height:1.8;margin-bottom:20px;"
               id="qv-desc"></p>
            <p style="font-size:0.8rem;margin-bottom:20px;color:var(--dark);">
              <strong>Material:</strong> <span id="qv-material"></span>
            </p>
            <div style="display:flex;flex-direction:column;gap:10px;">
              <button class="btn btn-gold btn-full" id="qv-add-cart">
                <i class="fas fa-shopping-bag"></i> Add to Cart
              </button>
              <a href="product.html?id=${htmlEscape(p.id)}" class="btn btn-outline-gold btn-full">
                View Full Details
              </a>
            </div>
          </div>
        </div>
      </div>`;

    // Set text nodes — never innerHTML — for user-sourced content
    overlay.querySelector('#qv-category').textContent = p.category;
    overlay.querySelector('#qv-desc').textContent     = p.short_desc || '';
    overlay.querySelector('#qv-material').textContent = p.material   || '';

    overlay.querySelector('#qv-add-cart').addEventListener('click', () => {
      addToCart(p);
      overlay.classList.remove('open');
    });
    overlay.querySelector('#qv-close').addEventListener('click', () => {
      overlay.classList.remove('open');
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });

    overlay.classList.add('open');
  } catch {
    showToast('Could not load product details', 'error');
  }
}
window.openQuickView = openQuickView;

// ── Inquiry Form Handler ──────────────────────────────────
async function handleInquirySubmit(e) {
  e.preventDefault();
  const form    = e.target;
  const btn     = document.getElementById('inquiry-submit');
  const success = document.getElementById('inquiry-success');
  const error   = document.getElementById('inquiry-error');

  const name    = sanitizeInput(document.getElementById('inq-name')?.value    || '');
  const email   = sanitizeInput(document.getElementById('inq-email')?.value   || '');
  const phone   = sanitizeInput(document.getElementById('inq-phone')?.value   || '');
  const subject = sanitizeInput(document.getElementById('inq-subject')?.value || '');
  const message = sanitizeInput(document.getElementById('inq-message')?.value || '');

  if (!name || !email || !subject || !message) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }
  if (!isValidEmail(email)) {
    showToast('Please enter a valid email address.', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';
  success?.classList.add('hidden');
  error?.classList.add('hidden');

  try {
    // Submit to Web3Forms — delivers an email to the owner's inbox
    const settings = (function(){
      try { return JSON.parse(localStorage.getItem('dd_admin_settings') || '{}'); }
      catch { return {}; }
    })();
    const w3fKey = settings.web3forms_key
      || (window.DD_CONFIG && DD_CONFIG.web3forms && DD_CONFIG.web3forms.accessKey)
      || '';
    if (!w3fKey) throw new Error('Web3Forms not configured');

    await fetch('https://api.web3forms.com/submit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify({
        access_key: w3fKey,
        subject:    `New Inquiry from ${name} — ${subject}`,
        from_name:  'DesignDreams Inquiries',
        form_type:  'inquiry-form',
        name, email, phone, message,
        inquiry_subject: subject,
      }),
    });

    if (success) {
      success.classList.remove('hidden');
      // Build success message using DOM — not innerHTML with user data
      success.textContent = '';
      const p1 = document.createElement('p');
      p1.innerHTML = `✅ Thank you, <strong>${htmlEscape(name)}</strong>! Your inquiry has been received.`;
      const p2 = document.createElement('p');
      p2.innerHTML = `We'll respond to <strong>${htmlEscape(email)}</strong> within 24 hours.`;
      const waMsg = `Hi DesignDreams! My name is ${name}. Inquiry: ${subject}. ${message}`;
      const waLink = document.createElement('a');
      waLink.href = getWhatsAppUrl(waMsg);
      waLink.target = '_blank';
      waLink.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-top:8px;color:#25D366;font-weight:600;';
      waLink.innerHTML = '<i class="fab fa-whatsapp"></i>';
      waLink.appendChild(document.createTextNode(' Also send via WhatsApp for faster response'));
      success.append(p1, p2, waLink);
    }
    // ── Save inquiry to localStorage for admin panel ────────
    try {
      const allInq = JSON.parse(localStorage.getItem('dd_inquiries') || '[]');
      allInq.unshift({
        id:         'inq-' + Date.now(),
        name, email, phone, subject, message,
        status:     'New',
        created_at: new Date().toISOString(),
      });
      if (allInq.length > 500) allInq.length = 500;
      localStorage.setItem('dd_inquiries', JSON.stringify(allInq));
    } catch { /* storage full – skip */ }

    form.reset();
  } catch {
    if (error) {
      error.classList.remove('hidden');
      error.textContent = '❌ Failed to send inquiry. Please try via WhatsApp or email directly.';
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Send Inquiry</span><i class="fas fa-paper-plane"></i>';
  }
}

// Note: applyAdminSettings() is now handled by content.js which runs on every page.

/**
 * DesignDreams – Dynamic Content Override
 * Loaded FIRST on every page before utils.js.
 * Applies: dd_theme, dd_announcement, dd_content, dd_seo,
 *          dd_admin_settings, dd_testimonials, dd_gallery, dd_categories.
 */

// ── Theme ──────────────────────────────────────────────────
(function applyTheme() {
  try {
    const theme = JSON.parse(localStorage.getItem('dd_theme') || '{}');
    if (!theme || !Object.keys(theme).length) return;
    const rules = [];
    if (theme.gold)      rules.push(`--gold: ${theme.gold};`);
    if (theme.gold_dark) rules.push(`--gold-dark: ${theme.gold_dark};`);
    if (theme.dark)      rules.push(`--dark: ${theme.dark};`);
    if (!rules.length) return;
    const style = document.createElement('style');
    style.id = 'dd-theme-override';
    style.textContent = `:root { ${rules.join(' ')} }`;
    document.head.appendChild(style);
  } catch {}
})();

// ── Announcement Banner ────────────────────────────────────
(function applyAnnouncement() {
  try {
    const ann = JSON.parse(localStorage.getItem('dd_announcement') || '{}');
    if (!ann || !ann.enabled || !ann.text) return;

    // Check if dismissed this session
    if (sessionStorage.getItem('dd_ann_dismissed') === '1') return;

    const bar = document.createElement('div');
    bar.id = 'dd-announcement-bar';
    const bg = ann.color || '#2d7d46';
    bar.style.cssText = `
      background:${bg};color:#fff;text-align:center;padding:10px 48px 10px 16px;
      font-size:0.875rem;font-weight:500;position:relative;z-index:9999;
      font-family:sans-serif;line-height:1.5;`;
    const msg = document.createElement('span');
    msg.textContent = ann.text;
    const close = document.createElement('button');
    close.setAttribute('aria-label', 'Dismiss');
    close.style.cssText = `
      position:absolute;right:12px;top:50%;transform:translateY(-50%);
      background:none;border:none;color:#fff;cursor:pointer;font-size:1.1rem;
      opacity:0.8;padding:4px;`;
    close.innerHTML = '&times;';
    close.addEventListener('click', () => {
      bar.remove();
      sessionStorage.setItem('dd_ann_dismissed', '1');
    });
    bar.appendChild(msg);
    bar.appendChild(close);

    // Insert before body's first child
    if (document.body) {
      document.body.insertBefore(bar, document.body.firstChild);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.insertBefore(bar, document.body.firstChild);
      });
    }
  } catch {}
})();

// ── SEO (title + meta description) ────────────────────────
(function applySeo() {
  try {
    const seo  = JSON.parse(localStorage.getItem('dd_seo') || '{}');
    if (!seo || !Object.keys(seo).length) return;
    const page = location.pathname.split('/').pop() || 'index.html';

    let title = '';
    let desc  = '';

    if (page === 'index.html' || page === '' || page === '/') {
      title = seo.home_title;
      desc  = seo.home_desc;
    } else if (page === 'shop.html') {
      title = seo.shop_title;
      desc  = seo.shop_desc;
    } else if (page === 'product.html') {
      // Product-specific title will be overridden by product.js; skip
    }

    if (title) document.title = title;
    if (desc) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', desc);
    }
  } catch {}
})();

// ── Admin Settings (WhatsApp, payment numbers, social links) ──
(function applyAdminSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('dd_admin_settings') || '{}');
    if (!saved || !Object.keys(saved).length) return;

    document.addEventListener('DOMContentLoaded', () => {
      // 1. WhatsApp number
      const wa = (saved.whatsapp || '').replace(/\D/g, '');
      if (wa && wa.length >= 10) {
        if (window.DD_CONFIG) DD_CONFIG.business.whatsapp = wa;
        document.querySelectorAll('a[href*="wa.me/"]').forEach(a => {
          const old     = a.getAttribute('href');
          const updated = old.replace(/wa\.me\/\d+/, `wa.me/${wa}`);
          if (old !== updated) a.setAttribute('href', updated);
          const txt = a.textContent.trim();
          if (/^\+92[\s\-\d]{9,13}$/.test(txt) || /^0\d{10}$/.test(txt)) {
            const digits = wa.startsWith('92') ? wa.slice(2) : wa;
            a.textContent = `+92 ${digits.slice(0, 3)} ${digits.slice(3)}`;
          }
        });
        document.querySelectorAll('.top-bar span, .footer-contact li').forEach(el => {
          if (/\+92\s*\d{3}/.test(el.textContent)) {
            el.innerHTML = el.innerHTML.replace(/\+92[\s\d]+/, () => {
              const d = wa.startsWith('92') ? wa.slice(2) : wa;
              return `+92 ${d.slice(0, 3)} ${d.slice(3)}`;
            });
          }
        });
      }

      // 2. EasyPaisa
      if (saved.ep_number) {
        if (window.DD_CONFIG) {
          DD_CONFIG.easypaisa.accountNumber = saved.ep_number;
          if (saved.ep_title) DD_CONFIG.easypaisa.accountTitle = saved.ep_title;
        }
        const el = document.getElementById('ep-number');
        if (el) el.textContent = saved.ep_number;
      }

      // 3. JazzCash
      if (saved.jc_number) {
        if (window.DD_CONFIG) {
          DD_CONFIG.jazzcash.accountNumber = saved.jc_number;
          if (saved.jc_title) DD_CONFIG.jazzcash.accountTitle = saved.jc_title;
        }
        const el = document.getElementById('jc-number');
        if (el) el.textContent = saved.jc_number;
      }

      // 4. Bank IBAN
      if (saved.bank_iban) {
        if (window.DD_CONFIG) {
          DD_CONFIG.bank.iban = saved.bank_iban;
          if (saved.bank_title) DD_CONFIG.bank.accountTitle = saved.bank_title;
        }
        const el = document.getElementById('bank-iban');
        if (el) el.textContent = saved.bank_iban;
      }

      // 5. Free shipping threshold
      if (saved.free_shipping && window.DD_CONFIG) {
        DD_CONFIG.shipping.freeThreshold = parseInt(saved.free_shipping) || DD_CONFIG.shipping.freeThreshold;
      }

      // 6. Instagram / Facebook
      if (saved.instagram) {
        document.querySelectorAll('a[aria-label="Instagram"]').forEach(a => {
          a.href = saved.instagram;
        });
      }
      if (saved.facebook) {
        document.querySelectorAll('a[aria-label="Facebook"]').forEach(a => {
          a.href = saved.facebook;
        });
      }
    });
  } catch {}
})();

// ── Content Overrides ──────────────────────────────────────
// Applied after DOMContentLoaded so elements exist in DOM.
document.addEventListener('DOMContentLoaded', function () {
  applyDynamicContent();
  applyTestimonials();
  applyGallery();
  applyCategories();
});

function applyDynamicContent() {
  try {
    const content = JSON.parse(localStorage.getItem('dd_content') || '{}');
    if (!content || !Object.keys(content).length) return;
    Object.entries(content).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (!el) return;
      // Images: set src
      if (el.tagName === 'IMG') {
        el.src = value;
        return;
      }
      // Anchors: set href
      if (el.tagName === 'A') {
        el.href = value;
        return;
      }
      // Everything else: safe textContent
      el.textContent = value;
    });
  } catch {}
}
window.applyDynamicContent = applyDynamicContent;

// ── Simple star renderer (no dependency on utils.js) ──────
function simpleStars(n) {
  const full  = Math.min(5, Math.max(0, Math.round(n)));
  const empty = 5 - full;
  return '★'.repeat(full) + '☆'.repeat(empty);
}

// ── Testimonials ───────────────────────────────────────────
function applyTestimonials() {
  const grid = document.getElementById('testimonials-grid');
  if (!grid) return;
  try {
    const testimonials = JSON.parse(localStorage.getItem('dd_testimonials') || '[]');
    if (!Array.isArray(testimonials) || !testimonials.length) return;
    grid.innerHTML = '';
    testimonials.forEach(t => {
      const article = document.createElement('article');
      article.className = 'testimonial-card';

      const stars = document.createElement('div');
      stars.className = 'stars';
      stars.textContent = simpleStars(t.rating || 5);

      const p = document.createElement('p');
      const quote = document.createTextNode('“' + (t.text || '') + '”');
      p.appendChild(quote);

      const footer = document.createElement('footer');
      const strong = document.createElement('strong');
      strong.textContent = t.name || '';
      footer.appendChild(strong);
      footer.appendChild(document.createTextNode(' – ' + (t.city || '')));

      article.appendChild(stars);
      article.appendChild(p);
      article.appendChild(footer);
      grid.appendChild(article);
    });
  } catch {}
}
window.applyTestimonials = applyTestimonials;

// ── Gallery ────────────────────────────────────────────────
function applyGallery() {
  const strip = document.getElementById('gallery-strip');
  if (!strip) return;
  try {
    const gallery = JSON.parse(localStorage.getItem('dd_gallery') || '[]');
    if (!Array.isArray(gallery) || !gallery.length) return;
    strip.innerHTML = '';
    gallery.forEach(item => {
      if (!item || !item.url) return;
      const a = document.createElement('a');
      a.className = 'gallery-item';
      a.href = item.link || 'shop.html';
      // Validate URL before using in CSS to prevent injection
      const safeUrl = (item.url.startsWith('http') || item.url.startsWith('data:image/'))
        ? item.url.replace(/'/g, "\\'")
        : '';
      if (!safeUrl) return;
      a.style.backgroundImage = `url('${safeUrl}')`;
      const span = document.createElement('span');
      span.className = 'gallery-overlay';
      span.innerHTML = '<i class="fab fa-instagram"></i>';
      a.appendChild(span);
      strip.appendChild(a);
    });
  } catch {}
}
window.applyGallery = applyGallery;

// ── Category Cards ─────────────────────────────────────────
function applyCategories() {
  try {
    const categories = JSON.parse(localStorage.getItem('dd_categories') || '[]');
    if (!Array.isArray(categories) || !categories.length) return;
    categories.forEach(cat => {
      if (!cat || !cat.name || !cat.image_url) return;
      const safeUrl = (cat.image_url.startsWith('http') || cat.image_url.startsWith('data:image/'))
        ? cat.image_url.replace(/'/g, "\\'")
        : '';
      if (!safeUrl) return;
      const card = document.querySelector(`.category-card[href*="cat=${encodeURIComponent(cat.name)}"] .category-img`);
      if (card) {
        card.style.backgroundImage = `url('${safeUrl}')`;
      }
    });
  } catch {}
}
window.applyCategories = applyCategories;

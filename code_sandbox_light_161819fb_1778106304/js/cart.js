/**
 * DesignDreams – Cart Module
 * Manages cart state in localStorage + renders cart drawer.
 * Depends on: utils.js, config.js
 */

const CART_KEY = 'dd_cart';

// ── State ──────────────────────────────────────────────────
let cart = loadCart();

function loadCart() {
  try {
    const data = localStorage.getItem(CART_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartUI();
}

// ── CRUD ───────────────────────────────────────────────────
function addToCart(product, qty = 1) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.qty += qty;
  } else {
    // Store only the fields we need; never trust injected price from UI manipulation
    cart.push({
      id:        product.id,
      name:      product.name,
      price:     product.price,
      price_usd: product.price_usd,
      image_url: product.image_url,
      category:  product.category,
      qty,
    });
  }
  saveCart();
  openCart();
  showToast(`${htmlEscape(product.name)} added to cart!`, 'success');
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
}

function updateQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart();
}

function clearCart() {
  cart = [];
  saveCart();
}

function getCart()       { return cart; }
function getCartTotal()  { return cart.reduce((sum, item) => sum + item.price * item.qty, 0); }
function getCartCount()  { return cart.reduce((sum, item) => sum + item.qty, 0); }

// ── UI ─────────────────────────────────────────────────────
function updateCartUI() {
  const count    = getCartCount();
  const totalPKR = getCartTotal();

  document.querySelectorAll('#cart-badge, #cart-count').forEach(el => {
    el.textContent = count;
  });

  const totalEl = document.getElementById('cart-total-pkr');
  if (totalEl) totalEl.textContent = formatPKR(totalPKR);

  renderCartItems();

  const footer = document.getElementById('cart-footer');
  const empty  = document.getElementById('cart-empty');
  if (footer) footer.style.display = count > 0 ? 'block' : 'none';
  if (empty)  empty.style.display  = count > 0 ? 'none'  : 'flex';
}

function renderCartItems() {
  const list = document.getElementById('cart-items');
  if (!list) return;
  list.innerHTML = '';

  cart.forEach(item => {
    const li = document.createElement('li');
    li.className = 'cart-item';
    // Use textContent/setAttribute for dynamic values to prevent XSS
    li.innerHTML = `
      <img class="cart-item-img"
           src="${htmlEscape(item.image_url)}"
           alt="${htmlEscape(item.name)}"
           onerror="this.src='https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=150&q=60'" />
      <div class="cart-item-info">
        <p class="cart-item-name"></p>
        <p class="cart-item-price">${formatPKR(item.price)}</p>
        <div class="cart-item-actions">
          <button class="qty-btn" data-id="${htmlEscape(item.id)}" data-delta="-1">
            <i class="fas fa-minus fa-xs"></i>
          </button>
          <span class="qty-display">${item.qty}</span>
          <button class="qty-btn" data-id="${htmlEscape(item.id)}" data-delta="1">
            <i class="fas fa-plus fa-xs"></i>
          </button>
          <button class="btn-remove" data-id="${htmlEscape(item.id)}">Remove</button>
        </div>
      </div>
    `;
    // Set name as text (not innerHTML) to prevent XSS
    li.querySelector('.cart-item-name').textContent = item.name;
    list.appendChild(li);
  });
}

// ── Drawer Open/Close ──────────────────────────────────────
function openCart() {
  document.getElementById('cart-drawer')?.classList.add('open');
  document.getElementById('cart-overlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cart-drawer')?.classList.remove('open');
  document.getElementById('cart-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Toast ──────────────────────────────────────────────────
function showToast(message, type = '') {
  // Ensure container exists and is always appended to body at top level
  // (avoids stacking-context traps in admin panel layout)
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  // Re-append to body each time to escape any nested stacking context
  if (container.parentElement !== document.body) {
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message; // textContent prevents HTML injection in toasts
  // Force inline styles as a fallback guarantee (in case CSS isn't loaded yet)
  toast.style.cssText = [
    'position:relative',
    'padding:14px 24px',
    'border-radius:8px',
    'font-size:0.9rem',
    'color:#fff',
    'min-width:280px',
    'max-width:420px',
    'text-align:center',
    'box-shadow:0 4px 20px rgba(0,0,0,0.25)',
    'animation:slideUp 0.3s ease forwards',
    type === 'success' ? 'background:#22c55e' : type === 'error' ? 'background:#ef4444' : 'background:#1a1a2e'
  ].join(';');

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity   = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition= '0.3s ease';
    setTimeout(() => toast.remove(), 350);
  }, 4000);
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('toast-container')) {
    const tc = document.createElement('div');
    tc.id = 'toast-container';
    document.body.appendChild(tc);
  }

  updateCartUI();

  document.getElementById('cart-toggle')?.addEventListener('click', openCart);
  document.getElementById('cart-close')?.addEventListener('click', closeCart);
  document.getElementById('cart-overlay')?.addEventListener('click', closeCart);

  // Event delegation for qty/remove buttons — avoids inline onclick on dynamic HTML
  document.getElementById('cart-items')?.addEventListener('click', (e) => {
    const qtyBtn    = e.target.closest('.qty-btn');
    const removeBtn = e.target.closest('.btn-remove');

    if (qtyBtn) {
      updateQty(qtyBtn.dataset.id, parseInt(qtyBtn.dataset.delta, 10));
    }
    if (removeBtn) {
      removeFromCart(removeBtn.dataset.id);
    }
  });
});

// ── Exports (global) ───────────────────────────────────────
window.addToCart     = addToCart;
window.removeFromCart= removeFromCart;
window.updateQty     = updateQty;
window.clearCart     = clearCart;
window.getCart       = getCart;
window.getCartTotal  = getCartTotal;
window.getCartCount  = getCartCount;
window.openCart      = openCart;
window.closeCart     = closeCart;
window.showToast     = showToast;
window.updateCartUI  = updateCartUI;

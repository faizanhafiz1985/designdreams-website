/**
 * DesignDreams – Checkout JS
 * Handles: order summary, payment methods, order placement,
 *          EmailJS / mailto confirmation, PayPal SDK.
 * Depends on: utils.js, config.js, cart.js
 */

// ── EmailJS Loader ────────────────────────────────────────
function loadEmailJS() {
  const settings = getAdminSettings();
  if (!settings.emailjs_key) return;
  const script  = document.createElement('script');
  script.src    = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
  script.onload = () => emailjs.init(settings.emailjs_key);
  document.head.appendChild(script);
}

function getAdminSettings() {
  try { return JSON.parse(localStorage.getItem('dd_admin_settings') || '{}'); }
  catch { return {}; }
}

// ── Order Number ──────────────────────────────────────────
function generateOrderNumber() {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DD-${ts}-${rnd}`;
}

document.addEventListener('DOMContentLoaded', () => {
  loadEmailJS();
  initCheckout();
});

let selectedPayment = null;

function initCheckout() {
  renderOrderSummary();
  bindPaymentMethodEvents();
  bindPlaceOrderBtn();
  loadPayPalSDK();
}

// ── Order Summary Rendering ───────────────────────────────
function renderOrderSummary() {
  const items     = getCart();
  const container = document.getElementById('order-items');
  if (!container) return;

  if (items.length === 0) {
    window.location.href = 'shop.html';
    return;
  }

  container.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'order-item';
    // Use safe attribute setting for src/alt
    div.innerHTML = `
      <img src="${htmlEscape(item.image_url)}" alt="${htmlEscape(item.name)}"
           onerror="this.src='https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=150&q=60'" />
      <div class="order-item-info">
        <p class="order-item-name"></p>
        <small class="order-item-meta"></small>
      </div>
      <span class="order-item-price">${formatPKR(item.price * item.qty)}</span>`;
    div.querySelector('.order-item-name').textContent = item.name;
    div.querySelector('.order-item-meta').textContent = `${item.category} × ${item.qty}`;
    container.appendChild(div);
  });

  updateTotals();
}

function updateTotals(codFee = false) {
  const subtotal = getCartTotal();
  const cfg      = DD_CONFIG.shipping;
  const shipping = subtotal >= cfg.freeThreshold ? 0 : cfg.flatRate;
  const cod      = codFee ? cfg.codFee : 0;
  const total    = subtotal + shipping + cod;

  setText('summary-subtotal', formatPKR(subtotal));
  setText('summary-shipping', shipping === 0 ? 'Free' : formatPKR(shipping));
  setText('summary-total',    formatPKR(total));

  const codRow = document.getElementById('cod-fee-row');
  if (codRow) codRow.style.display = codFee ? 'flex' : 'none';

  setText('ep-amount',   formatPKR(total));
  setText('jc-amount',   formatPKR(total));
  setText('bank-amount', formatPKR(total));

  if (DD_CONFIG.easypaisa) setText('ep-number',  DD_CONFIG.easypaisa.accountNumber);
  if (DD_CONFIG.jazzcash)  setText('jc-number',  DD_CONFIG.jazzcash.accountNumber);
  if (DD_CONFIG.bank)      setText('bank-iban',   DD_CONFIG.bank.iban);
}

// ── Payment Method Events ─────────────────────────────────
function bindPaymentMethodEvents() {
  document.querySelectorAll('.payment-method-option input[type=radio]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.payment-method-option').forEach(el => el.classList.remove('selected'));
      radio.closest('.payment-method-option').classList.add('selected');
      document.querySelectorAll('.payment-details-panel').forEach(p => p.classList.remove('active'));
      selectedPayment = radio.value;
      document.getElementById(`panel-${selectedPayment}`)?.classList.add('active');
      updateTotals(selectedPayment === 'cod');
    });
  });

  document.querySelectorAll('.payment-method-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const radio = opt.querySelector('input[type=radio]');
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
    });
  });
}

// ── Place Order Button ────────────────────────────────────
function bindPlaceOrderBtn() {
  const btn = document.getElementById('place-order-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const errorEl = document.getElementById('checkout-error');

    const name     = sanitizeInput(document.getElementById('co-name')?.value     || '');
    const email    = sanitizeInput(document.getElementById('co-email')?.value    || '');
    const phone    = sanitizeInput(document.getElementById('co-phone')?.value    || '');
    const address  = sanitizeInput(document.getElementById('co-address')?.value  || '');
    const city     = sanitizeInput(document.getElementById('co-city')?.value     || '');
    const province = sanitizeInput(document.getElementById('co-province')?.value || '');

    // Validation
    if (!name || !email || !phone || !address || !city || !province) {
      setError(errorEl, '⚠️ Please fill in all required contact and shipping fields.');
      errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!isValidEmail(email)) {
      setError(errorEl, '⚠️ Please enter a valid email address.');
      return;
    }
    if (!isValidPhone(phone)) {
      setError(errorEl, '⚠️ Please enter a valid Pakistani phone number (e.g. 03001234567).');
      return;
    }
    if (!selectedPayment) {
      setError(errorEl, '⚠️ Please select a payment method.');
      return;
    }
    if (selectedPayment === 'paypal') {
      setError(errorEl, '⚠️ Please use the PayPal button above to complete your PayPal payment.');
      return;
    }

    errorEl?.classList.add('hidden');
    await placeOrder({ name, email, phone, address, city, province });
  });
}

function setError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ── Core Order Placement ──────────────────────────────────
async function placeOrder({ name, email, phone, address, city, province, paymentStatus = 'Pending' }) {
  const btn     = document.getElementById('place-order-btn');
  const errorEl = document.getElementById('checkout-error');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Order…'; }

  const cartItems   = getCart();
  const subtotal    = getCartTotal();
  const cfg         = DD_CONFIG.shipping;
  const shipping    = subtotal >= cfg.freeThreshold ? 0 : cfg.flatRate;
  const cod         = selectedPayment === 'cod' ? cfg.codFee : 0;
  const totalPKR    = subtotal + shipping + cod;
  const notes       = sanitizeInput(document.getElementById('co-notes')?.value || '');
  const fullAddress = `${address}, ${city}, ${province}`;
  const orderNumber = generateOrderNumber();

  const payMethod = {
    easypaisa: 'EasyPaisa',
    jazzcash:  'JazzCash',
    bank:      'Bank Transfer (Meezan)',
    cod:       'Cash on Delivery',
    paypal:    'PayPal',
  }[selectedPayment] || selectedPayment;

  const orderData = {
    id:               orderNumber,
    customer_name:    name,
    customer_email:   email,
    customer_phone:   phone,
    customer_address: fullAddress,
    items:            JSON.stringify(cartItems),
    total_pkr:        totalPKR,
    payment_method:   payMethod,
    payment_status:   paymentStatus,
    order_status:     'Pending',
    notes,
  };

  try {
    // Submit order to Web3Forms — delivers an email straight to the owner's inbox
    const settings = (function(){
      try { return JSON.parse(localStorage.getItem('dd_admin_settings') || '{}'); }
      catch { return {}; }
    })();
    const w3fKey = settings.web3forms_key
      || (window.DD_CONFIG && DD_CONFIG.web3forms && DD_CONFIG.web3forms.accessKey)
      || '';
    if (!w3fKey) throw new Error('Web3Forms not configured');

    const itemsSummary = cartItems
      .map(i => `• ${i.name} × ${i.qty}  –  ${formatPKR(i.price * i.qty)}`)
      .join('\n');

    const res = await fetch('https://api.web3forms.com/submit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify({
        access_key:       w3fKey,
        subject:          `New Order #${orderNumber} — ${name}`,
        from_name:        'DesignDreams Orders',
        form_type:        'order-submission',
        order_number:     orderNumber,
        customer_name:    name,
        customer_email:   email,
        customer_phone:   phone,
        customer_address: fullAddress,
        items_summary:    itemsSummary,
        items_json:       JSON.stringify(cartItems),
        total_pkr:        String(totalPKR),
        payment_method:   payMethod,
        payment_status:   paymentStatus,
        notes:            notes || '—',
      }),
    });
    if (!res.ok) throw new Error('Order failed');

    await sendOrderConfirmationEmail({
      orderNumber, name, email, phone,
      address: fullAddress, cartItems, totalPKR, payMethod, notes,
    });

    showOrderSuccess({ name, email, phone, totalPKR, payMethod, orderNumber });
    clearCart();
    notifyOwnerWhatsApp({ name, phone, cartItems, totalPKR, payMethod, orderNumber });

    // ── Save order to localStorage for admin panel ──────────
    try {
      const allOrders = JSON.parse(localStorage.getItem('dd_orders') || '[]');
      allOrders.unshift({
        id:               orderNumber,
        customer_name:    name,
        customer_email:   email,
        customer_phone:   phone,
        customer_address: fullAddress,
        items:            cartItems,
        total_pkr:        totalPKR,
        payment_method:   payMethod,
        payment_status:   paymentStatus,
        order_status:     'Pending',
        notes:            notes || '',
        created_at:       new Date().toISOString(),
      });
      if (allOrders.length > 500) allOrders.length = 500;
      localStorage.setItem('dd_orders', JSON.stringify(allOrders));
    } catch { /* storage full – skip */ }

  } catch {
    if (errorEl) {
      errorEl.textContent = '❌ Failed to place order. Please try again or contact us on WhatsApp.';
      errorEl.classList.remove('hidden');
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-lock"></i> Place Order Securely';
    }
  }
}

// ── Email Confirmation ────────────────────────────────────
async function sendOrderConfirmationEmail({ orderNumber, name, email, phone, address, cartItems, totalPKR, payMethod, notes }) {
  const settings  = getAdminSettings();
  const itemsList = cartItems.map(i => `• ${i.name} × ${i.qty}  –  ${formatPKR(i.price * i.qty)}`).join('\n');

  const templateParams = {
    order_number:     orderNumber,
    customer_name:    name,
    customer_email:   email,
    customer_phone:   phone,
    shipping_address: address,
    items_list:       itemsList,
    items_count:      cartItems.reduce((s, i) => s + i.qty, 0),
    subtotal:         formatPKR(cartItems.reduce((s, i) => s + i.price * i.qty, 0)),
    total_pkr:        formatPKR(totalPKR),
    payment_method:   payMethod,
    notes:            notes || 'None',
    store_name:       'DesignDreams',
    store_email:      DD_CONFIG.business.email,
    store_whatsapp:   DD_CONFIG.business.phone,
    to_email:         email,
    reply_to:         DD_CONFIG.business.email,
    year:             new Date().getFullYear(),
  };

  if (settings.emailjs_service && settings.emailjs_template && settings.emailjs_key) {
    try {
      if (typeof emailjs !== 'undefined') {
        await emailjs.send(settings.emailjs_service, settings.emailjs_template, templateParams);
        return;
      }
    } catch {}
  }

  // Fallback: open default mail client
  const subject = encodeURIComponent(`Order Confirmation – ${orderNumber} | DesignDreams`);
  const body = encodeURIComponent(
    `Dear ${name},\n\nThank you for your order at DesignDreams! 🎉\n\n` +
    `Order Number : ${orderNumber}\n` +
    `Order Date   : ${new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n` +
    `ITEMS ORDERED:\n${itemsList}\n\n` +
    `Order Total  : ${formatPKR(totalPKR)}\n` +
    `Payment Via  : ${payMethod}\n\n` +
    `SHIPPING TO:\n${address}\nPhone: ${phone}\n\n` +
    (notes ? `Notes: ${notes}\n\n` : '') +
    `We will process your order within 24 hours.\n` +
    `For updates: WhatsApp us at ${DD_CONFIG.business.phone}\n\n` +
    `Thank you for shopping with DesignDreams! 💛`
  );
  try { window.location.href = `mailto:${email}?subject=${subject}&body=${body}`; } catch {}
}
window.sendOrderConfirmationEmail = sendOrderConfirmationEmail;

// ── Order Success Screen ──────────────────────────────────
function showOrderSuccess({ name, email, phone, totalPKR, payMethod, orderNumber }) {
  document.getElementById('checkout-layout')?.style.setProperty('display', 'none');

  const screen = document.getElementById('order-success-screen');
  if (!screen) return;
  screen.classList.remove('hidden');

  const details = document.getElementById('order-confirmation-details');
  if (!details) return;

  // Clear and rebuild using DOM — no user data in innerHTML
  details.innerHTML = '';

  // Order number box
  const numBox = document.createElement('div');
  numBox.style.cssText = 'text-align:center;margin-bottom:16px;padding:12px;background:rgba(200,169,110,0.1);border-radius:6px;';
  numBox.innerHTML = '<p style="font-size:0.75rem;letter-spacing:2px;text-transform:uppercase;color:var(--gray);margin-bottom:4px;">Your Order Number</p>';
  const numEl = document.createElement('p');
  numEl.style.cssText = 'font-family:monospace;font-size:1.4rem;font-weight:800;color:var(--gold-dark);letter-spacing:2px;';
  numEl.textContent = orderNumber;
  numBox.appendChild(numEl);
  numBox.insertAdjacentHTML('beforeend', '<p style="font-size:0.75rem;color:var(--gray);margin-top:4px;">Please save this for tracking your order</p>');
  details.appendChild(numBox);

  // Details grid
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:0.875rem;';
  const fields = [
    ['Order Date', new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })],
    ['Status', '✅ Confirmed'],
    ['Name', name],
    ['Phone', phone],
    ['Total', formatPKR(totalPKR)],
    ['Payment', payMethod],
  ];
  fields.forEach(([label, value]) => {
    const cell = document.createElement('div');
    const b = document.createElement('strong');
    b.textContent = `${label}:`;
    const br = document.createElement('br');
    const span = document.createElement('span');
    span.textContent = value;
    cell.append(b, br, span);
    grid.appendChild(cell);
  });
  // Email cell (full width)
  const emailCell = document.createElement('div');
  emailCell.style.gridColumn = '1/-1';
  emailCell.innerHTML = '<strong>Confirmation email sent to:</strong><br>';
  const emailSpan = document.createElement('span');
  emailSpan.style.color = 'var(--gold-dark)';
  emailSpan.textContent = email;
  emailCell.appendChild(emailSpan);
  grid.appendChild(emailCell);
  details.appendChild(grid);

  // WhatsApp payment confirmation prompt (manual payment methods)
  const manualMethods = ['EasyPaisa', 'JazzCash', 'Bank Transfer (Meezan)'];
  if (manualMethods.includes(payMethod)) {
    const waBox = document.createElement('div');
    waBox.style.cssText = 'margin-top:16px;padding:14px;background:rgba(37,211,102,0.1);border-radius:4px;border:1px solid rgba(37,211,102,0.3);';
    const waMsg = `Hi! My order number is ${orderNumber}. I have paid via ${payMethod}. Transaction ID: [YOUR_TXN_ID]. Please confirm.`;
    const waLink = document.createElement('a');
    waLink.href    = getWhatsAppUrl(waMsg);
    waLink.target  = '_blank';
    waLink.rel     = 'noopener noreferrer';
    waLink.style.cssText = 'color:#25D366;font-weight:700;';
    waLink.textContent = 'WhatsApp';
    waBox.innerHTML = '<p style="font-size:0.85rem;color:#1a5e30;"><i class="fab fa-whatsapp" style="color:#25D366;"></i> <strong>Next Step:</strong> Please send your payment transaction ID to us on </p>';
    waBox.querySelector('p').appendChild(waLink);
    waBox.querySelector('p').insertAdjacentText('beforeend', ' to confirm your order.');
    details.appendChild(waBox);
  }

  screen.scrollIntoView({ behavior: 'smooth' });
}

// ── Owner WhatsApp Notification ───────────────────────────
// Opens WhatsApp to let the admin send themselves the order summary.
// Cannot push silently without WhatsApp Business API.
function notifyOwnerWhatsApp({ name, phone, cartItems, totalPKR, payMethod, orderNumber }) {
  const itemList = cartItems.map(i => `• ${i.name} x${i.qty} (${formatPKR(i.price * i.qty)})`).join('\n');
  const msg =
    `🛍️ *NEW ORDER – DesignDreams*\n\n` +
    `📦 *Order:* ${orderNumber}\n` +
    `📅 *Date:* ${new Date().toLocaleDateString('en-PK')}\n\n` +
    `👤 *Customer:* ${name}\n` +
    `📞 *Phone:* ${phone}\n\n` +
    `🛒 *Items:*\n${itemList}\n\n` +
    `💰 *Total:* ${formatPKR(totalPKR)}\n` +
    `💳 *Payment:* ${payMethod}\n\n` +
    `Please confirm and process this order. 🙏`;

  // Opens WhatsApp with the store owner as recipient
  try { window.open(getWhatsAppUrl(msg), '_blank', 'noopener,noreferrer'); } catch {}
}

// ── PayPal SDK ────────────────────────────────────────────
function loadPayPalSDK() {
  const cfg = DD_CONFIG.paypal;
  if (!cfg.enabled || cfg.clientId === 'YOUR_PAYPAL_CLIENT_ID') {
    updatePayPalPanel(false);
    return;
  }

  const script  = document.createElement('script');
  script.src    = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.clientId)}&currency=${cfg.currency}`;
  script.onload = initPayPalButtons;
  script.onerror= () => updatePayPalPanel(false);
  document.body.appendChild(script);
}

function updatePayPalPanel(sdkLoaded) {
  const container = document.getElementById('paypal-button-container');
  if (!container) return;
  if (!sdkLoaded) {
    container.innerHTML = `
      <div style="background:var(--gray-light);border-radius:4px;padding:16px;text-align:center;font-size:0.85rem;color:var(--gray);">
        <i class="fab fa-paypal" style="font-size:1.5rem;color:#003087;display:block;margin-bottom:8px;"></i>
        <strong>PayPal Integration</strong><br/>
        Add your PayPal Client ID in <code>js/config.js</code> to enable PayPal.<br/>
        <a href="https://developer.paypal.com" target="_blank" rel="noopener noreferrer"
           style="color:#003087;margin-top:4px;display:inline-block;">Get PayPal Client ID →</a>
      </div>`;
  }
}

function initPayPalButtons() {
  const container = document.getElementById('paypal-button-container');
  if (!container || typeof paypal === 'undefined') { updatePayPalPanel(false); return; }
  container.innerHTML = '';

  paypal.Buttons({
    style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' },
    createOrder: (data, actions) => {
      const total    = getCartTotal();
      const shipping = total >= DD_CONFIG.shipping.freeThreshold ? 0 : DD_CONFIG.shipping.flatRate;
      const totalUSD = ((total + shipping) * DD_CONFIG.currency.pkrToUsd).toFixed(2);
      return actions.order.create({
        purchase_units: [{ description: 'DesignDreams Jewelry Order', amount: { currency_code: 'USD', value: totalUSD } }],
      });
    },
    onApprove: async (data, actions) => {
      await actions.order.capture();
      const name     = sanitizeInput(document.getElementById('co-name')?.value     || '');
      const email    = sanitizeInput(document.getElementById('co-email')?.value    || '');
      const phone    = sanitizeInput(document.getElementById('co-phone')?.value    || '');
      const address  = sanitizeInput(document.getElementById('co-address')?.value  || '');
      const city     = sanitizeInput(document.getElementById('co-city')?.value     || '');
      const province = sanitizeInput(document.getElementById('co-province')?.value || '');
      if (!name || !email || !phone || !address || !city || !province) {
        showToast('Please fill in your contact details before paying.', 'error');
        return;
      }
      selectedPayment = 'paypal';
      await placeOrder({ name, email, phone, address, city, province, paymentStatus: 'Paid' });
    },
    onError: () => showToast('PayPal payment failed. Please try another method.', 'error'),
  }).render('#paypal-button-container');
}

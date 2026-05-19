# DesignDreams – Refactoring Guide

## What Changed & Why

### New File: `js/utils.js`
Load this **before** all other JS files (already done in all HTML pages).
Contains shared utilities used across every page:
- `htmlEscape(str)` – prevents XSS when inserting user data into innerHTML
- `sanitizeInput(str)` – strips HTML tags from form inputs before submission
- `isValidEmail(str)` / `isValidPhone(str)` – regex validators
- `renderProductCard(p)` / `renderStars(n)` – moved here from main.js (were duplicated)
- `bindProductCardEvents(container)` – wires Add-to-Cart and Quick View via event delegation (replaces inline `onclick=`)
- `setText(id, val)` – safe DOM text setter (was duplicated in product.js and admin.js)

---

## Security Fixes

### 1. Admin Password – CRITICAL
**Before:** Plaintext `password: 'madihafaizan'` visible in page source.  
**After:** SHA-256 hash stored in `js/admin.js`. Password never appears in source.

**To change the admin password:**
1. Open your browser's DevTools console (F12 → Console tab).
2. Paste and run:
   ```js
   (async () => {
     const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('YourNewPassword'));
     console.log(Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join(''));
   })();
   ```
3. Copy the printed hex string.
4. In `js/admin.js`, replace the value of `ADMIN_PASSWORD_HASH` with your new hash.

**To change the admin username:**  
Find `const usernameOk = uname === 'admin';` in `js/admin.js` and change `'admin'` to your desired username.

### 2. Brute-Force Protection (new)
After **5 failed login attempts**, the account locks for **30 minutes**.  
Counters are stored in `sessionStorage` and reset on browser tab close.

### 3. XSS Vulnerabilities Fixed
All user-submitted data (customer names, emails, phone numbers, product names, inquiry messages) that was previously inserted raw into `innerHTML` is now:
- Either set via `.textContent` (safest), or
- Passed through `htmlEscape()` before being placed in HTML attributes or template strings.

**Pages affected:** cart drawer, order summary, order success screen, admin orders table, admin inquiries, admin products table, quick view modal.

### 4. `sendOrderWhatsApp` Bug Fixed
**Before:** The function built a WhatsApp message for the store owner but **never sent it** (dead code — message string was assigned but `window.open` was never called).  
**After:** `notifyOwnerWhatsApp()` calls `window.open(getWhatsAppUrl(msg))` so the owner WhatsApp chat actually opens after each order.

### 5. Input Validation Added
Checkout and inquiry forms now validate:
- Email format (regex: must contain `@` and valid domain)
- Phone format (Pakistani numbers: `03XXXXXXXXX` or `923XXXXXXXXX`)
- All required fields checked with `sanitizeInput()` before submission

### 6. Inline `onclick` Handlers Removed
All `onclick="fn()"` attributes in dynamically-generated HTML replaced with `addEventListener` via event delegation. This eliminates a class of XSS vector where injected HTML could execute arbitrary JavaScript via event attributes.

### 7. Logout Button Added
Admin top bar now has a **Logout** button that calls `logoutAdmin()`, which clears `sessionStorage` and reloads the page.

### 8. External Links Hardened
All `target="_blank"` links now include `rel="noopener noreferrer"` to prevent tab-napping attacks.

---

## Architecture Changes

| Before | After |
|--------|-------|
| `renderProductCard` defined in `main.js`, called from `shop.js` & `product.js` (load-order dependency) | Moved to `utils.js`, available everywhere |
| `renderStars` defined in `main.js` | Moved to `utils.js` |
| `setText` duplicated in `product.js` and `admin.js` | Single copy in `utils.js` |
| Login gate in inline `<script>` inside `admin.html` with plaintext credentials | Login logic in `admin.js`; only a session check (no credentials) remains in `admin.html` |
| All product card buttons used `onclick='addToCart(${JSON.stringify(p)})'` | Data stored in `data-product` attribute; click handled by `bindProductCardEvents()` |

---

## Migration Steps (Zero Data Loss)

No database changes. No localStorage structure changes. Steps:

1. **Replace all JS files** — copy the refactored `js/` folder files.
2. **Update all HTML files** — add `<script src="js/utils.js"></script>` before `config.js` (already done).
3. **Update `admin.html`** — the inline login `<script>` block has been replaced with a minimal session check.
4. **Change the admin password** — follow the steps in the Security section above. The default hash (`madihafaizan`) is still in place; change it immediately.
5. **Test the admin login** — visit `admin.html`, log in with `admin` / `madihafaizan`, verify the dashboard loads.
6. **Test checkout** — add a product to cart, complete checkout with a manual payment method, verify the owner WhatsApp notification opens.

---

## OWASP Top 10 Checklist

| Risk | Status | Notes |
|------|--------|-------|
| A01 Broken Access Control | ⚠️ Partial | Admin auth is client-side only. Move to server-side auth (Xano Auth API) for production. |
| A02 Cryptographic Failures | ✅ Fixed | Password now SHA-256 hashed. No plaintext credentials in source. |
| A03 Injection (XSS) | ✅ Fixed | All user content escaped via `htmlEscape()` / `.textContent`. |
| A04 Insecure Design | ✅ Improved | Event delegation replaces inline onclick; input sanitization added. |
| A05 Security Misconfiguration | ⚠️ Partial | No CSP header (requires server); `rel="noopener noreferrer"` added to all external links. |
| A06 Vulnerable Components | ✅ OK | Only CDN libraries (FontAwesome, EmailJS). No server-side dependencies. |
| A07 Auth & Session Failures | ✅ Improved | SHA-256 hash + brute-force lockout (5 attempts / 30 min). Session in `sessionStorage` (auto-clears on tab close). |
| A08 Software Integrity Failures | ⚠️ Partial | CDN scripts loaded without SRI hashes. Add `integrity=` attributes for production. |
| A09 Logging & Monitoring | ⚠️ None | No server-side logging. Consider Xano webhook for order/inquiry events. |
| A10 SSRF | ✅ N/A | No server-side request logic on this frontend. |

---

## Recommended Next Steps (Production Hardening)

1. **Server-side authentication** — Enable Xano's built-in Auth API instead of client-side password checking.
2. **Subresource Integrity (SRI)** — Add `integrity="sha384-..."` to FontAwesome and EmailJS CDN `<script>` tags.
3. **Content Security Policy** — Add a `Content-Security-Policy` HTTP response header (requires server/CDN config, e.g., Netlify `_headers` file).
4. **Rate limiting** — Configure Xano API rate limits on the `tables/orders` and `tables/inquiries` POST endpoints.
5. **Server-side price validation** — Add a Xano function to re-calculate order totals from live product prices before accepting an order, preventing cart price manipulation via DevTools.
6. **HTTPS** — Ensure your hosting enforces HTTPS (free on Netlify, Vercel, Cloudflare Pages).

/**
 * DesignDreams – Admin Panel JS
 * Includes: login gate, dashboard, orders, inquiries,
 *           hero images, product images, products, settings.
 * Depends on: utils.js, config.js, cart.js
 *
 * ─── HOW TO CHANGE THE ADMIN PASSWORD ────────────────────
 * 1. Open any page in Chrome / Firefox developer tools.
 * 2. Paste this into the Console tab and press Enter:
 *
 *    async function getHash(pw) {
 *      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
 *      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
 *    }
 *    getHash('YourNewPassword').then(console.log);
 *
 * 3. Copy the printed hex string and replace ADMIN_PASSWORD_HASH below.
 * ─────────────────────────────────────────────────────────
 */

// ── Authentication ────────────────────────────────────────
// SHA-256 hash of the admin password (NOT the plaintext password).
// Default hash below = SHA-256("madihafaizan") — change this after first login.
const ADMIN_PASSWORD_HASH = '22dd93717343816380d61c5b00c1211a574f26a07641c0231ec4485a8b80fcd2';
const SESSION_KEY         = 'dd_admin_auth';
const MAX_LOGIN_ATTEMPTS  = 5;
const LOCKOUT_MINUTES     = 30;

// Brute-force throttling stored in sessionStorage (cleared on tab close)
function getLoginState() {
  try { return JSON.parse(sessionStorage.getItem('dd_login_state') || '{}'); }
  catch { return {}; }
}
function saveLoginState(state) {
  sessionStorage.setItem('dd_login_state', JSON.stringify(state));
}

async function hashPassword(password) {
  const data   = new TextEncoder().encode(password);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isLockedOut() {
  const state = getLoginState();
  if (!state.lockUntil) return false;
  if (Date.now() < state.lockUntil) return true;
  // Lockout expired — reset
  saveLoginState({});
  return false;
}

function recordFailedAttempt() {
  const state    = getLoginState();
  const attempts = (state.attempts || 0) + 1;
  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    saveLoginState({ attempts, lockUntil: Date.now() + LOCKOUT_MINUTES * 60 * 1000 });
  } else {
    saveLoginState({ attempts });
  }
  return attempts;
}

function clearLoginAttempts() {
  saveLoginState({});
}

function unlockPanel() {
  document.getElementById('admin-login-overlay').style.display  = 'none';
  document.querySelector('.admin-sidebar').style.visibility      = 'visible';
  document.querySelector('.admin-main').style.visibility         = 'visible';
}

// Called from the login form's onsubmit
window.handleAdminLogin = async function (e) {
  e.preventDefault();
  const btn      = document.getElementById('login-btn');
  const errorEl  = document.getElementById('login-error');
  const errorMsg = document.getElementById('login-error-msg');
  const uname    = document.getElementById('login-username').value.trim();
  const pwd      = document.getElementById('login-password').value;

  errorEl.classList.remove('show');

  if (!uname || !pwd) {
    errorMsg.textContent = 'Please enter both username and password.';
    errorEl.classList.add('show');
    return;
  }

  if (isLockedOut()) {
    const state = getLoginState();
    const minsLeft = Math.ceil((state.lockUntil - Date.now()) / 60000);
    errorMsg.textContent = `Too many failed attempts. Try again in ${minsLeft} minute(s).`;
    errorEl.classList.add('show');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying…';

  // Artificial delay to slow brute-force even further
  await new Promise(r => setTimeout(r, 800));

  const inputHash = await hashPassword(pwd);
  const usernameOk = uname === 'admin'; // change username here if desired
  const passwordOk = inputHash === ADMIN_PASSWORD_HASH;

  if (usernameOk && passwordOk) {
    clearLoginAttempts();
    sessionStorage.setItem(SESSION_KEY, '1');
    unlockPanel();
  } else {
    const attempts = recordFailedAttempt();
    const remaining = MAX_LOGIN_ATTEMPTS - attempts;
    errorMsg.textContent = remaining > 0
      ? `Incorrect username or password. ${remaining} attempt(s) remaining.`
      : `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`;
    errorEl.classList.add('show');
    document.getElementById('login-password').value = '';
    document.getElementById('login-password').focus();
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
  }
};

window.togglePasswordVisibility = function () {
  const pwInput = document.getElementById('login-password');
  const icon    = document.getElementById('toggle-pw-icon');
  if (pwInput.type === 'password') {
    pwInput.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    pwInput.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
};

function logoutAdmin() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.reload();
}
window.logoutAdmin = logoutAdmin;

// ── Hero Slide Defaults ───────────────────────────────────
const DEFAULT_HERO_SLIDES = [
  { label: 'Slide 1', url: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=1600&q=90' },
  { label: 'Slide 2', url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1600&q=90' },
  { label: 'Slide 3', url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1600&q=90' },
];
const HERO_STORAGE_KEY = 'dd_hero_slides';
const SETTINGS_KEY     = 'dd_admin_settings';

// ── Initialization ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-username')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('login-password').focus(); }
  });

  // Check session without credentials in HTML
  if (sessionStorage.getItem(SESSION_KEY) === '1') unlockPanel();

  initNavigation();
  loadDashboard();
  // Wrap every panel init in its own try/catch so one failure never blocks the rest
  try { loadHeroSlides();       } catch {}
  try { loadProductsTable();    } catch {}
  try { loadOrdersTable();      } catch {}
  try { loadInquiries();        } catch {}
  try { loadSettings();         } catch {}
  try { loadContentPanel();     } catch {}
  try { loadTestimonialsPanel(); } catch {}
  try { loadGalleryPanel();     } catch {}
  try { loadCategoriesPanel();  } catch {}
  try { loadAnnouncementPanel(); } catch {}
  try { loadThemePanel();       } catch {}
  try { loadSeoPanel();         } catch {}
});

// ── Navigation ────────────────────────────────────────────
function initNavigation() {
  const titles = {
    dashboard:        'Dashboard',
    orders:           'Orders',
    inquiries:        'Inquiries',
    'hero-images':    'Hero Images',
    products:         'Products',
    settings:         'Settings',
    'content-manager':'Content Manager',
    testimonials:     'Testimonials',
    gallery:          'Gallery',
    categories:       'Category Cards',
    announcement:     'Announcement Banner',
    theme:            'Theme & Colors',
    seo:              'SEO Settings',
  };

  // Lazy loaders — called the first time a panel is shown if pre-loading failed.
  // Detection: if the panel has no .panel-header child it was never rendered.
  const panelLoaders = {
    'content-manager': () => { try { loadContentPanel();      } catch {} },
    'testimonials':    () => { try { loadTestimonialsPanel(); } catch {} },
    'gallery':         () => { try { loadGalleryPanel();      } catch {} },
    'categories':      () => { try { loadCategoriesPanel();   } catch {} },
    'announcement':    () => { try { loadAnnouncementPanel(); } catch {} },
    'theme':           () => { try { loadThemePanel();        } catch {} },
    'seo':             () => { try { loadSeoPanel();          } catch {} },
    'orders':          () => { try { loadOrdersTable();       } catch {} },
    'inquiries':       () => { try { loadInquiries();         } catch {} },
  };

  document.querySelectorAll('.admin-nav-item[data-panel]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      const panelEl = document.getElementById(`panel-${item.dataset.panel}`);
      panelEl?.classList.add('active');
      setText('panel-title', titles[item.dataset.panel] || item.dataset.panel);

      // Lazy-load safety net: if the panel has no rendered content, load it now
      if (panelEl && !panelEl.querySelector('.panel-header') && panelLoaders[item.dataset.panel]) {
        panelLoaders[item.dataset.panel]();
      }
    });
  });
}

// ── Publish to Website ────────────────────────────────────
/**
 * Merges all localStorage changes (products + image overrides) into a single
 * products.json file and pushes it to GitHub via the GitHub Contents API.
 * GitHub Pages (or Cloudflare Pages connected to the repo) auto-deploys on push,
 * making the changes visible to every visitor worldwide within ~1 minute.
 */

/** Unicode-safe base64 encoder (GitHub Contents API requires base64 content). */
function _toBase64(str) {
  // encodeURIComponent → %xx escapes → bytes → btoa
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Deploys products.json directly to a GitHub repository.
 * GitHub Pages (or Cloudflare Pages) will auto-rebuild and publish within ~1 min.
 *
 * 1. GET the current file SHA (required for an update, omitted for new file)
 * 2. PUT the new content (base64-encoded) with that SHA
 */
async function _publishViaGitHubAPI(token, owner, repo, jsonStr, branch = 'main') {
  const path = 'data/products.json';
  const url  = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept':        'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Step 1: try to get existing file SHA. 404 just means new file (still allowed).
  let sha = undefined;
  const getRes = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers });
  if (getRes.ok) {
    const data = await getRes.json();
    sha = data.sha;
  } else if (getRes.status !== 404) {
    const e = await getRes.json().catch(() => ({}));
    throw new Error(e.message || `Cannot reach GitHub (${getRes.status}). Check token scope and repo name.`);
  }

  // Step 2: PUT new content
  const body = {
    message: `Update products via admin panel — ${new Date().toISOString()}`,
    content: _toBase64(jsonStr),
    branch,
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!putRes.ok) {
    const e = await putRes.json().catch(() => ({}));
    throw new Error(e.message || `Commit failed (${putRes.status})`);
  }
  return putRes.json();
}

/**
 * Upload a product image (File object) to the GitHub repo under images/products/.
 * Returns the raw GitHub URL so visitors on any machine can see the image.
 */
async function _uploadImageToGitHub(file, productId, token, owner, repo, branch = 'main') {
  const ext   = file.name.split('.').pop().toLowerCase() || 'jpg';
  const path  = `images/products/${productId}.${ext}`;
  const url   = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept':        'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Convert file to base64
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result.split(',')[1]); // strip data-URL prefix
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Get existing SHA if file already exists
  let sha;
  const getRes = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers });
  if (getRes.ok) { const d = await getRes.json(); sha = d.sha; }

  const body = { message: `Upload product image ${productId}.${ext}`, content: base64, branch };
  if (sha) body.sha = sha;

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}));
    throw new Error(err.message || `Image upload failed (${putRes.status})`);
  }

  // Return the raw content URL (works on any machine, globally)
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
}

/** Test GitHub connection — called from the Settings panel */
async function testGitHubConnection() {
  const result = document.getElementById('gh-test-result');
  if (!result) return;

  const saved  = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  const token  = saved.gh_token || document.getElementById('set-gh-token')?.value?.trim() || '';
  const owner  = saved.gh_owner || document.getElementById('set-gh-owner')?.value?.trim() || '';
  const repo   = saved.gh_repo  || document.getElementById('set-gh-repo')?.value?.trim()  || '';

  if (!token || !owner || !repo) {
    result.style.display = 'block';
    result.style.background = '#fff3cd'; result.style.color = '#856404';
    result.innerHTML = '⚠️ Please enter your GitHub username, repository name, and token — then save settings.';
    return;
  }

  result.style.display = 'block';
  result.style.background = '#e8f4fd'; result.style.color = '#1a6fa8';
  result.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing GitHub connection…';

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/vnd.github+json',
      }
    });
    if (!res.ok) {
      if (res.status === 401) throw new Error('Token is invalid or expired.');
      if (res.status === 404) throw new Error(`Repo "${owner}/${repo}" not found, or token lacks access.`);
      throw new Error(`HTTP ${res.status}`);
    }
    const r = await res.json();
    result.style.background = '#e8f5e9'; result.style.color = '#2e7d32';
    result.innerHTML = `✅ Connected! Repo: <strong>${r.full_name}</strong> (${r.private ? 'private' : 'public'}) — Auto-publish is ready.`;
  } catch (e) {
    result.style.background = '#fce4e4'; result.style.color = '#c62828';
    result.innerHTML = `❌ Connection failed: ${e.message}`;
  }
}
window.testGitHubConnection = testGitHubConnection;

/** Trigger a browser download of the products JSON string */
function _downloadJson(json) {
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'products.json';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  localStorage.removeItem('dd_products_dirty');
  updatePublishBadge();
}

function publishChangesToWebsite() {
  const allPublishBtns = document.querySelectorAll('#publish-btn, [onclick*="publishChangesToWebsite"]');

  function setBtnState(state) {
    allPublishBtns.forEach(btn => {
      if (state === 'loading') {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing…';
      } else if (state === 'success') {
        btn.disabled = false;
        btn.style.background = '#22c55e';
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Published!';
        setTimeout(() => { btn.style.background = ''; btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Publish to Website'; }, 5000);
      } else if (state === 'error') {
        btn.disabled = false;
        btn.style.background = '#ef4444';
        btn.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed – Try Again';
        setTimeout(() => { btn.style.background = ''; btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Publish to Website'; }, 5000);
      } else {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Publish to Website';
      }
    });
  }

  setBtnState('loading');

  const _run = async () => {
    try {
      const products = JSON.parse(localStorage.getItem('dd_products') || '[]');
      const overrides = JSON.parse(localStorage.getItem('dd_product_images_override') || '{}');
      products.forEach(p => { if (overrides[p.id]) p.image_url = overrides[p.id]; });

      if (!products.length) {
        setBtnState('error');
        showToast('No products found. Please add products first.', 'error');
        return;
      }

      const json = JSON.stringify(products, null, 2);

      // Check for GitHub credentials
      const saved  = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      const token  = saved.gh_token || '';
      const owner  = saved.gh_owner || '';
      const repo   = saved.gh_repo  || '';
      const branch = saved.gh_branch || 'main';

      if (token && owner && repo) {
        // ── Auto-publish via GitHub API ───────────────────────
        showToast('Pushing to GitHub… please wait ~5 seconds.', '');
        try {
          await _publishViaGitHubAPI(token, owner, repo, json, branch);
          localStorage.removeItem('dd_products_dirty');
          updatePublishBadge();
          setBtnState('success');
          showToast('✅ Published to GitHub! Your live site will update in ~1 minute.', 'success');
        } catch (apiErr) {
          setBtnState('error');
          showToast('Publish failed: ' + (apiErr.message || 'Unknown error'), 'error');
        }
      } else {
        // ── Fallback: download products.json ──────────────────
        _downloadJson(json);
        localStorage.removeItem('dd_products_dirty');
        updatePublishBadge();
        setBtnState('success');
        showToast('✅ Downloaded! Go to Settings → GitHub Auto-Publish to enable one-click publishing.', 'success');
      }
    } catch (e) {
      setBtnState('error');
      showToast('Publish failed: ' + (e.message || 'Unknown error. Check your GitHub credentials in Settings.'), 'error');
    }
  };

  _run();
}
window.publishChangesToWebsite = publishChangesToWebsite;

/** Shows/hides the "Unpublished Changes" badge on the dashboard publish card. */
function updatePublishBadge() {
  const isDirty = localStorage.getItem('dd_products_dirty') === '1';
  const badge = document.getElementById('publish-dirty-badge');
  const btn   = document.getElementById('publish-btn');
  if (badge) badge.style.display = isDirty ? 'inline-flex' : 'none';
  if (btn)   btn.style.background = isDirty ? 'var(--gold)' : '';
}
window.updatePublishBadge = updatePublishBadge;

// ── Dashboard ─────────────────────────────────────────────
async function loadDashboard() {
  try {
    const products = await getAllProductsAdmin();
    setText('stat-products', Array.isArray(products) ? products.length : 0);
  } catch {}

  // Orders from localStorage (saved by checkout.js on each order)
  try {
    const orders  = JSON.parse(localStorage.getItem('dd_orders') || '[]');
    const paid    = orders.filter(o => o.payment_status && o.payment_status.toLowerCase() !== 'pending').length;
    setText('stat-orders',    orders.length);
    setText('stat-paid',      paid);
  } catch { setText('stat-orders', 0); setText('stat-paid', 0); }

  // Inquiries from localStorage
  try {
    const inqs = JSON.parse(localStorage.getItem('dd_inquiries') || '[]');
    setText('stat-inquiries', inqs.length);
  } catch { setText('stat-inquiries', 0); }

  // ── Publish to Website card ───────────────────────────────
  const publishSlot = document.getElementById('dash-publish-slot');
  if (publishSlot) {
    const isDirty = localStorage.getItem('dd_products_dirty') === '1';
    publishSlot.innerHTML = `
      <div style="background:var(--white);border-radius:var(--radius-md);padding:28px;box-shadow:var(--shadow-sm);border-left:4px solid var(--gold);margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">
          <div>
            <h3 style="font-size:1rem;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:10px;">
              <i class="fas fa-cloud-upload-alt" style="color:var(--gold);"></i>
              Publish to Website
              <span id="publish-dirty-badge" style="
                background:#e74c3c;color:#fff;font-size:0.7rem;font-weight:700;
                padding:2px 8px;border-radius:12px;letter-spacing:0.5px;
                display:${isDirty ? 'inline-flex' : 'none'};align-items:center;gap:4px;">
                <i class="fas fa-circle" style="font-size:0.45rem;"></i> UNPUBLISHED CHANGES
              </span>
            </h3>
            <p style="font-size:0.82rem;color:var(--gray);line-height:1.7;max-width:520px;">
              Changes you make here (products, images, prices) are <strong>saved only in this browser</strong>.
              To make them visible to all visitors, download the updated file and redeploy your site.
            </p>
            <ol style="font-size:0.8rem;color:var(--gray);margin:10px 0 0 16px;line-height:2;">
              <li>Set up GitHub credentials once in <strong>Settings → GitHub Auto-Publish</strong></li>
              <li>Click <strong>Publish to Website</strong> — pushes <code>products.json</code> directly to your repo</li>
              <li>GitHub Pages auto-rebuilds in ~1 minute</li>
              <li>Done — all visitors see your updates ✅</li>
            </ol>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;min-width:180px;">
            <button id="publish-btn" class="btn btn-gold" onclick="publishChangesToWebsite()"
                    style="display:flex;align-items:center;gap:8px;justify-content:center;${isDirty ? '' : ''}">
              <i class="fas fa-cloud-upload-alt"></i> Publish to Website
            </button>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer"
               class="btn btn-outline-gold btn-sm" style="display:flex;align-items:center;gap:8px;justify-content:center;">
              <i class="fab fa-github"></i> Open GitHub
            </a>
          </div>
        </div>
      </div>`;
  }

  // Recent orders from localStorage
  const ordersEl = document.getElementById('dash-recent-orders');
  if (ordersEl) {
    const recentOrders = JSON.parse(localStorage.getItem('dd_orders') || '[]').slice(0, 5);
    if (recentOrders.length) {
      renderDashboardOrders(recentOrders);
    } else {
      ordersEl.innerHTML = `<div class="empty-state" style="padding:20px;text-align:center;">
        <i class="fas fa-receipt" style="font-size:2rem;color:var(--gold);margin-bottom:8px;"></i>
        <p style="font-weight:600;">No orders yet</p>
        <p style="font-size:0.82rem;color:var(--gray);">Orders placed on the site appear here automatically.</p>
      </div>`;
    }
  }

  // Recent inquiries from localStorage
  const inqEl = document.getElementById('dash-recent-inq');
  if (inqEl) {
    const recentInq = JSON.parse(localStorage.getItem('dd_inquiries') || '[]').slice(0, 5);
    if (recentInq.length) {
      renderDashboardInquiries(recentInq);
    } else {
      inqEl.innerHTML = `<div class="empty-state" style="padding:20px;text-align:center;">
        <i class="fas fa-envelope" style="font-size:2rem;color:var(--gold);margin-bottom:8px;"></i>
        <p style="font-weight:600;">No inquiries yet</p>
        <p style="font-size:0.82rem;color:var(--gray);">Customer contact-form submissions appear here.</p>
      </div>`;
    }
  }
}

function renderDashboardOrders(orders) {
  const el = document.getElementById('dash-recent-orders');
  if (!el) return;
  if (!orders.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><p>No orders yet</p></div>';
    return;
  }
  const table = document.createElement('table');
  table.className = 'orders-table';
  table.innerHTML = '<thead><tr><th>Order ID</th><th>Customer</th><th>Total</th><th>Payment</th></tr></thead>';
  const tbody = document.createElement('tbody');
  orders.forEach(o => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="order-id-cell">#<span></span></td>
      <td></td>
      <td>${formatPKR(o.total_pkr || 0)}</td>
      <td><span class="status-badge status-${htmlEscape((o.payment_status||'pending').toLowerCase())}"></span></td>`;
    tr.querySelector('.order-id-cell span').textContent  = (o.id || '').slice(0, 8).toUpperCase();
    tr.querySelectorAll('td')[1].textContent              = o.customer_name || '—';
    tr.querySelector('.status-badge').textContent         = o.payment_status || 'Pending';
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  el.innerHTML = '';
  el.appendChild(table);
}

function renderDashboardInquiries(inqs) {
  const el = document.getElementById('dash-recent-inq');
  if (!el) return;
  if (!inqs.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-envelope"></i><p>No inquiries yet</p></div>';
    return;
  }
  el.innerHTML = '';
  inqs.forEach(i => {
    const card = document.createElement('div');
    card.className = `inquiry-card ${i.status === 'Replied' ? 'replied' : ''}`;
    card.innerHTML = `
      <div class="inquiry-card-header">
        <h4></h4>
        <span class="status-badge status-${i.status === 'New' ? 'pending' : 'paid'}"></span>
      </div>
      <p class="meta"></p>
      <p class="message"></p>`;
    card.querySelector('h4').textContent          = i.name || '—';
    card.querySelector('.status-badge').textContent = i.status || 'New';
    card.querySelector('.meta').textContent         = `${i.email || ''} · ${i.subject || ''}`;
    card.querySelector('.message').textContent      = (i.message || '').slice(0, 120) + ((i.message || '').length > 120 ? '…' : '');
    el.appendChild(card);
  });
}

// ── Hero Slides ───────────────────────────────────────────
function loadHeroSlides() {
  renderHeroSlidesAdmin(getSavedHeroSlides());
  document.getElementById('save-hero-btn')?.addEventListener('click', saveHeroSlides);
}

function getSavedHeroSlides() {
  try {
    const stored = localStorage.getItem(HERO_STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_HERO_SLIDES;
  } catch { return DEFAULT_HERO_SLIDES; }
}

function renderHeroSlidesAdmin(slides) {
  const container = document.getElementById('hero-slides-admin');
  if (!container) return;
  container.innerHTML = slides.map((s, i) => `
    <div class="hero-slide-card">
      <div class="hero-slide-preview">
        <img id="hero-preview-${i}" src="${htmlEscape(s.url)}" alt="Slide ${i + 1}"
             onerror="this.style.opacity=0.3" />
      </div>
      <div class="hero-slide-body">
        <label>Slide ${i + 1}</label>
        <div class="hero-slide-tabs">
          <button class="hero-slide-tab active" id="tab-url-${i}"
                  data-slide="${i}" data-tab="url">
            <i class="fas fa-link"></i> Paste URL
          </button>
          <button class="hero-slide-tab" id="tab-upload-${i}"
                  data-slide="${i}" data-tab="upload">
            <i class="fas fa-upload"></i> Upload from Device
          </button>
        </div>
        <div class="hero-slide-section active" id="section-url-${i}">
          <input type="url" id="hero-url-${i}" value="${htmlEscape(s.url)}"
                 placeholder="https://images.unsplash.com/…"
                 data-slide="${i}" />
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <a href="https://unsplash.com/s/photos/jewelry" target="_blank" rel="noopener noreferrer"
               style="font-size:0.73rem;color:var(--gold);">
              <i class="fas fa-search"></i> Browse Unsplash
            </a>
            <span style="font-size:0.73rem;color:var(--gray);">|</span>
            <a href="https://imgbb.com" target="_blank" rel="noopener noreferrer"
               style="font-size:0.73rem;color:var(--gold);">
              <i class="fas fa-cloud-upload-alt"></i> Host on ImgBB
            </a>
          </div>
        </div>
        <div class="hero-slide-section" id="section-upload-${i}">
          <input type="file" id="hero-file-${i}" accept="image/*" style="display:none;" data-slide="${i}" />
          <div class="hero-upload-zone" id="hero-dropzone-${i}" data-slide="${i}">
            <i class="fas fa-cloud-upload-alt"></i>
            <p>Click to choose or drag &amp; drop an image here</p>
          </div>
          <p id="hero-file-name-${i}" style="font-size:0.73rem;color:var(--gray);margin-top:6px;text-align:center;"></p>
        </div>
      </div>
    </div>`).join('');

  // Bind events via delegation (no inline onclick)
  container.addEventListener('click', (e) => {
    const tabBtn   = e.target.closest('.hero-slide-tab');
    const dropzone = e.target.closest('.hero-upload-zone');
    if (tabBtn)   switchHeroTab(parseInt(tabBtn.dataset.slide, 10), tabBtn.dataset.tab);
    if (dropzone) document.getElementById(`hero-file-${dropzone.dataset.slide}`)?.click();
  });
  container.addEventListener('input', (e) => {
    const urlInput = e.target.closest('input[type=url][data-slide]');
    if (urlInput) previewHeroSlide(parseInt(urlInput.dataset.slide, 10), urlInput.value);
  });
  container.addEventListener('change', (e) => {
    const fileInput = e.target.closest('input[type=file][data-slide]');
    if (fileInput) handleHeroFileUpload(parseInt(fileInput.dataset.slide, 10), fileInput);
  });
  container.addEventListener('dragover', (e) => {
    if (e.target.closest('.hero-upload-zone')) e.preventDefault();
  });
  container.addEventListener('dragleave', (e) => {
    e.target.closest('.hero-upload-zone')?.classList.remove('drag-over');
  });
  container.addEventListener('drop', (e) => {
    const dz = e.target.closest('.hero-upload-zone');
    if (!dz) return;
    e.preventDefault();
    dz.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    if (file?.type.startsWith('image/')) readHeroFile(parseInt(dz.dataset.slide, 10), file);
  });
}

function switchHeroTab(i, tab) {
  ['url', 'upload'].forEach(t => {
    document.getElementById(`tab-${t}-${i}`)?.classList.toggle('active', t === tab);
    document.getElementById(`section-${t}-${i}`)?.classList.toggle('active', t === tab);
  });
}
window.switchHeroTab = switchHeroTab;

function handleHeroFileUpload(i, input) {
  const file = input.files[0];
  if (file) readHeroFile(i, file);
}

function readHeroFile(i, file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const urlInput = document.getElementById(`hero-url-${i}`);
    if (urlInput) urlInput.value = dataUrl;
    previewHeroSlide(i, dataUrl);
    const nameEl = document.getElementById(`hero-file-name-${i}`);
    if (nameEl) {
      nameEl.innerHTML = '';
      nameEl.textContent = `${file.name} ready — click Save Changes to apply.`;
    }
    const dz = document.getElementById(`hero-dropzone-${i}`);
    if (dz) dz.style.borderColor = 'var(--gold)';
  };
  reader.readAsDataURL(file);
}

function previewHeroSlide(i, url) {
  const img = document.getElementById(`hero-preview-${i}`);
  if (img) { img.src = url; img.style.opacity = '1'; }
}
window.previewHeroSlide = previewHeroSlide;

function saveHeroSlides() {
  const slides = DEFAULT_HERO_SLIDES.map((_, i) => ({
    label: `Slide ${i + 1}`,
    url:   document.getElementById(`hero-url-${i}`)?.value.trim() || DEFAULT_HERO_SLIDES[i].url,
  }));

  if (JSON.stringify(slides).length > 4 * 1024 * 1024) {
    showToast('Images too large for local storage. Please use URLs or host images online.', 'error');
    return;
  }
  try {
    localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(slides));
    showToast('Hero slides saved! Refresh homepage to see changes.', 'success');
    renderHeroSlidesAdmin(slides);
  } catch {
    showToast('Storage full. Please use image URLs instead of uploading large files.', 'error');
  }
}

// ── Product Images ─────────────────────────────────────────
async function loadProductImages() {
  const grid = document.getElementById('img-products-grid');
  if (!grid) return;
  try {
    // Load image overrides saved by admin
    let imgOverrides = {};
    try { imgOverrides = JSON.parse(localStorage.getItem('dd_product_images_override') || '{}'); } catch {}

    const products = await getAllProductsAdmin();
    if (!Array.isArray(products) || !products.length) {
      grid.innerHTML = '<div class="empty-state"><i class="fas fa-camera"></i><p>No products found</p></div>';
      return;
    }
    grid.innerHTML = products.map(p => {
      // Apply any admin-saved image override so the panel shows the current image
      const displayUrl = imgOverrides[p.id] || p.image_url;
      return `
      <div class="img-product-card" id="imgcard-${htmlEscape(p.id)}">
        <div class="img-product-thumb">
          <img id="imgthumb-${htmlEscape(p.id)}" src="${htmlEscape(displayUrl)}" alt="${htmlEscape(p.name)}"
               onerror="this.src='https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&q=60'" />
          <div class="img-overlay">
            <button class="btn btn-gold btn-sm" data-action="change-img" data-id="${htmlEscape(p.id)}">
              <i class="fas fa-camera"></i> Change Image
            </button>
          </div>
        </div>
        <div class="img-product-body">
          <h4>${htmlEscape(p.name)}</h4>
          <p>${htmlEscape(p.category)}</p>
          <div class="hero-slide-tabs" style="margin-bottom:10px;">
            <button class="hero-slide-tab active" id="ptab-url-${htmlEscape(p.id)}" data-prod-id="${htmlEscape(p.id)}" data-tab="url">
              <i class="fas fa-link"></i> URL
            </button>
            <button class="hero-slide-tab" id="ptab-upload-${htmlEscape(p.id)}" data-prod-id="${htmlEscape(p.id)}" data-tab="upload">
              <i class="fas fa-upload"></i> Upload
            </button>
          </div>
          <div class="hero-slide-section active" id="psec-url-${htmlEscape(p.id)}">
            <input type="url" class="img-url-input" id="imgurl-${htmlEscape(p.id)}"
                   value="${htmlEscape(displayUrl)}"
                   placeholder="Paste new image URL…"
                   data-prod-id="${htmlEscape(p.id)}" />
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button class="btn btn-gold btn-sm" style="flex:1;" data-action="save-img" data-id="${htmlEscape(p.id)}">
                <i class="fas fa-save"></i> Save
              </button>
              <a href="https://unsplash.com/s/photos/jewelry" target="_blank" rel="noopener noreferrer"
                 class="btn btn-outline-gold btn-sm" title="Browse Unsplash">
                <i class="fas fa-search"></i>
              </a>
            </div>
          </div>
          <div class="hero-slide-section" id="psec-upload-${htmlEscape(p.id)}">
            <input type="file" id="pfile-${htmlEscape(p.id)}" accept="image/*" style="display:none;"
                   data-prod-id="${htmlEscape(p.id)}" />
            <div class="hero-upload-zone" id="pdropzone-${htmlEscape(p.id)}" data-prod-id="${htmlEscape(p.id)}">
              <i class="fas fa-cloud-upload-alt"></i>
              <p>Click or drag &amp; drop image here</p>
            </div>
            <p id="pfile-name-${htmlEscape(p.id)}" style="font-size:0.72rem;color:var(--gray);margin-top:6px;text-align:center;min-height:16px;"></p>
            <button class="btn btn-gold btn-sm" style="width:100%;margin-top:6px;"
                    id="psave-upload-${htmlEscape(p.id)}" data-action="save-img" data-id="${htmlEscape(p.id)}" disabled>
              <i class="fas fa-save"></i> Save Uploaded Image
            </button>
          </div>
        </div>
      </div>`;
    }).join('');

    // Event delegation for product image panel
    grid.addEventListener('click', (e) => {
      const tabBtn   = e.target.closest('[data-prod-id][data-tab]');
      const saveBtn  = e.target.closest('[data-action="save-img"]');
      const changeBtn= e.target.closest('[data-action="change-img"]');
      const dropzone = e.target.closest('.hero-upload-zone[data-prod-id]');
      if (tabBtn)    switchProdTab(tabBtn.dataset.prodId, tabBtn.dataset.tab);
      if (saveBtn)   saveProductImage(saveBtn.dataset.id);
      if (changeBtn) switchProdTab(changeBtn.dataset.id, 'upload');
      if (dropzone)  document.getElementById(`pfile-${dropzone.dataset.prodId}`)?.click();
    });
    grid.addEventListener('input', (e) => {
      const urlInput = e.target.closest('input[type=url][data-prod-id]');
      if (urlInput) previewProductImage(urlInput.dataset.prodId, urlInput.value);
    });
    grid.addEventListener('change', (e) => {
      const fileInput = e.target.closest('input[type=file][data-prod-id]');
      if (fileInput) readProdFile(fileInput.dataset.prodId, fileInput.files[0]);
    });
    grid.addEventListener('dragover', (e) => {
      if (e.target.closest('.hero-upload-zone')) e.preventDefault();
    });
    grid.addEventListener('drop', (e) => {
      const dz = e.target.closest('.hero-upload-zone[data-prod-id]');
      if (!dz) return;
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (file?.type.startsWith('image/')) readProdFile(dz.dataset.prodId, file);
    });

    document.getElementById('save-product-imgs-btn')?.addEventListener('click', saveAllProductImages);
  } catch {
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Failed to load products</p></div>';
  }
}

function switchProdTab(id, tab) {
  ['url', 'upload'].forEach(t => {
    document.getElementById(`ptab-${t}-${id}`)?.classList.toggle('active', t === tab);
    document.getElementById(`psec-${t}-${id}`)?.classList.toggle('active', t === tab);
  });
}
window.switchProdTab = switchProdTab;

function readProdFile(id, file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const urlInput = document.getElementById(`imgurl-${id}`);
    if (urlInput) urlInput.value = dataUrl;
    previewProductImage(id, dataUrl);
    const nameEl = document.getElementById(`pfile-name-${id}`);
    if (nameEl) nameEl.textContent = `${file.name} ready`;
    const dz = document.getElementById(`pdropzone-${id}`);
    if (dz) { dz.style.borderColor = 'var(--gold)'; dz.style.background = 'rgba(200,169,110,0.06)'; }
    const saveBtn = document.getElementById(`psave-upload-${id}`);
    if (saveBtn) saveBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

function previewProductImage(id, url) {
  const img = document.getElementById(`imgthumb-${id}`);
  if (img && url) img.src = url;
}
window.previewProductImage = previewProductImage;

function saveProductImage(id) {
  const urlInput = document.getElementById(`imgurl-${id}`);
  if (!urlInput) return;
  const newUrl = urlInput.value.trim();
  if (!newUrl) { showToast('Please enter or upload an image first.', 'error'); return; }

  const saveBtns = document.querySelectorAll(`[data-action="save-img"][data-id="${id}"]`);
  saveBtns.forEach(b => { b.disabled = true; b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; });

  try {
    // 1. Write the new URL directly into dd_products so it is the single source of truth.
    //    Other localStorage-reading code (renderProductCard, getProducts) will pick it up.
    const products = JSON.parse(localStorage.getItem('dd_products') || '[]');
    const idx = products.findIndex(p => p.id === id);
    if (idx !== -1) {
      products[idx].image_url = newUrl;
      localStorage.setItem('dd_products', JSON.stringify(products));
    }

    // 2. Keep the override key for backward-compat with renderProductCard overlay logic
    const overrides = JSON.parse(localStorage.getItem('dd_product_images_override') || '{}');
    overrides[id] = newUrl;
    localStorage.setItem('dd_product_images_override', JSON.stringify(overrides));

    // 3. Mark that there are unpublished changes
    localStorage.setItem('dd_products_dirty', '1');

    showToast('Image saved locally ✓  — click "Publish to Website" in the Dashboard to make it live for all visitors.', 'success');
    const nameEl = document.getElementById(`pfile-name-${id}`);
    if (nameEl) nameEl.textContent = 'Saved ✓';
    // Update thumbnail in admin immediately
    const thumb = document.getElementById(`imgthumb-${id}`);
    if (thumb) thumb.src = newUrl;
    // Refresh the dirty-badge on dashboard if visible
    updatePublishBadge();
  } catch {
    showToast('Failed to save image. Storage may be full.', 'error');
  } finally {
    saveBtns.forEach(b => { b.disabled = false; b.innerHTML = '<i class="fas fa-save"></i> Save'; });
  }
}
window.saveProductImage = saveProductImage;

function saveAllProductImages() {
  const inputs = document.querySelectorAll('.img-url-input');
  let saved = 0;
  try {
    const products = JSON.parse(localStorage.getItem('dd_products') || '[]');
    const overrides = JSON.parse(localStorage.getItem('dd_product_images_override') || '{}');
    for (const inp of inputs) {
      const id  = inp.id.replace('imgurl-', '');
      const url = inp.value.trim();
      if (!url) continue;
      // Write into dd_products directly
      const idx = products.findIndex(p => p.id === id);
      if (idx !== -1) products[idx].image_url = url;
      overrides[id] = url;
      saved++;
    }
    localStorage.setItem('dd_products', JSON.stringify(products));
    localStorage.setItem('dd_product_images_override', JSON.stringify(overrides));
    localStorage.setItem('dd_products_dirty', '1');
    updatePublishBadge();
    showToast(`${saved} image(s) saved locally ✓  — click "Publish to Website" in the Dashboard to make them live.`, 'success');
  } catch {
    showToast('Failed to save all images. Storage may be full.', 'error');
  }
}

// ── Products CRUD ─────────────────────────────────────────
async function getAllProductsAdmin() {
  try {
    const stored = localStorage.getItem('dd_products');
    if (stored) {
      const p = JSON.parse(stored);
      if (Array.isArray(p) && p.length > 0) return p;
    }
  } catch {}
  // Seed from JSON
  try {
    const res      = await fetch('/data/products.json');
    const products = await res.json();
    if (Array.isArray(products) && products.length > 0) {
      localStorage.setItem('dd_products', JSON.stringify(products));
      return products;
    }
  } catch {}
  return [];
}

function saveProductsToStorage(arr) {
  localStorage.setItem('dd_products', JSON.stringify(arr));
}

async function loadProductsTable() {
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;

  try {
    const products = await getAllProductsAdmin();
    setText('stat-products', products.length);
    if (!Array.isArray(products) || !products.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-gem"></i> No products yet. Click "Add Product" to begin.</td></tr>';
    } else {
      tbody.innerHTML = '';
      products.forEach(p => {
        const tr = document.createElement('tr');
        const stockColor = p.in_stock !== false ? 'green' : 'red';
        const stockIcon  = p.in_stock !== false ? 'check-circle' : 'times-circle';
        const stockLabel = p.in_stock !== false ? 'In Stock' : 'Out of Stock';
        tr.innerHTML = `
          <td><img src="${htmlEscape(p.image_url)}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;"
               onerror="this.src='https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=100&q=60'" /></td>
          <td style="font-weight:600;"></td>
          <td></td>
          <td>${formatPKR(p.price)}</td>
          <td>${p.badge ? `<span class="status-badge status-${p.badge === 'Sale' ? 'failed' : p.badge === 'New' ? 'shipped' : 'paid'}">${htmlEscape(p.badge)}</span>` : '—'}</td>
          <td>
            <button class="btn btn-sm" data-action="toggle-stock"
                    data-id="${htmlEscape(p.id)}"
                    style="font-size:0.75rem;border:1px solid ${stockColor};color:${stockColor};">
              <i class="fas fa-${stockIcon}"></i> ${stockLabel}
            </button>
          </td>
          <td>
            <button class="btn btn-outline-gold btn-sm" data-action="edit-product" data-id="${htmlEscape(p.id)}"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm" style="border:1px solid #e74c3c;color:#e74c3c;margin-left:4px;"
                    data-action="delete-product" data-id="${htmlEscape(p.id)}" data-name="${htmlEscape(p.name)}"><i class="fas fa-trash"></i></button>
          </td>`;
        tr.querySelectorAll('td')[1].textContent = p.name;
        tr.querySelectorAll('td')[2].textContent = p.category;
        tbody.appendChild(tr);
      });
    }
  } catch {
    tbody.innerHTML = '<tr><td colspan="7">Failed to load products.</td></tr>';
  }

  // "Add Product" button — remove old listener by replacing button
  const addBtn = document.getElementById('add-product-btn');
  if (addBtn) {
    const newBtn = addBtn.cloneNode(true);
    addBtn.replaceWith(newBtn);
    newBtn.addEventListener('click', () => openEditProduct(null));
  }

  // Event delegation for edit / delete / toggle-stock
  // Use a named handler stored on tbody so we can remove the previous one on re-render
  if (tbody._ddClickHandler) {
    tbody.removeEventListener('click', tbody._ddClickHandler);
  }
  tbody._ddClickHandler = async (e) => {
    const editBtn   = e.target.closest('[data-action="edit-product"]');
    const deleteBtn = e.target.closest('[data-action="delete-product"]');
    const toggleBtn = e.target.closest('[data-action="toggle-stock"]');
    if (editBtn)   openEditProduct(editBtn.dataset.id);
    if (deleteBtn) deleteProduct(deleteBtn.dataset.id, deleteBtn.dataset.name);
    if (toggleBtn) {
      const products = await getAllProductsAdmin();
      const idx = products.findIndex(p => p.id === toggleBtn.dataset.id);
      if (idx !== -1) {
        products[idx].in_stock = !(products[idx].in_stock !== false);
        saveProductsToStorage(products);
        loadProductsTable();
        showToast('Stock status updated.', 'success');
      }
    }
  };
  tbody.addEventListener('click', tbody._ddClickHandler);
}

// Holds the uploaded File object waiting for saveProduct() to push to GitHub
let _pmUploadedFile = null;

async function openEditProduct(id) {
  const modal = document.getElementById('product-modal');
  const title = document.getElementById('product-modal-title');
  document.getElementById('pm-error')?.classList.add('hidden');
  _pmUploadedFile = null;

  // Reset upload UI
  const dropzone = document.getElementById('pm-dropzone');
  const fileName = document.getElementById('pm-file-name');
  if (dropzone) { dropzone.style.borderColor = ''; dropzone.style.background = ''; }
  if (fileName) fileName.textContent = '';
  const fileInput = document.getElementById('pm-file-input');
  if (fileInput) fileInput.value = '';

  // Default to URL tab
  _pmSwitchImageTab('url');

  if (id) {
    title.textContent = 'Edit Product';
    try {
      const all = await getAllProductsAdmin();
      const p   = (Array.isArray(all) ? all : []).find(x => x.id === id);
      if (!p) throw new Error('Not found');
      const set = (fid, val) => { const el = document.getElementById(fid); if (el) el.value = val ?? ''; };
      set('pm-id', p.id); set('pm-name', p.name); set('pm-category', p.category);
      set('pm-price', p.price); set('pm-price-usd', p.price_usd || '');
      set('pm-image', p.image_url); set('pm-short-desc', p.short_desc);
      set('pm-description', p.description); set('pm-material', p.material);
      set('pm-badge', p.badge || ''); set('pm-rating', p.rating || 0);
      // Stock toggle
      const stockToggle = document.getElementById('pm-in-stock');
      if (stockToggle) stockToggle.checked = (p.in_stock !== false);
      // Image preview
      const prev = document.getElementById('pm-img-preview');
      if (prev && p.image_url && !p.image_url.startsWith('data:')) {
        prev.src = p.image_url; prev.style.display = 'block';
      } else if (prev) { prev.style.display = 'none'; }
    } catch { showToast('Failed to load product', 'error'); return; }
  } else {
    title.textContent = 'Add New Product';
    ['pm-id','pm-name','pm-price','pm-price-usd','pm-image','pm-short-desc','pm-description','pm-material','pm-rating']
      .forEach(fid => { const el = document.getElementById(fid); if (el) el.value = ''; });
    document.getElementById('pm-badge').value = '';
    const stockToggle = document.getElementById('pm-in-stock');
    if (stockToggle) stockToggle.checked = true;
    const prev = document.getElementById('pm-img-preview');
    if (prev) prev.style.display = 'none';
  }

  // Image URL live preview
  const imgInput = document.getElementById('pm-image');
  if (imgInput) {
    imgInput.oninput = function () {
      _pmUploadedFile = null; // URL takes precedence over any uploaded file
      const prev = document.getElementById('pm-img-preview');
      if (prev) { prev.src = this.value; prev.style.display = this.value ? 'block' : 'none'; }
    };
  }

  // Upload zone
  if (dropzone) {
    dropzone.onclick = () => fileInput?.click();
    dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); };
    dropzone.ondragleave = () => dropzone.classList.remove('drag-over');
    dropzone.ondrop = (e) => {
      e.preventDefault(); dropzone.classList.remove('drag-over');
      const f = e.dataTransfer?.files[0];
      if (f?.type.startsWith('image/')) _pmHandleFile(f);
    };
  }
  if (fileInput) {
    fileInput.onchange = () => { if (fileInput.files[0]) _pmHandleFile(fileInput.files[0]); };
  }

  modal?.classList.add('open');
}

function _pmSwitchImageTab(tab) {
  ['url','upload'].forEach(t => {
    document.getElementById(`pm-tab-${t}`)?.classList.toggle('active', t === tab);
    document.getElementById(`pm-sec-${t}`)?.classList.toggle('active', t === tab);
  });
}
window._pmSwitchImageTab = _pmSwitchImageTab;

function _pmHandleFile(file) {
  _pmUploadedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    // Show preview immediately (base64)
    const prev = document.getElementById('pm-img-preview');
    if (prev) { prev.src = dataUrl; prev.style.display = 'block'; }
    const urlInput = document.getElementById('pm-image');
    if (urlInput) urlInput.value = ''; // clear URL field — upload takes over
    const dz = document.getElementById('pm-dropzone');
    if (dz) { dz.style.borderColor = 'var(--gold)'; dz.style.background = 'rgba(200,169,110,0.06)'; }
    const fn = document.getElementById('pm-file-name');
    if (fn) fn.textContent = `${file.name} (${(file.size / 1024).toFixed(0)} KB) ready`;
  };
  reader.readAsDataURL(file);
}
window.openEditProduct = openEditProduct;

function closeProductModal() {
  document.getElementById('product-modal')?.classList.remove('open');
}
window.closeProductModal = closeProductModal;

async function saveProduct() {
  const id    = document.getElementById('pm-id')?.value.trim();
  const errEl = document.getElementById('pm-error');
  const productId = id || ('p' + Date.now());

  const body  = {
    id:          productId,
    name:        sanitizeInput(document.getElementById('pm-name')?.value || ''),
    category:    document.getElementById('pm-category')?.value,
    price:       parseFloat(document.getElementById('pm-price')?.value)     || 0,
    price_usd:   parseFloat(document.getElementById('pm-price-usd')?.value) || 0,
    image_url:   sanitizeInput(document.getElementById('pm-image')?.value || ''),
    short_desc:  sanitizeInput(document.getElementById('pm-short-desc')?.value  || ''),
    description: sanitizeInput(document.getElementById('pm-description')?.value || ''),
    material:    sanitizeInput(document.getElementById('pm-material')?.value     || ''),
    badge:       document.getElementById('pm-badge')?.value || '',
    rating:      parseFloat(document.getElementById('pm-rating')?.value) || 0,
    in_stock:    document.getElementById('pm-in-stock')?.checked !== false,
  };

  // Validate: need name + price + (url OR uploaded file)
  const hasUpload = !!_pmUploadedFile;
  if (!body.name || !body.price || (!body.image_url && !hasUpload)) {
    if (errEl) { errEl.textContent = 'Name, Price, and an image (URL or Upload) are required.'; errEl.classList.remove('hidden'); }
    return;
  }

  const btn = document.getElementById('pm-save-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
  if (errEl) errEl.classList.add('hidden');

  try {
    // ── If a file was uploaded, try GitHub upload first ──────
    if (hasUpload) {
      const saved   = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      const ghToken = saved.gh_token  || '';
      const ghOwner = saved.gh_owner  || '';
      const ghRepo  = saved.gh_repo   || '';
      const ghBranch= saved.gh_branch || 'main';

      if (ghToken && ghOwner && ghRepo) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading image to GitHub…';
        try {
          const rawUrl = await _uploadImageToGitHub(_pmUploadedFile, productId, ghToken, ghOwner, ghRepo, ghBranch);
          body.image_url = rawUrl;
          showToast('Image uploaded to GitHub ✓', 'success');
        } catch (imgErr) {
          // Fallback: store base64 locally (cross-machine issue explained to user)
          const reader = new FileReader();
          const dataUrl = await new Promise((resolve) => {
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(_pmUploadedFile);
          });
          body.image_url = dataUrl;
          showToast('GitHub image upload failed — stored locally only. Set up GitHub in Settings to enable cross-machine images.', 'error');
        }
      } else {
        // No GitHub: store base64 locally
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve) => {
          reader.onload = e => resolve(e.target.result);
          reader.readAsDataURL(_pmUploadedFile);
        });
        body.image_url = dataUrl;
        showToast('Image stored locally only. Add GitHub credentials in Settings to upload images to the server.', '');
      }
      _pmUploadedFile = null;
    }

    const products = await getAllProductsAdmin();
    const idx = products.findIndex(p => p.id === body.id);
    if (idx !== -1) {
      products[idx] = { ...products[idx], ...body };
    } else {
      products.push(body);
    }
    saveProductsToStorage(products);
    // Also keep image override in sync
    if (body.image_url) {
      const overrides = JSON.parse(localStorage.getItem('dd_product_images_override') || '{}');
      overrides[body.id] = body.image_url;
      localStorage.setItem('dd_product_images_override', JSON.stringify(overrides));
    }
    localStorage.setItem('dd_products_dirty', '1');
    updatePublishBadge();
    showToast('Product saved ✓ — click "Publish to Website" to make it live for all visitors.', 'success');
    closeProductModal();
    loadProductsTable();
  } catch (e) {
    if (errEl) { errEl.textContent = 'Failed to save: ' + (e.message || 'Unknown error'); errEl.classList.remove('hidden'); }
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save Product';
  }
}
window.saveProduct = saveProduct;

async function deleteProduct(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    const products = await getAllProductsAdmin();
    const updated  = products.filter(p => p.id !== id);
    saveProductsToStorage(updated);
    localStorage.setItem('dd_products_dirty', '1');
    updatePublishBadge();
    showToast(`"${name}" deleted locally ✓  — publish to make it live for all visitors.`, 'success');
    loadProductsTable();
  } catch {
    showToast('Failed to delete product.', 'error');
  }
}
window.deleteProduct = deleteProduct;

// ── Orders ─────────────────────────────────────────────────
function loadOrdersTable() {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;

  const orders = JSON.parse(localStorage.getItem('dd_orders') || '[]');
  setText('orders-count', `${orders.length} order${orders.length !== 1 ? 's' : ''}`);

  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="padding:40px;">
      <i class="fas fa-receipt" style="font-size:2rem;color:var(--border);display:block;margin-bottom:12px;"></i>
      No orders yet — they'll appear here when customers place orders.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  orders.forEach(o => {
    const statusColor = { Pending:'pending', Confirmed:'paid', Shipped:'shipped', Delivered:'delivered', Cancelled:'cancelled' };
    const payStatusColor = { Pending:'pending', Paid:'paid', Refunded:'shipped' };
    const date = o.created_at ? new Date(o.created_at).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'2-digit' }) : '—';
    const itemsList = Array.isArray(o.items)
      ? o.items.map(i => `${i.name} × ${i.qty}`).join(', ')
      : (o.items || '');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="order-id-cell">#<span></span></td>
      <td>
        <strong></strong><br>
        <small style="color:var(--gray);"></small>
      </td>
      <td style="max-width:160px;font-size:0.78rem;color:var(--gray);"></td>
      <td style="font-weight:600;white-space:nowrap;"></td>
      <td></td>
      <td>
        <select class="order-status-select" data-id="${htmlEscape(o.id)}" data-type="order_status"
          style="border:1px solid var(--border);border-radius:6px;padding:4px 6px;font-size:0.75rem;cursor:pointer;">
          ${['Pending','Confirmed','Shipped','Delivered','Cancelled'].map(s =>
            `<option value="${s}" ${o.order_status === s ? 'selected' : ''}>${s}</option>`
          ).join('')}
        </select>
      </td>
      <td style="font-size:0.78rem;color:var(--gray);"></td>
      <td>
        <button class="btn btn-sm" data-action="view-order" data-id="${htmlEscape(o.id)}"
          style="font-size:0.72rem;border:1px solid var(--gold);color:var(--gold-dark);margin-bottom:4px;display:block;width:100%;text-align:center;">
          <i class="fas fa-eye"></i> View
        </button>
        <button class="btn btn-sm" data-action="delete-order" data-id="${htmlEscape(o.id)}"
          style="font-size:0.72rem;border:1px solid #e74c3c;color:#e74c3c;display:block;width:100%;text-align:center;">
          <i class="fas fa-trash"></i> Delete
        </button>
      </td>`;
    tr.querySelector('.order-id-cell span').textContent       = (o.id || '').slice(-8).toUpperCase();
    tr.querySelectorAll('td')[1].querySelector('strong').textContent = o.customer_name || '—';
    tr.querySelectorAll('td')[1].querySelector('small').textContent  = o.customer_phone || '';
    tr.querySelectorAll('td')[2].textContent = itemsList;
    tr.querySelectorAll('td')[3].textContent = formatPKR(o.total_pkr || 0);
    const payBadge = document.createElement('span');
    payBadge.className = `status-badge status-${payStatusColor[o.payment_status] || 'pending'}`;
    payBadge.textContent = o.payment_method ? `${o.payment_method} — ${o.payment_status || 'Pending'}` : (o.payment_status || 'Pending');
    tr.querySelectorAll('td')[4].appendChild(payBadge);
    tr.querySelectorAll('td')[6].textContent = date;
    tbody.appendChild(tr);
  });

  // Order status change
  if (tbody._ddOrderHandler) tbody.removeEventListener('change', tbody._ddOrderHandler);
  if (tbody._ddOrderClickHandler) tbody.removeEventListener('click', tbody._ddOrderClickHandler);

  tbody._ddOrderHandler = (e) => {
    const sel = e.target.closest('.order-status-select');
    if (!sel) return;
    const id = sel.dataset.id;
    const orders = JSON.parse(localStorage.getItem('dd_orders') || '[]');
    const idx = orders.findIndex(o => o.id === id);
    if (idx !== -1) {
      orders[idx].order_status = sel.value;
      localStorage.setItem('dd_orders', JSON.stringify(orders));
      showToast(`Order status updated to "${sel.value}"`, 'success');
      loadDashboard();
    }
  };
  tbody._ddOrderClickHandler = (e) => {
    const viewBtn   = e.target.closest('[data-action="view-order"]');
    const deleteBtn = e.target.closest('[data-action="delete-order"]');
    if (viewBtn) {
      const id = viewBtn.dataset.id;
      const o  = JSON.parse(localStorage.getItem('dd_orders') || '[]').find(x => x.id === id);
      if (o) showOrderDetailModal(o);
    }
    if (deleteBtn) {
      if (!confirm('Delete this order from local records? This cannot be undone.')) return;
      const updated = JSON.parse(localStorage.getItem('dd_orders') || '[]').filter(x => x.id !== deleteBtn.dataset.id);
      localStorage.setItem('dd_orders', JSON.stringify(updated));
      loadOrdersTable();
      loadDashboard();
      showToast('Order deleted.', 'success');
    }
  };
  tbody.addEventListener('change', tbody._ddOrderHandler);
  tbody.addEventListener('click', tbody._ddOrderClickHandler);
}

function showOrderDetailModal(o) {
  const items = Array.isArray(o.items)
    ? o.items.map(i => `<li>${htmlEscape(i.name)} × ${i.qty} — ${formatPKR(i.price * i.qty)}</li>`).join('')
    : `<li>${htmlEscape(String(o.items || ''))}</li>`;
  const date = o.created_at ? new Date(o.created_at).toLocaleString('en-PK') : '—';
  const html = `
    <div style="position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:16px;" id="order-detail-overlay">
      <div style="background:var(--white);border-radius:var(--radius-md);padding:32px;max-width:540px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,0.4);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="font-family:var(--font-serif);font-size:1.2rem;">Order #${htmlEscape((o.id || '').slice(-8).toUpperCase())}</h3>
          <button onclick="document.getElementById('order-detail-overlay').remove()"
            style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--gray);">✕</button>
        </div>
        <dl style="display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;font-size:0.875rem;">
          <div><dt style="color:var(--gray);font-size:0.75rem;text-transform:uppercase;letter-spacing:.5px;">Customer</dt><dd style="font-weight:600;"></dd></div>
          <div><dt style="color:var(--gray);font-size:0.75rem;text-transform:uppercase;letter-spacing:.5px;">Phone</dt><dd></dd></div>
          <div><dt style="color:var(--gray);font-size:0.75rem;text-transform:uppercase;letter-spacing:.5px;">Email</dt><dd style="word-break:break-all;"></dd></div>
          <div><dt style="color:var(--gray);font-size:0.75rem;text-transform:uppercase;letter-spacing:.5px;">Date</dt><dd>${htmlEscape(date)}</dd></div>
          <div style="grid-column:1/-1;"><dt style="color:var(--gray);font-size:0.75rem;text-transform:uppercase;letter-spacing:.5px;">Shipping Address</dt><dd></dd></div>
          <div><dt style="color:var(--gray);font-size:0.75rem;text-transform:uppercase;letter-spacing:.5px;">Payment Method</dt><dd></dd></div>
          <div><dt style="color:var(--gray);font-size:0.75rem;text-transform:uppercase;letter-spacing:.5px;">Total</dt><dd style="font-weight:700;font-size:1rem;color:var(--gold-dark);"></dd></div>
          ${o.notes ? `<div style="grid-column:1/-1;"><dt style="color:var(--gray);font-size:0.75rem;text-transform:uppercase;letter-spacing:.5px;">Notes</dt><dd></dd></div>` : ''}
        </dl>
        <div style="margin-top:16px;padding:14px;background:var(--gray-light);border-radius:var(--radius);">
          <strong style="font-size:0.8rem;display:block;margin-bottom:8px;color:var(--gray);">ITEMS ORDERED</strong>
          <ul style="margin:0;padding-left:18px;font-size:0.875rem;line-height:1.9;">${items}</ul>
        </div>
      </div>
    </div>`;
  const div = document.createElement('div');
  div.innerHTML = html;
  const overlay = div.firstElementChild;
  const dls = overlay.querySelectorAll('dd');
  dls[0].textContent = o.customer_name   || '—';
  dls[1].textContent = o.customer_phone  || '—';
  dls[2].textContent = o.customer_email  || '—';
  // dls[3] = date (already set in html)
  dls[4].textContent = o.customer_address || '—';
  dls[5].textContent = o.payment_method  || '—';
  dls[6].textContent = formatPKR(o.total_pkr || 0);
  if (o.notes && dls[7]) dls[7].textContent = o.notes;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ── Inquiries ─────────────────────────────────────────────
function loadInquiries() {
  const container = document.getElementById('inquiry-cards');
  if (!container) return;

  const inquiries = JSON.parse(localStorage.getItem('dd_inquiries') || '[]');
  setText('inq-count', `${inquiries.length} inquiry${inquiries.length !== 1 ? 'ies' : 'y'}`);

  if (!inquiries.length) {
    container.innerHTML = `<div class="empty-state">
      <i class="fas fa-envelope" style="font-size:2.5rem;color:var(--border);display:block;margin-bottom:12px;"></i>
      <p style="font-weight:600;">No inquiries yet</p>
      <p style="font-size:0.82rem;color:var(--gray);">Customer contact-form submissions appear here.</p>
    </div>`;
    return;
  }

  container.innerHTML = '';
  inquiries.forEach(inq => {
    const date = inq.created_at ? new Date(inq.created_at).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
    const card = document.createElement('div');
    card.className = `inquiry-card ${inq.status === 'Replied' ? 'replied' : ''}`;
    card.dataset.id = inq.id;
    card.innerHTML = `
      <div class="inquiry-card-header">
        <div>
          <h4></h4>
          <span style="font-size:0.75rem;color:var(--gray);"></span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="status-badge status-${inq.status === 'Replied' ? 'paid' : 'pending'}"></span>
          <button data-action="reply-inq" data-id="${htmlEscape(inq.id)}"
            style="font-size:0.72rem;padding:4px 10px;border-radius:20px;background:none;
                   border:1px solid var(--gold);color:var(--gold-dark);cursor:pointer;">
            <i class="fas fa-reply"></i> Reply
          </button>
          <button data-action="delete-inq" data-id="${htmlEscape(inq.id)}"
            style="font-size:0.72rem;padding:4px 8px;border-radius:20px;background:none;
                   border:1px solid #e74c3c;color:#e74c3c;cursor:pointer;">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      <p class="meta"></p>
      <p class="message"></p>`;
    card.querySelector('h4').textContent           = inq.name || '—';
    card.querySelector('span').textContent          = date;
    card.querySelector('.status-badge').textContent = inq.status || 'New';
    card.querySelector('.meta').textContent         = `${inq.email || ''} · ${inq.phone || ''} · ${inq.subject || ''}`;
    card.querySelector('.message').textContent      = (inq.message || '').slice(0, 200) + ((inq.message || '').length > 200 ? '…' : '');
    container.appendChild(card);
  });

  if (container._ddInqHandler) container.removeEventListener('click', container._ddInqHandler);
  container._ddInqHandler = (e) => {
    const replyBtn  = e.target.closest('[data-action="reply-inq"]');
    const deleteBtn = e.target.closest('[data-action="delete-inq"]');
    if (replyBtn) {
      const id  = replyBtn.dataset.id;
      const inq = JSON.parse(localStorage.getItem('dd_inquiries') || '[]').find(x => x.id === id);
      if (inq) {
        window.open(`mailto:${inq.email}?subject=Re: ${encodeURIComponent(inq.subject || 'Your Inquiry')}&body=${encodeURIComponent(`Hi ${inq.name},\n\nThank you for reaching out to DesignDreams!\n\n`)}`, '_blank');
        // Mark as replied
        const all = JSON.parse(localStorage.getItem('dd_inquiries') || '[]');
        const idx = all.findIndex(x => x.id === id);
        if (idx !== -1) { all[idx].status = 'Replied'; localStorage.setItem('dd_inquiries', JSON.stringify(all)); }
        loadInquiries();
        loadDashboard();
      }
    }
    if (deleteBtn) {
      if (!confirm('Delete this inquiry from local records?')) return;
      const updated = JSON.parse(localStorage.getItem('dd_inquiries') || '[]').filter(x => x.id !== deleteBtn.dataset.id);
      localStorage.setItem('dd_inquiries', JSON.stringify(updated));
      loadInquiries();
      loadDashboard();
      showToast('Inquiry deleted.', 'success');
    }
  };
  container.addEventListener('click', container._ddInqHandler);
}

// ── Settings ──────────────────────────────────────────────
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const set   = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
    set('set-email',     saved.email     || DD_CONFIG.business.email);
    set('set-address',   saved.address   || DD_CONFIG.business.address);
    set('set-instagram', saved.instagram || DD_CONFIG.business.instagram);
    set('set-facebook',  saved.facebook  || DD_CONFIG.business.facebook);
    const wa = saved.whatsapp || DD_CONFIG.business.whatsapp;
    set('set-whatsapp', wa);
    updateWaPreview(wa);
    set('set-ep-num',   saved.ep_number || DD_CONFIG.easypaisa.accountNumber);
    set('set-ep-title', saved.ep_title  || DD_CONFIG.easypaisa.accountTitle);
    set('set-jc-num',   saved.jc_number || DD_CONFIG.jazzcash.accountNumber);
    set('set-jc-title', saved.jc_title  || DD_CONFIG.jazzcash.accountTitle);
    set('set-bank-iban',  saved.bank_iban  || DD_CONFIG.bank.iban);
    set('set-bank-title', saved.bank_title || DD_CONFIG.bank.accountTitle);
    set('set-paypal',   saved.paypal_client_id || DD_CONFIG.paypal.clientId);
    set('set-shipping', saved.free_shipping    || DD_CONFIG.shipping.freeThreshold);
    set('set-emailjs-service',  saved.emailjs_service  || '');
    set('set-emailjs-template', saved.emailjs_template || '');
    set('set-emailjs-key',      saved.emailjs_key      || '');
    set('set-gh-owner',  saved.gh_owner  || '');
    set('set-gh-repo',   saved.gh_repo   || '');
    set('set-gh-branch', saved.gh_branch || 'main');
    set('set-gh-token',  saved.gh_token  || '');
    set('set-w3f-key',   saved.web3forms_key || '');
  } catch {}

  document.getElementById('save-settings-btn')?.addEventListener('click', saveSettings);
}

function updateWaPreview(number) {
  const clean = (number || '').replace(/\D/g, '');
  const link  = document.getElementById('wa-preview-link');
  if (link) {
    link.href = `https://wa.me/${clean}`;
    link.textContent = `https://wa.me/${clean}`;
  }
}
window.updateWaPreview = updateWaPreview;

function previewWhatsApp(val) { updateWaPreview(val); }
window.previewWhatsApp = previewWhatsApp;

function saveSettings() {
  const get = id => sanitizeInput(document.getElementById(id)?.value || '');
  const settings = {
    email:            get('set-email'),
    address:          get('set-address'),
    instagram:        get('set-instagram'),
    facebook:         get('set-facebook'),
    whatsapp:         get('set-whatsapp').replace(/\D/g, ''),
    ep_number:        get('set-ep-num'),
    ep_title:         get('set-ep-title'),
    jc_number:        get('set-jc-num'),
    jc_title:         get('set-jc-title'),
    bank_iban:        get('set-bank-iban'),
    bank_title:       get('set-bank-title'),
    paypal_client_id: get('set-paypal'),
    free_shipping:    parseInt(get('set-shipping')) || 10000,
    emailjs_service:  get('set-emailjs-service'),
    emailjs_template: get('set-emailjs-template'),
    emailjs_key:      get('set-emailjs-key'),
    gh_owner:      get('set-gh-owner'),
    gh_repo:       get('set-gh-repo'),
    gh_branch:     get('set-gh-branch') || 'main',
    gh_token:      get('set-gh-token'),
    web3forms_key: get('set-w3f-key'),
  };

  if (settings.whatsapp && settings.whatsapp.length < 10) {
    showToast('WhatsApp number seems too short. Please check and try again.', 'error');
    return;
  }

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

  if (settings.whatsapp)     DD_CONFIG.business.whatsapp       = settings.whatsapp;
  if (settings.ep_number)    DD_CONFIG.easypaisa.accountNumber  = settings.ep_number;
  if (settings.jc_number)    DD_CONFIG.jazzcash.accountNumber   = settings.jc_number;
  if (settings.bank_iban)    DD_CONFIG.bank.iban                = settings.bank_iban;
  if (settings.free_shipping) DD_CONFIG.shipping.freeThreshold  = settings.free_shipping;

  document.getElementById('settings-saved')?.classList.remove('hidden');
  setTimeout(() => document.getElementById('settings-saved')?.classList.add('hidden'), 4000);
  showToast('Settings saved! All pages updated.', 'success');
}

// ── Content Manager Panel ──────────────────────────────────
function loadContentPanel() {
  const panel = document.getElementById('panel-content-manager');
  if (!panel) return;

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('dd_content') || '{}'); } catch {}

  const fields = [
    { id: 'hero-eyebrow-text',  label: 'Hero Eyebrow Text',         placeholder: 'Premium Stainless Steel Collection' },
    { id: 'hero-title-text',    label: 'Hero Title (main h1)',       placeholder: 'Wear Your Dream' },
    { id: 'hero-subtitle-text', label: 'Hero Subtitle',             placeholder: 'Handcrafted artificial jewelry…' },
    { id: 'about-heading',      label: 'About Section Heading',     placeholder: 'Jewelry That Tells Your Story' },
    { id: 'about-body',         label: 'About Body Text',           placeholder: 'DesignDreams was born from…', textarea: true },
    { id: 'footer-tagline',     label: 'Footer Tagline',            placeholder: 'Premium stainless steel and artificial jewelry…', textarea: true },
    { id: 'top-bar-shipping',   label: 'Free Shipping Notice Text', placeholder: 'Free shipping on orders above PKR 10,000' },
    { id: 'contact-email-text', label: 'Contact Email Display',     placeholder: 'designdreamsbysyeda@gmail.com' },
    { id: 'contact-address-text',label:'Contact Address',           placeholder: 'North Nazimabad Block L, Karachi, Pakistan' },
  ];

  panel.innerHTML = `
    <div class="panel-header">
      <h2>Content Manager</h2>
      <button class="btn btn-gold btn-sm" id="save-content-btn"><i class="fas fa-save"></i> Save Content</button>
    </div>
    <p style="color:var(--gray);font-size:0.85rem;margin-bottom:24px;">
      <i class="fas fa-info-circle" style="color:var(--gold);"></i>
      Edit any visible text on the homepage. Changes apply instantly after saving — no code edits needed.
    </p>
    <div style="background:var(--white);border-radius:var(--radius-md);padding:28px;box-shadow:var(--shadow-sm);">
      <div class="contact-form" style="gap:16px;" id="content-fields-form">
        ${fields.map(f => `
          <div class="form-group">
            <label style="font-weight:600;">${htmlEscape(f.label)}</label>
            ${f.textarea
              ? `<textarea id="cf-${htmlEscape(f.id)}" rows="3" placeholder="${htmlEscape(f.placeholder)}" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius);font-family:inherit;font-size:0.875rem;">${htmlEscape(saved[f.id] || '')}</textarea>`
              : `<input type="text" id="cf-${htmlEscape(f.id)}" value="${htmlEscape(saved[f.id] || '')}" placeholder="${htmlEscape(f.placeholder)}" />`
            }
            <small style="color:var(--gray);font-size:0.73rem;">Element ID: <code>${htmlEscape(f.id)}</code></small>
          </div>`).join('')}
      </div>
    </div>`;

  document.getElementById('save-content-btn')?.addEventListener('click', () => {
    const content = {};
    fields.forEach(f => {
      const el = document.getElementById(`cf-${f.id}`);
      if (el) content[f.id] = sanitizeInput(el.value);
    });
    localStorage.setItem('dd_content', JSON.stringify(content));
    showToast('Content saved! Refresh the homepage to see changes.', 'success');
  });
}

// ── Testimonials Panel ─────────────────────────────────────
const DEFAULT_TESTIMONIALS = [
  { id: 't1', name: 'Ayesha K.', city: 'Lahore', text: 'The Golden Luxury Set is absolutely stunning! It hasn\'t tarnished even after months. Highly recommend DesignDreams!', rating: 5 },
  { id: 't2', name: 'Sana R.',   city: 'Karachi', text: 'Ordered via EasyPaisa and my bracelet arrived in 2 days! The quality is premium and the packaging was beautiful.', rating: 5 },
  { id: 't3', name: 'Fatima M.', city: 'Islamabad', text: 'Love the pearl earrings! They\'re hypoallergenic as promised. Perfect for my sensitive ears. Will order again!', rating: 4.5 },
];

function getTestimonials() {
  try {
    const stored = JSON.parse(localStorage.getItem('dd_testimonials') || '[]');
    if (Array.isArray(stored) && stored.length > 0) return stored;
  } catch {}
  return DEFAULT_TESTIMONIALS;
}

function saveTestimonials(arr) {
  localStorage.setItem('dd_testimonials', JSON.stringify(arr));
}

function loadTestimonialsPanel() {
  const panel = document.getElementById('panel-testimonials');
  if (!panel) return;
  renderTestimonialsPanel(panel);
}

function renderTestimonialsPanel(panel) {
  const testimonials = getTestimonials();
  panel.innerHTML = `
    <div class="panel-header">
      <h2>Testimonials</h2>
      <button class="btn btn-gold btn-sm" id="add-testimonial-btn"><i class="fas fa-plus"></i> Add Testimonial</button>
    </div>
    <p style="color:var(--gray);font-size:0.85rem;margin-bottom:24px;">
      Manage customer reviews shown on the homepage. Add, edit, or delete testimonials.
    </p>
    <div id="testimonials-list" style="display:flex;flex-direction:column;gap:16px;">
      ${testimonials.map(t => `
        <div class="testimonial-admin-card" style="background:var(--white);border-radius:var(--radius-md);padding:20px 24px;box-shadow:var(--shadow-sm);border-left:4px solid var(--gold);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
            <div>
              <strong style="font-size:1rem;" id="tn-name-${htmlEscape(t.id)}"></strong>
              <span style="color:var(--gray);font-size:0.85rem;" id="tn-city-${htmlEscape(t.id)}"></span>
              <span style="color:var(--gold);margin-left:8px;">${'★'.repeat(Math.round(t.rating || 5))}</span>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-outline-gold btn-sm" data-action="edit-testimonial" data-id="${htmlEscape(t.id)}"><i class="fas fa-edit"></i></button>
              <button class="btn btn-sm" style="border:1px solid #e74c3c;color:#e74c3c;"
                      data-action="delete-testimonial" data-id="${htmlEscape(t.id)}"><i class="fas fa-trash"></i></button>
            </div>
          </div>
          <p style="color:var(--gray);font-size:0.875rem;font-style:italic;" id="tn-text-${htmlEscape(t.id)}"></p>
        </div>`).join('')}
    </div>
    <!-- Add/Edit form -->
    <div id="testimonial-form-wrap" style="display:none;margin-top:24px;background:var(--white);border-radius:var(--radius-md);padding:24px;box-shadow:var(--shadow-sm);">
      <h3 style="font-size:1rem;font-weight:600;margin-bottom:16px;" id="testimonial-form-title">Add Testimonial</h3>
      <input type="hidden" id="tf-id" />
      <div class="contact-form" style="gap:14px;">
        <div class="form-row">
          <div class="form-group"><label>Name *</label><input type="text" id="tf-name" placeholder="Customer Name" /></div>
          <div class="form-group"><label>City</label><input type="text" id="tf-city" placeholder="Karachi" /></div>
        </div>
        <div class="form-group"><label>Review Text *</label><textarea id="tf-text" rows="3" placeholder="Write the review here…"></textarea></div>
        <div class="form-group">
          <label>Rating (1–5)</label>
          <input type="number" id="tf-rating" min="1" max="5" step="0.5" value="5" />
        </div>
        <div style="display:flex;gap:12px;">
          <button class="btn btn-outline-gold" id="testimonial-form-cancel">Cancel</button>
          <button class="btn btn-gold" id="testimonial-form-save"><i class="fas fa-save"></i> Save Testimonial</button>
        </div>
      </div>
    </div>`;

  // Set text safely
  testimonials.forEach(t => {
    const nameEl = document.getElementById(`tn-name-${t.id}`);
    const cityEl = document.getElementById(`tn-city-${t.id}`);
    const textEl = document.getElementById(`tn-text-${t.id}`);
    if (nameEl) nameEl.textContent = t.name || '';
    if (cityEl) cityEl.textContent = t.city ? ` — ${t.city}` : '';
    if (textEl) textEl.textContent = `"${t.text || ''}"`;
  });

  document.getElementById('add-testimonial-btn')?.addEventListener('click', () => {
    openTestimonialForm(null);
  });

  panel.addEventListener('click', (e) => {
    const editBtn   = e.target.closest('[data-action="edit-testimonial"]');
    const deleteBtn = e.target.closest('[data-action="delete-testimonial"]');
    if (editBtn)   openTestimonialForm(editBtn.dataset.id);
    if (deleteBtn) {
      const all = getTestimonials();
      const updated = all.filter(t => t.id !== deleteBtn.dataset.id);
      saveTestimonials(updated);
      renderTestimonialsPanel(panel);
      showToast('Testimonial deleted.', 'success');
    }
  });

  document.getElementById('testimonial-form-cancel')?.addEventListener('click', () => {
    document.getElementById('testimonial-form-wrap').style.display = 'none';
  });

  document.getElementById('testimonial-form-save')?.addEventListener('click', () => {
    const id   = document.getElementById('tf-id')?.value || ('t' + Date.now());
    const name = sanitizeInput(document.getElementById('tf-name')?.value || '');
    const city = sanitizeInput(document.getElementById('tf-city')?.value || '');
    const text = sanitizeInput(document.getElementById('tf-text')?.value || '');
    const rating = parseFloat(document.getElementById('tf-rating')?.value) || 5;
    if (!name || !text) { showToast('Name and review text are required.', 'error'); return; }
    const all = getTestimonials();
    const idx = all.findIndex(t => t.id === id);
    const entry = { id, name, city, text, rating };
    if (idx !== -1) all[idx] = entry;
    else all.push(entry);
    saveTestimonials(all);
    renderTestimonialsPanel(panel);
    showToast('Testimonial saved!', 'success');
  });

  function openTestimonialForm(id) {
    const wrap = document.getElementById('testimonial-form-wrap');
    wrap.style.display = 'block';
    wrap.scrollIntoView({ behavior: 'smooth' });
    const titleEl = document.getElementById('testimonial-form-title');
    if (id) {
      titleEl.textContent = 'Edit Testimonial';
      const t = getTestimonials().find(x => x.id === id);
      if (t) {
        document.getElementById('tf-id').value     = t.id;
        document.getElementById('tf-name').value   = t.name || '';
        document.getElementById('tf-city').value   = t.city || '';
        document.getElementById('tf-text').value   = t.text || '';
        document.getElementById('tf-rating').value = t.rating || 5;
      }
    } else {
      titleEl.textContent = 'Add Testimonial';
      ['tf-id','tf-name','tf-city','tf-text'].forEach(fid => {
        const el = document.getElementById(fid); if (el) el.value = '';
      });
      document.getElementById('tf-rating').value = 5;
    }
  }
}

// ── Gallery Panel ──────────────────────────────────────────
const DEFAULT_GALLERY = [
  { url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&q=80', link: 'shop.html' },
  { url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&q=80', link: 'shop.html' },
  { url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&q=80', link: 'shop.html' },
  { url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&q=80', link: 'shop.html' },
  { url: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&q=80', link: 'shop.html' },
  { url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&q=80', link: 'shop.html' },
];

function loadGalleryPanel() {
  const panel = document.getElementById('panel-gallery');
  if (!panel) return;

  let gallery = DEFAULT_GALLERY;
  try {
    const stored = JSON.parse(localStorage.getItem('dd_gallery') || '[]');
    if (Array.isArray(stored) && stored.length > 0) gallery = stored;
  } catch {}

  // Ensure always 6 slots
  while (gallery.length < 6) gallery.push({ url: '', link: 'shop.html' });
  gallery = gallery.slice(0, 6);

  panel.innerHTML = `
    <div class="panel-header">
      <h2>Gallery / Instagram Strip</h2>
      <button class="btn btn-gold btn-sm" id="save-gallery-btn"><i class="fas fa-save"></i> Save Gallery</button>
    </div>
    <p style="color:var(--gray);font-size:0.85rem;margin-bottom:24px;">
      Manage the 6 gallery images shown at the bottom of the homepage (Instagram strip).
    </p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;">
      ${gallery.map((item, i) => `
        <div style="background:var(--white);border-radius:var(--radius-md);overflow:hidden;box-shadow:var(--shadow-sm);">
          <div style="aspect-ratio:1;overflow:hidden;background:var(--gray-light);">
            <img id="gallery-preview-${i}" src="${htmlEscape(item.url || '')}" alt="Gallery ${i + 1}"
                 style="width:100%;height:100%;object-fit:cover;"
                 onerror="this.style.opacity=0.3" />
          </div>
          <div style="padding:14px;">
            <label style="font-size:0.78rem;font-weight:600;display:block;margin-bottom:6px;">Image ${i + 1} URL</label>
            <input type="url" id="gallery-url-${i}" value="${htmlEscape(item.url || '')}"
                   placeholder="https://images.unsplash.com/…"
                   style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:0.78rem;"
                   data-gallery-idx="${i}" />
            <label style="font-size:0.78rem;font-weight:600;display:block;margin-top:8px;margin-bottom:4px;">Link URL</label>
            <input type="url" id="gallery-link-${i}" value="${htmlEscape(item.link || 'shop.html')}"
                   placeholder="shop.html"
                   style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:0.78rem;" />
          </div>
        </div>`).join('')}
    </div>`;

  // Live preview on URL input
  panel.addEventListener('input', (e) => {
    const idx = e.target.dataset.galleryIdx;
    if (idx !== undefined) {
      const preview = document.getElementById(`gallery-preview-${idx}`);
      if (preview) { preview.src = e.target.value; preview.style.opacity = '1'; }
    }
  });

  document.getElementById('save-gallery-btn')?.addEventListener('click', () => {
    const saved = Array.from({ length: 6 }, (_, i) => ({
      url:  document.getElementById(`gallery-url-${i}`)?.value.trim() || '',
      link: document.getElementById(`gallery-link-${i}`)?.value.trim() || 'shop.html',
    }));
    localStorage.setItem('dd_gallery', JSON.stringify(saved));
    showToast('Gallery saved! Refresh the homepage to see changes.', 'success');
  });
}

// ── Category Cards Panel ───────────────────────────────────
const DEFAULT_CATEGORIES = [
  { name: 'Necklaces', image_url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&q=80' },
  { name: 'Bracelets', image_url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&q=80' },
  { name: 'Rings',     image_url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=500&q=80' },
  { name: 'Earrings',  image_url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500&q=80' },
  { name: 'Sets',      image_url: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800&q=80' },
];

function loadCategoriesPanel() {
  const panel = document.getElementById('panel-categories');
  if (!panel) return;

  let categories = DEFAULT_CATEGORIES.map(d => ({ ...d }));
  try {
    const stored = JSON.parse(localStorage.getItem('dd_categories') || '[]');
    if (Array.isArray(stored) && stored.length > 0) {
      categories = DEFAULT_CATEGORIES.map(def => {
        const found = stored.find(s => s.name === def.name);
        return found ? { ...def, ...found } : def;
      });
    }
  } catch {}

  panel.innerHTML = `
    <div class="panel-header">
      <h2>Category Cards</h2>
      <button class="btn btn-gold btn-sm" id="save-categories-btn"><i class="fas fa-save"></i> Save Categories</button>
    </div>
    <p style="color:var(--gray);font-size:0.85rem;margin-bottom:24px;">
      Edit the background images for each category card shown on the homepage.
    </p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px;">
      ${categories.map((cat, i) => `
        <div style="background:var(--white);border-radius:var(--radius-md);overflow:hidden;box-shadow:var(--shadow-sm);">
          <div style="aspect-ratio:4/3;overflow:hidden;background:var(--gray-light);">
            <img id="cat-preview-${i}" src="${htmlEscape(cat.image_url || '')}" alt="${htmlEscape(cat.name)}"
                 style="width:100%;height:100%;object-fit:cover;"
                 onerror="this.style.opacity=0.3" />
          </div>
          <div style="padding:14px;">
            <strong style="display:block;margin-bottom:8px;font-size:0.9rem;">${htmlEscape(cat.name)}</strong>
            <input type="hidden" id="cat-name-${i}" value="${htmlEscape(cat.name)}" />
            <label style="font-size:0.78rem;font-weight:600;display:block;margin-bottom:6px;">Image URL</label>
            <input type="url" id="cat-url-${i}" value="${htmlEscape(cat.image_url || '')}"
                   placeholder="https://images.unsplash.com/…"
                   style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:0.78rem;"
                   data-cat-idx="${i}" />
          </div>
        </div>`).join('')}
    </div>`;

  // Live preview
  panel.addEventListener('input', (e) => {
    const idx = e.target.dataset.catIdx;
    if (idx !== undefined) {
      const preview = document.getElementById(`cat-preview-${idx}`);
      if (preview) { preview.src = e.target.value; preview.style.opacity = '1'; }
    }
  });

  document.getElementById('save-categories-btn')?.addEventListener('click', () => {
    const saved = categories.map((_, i) => ({
      name:      document.getElementById(`cat-name-${i}`)?.value || '',
      image_url: document.getElementById(`cat-url-${i}`)?.value.trim() || '',
    }));
    localStorage.setItem('dd_categories', JSON.stringify(saved));
    showToast('Category cards saved! Refresh the homepage to see changes.', 'success');
  });
}

// ── Announcement Banner Panel ──────────────────────────────
function loadAnnouncementPanel() {
  const panel = document.getElementById('panel-announcement');
  if (!panel) return;

  let ann = { enabled: false, text: '', color: '#2d7d46' };
  try { ann = { ...ann, ...JSON.parse(localStorage.getItem('dd_announcement') || '{}') }; } catch {}

  panel.innerHTML = `
    <div class="panel-header">
      <h2>Announcement Banner</h2>
      <button class="btn btn-gold btn-sm" id="save-announcement-btn"><i class="fas fa-save"></i> Save &amp; Apply</button>
    </div>
    <p style="color:var(--gray);font-size:0.85rem;margin-bottom:24px;">
      Show a dismissable promotional banner at the top of every page.
    </p>
    <div style="background:var(--white);border-radius:var(--radius-md);padding:28px;box-shadow:var(--shadow-sm);">
      <div class="contact-form" style="gap:16px;">
        <div class="form-group">
          <label style="font-weight:600;">Enable Banner</label>
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-top:6px;">
            <input type="checkbox" id="ann-enabled" ${ann.enabled ? 'checked' : ''} style="width:18px;height:18px;" />
            <span>Show announcement banner on all pages</span>
          </label>
        </div>
        <div class="form-group">
          <label style="font-weight:600;">Banner Message *</label>
          <input type="text" id="ann-text" value="${htmlEscape(ann.text || '')}"
                 placeholder="e.g. Free shipping on orders above PKR 10,000 this weekend only!" />
        </div>
        <div class="form-group">
          <label style="font-weight:600;">Background Color</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;">
            ${[
              { color: '#2d7d46', label: 'Green' },
              { color: '#C8A96E', label: 'Gold' },
              { color: '#c0392b', label: 'Red' },
              { color: '#1a1a1a', label: 'Dark' },
              { color: '#1a5276', label: 'Blue' },
            ].map(c => `
              <label style="cursor:pointer;display:flex;align-items:center;gap:6px;">
                <input type="radio" name="ann-color" value="${htmlEscape(c.color)}"
                       ${ann.color === c.color ? 'checked' : ''} />
                <span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:${htmlEscape(c.color)};border:2px solid rgba(0,0,0,0.1);"></span>
                ${htmlEscape(c.label)}
              </label>`).join('')}
            <label style="cursor:pointer;display:flex;align-items:center;gap:6px;">
              <input type="radio" name="ann-color" value="custom" id="ann-color-custom-radio" />
              <input type="color" id="ann-color-custom" value="${htmlEscape(ann.color || '#2d7d46')}"
                     style="width:24px;height:24px;padding:0;border:none;cursor:pointer;" />
              Custom
            </label>
          </div>
        </div>
        <!-- Live Preview -->
        <div>
          <label style="font-weight:600;display:block;margin-bottom:8px;">Preview</label>
          <div id="ann-preview" style="background:${htmlEscape(ann.color || '#2d7d46')};color:#fff;padding:10px 48px 10px 16px;border-radius:6px;font-size:0.875rem;position:relative;">
            <span id="ann-preview-text">${htmlEscape(ann.text || 'Your announcement text here')}</span>
            <span style="position:absolute;right:12px;top:50%;transform:translateY(-50%);opacity:0.7;">✕</span>
          </div>
        </div>
      </div>
    </div>`;

  // Live preview updates
  const updatePreview = () => {
    const text  = document.getElementById('ann-text')?.value || 'Your announcement text here';
    const radio = document.querySelector('input[name="ann-color"]:checked');
    let color   = radio?.value === 'custom'
      ? (document.getElementById('ann-color-custom')?.value || '#2d7d46')
      : (radio?.value || '#2d7d46');
    const preview     = document.getElementById('ann-preview');
    const previewText = document.getElementById('ann-preview-text');
    if (preview)     preview.style.background     = color;
    if (previewText) previewText.textContent = text;
  };

  panel.addEventListener('input', updatePreview);
  panel.addEventListener('change', (e) => {
    if (e.target.name === 'ann-color') updatePreview();
  });

  document.getElementById('save-announcement-btn')?.addEventListener('click', () => {
    const radio = document.querySelector('input[name="ann-color"]:checked');
    const color = radio?.value === 'custom'
      ? (document.getElementById('ann-color-custom')?.value || '#2d7d46')
      : (radio?.value || '#2d7d46');
    const saved = {
      enabled: document.getElementById('ann-enabled')?.checked || false,
      text:    sanitizeInput(document.getElementById('ann-text')?.value || ''),
      color,
    };
    localStorage.setItem('dd_announcement', JSON.stringify(saved));
    showToast('Announcement saved! Refresh any page to see it.', 'success');
  });
}

// ── Theme & Colors Panel ───────────────────────────────────
const DEFAULT_THEME = { gold: '#C8A96E', gold_dark: '#a8803f', dark: '#1a1a1a' };

function loadThemePanel() {
  const panel = document.getElementById('panel-theme');
  if (!panel) return;

  let theme = { ...DEFAULT_THEME };
  try { theme = { ...DEFAULT_THEME, ...JSON.parse(localStorage.getItem('dd_theme') || '{}') }; } catch {}

  panel.innerHTML = `
    <div class="panel-header">
      <h2>Theme &amp; Colors</h2>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-outline-gold btn-sm" id="reset-theme-btn"><i class="fas fa-undo"></i> Reset to Default</button>
        <button class="btn btn-gold btn-sm" id="save-theme-btn"><i class="fas fa-save"></i> Save &amp; Apply</button>
      </div>
    </div>
    <p style="color:var(--gray);font-size:0.85rem;margin-bottom:24px;">
      Customize the color scheme. Changes apply via CSS variables across all pages.
    </p>
    <div style="background:var(--white);border-radius:var(--radius-md);padding:28px;box-shadow:var(--shadow-sm);max-width:480px;">
      <div class="contact-form" style="gap:20px;">
        ${[
          { id: 'theme-gold',      label: 'Main Gold Color (--gold)',            val: theme.gold },
          { id: 'theme-gold-dark', label: 'Gold Dark Variant (--gold-dark)',     val: theme.gold_dark },
          { id: 'theme-dark',      label: 'Dark Background Color (--dark)',      val: theme.dark },
        ].map(f => `
          <div class="form-group">
            <label style="font-weight:600;">${htmlEscape(f.label)}</label>
            <div style="display:flex;align-items:center;gap:12px;margin-top:6px;">
              <input type="color" id="${htmlEscape(f.id)}" value="${htmlEscape(f.val || '#C8A96E')}"
                     style="width:48px;height:36px;padding:2px;border:1px solid var(--border);border-radius:4px;cursor:pointer;" />
              <input type="text" id="${htmlEscape(f.id)}-hex" value="${htmlEscape(f.val || '#C8A96E')}"
                     style="width:120px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius);font-family:monospace;font-size:0.875rem;" />
              <div id="${htmlEscape(f.id)}-swatch"
                   style="width:36px;height:36px;border-radius:50%;border:2px solid rgba(0,0,0,0.1);background:${htmlEscape(f.val || '#C8A96E')};"></div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;

  // Sync color picker ↔ hex input ↔ swatch
  ['theme-gold', 'theme-gold-dark', 'theme-dark'].forEach(id => {
    const picker = document.getElementById(id);
    const hex    = document.getElementById(`${id}-hex`);
    const swatch = document.getElementById(`${id}-swatch`);
    if (!picker || !hex || !swatch) return;
    picker.addEventListener('input', () => {
      hex.value = picker.value;
      swatch.style.background = picker.value;
    });
    hex.addEventListener('input', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) {
        picker.value = hex.value;
        swatch.style.background = hex.value;
      }
    });
  });

  document.getElementById('reset-theme-btn')?.addEventListener('click', () => {
    localStorage.removeItem('dd_theme');
    // Remove override style
    document.getElementById('dd-theme-override')?.remove();
    loadThemePanel();
    showToast('Theme reset to default.', 'success');
  });

  document.getElementById('save-theme-btn')?.addEventListener('click', () => {
    const saved = {
      gold:      document.getElementById('theme-gold')?.value      || DEFAULT_THEME.gold,
      gold_dark: document.getElementById('theme-gold-dark')?.value || DEFAULT_THEME.gold_dark,
      dark:      document.getElementById('theme-dark')?.value      || DEFAULT_THEME.dark,
    };
    localStorage.setItem('dd_theme', JSON.stringify(saved));
    // Apply immediately
    let style = document.getElementById('dd-theme-override');
    if (!style) {
      style = document.createElement('style');
      style.id = 'dd-theme-override';
      document.head.appendChild(style);
    }
    style.textContent = `:root { --gold: ${saved.gold}; --gold-dark: ${saved.gold_dark}; --dark: ${saved.dark}; }`;
    showToast('Theme saved! Applied to all pages.', 'success');
  });
}

// ── SEO Panel ──────────────────────────────────────────────
function loadSeoPanel() {
  const panel = document.getElementById('panel-seo');
  if (!panel) return;

  let seo = {};
  try { seo = JSON.parse(localStorage.getItem('dd_seo') || '{}'); } catch {}

  panel.innerHTML = `
    <div class="panel-header">
      <h2>SEO Settings</h2>
      <button class="btn btn-gold btn-sm" id="save-seo-btn"><i class="fas fa-save"></i> Save SEO</button>
    </div>
    <p style="color:var(--gray);font-size:0.85rem;margin-bottom:24px;">
      <i class="fas fa-info-circle" style="color:var(--gold);"></i>
      These values override the page title and meta description for search engines and browser tabs.
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
      <!-- Homepage -->
      <div style="background:var(--white);border-radius:var(--radius-md);padding:24px;box-shadow:var(--shadow-sm);">
        <h3 style="font-size:1rem;font-weight:600;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border);">
          <i class="fas fa-home" style="color:var(--gold);"></i> Homepage (index.html)
        </h3>
        <div class="contact-form" style="gap:14px;">
          <div class="form-group">
            <label>Page Title</label>
            <input type="text" id="seo-home-title" value="${htmlEscape(seo.home_title || '')}"
                   placeholder="DesignDreams – Luxury Stainless Steel Jewelry" />
            <small style="color:var(--gray);font-size:0.73rem;">Recommended: 50–60 characters</small>
          </div>
          <div class="form-group">
            <label>Meta Description</label>
            <textarea id="seo-home-desc" rows="3" placeholder="DesignDreams offers premium artificial and stainless steel jewelry…">${htmlEscape(seo.home_desc || '')}</textarea>
            <small style="color:var(--gray);font-size:0.73rem;">Recommended: 150–160 characters</small>
          </div>
        </div>
      </div>
      <!-- Shop -->
      <div style="background:var(--white);border-radius:var(--radius-md);padding:24px;box-shadow:var(--shadow-sm);">
        <h3 style="font-size:1rem;font-weight:600;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border);">
          <i class="fas fa-store" style="color:var(--gold);"></i> Shop Page (shop.html)
        </h3>
        <div class="contact-form" style="gap:14px;">
          <div class="form-group">
            <label>Page Title</label>
            <input type="text" id="seo-shop-title" value="${htmlEscape(seo.shop_title || '')}"
                   placeholder="Shop All Jewelry – DesignDreams" />
            <small style="color:var(--gray);font-size:0.73rem;">Recommended: 50–60 characters</small>
          </div>
          <div class="form-group">
            <label>Meta Description</label>
            <textarea id="seo-shop-desc" rows="3" placeholder="Browse our full collection of necklaces, bracelets, rings, earrings and sets…">${htmlEscape(seo.shop_desc || '')}</textarea>
            <small style="color:var(--gray);font-size:0.73rem;">Recommended: 150–160 characters</small>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById('save-seo-btn')?.addEventListener('click', () => {
    const saved = {
      home_title: sanitizeInput(document.getElementById('seo-home-title')?.value || ''),
      home_desc:  sanitizeInput(document.getElementById('seo-home-desc')?.value  || ''),
      shop_title: sanitizeInput(document.getElementById('seo-shop-title')?.value || ''),
      shop_desc:  sanitizeInput(document.getElementById('seo-shop-desc')?.value  || ''),
    };
    localStorage.setItem('dd_seo', JSON.stringify(saved));
    showToast('SEO settings saved! Applied on next page load.', 'success');
  });
}

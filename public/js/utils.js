/**
 * Shared Utility Functions for Shri Govind Pharmacy
 * Eliminates duplicate code across JS files
 */

/* ══════════════════════════════════════
   1. TOAST NOTIFICATIONS
══════════════════════════════════════ */
function toast(message, type = 'info', duration = 3000) {
  const zone = document.querySelector('.toast-zone') || createToastZone();
  
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-info-circle',
    warning: 'fa-exclamation-triangle'
  };

  const colors = {
    success: '#22c55e',
    error: '#ef4444',
    info: '#3b82f6',
    warning: '#f59e0b'
  };

  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `
    <i class="fas ${icons[type] || icons.info}"></i>
    <span>${message}</span>
  `;
  t.style.cssText = `
    background: ${colors[type] || colors.info};
    color: white;
    padding: 14px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 500;
    min-width: 280px;
    max-width: 400px;
    pointer-events: auto;
    animation: slideInUp 0.3s ease;
  `;

  zone.appendChild(t);

  setTimeout(() => {
    t.style.animation = 'slideOutDown 0.3s ease';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

function createToastZone() {
  const zone = document.createElement('div');
  zone.className = 'toast-zone';
  zone.style.cssText = `
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    pointer-events: none;
  `;
  document.body.appendChild(zone);
  return zone;
}

/* ══════════════════════════════════════
   2. SCROLL HANDLER (Throttled)
══════════════════════════════════════ */
function createThrottledScrollHandler(callback) {
  let ticking = false;
  
  return function() {
    if (!ticking) {
      requestAnimationFrame(() => {
        callback();
        ticking = false;
      });
      ticking = true;
    }
  };
}

/* ══════════════════════════════════════
   3. BACK TO TOP BUTTON
══════════════════════════════════════ */
function initBackToTop(buttonSelector = '.back-to-top') {
  const btn = document.querySelector(buttonSelector);
  if (!btn) return;

  const scrollHandler = createThrottledScrollHandler(() => {
    btn.style.display = window.scrollY > 400 ? 'flex' : 'none';
  });

  window.addEventListener('scroll', scrollHandler, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ══════════════════════════════════════
   4. HEADER SHADOW ON SCROLL
══════════════════════════════════════ */
function initHeaderShadow(headerSelector = '#main-header') {
  const header = document.querySelector(headerSelector);
  if (!header) return;

  const scrollHandler = createThrottledScrollHandler(() => {
    header.classList.toggle('scrolled', window.scrollY > 60);
  });

  window.addEventListener('scroll', scrollHandler, { passive: true });
}

/* ══════════════════════════════════════
   5. MOBILE MENU
══════════════════════════════════════ */
function initMobileMenu() {
  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  const mobileOverlay = document.querySelector('.mobile-overlay');
  const closeBtn = document.querySelector('.mobile-menu-close');

  if (!hamburger || !mobileMenu) return;

  function openMenu() {
    mobileMenu.classList.add('open');
    if (mobileOverlay) mobileOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    mobileMenu.classList.remove('open');
    if (mobileOverlay) mobileOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', openMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);
  if (mobileOverlay) mobileOverlay.addEventListener('click', closeMenu);

  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
      closeMenu();
    }
  });
}

/* ══════════════════════════════════════
   6. CART BADGE UPDATE
══════════════════════════════════════ */
async function updateCartBadge() {
  try {
    const response = await fetch('/api/user/counts');
    if (!response.ok) return;
    
    const data = await response.json();
    
    // Update all cart badge elements
    document.querySelectorAll('.cart-count, .cart-badge').forEach(el => {
      el.textContent = data.cartCount || 0;
      el.style.display = data.cartCount > 0 ? 'inline' : 'none';
    });
  } catch (err) {
    console.error('Error updating cart badge:', err);
  }
}

/* ══════════════════════════════════════
   7. WISHLIST BADGE UPDATE
══════════════════════════════════════ */
async function updateWishlistBadge() {
  try {
    const response = await fetch('/api/user/counts');
    if (!response.ok) return;
    
    const data = await response.json();
    
    // Update all wishlist badge elements
    document.querySelectorAll('.wishlist-count').forEach(el => {
      el.textContent = data.wishlistCount || 0;
      el.style.display = data.wishlistCount > 0 ? 'inline' : 'none';
    });
  } catch (err) {
    console.error('Error updating wishlist badge:', err);
  }
}

/* ══════════════════════════════════════
   8. DEBOUNCE UTILITY
══════════════════════════════════════ */
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/* ══════════════════════════════════════
   9. LOCALE STORAGE HELPERS
══════════════════════════════════════ */
function storageAvailable(type) {
  try {
    const storage = window[type];
    const x = '__storage_test__';
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch (e) {
    return false;
  }
}

/* ══════════════════════════════════════
   10. REDUCED MOTION CHECK
══════════════════════════════════════ */
function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

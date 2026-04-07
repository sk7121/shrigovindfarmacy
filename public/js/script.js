/* ========================================
   SHRI GOVIND PHARMACY — script.js
   ======================================== */

document.addEventListener('DOMContentLoaded', function () {

  /* ══════════════════════════════════════
     1. ANNOUNCEMENT BAR ROTATOR + CLOSE
  ══════════════════════════════════════ */
  const announceSlides = document.querySelectorAll('.announce-slide');
  const announceClose = document.getElementById('announce-close');
  const announceBar = document.getElementById('announce-bar');
  let aIdx = 0;

  if (announceSlides.length > 1) {
    // Start only if bar is visible
    setInterval(() => {
      announceSlides[aIdx].classList.remove('active');
      aIdx = (aIdx + 1) % announceSlides.length;
      announceSlides[aIdx].classList.add('active');
    }, 3500);
  }

  if (announceClose && announceBar) {
    announceClose.addEventListener('click', () => {
      announceBar.style.maxHeight = announceBar.offsetHeight + 'px';
      requestAnimationFrame(() => {
        announceBar.style.transition = 'max-height 0.4s ease, opacity 0.3s ease, padding 0.3s ease';
        announceBar.style.maxHeight = '0';
        announceBar.style.opacity = '0';
        announceBar.style.overflow = 'hidden';
        announceBar.style.padding = '0';
      });
    });
  }


  /* ══════════════════════════════════════
     3. STICKY HEADER SHADOW ON SCROLL
  ══════════════════════════════════════ */
  const mainHeader = document.getElementById('main-header');
  window.addEventListener('scroll', () => {
    if (!mainHeader) return;
    mainHeader.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });


  /* ══════════════════════════════════════
     4. HAMBURGER + MOBILE MENU
  ══════════════════════════════════════ */
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileOverlay = document.getElementById('mobile-overlay');
  const mobileClose = document.getElementById('mobile-close');

  function openMobileMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.add('open');
    mobileOverlay && mobileOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Prevent iOS rubber-band scroll behind drawer
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    animateHamburger(true);
    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
  }

  function closeMobileMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove('open');
    mobileOverlay && mobileOverlay.classList.remove('open');
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    animateHamburger(false);
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
  }

  function animateHamburger(open) {
    if (!hamburger) return;
    const spans = hamburger.querySelectorAll('span');
    if (open) {
      spans[0].style.transform = 'translateY(7px) rotate(45deg)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
    } else {
      spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    }
  }

  if (hamburger) hamburger.addEventListener('click', openMobileMenu);
  if (mobileClose) mobileClose.addEventListener('click', closeMobileMenu);
  if (mobileOverlay) mobileOverlay.addEventListener('click', closeMobileMenu);

  // Mobile submenu toggle
  document.querySelectorAll('.mob-sub-trigger').forEach(trigger => {
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      const li = this.closest('li');
      const sub = li.querySelector('.mob-submenu');
      const arrow = this.querySelector('.mob-arrow');
      if (!sub) return;
      const isOpen = sub.classList.toggle('open');
      arrow && arrow.classList.toggle('rotated', isOpen);
      this.setAttribute('aria-expanded', isOpen);
    });
  });

  // Close menu on non-submenu link click
  document.querySelectorAll('.mobile-menu li a:not(.mob-sub-trigger)').forEach(link => {
    link.addEventListener('click', closeMobileMenu);
  });


  /* ══════════════════════════════════════
     4b. TOUCH DROPDOWN SUPPORT FOR TABLETS
  ══════════════════════════════════════ */
  // Enable dropdown menus on touch devices (tablets 768px-1024px)
  document.querySelectorAll('.has-dropdown > a').forEach(trigger => {
    trigger.addEventListener('click', function (e) {
      // Only prevent default on touch devices or tablet/mobile viewports
      if (window.innerWidth <= 1024) {
        const parent = this.closest('.has-dropdown');
        const dropdown = parent.querySelector('.mega-dropdown, .user-dropdown');
        
        if (dropdown) {
          e.preventDefault();
          e.stopPropagation();
          
          // Close all other dropdowns
          document.querySelectorAll('.has-dropdown').forEach(item => {
            if (item !== parent) {
              item.classList.remove('touch-open');
            }
          });
          
          // Toggle this dropdown
          parent.classList.toggle('touch-open');
        }
      }
    });
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.has-dropdown')) {
      document.querySelectorAll('.has-dropdown').forEach(item => {
        item.classList.remove('touch-open');
      });
    }
  });


  /* ══════════════════════════════════════
     5. SEARCH OVERLAY
  ══════════════════════════════════════ */
  const searchTrigger = document.getElementById('search-trigger');
  const searchOverlay = document.getElementById('search-overlay');
  const searchClose = document.getElementById('search-close');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');

  function openSearch() {
    if (!searchOverlay) return;
    searchOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Slightly delayed focus to avoid iOS keyboard conflicts
    setTimeout(() => searchInput && searchInput.focus(), 350);
  }

  function closeSearch() {
    if (!searchOverlay) return;
    searchOverlay.classList.remove('open');
    document.body.style.overflow = '';
    if (searchInput) searchInput.blur();
  }

  if (searchTrigger) searchTrigger.addEventListener('click', openSearch);
  if (searchClose) searchClose.addEventListener('click', closeSearch);
  if (searchOverlay) {
    searchOverlay.addEventListener('click', e => {
      if (e.target === searchOverlay) closeSearch();
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSearch(); closeMobileMenu(); closeModal(); }
  });

  function handleSearch(e) {
    if (e) e.preventDefault();

    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const searchCategory = document.getElementById('search-cat');
    const selectedCategory = searchCategory ? searchCategory.value : '';
    
    if (!query && !selectedCategory) { 
      toast('Please enter something to search.', 'error'); 
      return; 
    }

    // Sync with bottom filter form
    const bottomSearchInput = document.querySelector('#product-filter-form input[name="search"]');
    const bottomCategorySelect = document.querySelector('#product-filter-form select[name="category"]');
    
    if (bottomSearchInput) bottomSearchInput.value = searchInput ? searchInput.value : '';
    if (bottomCategorySelect && selectedCategory) bottomCategorySelect.value = selectedCategory;

    const cards = document.querySelectorAll('.product-card');
    let found = false;
    
    cards.forEach(card => {
      const cardText = card.innerText.toLowerCase();
      const cardCategory = card.getAttribute('data-category') || '';
      
      const matchesSearch = !query || cardText.includes(query);
      const matchesCategory = !selectedCategory || cardCategory === selectedCategory;
      
      const show = matchesSearch && matchesCategory;
      card.classList.toggle('hidden', !show);
      if (show) found = true;
    });

    if (!found) {
      cards.forEach(c => c.classList.remove('hidden'));
      toast('No products found — showing all.', 'error');
    } else {
      closeSearch();
      // Show filtered products in place - no scrolling
      const visibleCount = document.querySelectorAll('.product-card:not(.hidden)').length;
      toast(`Found ${visibleCount} product${visibleCount !== 1 ? 's' : ''}`, 'success');
      
      // Scroll to the product grid smoothly
      const productGrid = document.getElementById('product-grid') || document.querySelector('.product-grid');
      if (productGrid) {
        productGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  if (searchBtn) searchBtn.addEventListener('click', handleSearch);
  if (searchInput) {
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      }
    });
    searchInput.addEventListener('input', () => {
      if (!searchInput.value.trim()) {
        document.querySelectorAll('.product-card').forEach(c => c.classList.remove('hidden'));
        // Scroll to product grid when clearing search
        const productGrid = document.getElementById('product-grid') || document.querySelector('.product-grid');
        if (productGrid) {
          productGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }

  window.quickSearch = function (term) {
    if (searchInput) searchInput.value = term;
    handleSearch();
  };


  /* ══════════════════════════════════════
     6. HERO SLIDER
  ══════════════════════════════════════ */
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.dot');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  let current = 0;
  let autoInterval = null;
  let isAnimating = false;

  function goToSlide(index) {
    if (isAnimating || slides.length === 0) return;
    isAnimating = true;
    slides[current].classList.remove('active');
    if (dots[current]) { dots[current].classList.remove('active'); dots[current].setAttribute('aria-selected', 'false'); }
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active');
    if (dots[current]) { dots[current].classList.add('active'); dots[current].setAttribute('aria-selected', 'true'); }
    setTimeout(() => { isAnimating = false; }, 900);
  }

  function startAuto() { autoInterval = setInterval(() => goToSlide(current + 1), 5000); }
  function stopAuto() { clearInterval(autoInterval); }
  function resetAuto() { stopAuto(); startAuto(); }

  if (prevBtn) prevBtn.addEventListener('click', () => { goToSlide(current - 1); resetAuto(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { goToSlide(current + 1); resetAuto(); });
  dots.forEach(dot => {
    dot.addEventListener('click', () => { goToSlide(+dot.dataset.slide); resetAuto(); });
  });

  if (slides.length > 0) startAuto();

  // Touch/swipe support for mobile
  const heroSection = document.querySelector('.hero-slider');
  if (heroSection) {
    let touchStartX = 0;
    let touchStartY = 0;

    heroSection.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    heroSection.addEventListener('touchend', e => {
      const diffX = touchStartX - e.changedTouches[0].screenX;
      const diffY = touchStartY - e.changedTouches[0].screenY;
      // Only trigger slide if horizontal swipe is dominant
      if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
        goToSlide(diffX > 0 ? current + 1 : current - 1);
        resetAuto();
      }
    }, { passive: true });

    // Pause slider when page not visible (battery saving)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAuto();
      else startAuto();
    });
  }


  /* ══════════════════════════════════════
     9. PRODUCT FILTER TABS
  ══════════════════════════════════════ */
  const filterTabs = document.querySelectorAll('.ftab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', function () {
      filterTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      this.classList.add('active');
      this.setAttribute('aria-selected', 'true');

      const filter = this.dataset.filter;
      document.querySelectorAll('.product-card').forEach(card => {
        if (filter === 'all' || card.dataset.category === filter) {
          card.classList.remove('hidden');
          card.style.animation = 'fadeInCard 0.35s ease';
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });

  // Inject animations + badge pop
  const filterStyle = document.createElement('style');
  filterStyle.textContent = `
    @keyframes fadeInCard { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
    .badge.pop { animation: badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1); }
    @keyframes badgePop { 0%{transform:scale(1)} 50%{transform:scale(1.5)} 100%{transform:scale(1)} }
    .search-btn-text { display: inline; }
    @media (max-width: 400px) { .search-btn-text { display: none; } }
  `;
  document.head.appendChild(filterStyle);


  /* ══════════════════════════════════════
     10. QUICK VIEW MODAL
     On touch devices, open modal on card tap.
     Overlay buttons trigger on explicit press.
  ══════════════════════════════════════ */
  const modal = document.getElementById('productModal');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalClose = document.getElementById('modal-close');
  const modalAddBtn = document.getElementById('modalAddBtn');

  function openModal(card) {
    if (!modal) return;
    const img = card.querySelector('.product-image img')?.src || '';
    const brand = card.querySelector('.pd-brand')?.innerText || '';
    const title = card.querySelector('.product-title')?.innerText || '';
    const rating = card.querySelector('.pd-rating')?.innerHTML || '';
    const price = card.querySelector('.current-price')?.innerText || '';
    const mrp = card.querySelector('.old-price')?.innerText || '';
    const disc = card.querySelector('.discount-pct')?.innerText || '';
    const stock = card.querySelector('.product-badge')?.innerText || 'In Stock';
    const name = card.querySelector('.product-title')?.innerText || 'Product';
    const pricVal = card.querySelector('.add-to-cart-btn')?.dataset.price || 0;

    document.getElementById('modalImg').src = img;
    document.getElementById('modalImg').alt = name;
    document.getElementById('modalBrand').textContent = brand;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalRating').innerHTML = rating;
    document.getElementById('modalPrice').textContent = price;
    document.getElementById('modalMrp').textContent = mrp;
    document.getElementById('modalDisc').textContent = disc;
    document.getElementById('modalStock').textContent = stock;

    modalAddBtn.dataset.name = name;
    modalAddBtn.dataset.price = pricVal;

    modal.classList.add('open');
    modalBackdrop && modalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Scroll modal to top for mobile bottom-sheet style
    if (modal.querySelector('.modal-content')) {
      modal.querySelector('.modal-content').scrollTop = 0;
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    modalBackdrop && modalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.quick-view').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const card = this.closest('.product-card');
      if (card) openModal(card);
    });
  });

  // Card click → quick view (not on interactive elements)
  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', function (e) {
      if (e.target.closest('.add-to-cart-btn') || e.target.closest('.overlay-btn')) return;
      openModal(this);
    });
  });

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

  // Swipe down to close modal on mobile
  if (modal) {
    let modalTouchStartY = 0;
    modal.addEventListener('touchstart', e => {
      modalTouchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    modal.addEventListener('touchend', e => {
      const diff = e.changedTouches[0].screenY - modalTouchStartY;
      if (diff > 80) closeModal(); // swipe down 80px = close
    }, { passive: true });
  }

  if (modalAddBtn) {
    modalAddBtn.addEventListener('click', function () {
      const name = this.dataset.name || 'Product';
      updateCart(1);
      toast(`✅ ${name} added to cart!`, 'success');
      closeModal();
    });
  }

  window.closeModal = closeModal;


  /* ══════════════════════════════════════
     11. NEWSLETTER
  ══════════════════════════════════════ */
  const nlForm = document.getElementById('newsletter-form');
  if (nlForm) {
    nlForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const emailInput = this.querySelector('input[name="subscriber_email"]');
      const email = emailInput ? emailInput.value.trim() : '';
      if (!email || !email.includes('@')) {
        toast('Please enter a valid email.', 'error');
        return;
      }
      toast(`🎉 Subscribed! Welcome, ${email.split('@')[0]}!`, 'success');
      this.reset();
      if (emailInput) emailInput.blur(); // dismiss keyboard on mobile
    });
  }


  /* ══════════════════════════════════════
     12. BACK TO TOP
  ══════════════════════════════════════ */
  const backToTop = document.getElementById('back-to-top');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      backToTop.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }


  /* ══════════════════════════════════════
     13. SMOOTH SCROLL FOR ANCHOR LINKS
     (offset for sticky header height)
  ══════════════════════════════════════ */
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', function (e) {
      const id = this.getAttribute('href').slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        const headerH = mainHeader ? mainHeader.offsetHeight : 70;
        const top = target.getBoundingClientRect().top + window.scrollY - headerH;
        window.scrollTo({ top, behavior: 'smooth' });
        // Close mobile menu if open
        closeMobileMenu();
      }
    });
  });


  /* ══════════════════════════════════════
     14. SCROLL REVEAL ANIMATION
     (All elements visible immediately - no lazy loading)
  ══════════════════════════════════════ */
  // Removed IntersectionObserver lazy loading
  // All elements are now visible immediately on page load
  const revealTargets = document.querySelectorAll(
    '.category-card, .product-card, .testi-card, .offer-card, .trust-item'
  );
  
  // Make all elements visible immediately without animation delay
  revealTargets.forEach(el => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  });


  /* ══════════════════════════════════════
     15. ANIMATED COUNTERS (About section)
  ══════════════════════════════════════ */
  function animateCounter(el, target, suffix = '') {
    // Special case for decimal like 4.9
    const isDecimal = !Number.isInteger(target);
    let current = 0;
    const step = isDecimal ? 0.1 : Math.ceil(target / 60);
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = (isDecimal ? current.toFixed(1) : Math.round(current).toLocaleString('en-IN')) + suffix;
      if (current >= target) clearInterval(timer);
    }, isDecimal ? 40 : 25);
  }

  const counterObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const stats = entry.target.querySelectorAll('.ab-stat strong');
      const rawData = [
        { value: 12000, suffix: '+' },
        { value: 500, suffix: '+' },
        { value: 25, suffix: '+' },
        { value: 4.9, suffix: '★' },
      ];
      stats.forEach((el, i) => {
        if (rawData[i]) animateCounter(el, rawData[i].value, rawData[i].suffix);
      });
      counterObserver.unobserve(entry.target);
    });
  }, { threshold: 0.5 });

  const aboutStatsRow = document.querySelector('.about-stats-row');
  if (aboutStatsRow) counterObserver.observe(aboutStatsRow);

  // Hero stats counter
  const slideStats = document.querySelector('.slide-stats');
  if (slideStats) {
    const hData = [{ v: 12000, s: '+' }, { v: 500, s: '+' }, { v: 25, s: '+' }];
    const hEls = slideStats.querySelectorAll('.ss-item strong');
    setTimeout(() => {
      hEls.forEach((el, i) => { if (hData[i]) animateCounter(el, hData[i].v, hData[i].s); });
    }, 800);
  }


  /* ══════════════════════════════════════
     16. TOAST SYSTEM
     (centered, avoids WhatsApp button)
  ══════════════════════════════════════ */
  function toast(msg, type = 'success') {
    const zone = document.getElementById('toastZone');
    if (!zone) return;

    // Limit stacked toasts to 3
    const existing = zone.querySelectorAll('.toast');
    if (existing.length >= 3) existing[0].remove();

    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.setAttribute('role', 'alert');
    
    const icon = type === 'success' ? '✓' : '✕';
    t.innerHTML = `<span class="t-dot"></span><strong>${icon}</strong> <span>${msg}</span>`;
    
    zone.appendChild(t);

    setTimeout(() => {
      t.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      t.style.opacity = '0';
      t.style.transform = 'translateY(10px)';
      setTimeout(() => t.remove(), 400);
    }, 3200);
  }

  window.toast = toast;


  /* ══════════════════════════════════════
     17. TOUCH DEVICE DETECTION
  ══════════════════════════════════════ */
  function isTouchDevice() {
    return (('ontouchstart' in window) ||
       (navigator.maxTouchPoints > 0) ||
       (navigator.msMaxTouchPoints > 0));
  }

  /* ══════════════════════════════════════
     18. PREVENT DOUBLE-TAP ZOOM on Buttons
     (for Android Chrome specifically)
  ══════════════════════════════════════ */
  if (isTouchDevice()) {
    document.querySelectorAll('button, .btn, .oc-btn, .ftab, .sug-chip').forEach(el => {
      el.addEventListener('touchend', function (e) {
        // Only prevent default if it's a regular tap (not a scroll)
        e.preventDefault();
        this.click();
      }, { passive: false });
    });
  }


  /* ══════════════════════════════════════
     18. ORIENTATION CHANGE HANDLER
     Reset scroll/layout on rotate
  ══════════════════════════════════════ */
  window.addEventListener('orientationchange', () => {
    // Brief delay to allow browser to resize
    setTimeout(() => {
      // Re-close overlays that might look broken after rotate
      if (searchOverlay && searchOverlay.classList.contains('open')) closeSearch();
    }, 300);
  });


  /* ══════════════════════════════════════
     19. FONT AWESOME LOAD FALLBACK
     If icon fonts fail, ensure visibility
  ══════════════════════════════════════ */
  window.addEventListener('load', () => {
    const testIcon = document.querySelector('.fas');
    if (!testIcon) return;
    const computed = window.getComputedStyle(testIcon, '::before').content;
    if (!computed || computed === 'none' || computed === '""') {
      // FA didn't load – fallback visibility
      document.querySelectorAll('.icon-btn, .hamburger').forEach(el => {
        el.style.minWidth = '44px';
        el.style.minHeight = '44px';
      });
    }
  });

  /* ══════════════════════════════════════
     20. PRODUCT FILTER FORM (In-place filtering)
  ══════════════════════════════════════ */
  const filterForm = document.getElementById('product-filter-form');
  const filterSubmitBtn = document.getElementById('filter-submit-btn');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');

  if (filterForm && filterSubmitBtn) {
    // Handle Enter key on filter inputs
    const filterInputs = filterForm.querySelectorAll('input, select');
    filterInputs.forEach(input => {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          filterSubmitBtn.click();
        }
      });
    });

    filterSubmitBtn.addEventListener('click', function(e) {
      e.preventDefault();

      const searchInput = filterForm.querySelector('input[name="search"]');
      const categorySelect = filterForm.querySelector('select[name="category"]');
      const maxPriceInput = filterForm.querySelector('input[name="maxPrice"]');
      const sortBySelect = filterForm.querySelector('select[name="sortBy"]');

      const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
      const category = categorySelect ? categorySelect.value : 'all';
      const maxPrice = maxPriceInput ? parseFloat(maxPriceInput.value) : null;
      const sortBy = sortBySelect ? sortBySelect.value : 'default';

      // Sync with top search bar
      const topSearchInput = document.getElementById('searchInput');
      const topCategorySelect = document.getElementById('search-cat');

      if (topSearchInput) topSearchInput.value = searchInput ? searchInput.value : '';
      if (topCategorySelect && category !== 'all') topCategorySelect.value = category;

      const cards = document.querySelectorAll('.product-card');
      let found = false;

      cards.forEach(card => {
        const productName = card.querySelector('.product-title') || card.querySelector('h4') || card;
        const productCategory = card.getAttribute('data-category') || '';
        const priceElement = card.querySelector('.current-price');

        const nameText = productName.innerText.toLowerCase();
        const matchesSearch = !searchTerm || nameText.includes(searchTerm);
        const matchesCategory = category === 'all' || productCategory.includes(category);

        let matchesPrice = true;
        if (maxPrice && priceElement) {
          const productPrice = parseFloat(priceElement.innerText.replace(/[^0-9.]/g, ''));
          matchesPrice = !isNaN(productPrice) && productPrice <= maxPrice;
        }

        const show = matchesSearch && matchesCategory && matchesPrice;
        card.classList.toggle('hidden', !show);
        if (show) found = true;
      });

      // Sort products if needed
      if (sortBy !== 'default' && found) {
        const productContainer = document.querySelector('.product-grid') || document.querySelector('#product .container');
        if (productContainer) {
          const productsArray = Array.from(cards);
          productsArray.sort((a, b) => {
            const aPriceEl = a.querySelector('.current-price');
            const bPriceEl = b.querySelector('.current-price');
            const aPrice = parseFloat((aPriceEl ? aPriceEl.innerText : '0').replace(/[^0-9.]/g, '')) || 0;
            const bPrice = parseFloat((bPriceEl ? bPriceEl.innerText : '0').replace(/[^0-9.]/g, '')) || 0;
            const aName = (a.querySelector('.product-title') || a).innerText.toLowerCase();
            const bName = (b.querySelector('.product-title') || b).innerText.toLowerCase();

            switch(sortBy) {
              case 'price-low': return aPrice - bPrice;
              case 'price-high': return bPrice - aPrice;
              case 'name-asc': return aName.localeCompare(bName);
              case 'name-desc': return bName.localeCompare(aName);
              default: return 0;
            }
          });

          productsArray.forEach(product => {
            if (!product.classList.contains('hidden')) {
              productContainer.appendChild(product);
            }
          });
        }
      }

      if (!found) {
        cards.forEach(c => c.classList.remove('hidden'));
        toast('No products found — showing all.', 'error');
      } else {
        const visibleCount = document.querySelectorAll('.product-card:not(.hidden)').length;
        toast(`Found ${visibleCount} product${visibleCount !== 1 ? 's' : ''}`, 'success');
        
        // Scroll to the product grid smoothly
        const productGrid = document.getElementById('product-grid') || document.querySelector('.product-grid');
        if (productGrid) {
          productGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }

  // Clear filters button handler
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Clear all filter inputs
      const searchInput = filterForm?.querySelector('input[name="search"]');
      const categorySelect = filterForm?.querySelector('select[name="category"]');
      const maxPriceInput = filterForm?.querySelector('input[name="maxPrice"]');
      const sortBySelect = filterForm?.querySelector('select[name="sortBy"]');
      
      if (searchInput) searchInput.value = '';
      if (categorySelect) categorySelect.value = 'all';
      if (maxPriceInput) maxPriceInput.value = '';
      if (sortBySelect) sortBySelect.value = 'default';
      
      // Clear top search bar too
      const topSearchInput = document.getElementById('searchInput');
      const topCategorySelect = document.getElementById('search-cat');
      
      if (topSearchInput) topSearchInput.value = '';
      if (topCategorySelect) topCategorySelect.value = '';
      
      // Show all products
      document.querySelectorAll('.product-card').forEach(c => c.classList.remove('hidden'));
      
      // Scroll to product grid smoothly
      const productGrid = document.getElementById('product-grid') || document.querySelector('.product-grid');
      if (productGrid) {
        productGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
      toast('All filters cleared', 'info');
    });
  }

});

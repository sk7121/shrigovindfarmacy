/* ========================================
   SHRI GOVIND PHARMACY — categories.js
   Category Page Specific JS
   ======================================== */

document.addEventListener('DOMContentLoaded', function () {

  /* ══════════════════════════════════════
     1. HERO PARTICLES
  ══════════════════════════════════════ */
  const particlesContainer = document.getElementById('hero-particles');
  if (particlesContainer) {
    const count = window.innerWidth < 768 ? 8 : 18;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = Math.random() * 60 + 10;
      p.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${Math.random() * 100}%;
        animation-duration: ${Math.random() * 20 + 15}s;
        animation-delay: ${Math.random() * -20}s;
      `;
      particlesContainer.appendChild(p);
    }
  }


  /* ══════════════════════════════════════
     2. STICKY NAV — ACTIVE SECTION TRACKING
  ══════════════════════════════════════ */
  const catSections = document.querySelectorAll('.cat-section');
  const csnLinks    = document.querySelectorAll('.csn-link');

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        csnLinks.forEach(link => {
          link.classList.toggle('active', link.dataset.target === id);
        });
      }
    });
  }, { threshold: 0.3, rootMargin: '-100px 0px -40% 0px' });

  catSections.forEach(section => sectionObserver.observe(section));

  // Smooth scroll for sticky nav links
  csnLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const targetId = this.dataset.target;
      const target = document.getElementById(targetId);
      if (target) {
        const offset = 140; // header + sticky nav height
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });


  /* ══════════════════════════════════════
     3. CATEGORY TAG FILTERS
  ══════════════════════════════════════ */
  document.querySelectorAll('.ctag').forEach(tag => {
    tag.addEventListener('click', function () {
      const cat     = this.dataset.cat;
      const tagVal  = this.dataset.tag;
      const grid    = document.querySelector(`#grid-${cat}`);
      if (!grid) return;

      // Update active tab
      document.querySelectorAll(`.ctag[data-cat="${cat}"]`).forEach(t => t.classList.remove('active'));
      this.classList.add('active');

      // Filter cards
      const cards = grid.querySelectorAll('.product-card');
      let visibleCount = 0;

      cards.forEach(card => {
        // Get product tags from data attributes or data-tag
        const productTag = card.dataset.tag || 'all';
        const match = tagVal === 'all' || productTag === tagVal;
        if (match) {
          card.classList.remove('hidden');
          card.style.animation = 'catFadeIn 0.35s ease forwards';
          visibleCount++;
        } else {
          card.classList.add('hidden');
        }
      });

      // Remove old no-results
      const existing = grid.querySelector('.no-results');
      if (existing) existing.remove();

      if (visibleCount === 0) {
        const noRes = document.createElement('div');
        noRes.className = 'no-results';
        noRes.innerHTML = `
          <i class="fas fa-search"></i>
          <h3>No products found</h3>
          <p>Try selecting a different filter or browse all products.</p>
        `;
        grid.appendChild(noRes);
      }
    });
  });


  /* ══════════════════════════════════════
     4. GLOBAL SEARCH (sticky nav input)
  ══════════════════════════════════════ */
  const catSearchInput = document.getElementById('cat-search-input');

  if (catSearchInput) {
    let searchTimeout;
    catSearchInput.addEventListener('input', function () {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const query = this.value.trim().toLowerCase();

        if (!query) {
          // Reset all cards
          document.querySelectorAll('.product-card').forEach(c => {
            c.classList.remove('hidden');
            c.style.animation = '';
          });
          document.querySelectorAll('.no-results').forEach(el => el.remove());
          return;
        }

        // Search across all grids
        catSections.forEach(section => {
          const grid  = section.querySelector('.cat-product-grid');
          const cards = section.querySelectorAll('.product-card');
          let found   = 0;

          cards.forEach(card => {
            const text = card.innerText.toLowerCase();
            if (text.includes(query)) {
              card.classList.remove('hidden');
              card.style.animation = 'catFadeIn 0.3s ease forwards';
              found++;
            } else {
              card.classList.add('hidden');
            }
          });

          // Handle no-results per section
          const existing = grid && grid.querySelector('.no-results');
          if (existing) existing.remove();

          if (found === 0 && grid) {
            const noRes = document.createElement('div');
            noRes.className = 'no-results';
            noRes.innerHTML = `
              <i class="fas fa-search"></i>
              <h3>No matches in this category</h3>
              <p>Try a different search term.</p>
            `;
            grid.appendChild(noRes);
          }
        });

        // Scroll to products area
        const firstSection = document.querySelector('.cat-section');
        if (firstSection) {
          const top = firstSection.getBoundingClientRect().top + window.scrollY - 150;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      }, 300);
    });

    // Clear on escape
    catSearchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        catSearchInput.value = '';
        catSearchInput.dispatchEvent(new Event('input'));
      }
    });
  }


  /* ══════════════════════════════════════
     5. CART FUNCTIONALITY (shared logic)
  ══════════════════════════════════════ */
  let cartCount   = 0;
  const cartBadge = document.getElementById('cart-count');
  
  // Fetch real cart count from server
  async function fetchCartCount() {
    try {
      const response = await fetch('/api/user/counts');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          cartCount = result.cartCount || 0;
          if (cartBadge) {
            cartBadge.textContent = cartCount;
            if (cartCount > 0) {
              cartBadge.style.display = 'inline-block';
            }
          }
        }
      }
    } catch (err) {
      console.log('Error fetching cart count:', err);
    }
  }
  
  // Fetch cart count on page load
  fetchCartCount();

  function updateCart(delta = 1) {
    cartCount += delta;
    if (cartCount < 0) cartCount = 0;
    localStorage.setItem('sgp-cart-count', cartCount);
    if (cartBadge) {
      cartBadge.textContent = cartCount;
      cartBadge.classList.add('pop');
      setTimeout(() => cartBadge.classList.remove('pop'), 300);
    }
  }

  // Track buttons being processed to prevent double-clicks
  const processingButtons = new Set();

  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', async function (e) {
      e.stopPropagation();
      
      // Prevent double-click on same button
      if (processingButtons.has(this)) {
        return;
      }
      
      const productId = this.dataset.productId;
      const name = this.dataset.name || 'Product';

      // If productId exists, add to server cart
      if (productId && productId !== 'undefined') {
        // Mark button as processing
        processingButtons.add(this);
        
        // Disable button visually
        const originalText = this.innerHTML;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        this.disabled = true;
        
        try {
          const response = await fetch('/user/add-to-cart/' + productId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: 1 })
          });

          if (response.ok) {
            const result = await response.json();
            cartCount = result.cartCount || 0;
            if (cartBadge) {
              cartBadge.textContent = cartCount;
              cartBadge.classList.add('pop');
              setTimeout(() => cartBadge.classList.remove('pop'), 300);
            }
            toast(`✅ ${name} added to cart!`, 'success', 'Go to Cart', '/user/cart');
          }
        } catch (err) {
          console.log('Error adding to cart:', err);
          toast('Error adding to cart. Please try again.', 'error');
        } finally {
          // Re-enable button
          processingButtons.delete(this);
          this.innerHTML = '<i class="fas fa-cart-plus"></i> Add to Cart';
          this.disabled = false;
        }
      } else {
        // Fallback to local storage
        updateCart(1);
        toast(`✅ ${name} added to cart!`, 'success', 'Go to Cart', '/user/cart');
      }
    });
  });


  /* ══════════════════════════════════════
     6. WISHLIST
  ══════════════════════════════════════ */
  let wishCount   = 0;
  const wishBadge = document.getElementById('wish-count');

  // Fetch real wishlist count from server
  async function fetchWishlistCount() {
    try {
      const response = await fetch('/api/user/counts');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          wishCount = result.wishlistCount || 0;
          if (wishBadge) {
            wishBadge.textContent = wishCount;
            if (wishCount > 0) {
              wishBadge.style.display = 'inline-block';
            }
          }
        }
      }
    } catch (err) {
      console.log('Error fetching wishlist count:', err);
    }
  }

  // Fetch wishlist count on page load
  fetchWishlistCount();

  // Check wishlist status for all products on page load
  async function checkWishlistStatus() {
    const productCards = document.querySelectorAll('.product-card');
    for (const card of productCards) {
      const productId = card.dataset.productId;
      if (!productId) continue;

      try {
        const response = await fetch('/wishlist/check/' + productId);
        if (response.ok) {
          const result = await response.json();
          const wishBtn = card.querySelector('.wish-it');
          if (wishBtn && result.inWishlist) {
            wishBtn.style.color = '#e91e63';
          }
        }
      } catch (err) {
        // Ignore errors for individual checks
      }
    }
  }

  // Check wishlist status after fetching count
  setTimeout(checkWishlistStatus, 500);

  document.querySelectorAll('.wish-it').forEach(btn => {
    btn.addEventListener('click', async function (e) {
      e.stopPropagation();
      e.preventDefault();

      const productCard = this.closest('.product-card');
      const productId = productCard ? productCard.dataset.productId : null;

      console.log('Wishlist button clicked');
      console.log('Product ID:', productId);
      console.log('Product card found:', !!productCard);

      // Toggle wishlist status
      if (productId && productId !== 'undefined') {
        try {
          // Check current status first
          const checkResponse = await fetch('/wishlist/check/' + productId);
          let isInWishlist = false;
          
          if (checkResponse.ok) {
            const checkResult = await checkResponse.json();
            isInWishlist = checkResult.inWishlist;
          }

          // Toggle: remove if in wishlist, add if not
          const url = isInWishlist 
            ? '/wishlist/remove/' + productId 
            : '/wishlist/add/' + productId;
            
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });

          if (response.ok) {
            const result = await response.json();
            wishCount = result.wishlistCount || 0;
            if (wishBadge) {
              wishBadge.textContent = wishCount;
              wishBadge.classList.add('pop');
              setTimeout(() => wishBadge.classList.remove('pop'), 300);
            }
            
            // Toggle button color
            if (isInWishlist) {
              this.style.color = '';
              toast('❤️ Removed from Wishlist', 'success');
            } else {
              this.style.color = '#e91e63';
              toast('❤️ Added to Wishlist!', 'success');
            }
          } else {
            const error = await response.text();
            console.log('Error response:', error);
            if (response.status === 401 || response.status === 302) {
              toast('Please login to add items to wishlist', 'error');
              setTimeout(() => {
                window.location.href = '/login';
              }, 1000);
            } else {
              toast(error || 'Error updating wishlist', 'error');
            }
          }
        } catch (err) {
          console.log('Error updating wishlist:', err);
          toast('Error updating wishlist', 'error');
        }
      } else {
        console.log('No product ID found');
        // Fallback to local storage
        const currentColor = this.style.color;
        if (currentColor === 'rgb(233, 30, 99)' || currentColor === '#e91e63') {
          // Remove from local wishlist
          wishCount--;
          this.style.color = '';
          toast('❤️ Removed from Wishlist', 'success');
        } else {
          // Add to local wishlist
          wishCount++;
          this.style.color = '#e91e63';
          toast('❤️ Added to Wishlist!', 'success');
        }
        if (wishCount < 0) wishCount = 0;
        localStorage.setItem('sgp-wish-count', wishCount);
        if (wishBadge) {
          wishBadge.textContent = wishCount;
          if (wishCount > 0) {
            wishBadge.style.display = 'inline-block';
          } else {
            wishBadge.style.display = 'none';
          }
        }
      }
    });
  });


  /* ══════════════════════════════════════
     7. QUICK VIEW MODAL
  ══════════════════════════════════════ */
  const modal         = document.getElementById('productModal');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalClose    = document.getElementById('modal-close');
  const modalAddBtn   = document.getElementById('modalAddBtn');

  function openModal(card) {
    if (!modal) return;
    const img    = card.querySelector('.product-image img')?.src   || '';
    const brand  = card.querySelector('.pd-brand')?.innerText      || '';
    const title  = card.querySelector('.product-title')?.innerText || '';
    const rating = card.querySelector('.pd-rating')?.innerHTML     || '';
    const price  = card.querySelector('.current-price')?.innerText || '';
    const mrp    = card.querySelector('.old-price')?.innerText     || '';
    const disc   = card.querySelector('.discount-pct')?.innerText  || '';
    const stock  = card.querySelector('.product-badge')?.innerText || 'In Stock';
    const name   = card.querySelector('.product-title')?.innerText || 'Product';
    const priceV = card.querySelector('.add-to-cart-btn')?.dataset.price || 0;

    document.getElementById('modalImg').src          = img;
    document.getElementById('modalBrand').textContent = brand;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalRating').innerHTML  = rating;
    document.getElementById('modalPrice').textContent = price;
    document.getElementById('modalMrp').textContent   = mrp;
    document.getElementById('modalDisc').textContent  = disc;
    document.getElementById('modalStock').textContent = stock;
    modalAddBtn.dataset.name  = name;
    modalAddBtn.dataset.price = priceV;

    modal.classList.add('open');
    modalBackdrop && modalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    modalBackdrop && modalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.quick-view').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const card = btn.closest('.product-card');
      if (card) openModal(card);
    });
  });

  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', function (e) {
      if (e.target.closest('.add-to-cart-btn') || e.target.closest('.overlay-btn')) return;
      openModal(this);
    });
  });

  if (modalClose)    modalClose.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  if (modalAddBtn) {
    modalAddBtn.addEventListener('click', function () {
      const name = this.dataset.name || 'Product';
      updateCart(1);
      toast(`✅ ${name} added to cart!`, 'success');
      closeModal();
    });
  }


  /* ══════════════════════════════════════
     8. LOAD MORE (simulated)
  ══════════════════════════════════════ */
  document.querySelectorAll('.load-more-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const cat = this.dataset.cat;

      // Show loading state
      this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading…';
      this.disabled = true;

      setTimeout(() => {
        this.innerHTML = 'All Products Loaded <i class="fas fa-check"></i>';
        this.disabled = true;
        this.style.opacity = '0.6';
        toast(`All ${cat} products loaded!`, 'success');
      }, 1200);
    });
  });


  /* ══════════════════════════════════════
     9. SCROLL REVEAL ANIMATIONS
  ══════════════════════════════════════ */
  const revealEls = document.querySelectorAll(
    '.cat-section-head, .cat-tags, .product-card, .cat-cta-banner'
  );

  const revObs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.style.opacity   = '1';
          entry.target.style.transform = 'translateY(0)';
        }, (i % 5) * 70);
        revObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  revealEls.forEach(el => {
    if (!el.classList.contains('cat-section-head') && !el.classList.contains('cat-tags')) {
      el.style.opacity   = '0';
      el.style.transform = 'translateY(22px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    }
    revObs.observe(el);
  });


  /* ══════════════════════════════════════
     10. INJECT CATEGORY-SPECIFIC ANIMATIONS
  ══════════════════════════════════════ */
  const style = document.createElement('style');
  style.textContent = `
    @keyframes catFadeIn {
      from { opacity: 0; transform: scale(0.96) translateY(8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .badge.pop {
      animation: badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes badgePop {
      0%  { transform: scale(1); }
      50% { transform: scale(1.5); }
      100%{ transform: scale(1); }
    }
  `;
  document.head.appendChild(style);


  /* ══════════════════════════════════════
     11. TOAST SYSTEM (local, synced with main)
  ══════════════════════════════════════ */
  function toast(msg, type = 'success', actionText = null, actionUrl = null) {
    const zone = document.getElementById('toastZone');
    if (!zone) return;
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    
    let actionHTML = '';
    if (actionText && actionUrl) {
      actionHTML = `<a href="${actionUrl}" class="toast-action">${actionText}</a>`;
    }
    
    t.innerHTML = `<div class="t-dot"></div>${msg}${actionHTML}`;
    zone.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      t.style.opacity    = '0';
      t.style.transform  = 'translateY(10px)';
      setTimeout(() => t.remove(), 400);
    }, 3200);
  }

  // Make toast globally available
  window.toast = toast;


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
     14. HAMBURGER + MOBILE MENU
  ══════════════════════════════════════ */
  const hamburger     = document.getElementById('hamburger');
  const mobileMenu    = document.getElementById('mobile-menu');
  const mobileOverlay = document.getElementById('mobile-overlay');
  const mobileClose   = document.getElementById('mobile-close');

  function openMobileMenu() {
    mobileMenu && mobileMenu.classList.add('open');
    mobileOverlay && mobileOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (hamburger) {
      const spans = hamburger.querySelectorAll('span');
      spans[0].style.transform = 'translateY(7px) rotate(45deg)';
      spans[1].style.opacity   = '0';
      spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
    }
  }

  function closeMobileMenu() {
    mobileMenu && mobileMenu.classList.remove('open');
    mobileOverlay && mobileOverlay.classList.remove('open');
    document.body.style.overflow = '';
    if (hamburger) {
      hamburger.querySelectorAll('span').forEach(s => {
        s.style.transform = ''; s.style.opacity = '';
      });
    }
  }

  hamburger     && hamburger.addEventListener('click', openMobileMenu);
  mobileClose   && mobileClose.addEventListener('click', closeMobileMenu);
  mobileOverlay && mobileOverlay.addEventListener('click', closeMobileMenu);

  // Mobile submenu toggle
  document.querySelectorAll('.mob-sub-trigger').forEach(trigger => {
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      const sub   = this.closest('li').querySelector('.mob-submenu');
      const arrow = this.querySelector('.mob-arrow');
      sub   && sub.classList.toggle('open');
      arrow && arrow.classList.toggle('rotated');
    });
  });

  // Search overlay
  const searchTrigger = document.getElementById('search-trigger');
  const searchOverlay = document.getElementById('search-overlay');
  const searchClose   = document.getElementById('search-close');

  searchTrigger && searchTrigger.addEventListener('click', () => {
    searchOverlay && searchOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  });
  searchClose && searchClose.addEventListener('click', () => {
    searchOverlay && searchOverlay.classList.remove('open');
    document.body.style.overflow = '';
  });

  // Announce bar close
  const announceClose = document.getElementById('announce-close');
  const announceBar   = document.getElementById('announce-bar');
  const announceSlides = document.querySelectorAll('.announce-slide');
  let aIdx = 0;

  if (announceSlides.length > 1) {
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
        announceBar.style.transition = 'max-height 0.4s ease, opacity 0.3s ease';
        announceBar.style.maxHeight  = '0';
        announceBar.style.opacity    = '0';
        announceBar.style.overflow   = 'hidden';
        announceBar.style.padding    = '0';
      });
    });
  }

  // Sticky header shadow
  const mainHeader = document.getElementById('main-header');
  window.addEventListener('scroll', () => {
    mainHeader && mainHeader.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });

});






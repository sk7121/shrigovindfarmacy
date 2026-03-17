/* ================================================
   SHRI GOVIND PHARMACY — contact.js
   Scroll reveal, form validation, FAQ accordion,
   newsletter, toast
   ================================================ */

'use strict';

/* ── HELPERS ── */
const $    = (s, ctx = document) => ctx.querySelector(s);
const $$   = (s, ctx = document) => [...ctx.querySelectorAll(s)];
const wait = (ms) => new Promise(r => setTimeout(r, ms));

/* ================================================
   2.  TOPBAR — rotating ticker + close
   ================================================ */
(function () {
  const slides   = $$('.tick-slide');
  const closeBtn = $('#topbarClose');
  const topbar   = $('#topbarWrap');
  let current = 0;
  let timer;

  if (slides.length > 1) {
    timer = setInterval(() => {
      slides[current].classList.remove('tick-active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('tick-active');
    }, 3200);
  }

  if (closeBtn && topbar) {
    closeBtn.addEventListener('click', () => {
      clearInterval(timer);
      topbar.style.transition = 'max-height 0.4s ease, opacity 0.35s ease, padding 0.4s ease';
      topbar.style.maxHeight  = topbar.offsetHeight + 'px';
      requestAnimationFrame(() => {
        topbar.style.maxHeight = '0';
        topbar.style.opacity   = '0';
        topbar.style.overflow  = 'hidden';
        topbar.style.padding   = '0';
        topbar.style.minHeight = '0';
      });
    });
  }
})();

/* ================================================
   3.  HEADER SHADOW ON SCROLL
   ================================================ */
(function () {
  const hdr = $('#mainHeader');
  if (!hdr) return;
  window.addEventListener('scroll', () => {
    hdr.style.boxShadow = window.scrollY > 10
      ? '0 4px 22px rgba(0,0,0,0.14)'
      : '';
  }, { passive: true });
})();

/* ================================================
   4.  SCROLL REVEAL
   ================================================ */
(function () {
  const els = $$('.reveal');
  if (!els.length) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      // Stagger siblings in the same parent
      const parent   = entry.target.parentElement;
      const siblings = $$('.reveal:not(.in)', parent);
      const delay    = siblings.indexOf(entry.target) * 80;

      setTimeout(() => entry.target.classList.add('in'), delay);
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -36px 0px' });

  els.forEach(el => obs.observe(el));
})();

/* ================================================
   5.  FORM VALIDATION & SUBMISSION
   ================================================ */
(function () {
  const form = $('#contactForm');
  const btn  = $('#submitBtn');
  if (!form || !btn) return;

  const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const isPhone = v => /^[6-9]\d{9}$/.test(v.replace(/\D/g, ''));

  // Mark field valid / invalid
  function mark(fieldId, errId, hasErr) {
    const inp = $(`#${fieldId}`);
    const err = $(`#${errId}`);
    inp && inp.classList.toggle('err', hasErr);
    err && err.classList.toggle('show', hasErr);
    return hasErr;
  }

  // Clear error as user types
  $$('input, select, textarea', form).forEach(el => {
    el.addEventListener('input', () => {
      el.classList.remove('err');
      const e = $(`#err-${el.id}`);
      if (e) e.classList.remove('show');
    });
  });

  // Phone — digits only
  const ph = $('#fPhone');
  if (ph) {
    ph.addEventListener('input', () => {
      ph.value = ph.value.replace(/\D/g, '').slice(0, 10);
    });
  }

  // Ripple effect on submit click
  btn.addEventListener('click', function (e) {
    const r    = document.createElement('span');
    r.className = 'ripple';
    const rect = this.getBoundingClientRect();
    const sz   = Math.max(rect.width, rect.height);
    r.style.cssText = `width:${sz}px;height:${sz}px;left:${e.clientX - rect.left - sz / 2}px;top:${e.clientY - rect.top - sz / 2}px`;
    this.appendChild(r);
    setTimeout(() => r.remove(), 700);
  });

  // Submit handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name    = $('#fName').value.trim();
    const phone   = $('#fPhone').value.trim();
    const email   = $('#fEmail').value.trim();
    const subject = $('#fSubject').value;
    const msg     = $('#fMsg').value.trim();
    const agreed  = $('#fAgree').checked;

    let ok = true;

    if (!name)           ok = !mark('fName',    'err-fName',    true);
    else                       mark('fName',    'err-fName',    false);
    if (!isPhone(phone)) ok = !mark('fPhone',   'err-fPhone',   true);
    else                       mark('fPhone',   'err-fPhone',   false);
    if (!isEmail(email)) ok = !mark('fEmail',   'err-fEmail',   true);
    else                       mark('fEmail',   'err-fEmail',   false);
    if (!subject)        ok = !mark('fSubject', 'err-fSubject', true);
    else                       mark('fSubject', 'err-fSubject', false);
    if (!msg)            ok = !mark('fMsg',     'err-fMsg',     true);
    else                       mark('fMsg',     'err-fMsg',     false);

    if (!agreed) {
      toast('Please agree to the Privacy Policy.', 'error');
      ok = false;
    }
    if (!ok) return;

    // Simulate sending
    btn.classList.add('loading');
    btn.disabled = true;
    await wait(2200);
    btn.classList.remove('loading');
    btn.disabled = false;

    form.reset();
    const ctr = $('#charCtr');
    if (ctr) ctr.textContent = '0 / 500';

    toast("Message sent! We'll reply within 2 hours. 🙏", 'success');
  });
})();

/* ================================================
   6.  TEXTAREA CHARACTER COUNTER
   ================================================ */
(function () {
  const ta  = $('#fMsg');
  const ctr = $('#charCtr');
  if (!ta || !ctr) return;
  const MAX = 500;
  ta.addEventListener('input', () => {
    if (ta.value.length > MAX) ta.value = ta.value.slice(0, MAX);
    const n = ta.value.length;
    ctr.textContent = `${n} / ${MAX}`;
    ctr.classList.toggle('over', n >= MAX - 40);
  });
})();

/* ================================================
   7.  FAQ ACCORDION
   ================================================ */
(function () {
  $$('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      const ans  = btn.nextElementSibling;

      // Close all others
      $$('.faq-q[aria-expanded="true"]').forEach(other => {
        if (other !== btn) {
          other.setAttribute('aria-expanded', 'false');
          const otherAns = other.nextElementSibling;
          if (otherAns) otherAns.classList.remove('open');
        }
      });

      btn.setAttribute('aria-expanded', String(!open));
      if (ans) ans.classList.toggle('open', !open);
    });
  });
})();

/* ================================================
   8.  NEWSLETTER
   ================================================ */
(function () {
  const inp = $('#nlEmail');
  const btn = $('#nlBtn');
  if (!inp || !btn) return;

  const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  async function submit() {
    if (!isEmail(inp.value)) {
      inp.style.outline = '2px solid #ff6b6b';
      inp.focus();
      setTimeout(() => { inp.style.outline = ''; }, 1800);
      toast('Please enter a valid email address.', 'error');
      return;
    }
    btn.classList.add('loading');
    btn.disabled = true;
    await wait(1700);
    btn.classList.remove('loading');
    btn.disabled = false;
    inp.value = '';
    toast('Subscribed! Welcome to the Shri Govind family. ✅', 'success');
  }

  btn.addEventListener('click', submit);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  });
})();

/* ================================================
   9.  BACK TO TOP
   ================================================ */
(function () {
  const btn = $('#bttBtn');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 320);
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

/* ================================================
   10. SMOOTH ANCHOR LINKS
   ================================================ */
$$('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (!href || href === '#') return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    const hdr    = $('#mainHeader');
    const offset = hdr ? hdr.offsetHeight + 8 : 80;
    window.scrollTo({
      top: target.getBoundingClientRect().top + window.scrollY - offset,
      behavior: 'smooth'
    });
  });
});

/* ================================================
   11. TOAST HELPER
   ================================================ */
function toast(msg, type = 'success') {
  const zone = $('#toastZone');
  if (!zone) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="tdot"></span><span>${msg}</span>`;
  zone.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s ease, transform .3s ease';
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(8px)';
    setTimeout(() => el.remove(), 320);
  }, 4000);
}

// Expose globally
window.sgpToast = toast;

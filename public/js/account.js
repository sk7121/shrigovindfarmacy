/* ========================================
   SHRI GOVIND PHARMACY — Auth Page JS
   Handles: tabs, validation,
   password strength, ripple, toasts
   ======================================== */

/* ── UTILITY: ASYNC WAIT ── */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

document.addEventListener("DOMContentLoaded", function () {

  /* ── TAB SWITCHING ── */
  const tabs = document.querySelectorAll('.auth-tab');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      showPanel(tab.dataset.tab);
      const bcEl = document.getElementById('bc-current');
      if (bcEl) {
        bcEl.textContent = tab.dataset.tab === 'login' ? 'Sign In' : 'Create Account';
      }
    });
  });

  function showPanel(name) {
    document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
    const el = document.getElementById('panel-' + name);
    if (el) el.classList.add('active');
  }

  /* ── FORGOT PASSWORD / BACK TO LOGIN ── */
  const goForgotBtn = document.getElementById('go-forgot');
  if (goForgotBtn) {
    goForgotBtn.addEventListener('click', e => {
      e.preventDefault();
      tabs.forEach(t => t.classList.remove('active'));
      showPanel('forgot');
      const bcEl = document.getElementById('bc-current');
      if (bcEl) bcEl.textContent = 'Reset Password';
    });
  }

  const backLoginBtn = document.getElementById('back-login');
  if (backLoginBtn) {
    backLoginBtn.addEventListener('click', () => {
      if (tabs[0]) tabs[0].classList.add('active');
      showPanel('login');
      const bcEl = document.getElementById('bc-current');
      if (bcEl) bcEl.textContent = 'Sign In';
    });
  }

  /* ── FORGOT PASSWORD: SHOW STEP 1 ── */
  window.showForgotStep1 = function() {
    document.getElementById('forgot-step1').style.display = 'block';
    document.getElementById('forgot-step2').style.display = 'none';
    document.getElementById('f-otp').value = '';
    document.getElementById('f-password').value = '';
    document.getElementById('f-cpassword').value = '';
  }

  /* ── MOBILE MENU TOGGLE ── */
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      mobileMenu.classList.toggle('active');
    });
  }

/* ── TOGGLE PASSWORD VISIBILITY ── */
document.querySelectorAll('.toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const inp = document.getElementById(btn.dataset.t);
    const isHidden = inp.type === 'password';
    inp.type = isHidden ? 'text' : 'password';
    btn.innerHTML = isHidden
      ? '<i class="fa-regular fa-eye-slash"></i>'
      : '<i class="fa-regular fa-eye"></i>';
  });
});

/* ── PASSWORD STRENGTH METER ── */
const pwInp = document.getElementById('s-password');
const segs = [1, 2, 3, 4].map(i => document.getElementById('sg' + i));
const stLbl = document.getElementById('s-strength-lbl');
const SC = ['#e53e3e', '#ed8936', '#ecc94b', '#1c8125'];
const SL = ['Very Weak', 'Fair', 'Good', 'Strong 💪'];

pwInp.addEventListener('input', () => {
  const v = pwInp.value;
  let score = 0;
  if (v.length >= 8) score++;
  if (/[A-Z]/.test(v)) score++;
  if (/[0-9]/.test(v)) score++;
  if (/[^A-Za-z0-9]/.test(v)) score++;

  segs.forEach((seg, i) => {
    seg.style.background = i < score ? SC[score - 1] : 'var(--border-color)';
  });

  stLbl.textContent = v.length ? (SL[score - 1] || 'Very Weak') : 'Enter a password';
  stLbl.style.color = v.length ? SC[score - 1] : 'var(--text-muted)';
});

/* ── RIPPLE EFFECT ON SUBMIT BUTTONS ── */
document.querySelectorAll('.btn-submit').forEach(btn => {
  btn.addEventListener('click', function (e) {
    const r = document.createElement('div');
    r.className = 'ripple';
    const rect = btn.getBoundingClientRect();
    const sz = Math.max(rect.width, rect.height);
    r.style.cssText = `width:${sz}px;height:${sz}px;left:${e.clientX - rect.left - sz / 2}px;top:${e.clientY - rect.top - sz / 2}px`;
    btn.appendChild(r);
    setTimeout(() => r.remove(), 600);
  });
});

/* ── TOAST NOTIFICATIONS ── */
function toast(msg, type = 'success') {
  const zone = document.getElementById('toastZone');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle';
  t.innerHTML = `<i class="fas ${icon}"></i><span>${msg}</span>`;
  zone.appendChild(t);
  
  // Animate in
  setTimeout(() => t.classList.add('show'), 10);
  
  // Remove after delay
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

/* ── VALIDATORS ── */
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isPhone = v => /^[6-9]\d{9}$/.test(v);
const isContact = v => isEmail(v) || isPhone(v);

function markField(inpId, errId, hasErr) {
  const inp = document.getElementById(inpId);
  const err = document.getElementById(errId);
  if (inp) inp.classList.toggle('error', hasErr);
  if (err) err.classList.toggle('show', hasErr);
  return hasErr;
}

/* ── POPULATE REDIRECT URL FROM QUERY PARAM ── */
const urlParams = new URLSearchParams(window.location.search);
const redirectUrl = urlParams.get('redirect');
const redirectInput = document.getElementById('redirect-url');
if (redirectInput && redirectUrl) {
  redirectInput.value = redirectUrl;
}

/* ── LOGIN FORM SUBMISSION ── */
document.getElementById('form-login').addEventListener('submit', async e => {
  e.preventDefault();

  const email = document.getElementById('l-email').value.trim();
  const pass = document.getElementById('l-password').value;
  let ok = true;

  if (!isContact(email)) { ok = false; markField('l-email', 'e-l-email', true); }
  else markField('l-email', 'e-l-email', false);

  if (!pass) { ok = false; markField('l-password', 'e-l-password', true); }
  else markField('l-password', 'e-l-password', false);

  if (!ok) return;

  const btn = e.target.querySelector('.btn-submit');
  btn.classList.add('loading');
  await wait(1800);
  btn.classList.remove('loading');
  toast('🙏 Welcome back! Redirecting to your dashboard…', 'success');
  e.target.submit();
});

/* ── SIGNUP FORM SUBMISSION ── */
document.getElementById('form-signup').addEventListener('submit', async e => {
  e.preventDefault();

  console.log('[Signup Form] Form submitted');

  const val = id => document.getElementById(id).value.trim();
  const pass = document.getElementById('s-password').value;
  const cpass = document.getElementById('s-cpassword').value;
  const agreed = document.getElementById('agree').checked;
  let ok = true;

  const checks = [
    [!val('s-fname'), 's-fname', 'e-s-fname'],
    [!val('s-lname'), 's-lname', 'e-s-lname'],
    [!isEmail(val('s-email')), 's-email', 'e-s-email'],
    [!isPhone(val('s-phone')), 's-phone', 'e-s-phone'],
    [pass.length < 8, 's-password', 'e-s-password'],
    [pass !== cpass, 's-cpassword', 'e-s-cpassword'],
  ];

  checks.forEach(([cond, inpId, errId]) => {
    markField(inpId, errId, cond);
    if (cond) ok = false;
  });

  if (!agreed) {
    toast('Please agree to the Terms & Privacy Policy.', 'error');
    ok = false;
  }

  if (!ok) {
    console.log('[Signup Form] Validation failed');
    return;
  }

  console.log('[Signup Form] Validation passed, submitting...');
  const btn = e.target.querySelector('.btn-submit');
  btn.classList.add('loading');
  await wait(2000);
  btn.classList.remove('loading');
  toast('🎉 OTP sent! Check your email to verify.', 'success');

  // Submit the form to the server
  e.target.submit();
});

/* ── FORGOT PASSWORD: SEND OTP ── */
const btnSendOtp = document.getElementById('btn-send-otp');
if (btnSendOtp) {
  btnSendOtp.addEventListener('click', async () => {
    const email = document.getElementById('f-contact').value.trim();

    if (!isContact(email)) {
      markField('f-contact', 'e-f-contact', true);
      return;
    }
    markField('f-contact', 'e-f-contact', false);

    btnSendOtp.classList.add('loading');
    
    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const result = await response.json();

      if (result.success) {
        btnSendOtp.classList.remove('loading');
        toast('✅ OTP sent successfully! Check your email.', 'success');
        // Show step 2
        document.getElementById('forgot-step1').style.display = 'none';
        document.getElementById('forgot-step2').style.display = 'block';
      } else {
        btnSendOtp.classList.remove('loading');
        toast(result.message || 'Failed to send OTP', 'error');
      }
    } catch (error) {
      btnSendOtp.classList.remove('loading');
      toast('Network error. Please try again.', 'error');
    }
  });
}

/* ── FORGOT PASSWORD: RESEND OTP ── */
const btnResendOtp = document.getElementById('btn-resend-otp');
if (btnResendOtp) {
  btnResendOtp.addEventListener('click', async () => {
    const email = document.getElementById('f-contact').value.trim();
    
    btnResendOtp.disabled = true;
    btnResendOtp.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
    
    try {
      const response = await fetch('/api/otp/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'password_reset' })
      });
      const result = await response.json();

      if (result.success) {
        toast('✅ OTP resent successfully! Check your email.', 'success');
      } else {
        toast(result.message || 'Failed to resend OTP', 'error');
      }
    } catch (error) {
      toast('Network error. Please try again.', 'error');
    }
    
    btnResendOtp.disabled = false;
    btnResendOtp.innerHTML = '<i class="fa-solid fa-redo"></i> Resend OTP';
  });
}

/* ── FORGOT PASSWORD: PASSWORD STRENGTH ── */
const fPwInp = document.getElementById('f-password');
const fSegs = [1, 2, 3, 4].map(i => document.getElementById('fg' + i));
const fStLbl = document.getElementById('f-strength-lbl');

if (fPwInp && fSegs[0]) {
  fPwInp.addEventListener('input', () => {
    const v = fPwInp.value;
    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;

    fSegs.forEach((seg, i) => {
      if (seg) seg.style.background = i < score ? SC[score - 1] : 'var(--border-color)';
    });

    fStLbl.textContent = v.length ? (SL[score - 1] || 'Very Weak') : 'Enter a password';
    fStLbl.style.color = v.length ? SC[score - 1] : 'var(--text-muted)';
  });
}

/* ── FORGOT PASSWORD: RESET PASSWORD ── */
const btnResetPassword = document.getElementById('btn-reset-password');
if (btnResetPassword) {
  btnResetPassword.addEventListener('click', async () => {
    const otp = document.getElementById('f-otp').value.trim();
    const email = document.getElementById('f-contact').value.trim();
    const password = document.getElementById('f-password').value;
    const confirmPassword = document.getElementById('f-cpassword').value;

    let ok = true;

    // Validate OTP
    if (!otp || otp.length !== 6) {
      markField('f-otp', 'e-f-otp', true);
      ok = false;
    } else {
      markField('f-otp', 'e-f-otp', false);
    }

    // Validate password
    if (!password || password.length < 8) {
      markField('f-password', 'e-f-password', true);
      ok = false;
    } else {
      markField('f-password', 'e-f-password', false);
    }

    // Validate confirm password
    if (!confirmPassword || password !== confirmPassword) {
      markField('f-cpassword', 'e-f-cpassword', true);
      ok = false;
    } else {
      markField('f-cpassword', 'e-f-cpassword', false);
    }

    if (!ok) return;

    btnResetPassword.classList.add('loading');

    try {
      // First verify OTP
      const verifyResponse = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email,
          otp: otp,
          purpose: 'password_reset'
        })
      });
      const verifyResult = await verifyResponse.json();

      if (!verifyResult.success) {
        btnResetPassword.classList.remove('loading');
        toast(verifyResult.message || 'Invalid OTP', 'error');
        return;
      }

      // Then reset password (OTP already verified)
      const resetResponse = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: password,
          confirm_password: confirmPassword
        })
      });
      const resetResult = await resetResponse.json();

      if (resetResult.success) {
        toast('✅ Password reset successful! Redirecting to login...', 'success');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        btnResetPassword.classList.remove('loading');
        toast(resetResult.message || 'Failed to reset password', 'error');
      }
    } catch (error) {
      btnResetPassword.classList.remove('loading');
      toast('Network error. Please try again.', 'error');
    }
  });
}

/* ── SOCIAL LOGIN (PLACEHOLDER) ── */
function socialClick() {
  toast('Social login coming soon! 🚀', 'success');
}

/* ── LIVE CLEAR FIELD ERRORS ON INPUT ── */
document.querySelectorAll('.field-input').forEach(inp => {
  inp.addEventListener('input', () => {
    inp.classList.remove('error');
    const errEl = document.getElementById('e-' + inp.id);
    if (errEl) errEl.classList.remove('show');
  });
});

});
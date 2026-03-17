// ==================== DOCTOR PAGE FUNCTIONALITY ====================

// Store doctor data globally
let doctor = doctorData || {};

// ==================== TOAST NOTIFICATIONS ====================
function toast(msg, type = 'success') {
  const zone = document.getElementById('toastZone');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `<div class="t-dot"></div>${msg}`;
  zone.appendChild(t);
  
  // Auto remove after 3.5 seconds
  setTimeout(() => {
    t.style.animation = 'toastPop 0.3s reverse';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ==================== MODAL FUNCTIONS ====================
function openBookingModal() {
  // If there's an active appointment, redirect to it
  if (activeAppointment) {
    toast('Redirecting to your appointment details...', 'success');
    setTimeout(() => {
      window.location.href = '/appointment/' + activeAppointment._id;
    }, 1000);
    return;
  }
  
  if (!isLoggedIn) {
    toast('Please login to book an appointment', 'error');
    setTimeout(() => {
      window.location.href = '/login';
    }, 1000);
    return;
  }
  document.getElementById('bookingModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeBookingModal() {
  document.getElementById('bookingModal').style.display = 'none';
  document.body.style.overflow = 'auto';
  document.getElementById('bookingForm').reset();
}

function openReviewModal() {
  if (!isLoggedIn) {
    toast('Please login to write a review', 'error');
    setTimeout(() => {
      window.location.href = '/login';
    }, 1000);
    return;
  }
  document.getElementById('reviewModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeReviewModal() {
  document.getElementById('reviewModal').style.display = 'none';
  document.body.style.overflow = 'auto';
  document.getElementById('reviewForm').reset();
}

// Close modals when clicking outside
window.onclick = function(event) {
  const bookingModal = document.getElementById('bookingModal');
  const reviewModal = document.getElementById('reviewModal');
  
  if (event.target === bookingModal) {
    closeBookingModal();
  }
  if (event.target === reviewModal) {
    closeReviewModal();
  }
}

// ==================== BOOKING FUNCTIONS ====================
async function submitBooking(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  
  const bookingData = {
    doctorId: doctor._id,
    appointmentType: formData.get('appointmentType'),
    appointmentDate: formData.get('appointmentDate'),
    appointmentTime: formData.get('appointmentTime'),
    reason: formData.get('reason'),
    symptoms: formData.get('symptoms') ? formData.get('symptoms').split(',').map(s => s.trim()) : [],
    medicalHistory: formData.get('medicalHistory'),
    currentMedications: formData.get('currentMedications')
  };
  
  try {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Booking...';
    submitBtn.disabled = true;
    
    const response = await fetch('/api/doctor/appointment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bookingData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      toast(result.message, 'success');
      closeBookingModal();

      // Redirect to appointment details page
      setTimeout(() => {
        window.location.href = '/appointment/' + result.appointment._id;
      }, 1500);
    } else {
      toast(result.message || 'Failed to book appointment', 'error');
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  } catch (error) {
    console.error('Booking error:', error);
    toast('An error occurred while booking. Please try again.', 'error');
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Book Appointment';
    submitBtn.disabled = false;
  }
}

// ==================== REVIEW FUNCTIONS ====================
async function submitReview(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  
  const rating = formData.get('rating');
  const comment = formData.get('comment');
  
  if (!rating) {
    toast('Please select a rating', 'error');
    return;
  }
  
  try {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
    submitBtn.disabled = true;
    
    const response = await fetch(`/api/doctor/${doctor._id}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rating, comment })
    });
    
    const result = await response.json();
    
    if (result.success) {
      toast(result.message, 'success');
      closeReviewModal();
      
      // Reload page to show updated rating
      setTimeout(() => {
        location.reload();
      }, 1500);
    } else {
      toast(result.message || 'Failed to submit review', 'error');
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Review';
      submitBtn.disabled = false;
    }
  } catch (error) {
    console.error('Review error:', error);
    toast('An error occurred while submitting. Please try again.', 'error');
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Review';
    submitBtn.disabled = false;
  }
}

// ==================== AVAILABILITY STATUS ====================
async function refreshAvailabilityStatus() {
  try {
    const response = await fetch('/api/doctor');
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        const updatedDoctor = result.doctor;
        
        // Update availability badge
        const badge = document.querySelector('.doc-badge-float span');
        if (badge) {
          badge.textContent = updatedDoctor.isAvailableNow ? 'Available Now' : 'Currently Unavailable';
        }
        
        // Update badge color
        const dot = document.querySelector('.doc-badge-float .dot');
        if (dot) {
          dot.style.background = updatedDoctor.isAvailableNow ? '#25D366' : '#ff6b6b';
        }
      }
    }
  } catch (error) {
    console.error('Error refreshing availability:', error);
  }
}

// ==================== QUICK WHATSAPP BUTTON ====================
function quickWhatsApp() {
  const phone = doctor.contact?.whatsapp || doctor.contact?.phone;
  const message = 'Hello Doctor, I need Ayurvedic consultation.';
  const url = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

// ==================== COPY PHONE NUMBER ====================
function copyPhoneNumber() {
  const phone = doctor.contact?.phone;
  if (phone) {
    navigator.clipboard.writeText(phone).then(() => {
      toast('Phone number copied to clipboard', 'success');
    }).catch(() => {
      toast('Failed to copy phone number', 'error');
    });
  }
}

// ==================== SHARE DOCTOR ====================
function shareDoctor() {
  if (navigator.share) {
    navigator.share({
      title: `Dr. ${doctor.name} - Ayurvedic Consultation`,
      text: `Consult Dr. ${doctor.name} at Shri Govind Pharmacy. ${doctor.title}`,
      url: window.location.href
    }).catch((error) => {
      console.log('Share cancelled:', error);
    });
  } else {
    // Fallback: copy URL
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast('Page link copied to clipboard', 'success');
    });
  }
}

// ==================== PRINT PRESCRIPTION ====================
function printPrescription() {
  window.print();
}

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', function(e) {
  // ESC to close modals
  if (e.key === 'Escape') {
    closeBookingModal();
    closeReviewModal();
  }
  
  // Ctrl/Cmd + B to book appointment
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    openBookingModal();
  }
});

// ==================== ANALYTICS TRACKING ====================
// Track page view
document.addEventListener('DOMContentLoaded', function() {
  // You can integrate Google Analytics or custom analytics here
  console.log('Doctor page loaded for:', doctor.name);
  
  // Track WhatsApp click
  const waButtons = document.querySelectorAll('a[href*="wa.me"]');
  waButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      console.log('WhatsApp button clicked');
      // Add analytics tracking here
    });
  });
});

// ==================== ERROR HANDLING ====================
window.onerror = function(msg, url, lineNo, columnNo, error) {
  console.error('Error: ', msg, '\nURL: ', url, '\nLine: ', lineNo);
  toast('Something went wrong. Please refresh the page.', 'error');
  return false;
};

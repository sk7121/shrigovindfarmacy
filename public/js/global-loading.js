/**
 * Global Loading Overlay - Works on ALL pages
 * Auto-shows when fetch takes >0.5s
 */

(function() {
  // Don't run if already loaded
  if (window.__loadingOverlayInitialized) return;
  window.__loadingOverlayInitialized = true;

  // Create loading overlay element
  const loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'global-loading-overlay';
  loadingOverlay.innerHTML = `
    <div class="global-loading-spinner">
      <i class="fas fa-circle-notch fa-spin"></i>
      <p>Loading...</p>
    </div>
  `;
  
  // Append to body when DOM is ready
  if (document.body) {
    document.body.appendChild(loadingOverlay);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(loadingOverlay);
    });
  }

  let loadingTimer = null;
  let isLoadingVisible = false;

  // Global function to show loading with delay
  window.showLoading = function(delay = 500) {
    if (isLoadingVisible) return;
    
    loadingTimer = setTimeout(() => {
      loadingOverlay.classList.add('visible');
      isLoadingVisible = true;
    }, delay);
  };

  // Global function to hide loading
  window.hideLoading = function() {
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
    
    if (isLoadingVisible) {
      loadingOverlay.classList.remove('visible');
      isLoadingVisible = false;
    }
  };

  // Intercept fetch to auto-show loading
  const originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = async function(...args) {
      showLoading(500);
      try {
        const response = await originalFetch.apply(this, args);
        return response;
      } finally {
        hideLoading();
      }
    };
  }
})();

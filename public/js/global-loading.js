/**
 * Global Loading Overlay - Works on ALL pages
 * Auto-shows when fetch takes >0.5s
 * Smart viewport-aware loading - only waits for visible elements
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

  // Smart viewport-aware loading check
  // Only waits for images in the current viewport to load
  function checkViewportImages() {
    return new Promise((resolve) => {
      // Get all images on the page
      const allImages = Array.from(document.images);
      
      if (allImages.length === 0) {
        resolve();
        return;
      }

      // Filter only images in or near viewport (with 2x viewport buffer)
      const viewportImages = allImages.filter(img => {
        const rect = img.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        
        // Check if image is within 2x viewport distance
        return rect.top >= -viewportHeight * 2 && 
               rect.top <= viewportHeight * 2 &&
               rect.left >= -viewportWidth && 
               rect.left <= viewportWidth * 2;
      });

      // If no images in viewport, resolve immediately
      if (viewportImages.length === 0) {
        resolve();
        return;
      }

      // Wait for viewport images to load
      let loadedCount = 0;
      const totalImages = viewportImages.length;

      viewportImages.forEach(img => {
        if (img.complete) {
          // Already loaded
          loadedCount++;
        } else {
          img.addEventListener('load', () => {
            loadedCount++;
            if (loadedCount >= totalImages) {
              resolve();
            }
          });
          img.addEventListener('error', () => {
            loadedCount++;
            if (loadedCount >= totalImages) {
              resolve();
            }
          });
        }
      });

      // If all already loaded
      if (loadedCount >= totalImages) {
        resolve();
      }

      // Timeout after 3 seconds max
      setTimeout(resolve, 3000);
    });
  }

  // Hide loading when DOM is ready and viewport images are loaded
  document.addEventListener('DOMContentLoaded', async () => {
    // Wait a bit for initial render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check viewport images
    await checkViewportImages();
    
    // Hide loading overlay
    hideLoading();
  });

  // Also hide on window load (fallback)
  window.addEventListener('load', () => {
    hideLoading();
  });

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

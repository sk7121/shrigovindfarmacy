/**
 * Theme Toggle Script - Shri Govind Pharmacy
 * Handles dark/light mode with localStorage persistence
 * Used across all pages for consistent theme experience
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'sgp-theme';
  const DEFAULT_THEME = 'light';

  // Initialize theme immediately (before DOMContentLoaded to prevent flash)
  function applyTheme() {
    const html = document.documentElement;
    const savedTheme = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
    html.setAttribute('data-theme', savedTheme);
    return savedTheme;
  }

  // Apply theme immediately
  const currentTheme = applyTheme();

  // Setup toggle button when DOM is ready
  function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const html = document.documentElement;

    // Update icon based on current theme
    if (themeIcon) {
      themeIcon.className = currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    // Add click event listener to toggle button
    if (themeToggle) {
      themeToggle.addEventListener('click', function() {
        const current = html.getAttribute('data-theme');
        const newTheme = current === 'light' ? 'dark' : 'light';

        // Apply new theme
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem(STORAGE_KEY, newTheme);

        // Update icon
        if (themeIcon) {
          themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }

        // Visual feedback
        themeToggle.style.transform = 'scale(0.85)';
        setTimeout(function() {
          themeToggle.style.transform = '';
        }, 200);
      });
    }
  }

  // Run setup when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupThemeToggle);
  } else {
    setupThemeToggle();
  }
})();

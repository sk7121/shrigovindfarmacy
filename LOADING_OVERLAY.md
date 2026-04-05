# Global Loading Overlay

## Overview
A global loading overlay that automatically appears when any fetch/AJAX request takes longer than **0.5 seconds**.

## Features
- ✅ **Auto-detection**: Intercepts all `fetch()` calls automatically
- ✅ **Smart delay**: Only shows if request takes >500ms (avoids flicker)
- ✅ **Manual control**: Can be triggered manually with `showLoading()` and `hideLoading()`
- ✅ **Responsive**: Works on all screen sizes (desktop, tablet, mobile)
- ✅ **Beautiful design**: Smooth blur backdrop with centered spinner

## How It Works

### Automatic Mode
The overlay automatically shows/hides for any `fetch()` request:

```javascript
// This will auto-show loading if it takes >0.5s
const response = await fetch('/api/some-endpoint');
const data = await response.json();
```

### Manual Mode
You can also control it manually:

```javascript
// Show immediately (0ms delay)
showLoading(0);

// Show with custom delay (e.g., 1 second)
showLoading(1000);

// Hide loading
hideLoading();
```

### Example Usage

```javascript
// Example 1: Long-running operation
async function submitForm() {
  showLoading(0); // Show immediately
  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    toast('Success!', 'success');
  } catch (error) {
    toast('Error occurred', 'error');
  } finally {
    hideLoading(); // Always hide in finally block
  }
}

// Example 2: Multiple sequential requests
async function loadData() {
  // Loading shows for first request
  const users = await fetch('/api/users').then(r => r.json());
  
  // Loading auto-hides after first request
  displayUsers(users);
  
  // Loading shows again for second request
  const products = await fetch('/api/products').then(r => r.json());
  displayProducts(products);
}
```

## CSS Customization

The loading overlay uses these CSS classes:
- `.global-loading-overlay` - Main overlay container
- `.global-loading-overlay.visible` - When overlay is visible
- `.global-loading-spinner` - Spinner box
- `.global-loading-spinner i` - Spinner icon
- `.global-loading-spinner p` - Loading text

To customize colors, spacing, etc., edit these in `public/css/style.css`.

## Testing

Open `/loading-test.html` in your browser to see the loading overlay in action:
- **Fast Request**: Completes in <0.5s (loading won't show)
- **Slow Request**: Takes 1.5s (loading will appear)
- **Manual Loading**: Direct control with showLoading/hideLoading

## Technical Details

- **Z-index**: 9999 (appears above all other elements)
- **Backdrop**: Semi-transparent black with blur effect
- **Animation**: Smooth 0.3s opacity transition
- **Mobile-friendly**: Works on all devices including touch screens

## Notes

1. The loading overlay is **non-intrusive** - it only shows if the request takes longer than 0.5 seconds
2. Fast requests (<500ms) will complete without any visual interruption
3. The overlay **blocks all interactions** when visible (clicks pass-through when hidden)
4. Works with **all fetch-based code** in your application automatically

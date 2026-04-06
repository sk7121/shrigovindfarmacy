# Production/Render Infinite Reload Fix

## 🔍 Root Cause

The infinite reload issue on production/Render was caused by:

1. **Missing Trust Proxy Configuration**: Express wasn't trusting Render's reverse proxy, causing incorrect HTTPS detection
2. **Session Cookie Secure Flag Issue**: The session cookie required both `NODE_ENV=production` AND `HTTPS=true`, but Render doesn't set `HTTPS` by default
3. **Aggressive HTML Caching**: HTML pages were being cached, causing stale redirects
4. **Service Worker Cache Strategy**: Network-first strategy for HTML could cause redirect loops on slow connections

## ✅ Applied Fixes

### 1. Trust Proxy Configuration (app.js)
```javascript
// Trust Render's reverse proxy for proper HTTPS detection
app.set('trust proxy', 1);
```

### 2. Session Cookie Fix (app.js)
**Before:**
```javascript
secure: process.env.NODE_ENV === "production" && process.env.HTTPS === "true"
```

**After:**
```javascript
secure: process.env.NODE_ENV === "production" // Secure in production automatically
```

### 3. HTML Cache Control (app.js)
**Before:**
```javascript
res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
```

**After:**
```javascript
if (process.env.NODE_ENV === 'production') {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
} else {
  res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
}
```

### 4. Service Worker Cache Strategy (sw.js)
- Updated cache version from v4 → v5 to force cache invalidation
- Changed HTML caching from "network-first" to "cache-first" to prevent redirect loops
- Added background cache updates for fresh content

## 🚀 Additional Render Deployment Recommendations

### Environment Variables to Set on Render

Make sure these are configured in your Render dashboard:

```bash
NODE_ENV=production
MONGO_URL=your_mongodb_connection_string
SESSION_SECRET=your_long_random_secret
ACCESS_SECRET=your_long_random_secret
REFRESH_SECRET=your_long_random_secret
PORT=10000
```

### Optional but Recommended

```bash
# Email configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email
EMAIL_PASS=your_password
EMAIL_FROM=noreply@shrigovindpharmacy.com

# Razorpay (if using payments)
RAZORPAY_KEY_ID=your_key
RAZORPAY_KEY_SECRET=your_secret

# Cloudinary (for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
```

### MongoDB Atlas Setup

1. Use MongoDB Atlas (cloud) instead of local MongoDB
2. Whitelist all IPs (`0.0.0.0/0`) for Render access
3. Use connection string format: `mongodb+srv://username:password@cluster.mongodb.net/dbname`

### Render Web Service Configuration

Create a `render.yaml` file in your project root:

```yaml
services:
  - type: web
    name: shri-govind-pharmacy
    env: node
    buildCommand: npm install
    startCommand: node app.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGO_URL
        sync: false
      - key: SESSION_SECRET
        generateValue: true
      - key: ACCESS_SECRET
        generateValue: true
      - key: REFRESH_SECRET
        generateValue: true
      - key: PORT
        value: 10000
```

## 🧪 Testing After Deployment

1. **Clear browser cache and service worker:**
   - Open DevTools → Application → Service Workers → Unregister
   - Clear all site data
   - Reload page

2. **Test these flows:**
   - Visit homepage (`/`)
   - Login/Signup
   - Access protected routes
   - Check if session persists across page reloads
   - Test redirect after login

3. **Check cookies in DevTools:**
   - Application → Cookies
   - Verify `accessToken`, `refreshToken`, and session cookies are set
   - Ensure `Secure` flag is checked in production

## 🔧 Troubleshooting

### If infinite reload still occurs:

1. **Check Render logs** for errors:
   ```bash
   # In Render dashboard → Logs
   ```

2. **Verify environment variables** are set correctly

3. **Check MongoDB connection** - ensure it's accessible from Render

4. **Test with incognito mode** to rule out browser cache issues

5. **Force service worker update:**
   - DevTools → Application → Service Workers → Update
   - Or unregister and reload

### Common Issues:

**Issue:** Session not persisting
**Solution:** Verify `SESSION_SECRET` is set and `trust proxy` is configured

**Issue:** Redirect loop on `/home`
**Solution:** Check MongoDB is connected and products query isn't failing

**Issue:** Service worker caching old version
**Solution:** Increment `CACHE_NAME` version in `sw.js` (already done: v4 → v5)

## 📝 Notes

- Service worker file (`sw.js`) exists but is NOT currently registered in the app
- If you want to use the service worker, you'll need to register it in your main JavaScript file
- The fixes ensure production works without requiring `HTTPS=true` environment variable
- Render automatically provides HTTPS, so `secure: true` for cookies is correct in production

## 🎯 Next Steps

1. Commit and push changes to your repository
2. Redeploy on Render
3. Clear browser cache/service worker
4. Test thoroughly
5. Monitor Render logs for any errors

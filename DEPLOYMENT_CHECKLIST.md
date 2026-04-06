# 🚀 Quick Deployment Checklist for Render

## ✅ Pre-Deployment (Done)
- [x] Fixed trust proxy configuration for HTTPS detection
- [x] Fixed session cookie secure flag (removed HTTPS env var dependency)
- [x] Updated HTML cache control for production
- [x] Updated service worker cache strategy (v4 → v5)
- [x] Created render.yaml configuration
- [x] Syntax verified (node -c app.js passed)

## 📋 Before Deploying

### 1. MongoDB Setup
- [ ] MongoDB Atlas cluster created and running
- [ ] Network access set to `0.0.0.0/0` (allow all IPs)
- [ ] Database user created with read/write permissions
- [ ] Connection string copied (mongodb+srv://...)

### 2. Environment Variables
Set these in Render Dashboard → Environment Variables:

**Required:**
```
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/shrigovind
SESSION_SECRET=<generate a long random string>
ACCESS_SECRET=<generate a long random string>
REFRESH_SECRET=<generate a long random string>
```

**Optional (add as needed):**
```
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=Shri Govind Pharmacy <noreply@shrigovindpharmacy.com>
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### 3. Generate Secrets
Use these commands to generate secure secrets:

```bash
# Session Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Access Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Refresh Secret  
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 🎯 Deployment Steps

### Option 1: Using render.yaml (Recommended)
1. Commit all changes to your GitHub repository
2. Go to https://dashboard.render.com
3. Click "New +" → "Blueprint Instance"
4. Connect your GitHub repository
5. Render will auto-detect render.yaml
6. Fill in the required environment variables
7. Click "Apply"

### Option 2: Manual Deployment
1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name:** shri-govind-pharmacy
   - **Environment:** Node
   - **Build Command:** `npm install --production`
   - **Start Command:** `node app.js`
   - **Plan:** Free (or your preferred plan)
5. Add environment variables manually
6. Click "Create Web Service"

## 🧪 Post-Deployment Testing

### 1. Verify Deployment
- [ ] Render shows "Live" status
- [ ] No errors in Render logs
- [ ] MongoDB connected successfully (check logs)

### 2. Test Core Functionality
Open your production URL and test:

- [ ] Homepage loads without infinite reload
- [ ] Can navigate to all pages
- [ ] Login works
- [ ] Signup works
- [ ] Session persists after page reload
- [ ] Logout works
- [ ] Protected routes redirect properly

### 3. Browser DevTools Checks
- [ ] Open DevTools → Application → Cookies
- [ ] Verify cookies are set with `Secure` flag
- [ ] No redirect loop in Network tab
- [ ] Console has no errors

### 4. Clear Old Service Worker (Important!)
If you previously deployed with the old service worker:

1. Open DevTools → Application → Service Workers
2. Click "Unregister" for any existing service worker
3. Clear all site data (Application → Clear storage → Clear site data)
4. Hard reload (Ctrl + Shift + R)

## 🐛 Troubleshooting

### Issue: Still seeing infinite reload

**Solution 1:** Check Render logs
```
Dashboard → Your Service → Logs
```

Look for:
- ✅ "Connected to MongoDB"
- ✅ "Server running on http://localhost:10000"
- ❌ Any error messages

**Solution 2:** Verify environment variables
```bash
# In Render dashboard, ensure these are set:
NODE_ENV=production
MONGO_URL=mongodb+srv://...
SESSION_SECRET=<long-random-string>
ACCESS_SECRET=<long-random-string>
REFRESH_SECRET=<long-random-string>
```

**Solution 3:** Clear browser completely
1. Open incognito/private window
2. Try your production URL
3. If it works, the issue was browser cache

**Solution 4:** Check MongoDB connection
- Ensure MongoDB Atlas allows connections from all IPs (0.0.0.0/0)
- Verify connection string is correct
- Check MongoDB is running

## 📊 Monitoring

After successful deployment:

1. **Monitor Render Logs** for 24 hours
2. **Check Uptime** - should be 99.9%+
3. **Test Performance** - pages should load < 3 seconds
4. **Monitor MongoDB** - check connection pool usage

## 🎉 Success Criteria

Your deployment is successful when:
- ✅ No infinite reload on production
- ✅ All pages load correctly
- ✅ Login/Signup works
- ✅ Session persists across reloads
- ✅ No console errors
- ✅ Render shows healthy status

## 📞 Support

If you encounter issues:
1. Check Render logs first
2. Review PRODUCTION_FIX.md for detailed troubleshooting
3. Test in incognito mode
4. Verify all environment variables are set
5. Check MongoDB connection

---

**Last Updated:** April 6, 2026
**Fix Version:** 1.0

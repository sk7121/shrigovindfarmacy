# 🧪 Responsive Design Testing Checklist

**Project:** Shri Govind Pharmacy  
**Server:** http://localhost:3000  
**Status:** ✅ All critical fixes applied

---

## 📱 Device Sizes to Test

### Mobile Phones (320px - 480px)
- [ ] **320px** - iPhone SE (1st gen) - Minimum supported
- [ ] **375px** - iPhone 12/13/14
- [ ] **360px** - Small Android
- [ ] **414px** - iPhone 14 Plus
- [ ] **480px** - Medium phones

### Tablets (768px - 1024px)
- [ ] **768px** - iPad portrait (dropdown menus MUST work via tap)
- [ ] **820px** - iPad Air
- [ ] **1024px** - iPad landscape

### Laptops/Desktop (1024px+)
- [ ] **1280px** - Small laptop
- [ ] **1440px** - Standard desktop
- [ ] **1920px** - Full HD monitor

---

## 🔍 Critical Tests (Must Pass)

### Test 1: Mobile Menu + Modal
**Screen:** Any mobile size (≤768px)

1. Open hamburger menu
2. While menu is open, trigger any modal (e.g., product quick view)
3. **Expected:** Modal appears ON TOP of mobile menu
4. **Expected:** Modal backdrop covers everything
5. **Expected:** Can close modal independently

✅ PASS / ❌ FAIL

---

### Test 2: Category Dropdown (Tablet)
**Screen:** 768px - 1024px

1. Navigate to homepage
2. **TAP** (don't hover) "Categories" in navigation
3. **Expected:** Dropdown opens on tap
4. **Expected:** Tap again closes it
5. **Expected:** Tap outside closes it
6. **Expected:** Can click all links inside dropdown

✅ PASS / ❌ FAIL

---

### Test 3: User Menu Dropdown (Tablet)
**Screen:** 768px - 1024px

1. Login as a user
2. **TAP** the user name in navigation
3. **Expected:** User dropdown opens
4. **Expected:** All menu items clickable
5. **Expected:** Tap outside closes it

✅ PASS / ❌ FAIL

---

### Test 4: iPhone Modal Safe Area
**Screen:** iPhone with home indicator (X or newer)

1. Open any modal on mobile (e.g., product quick view)
2. Scroll to bottom of modal content
3. **Expected:** Content has padding above iPhone home bar
4. **Expected:** No content hidden behind home indicator
5. **Expected:** Can scroll to see all content

✅ PASS / ❌ FAIL

---

### Test 5: Cart Toast + WhatsApp Button
**Screen:** Mobile cart page (≤768px)

1. Add item to cart
2. Go to /cart
3. Trigger a toast notification (e.g., update quantity)
4. **Expected:** Toast appears ABOVE WhatsApp button
5. **Expected:** No overlap between toast and WA float
6. **Expected:** Both fully visible and clickable

✅ PASS / ❌ FAIL

---

### Test 6: Hero Slider at 320px
**Screen:** 320px width

1. Resize browser to 320px
2. Look at hero slider at top of homepage
3. **Expected:** Badge visible
4. **Expected:** Heading fully visible (not clipped)
5. **Expected:** Both buttons visible
6. **Expected:** Stats section visible

✅ PASS / ❌ FAIL

---

## 🎨 Visual Quality Tests

### Product Grid
- [ ] **Desktop:** 4-5 columns, no overlap
- [ ] **Tablet:** 3 columns, good spacing
- [ ] **Mobile:** 2 columns → 1 column at 480px
- [ ] **320px:** Single column, full width

### Navigation Bar
- [ ] **Desktop:** All links visible in row
- [ ] **Tablet:** Links visible, dropdowns work on tap
- [ ] **Mobile:** Hamburger menu appears, opens correctly

### Cart Page
- [ ] **Desktop:** Two-column layout (items + summary)
- [ ] **Mobile:** Single column, items stack properly
- [ ] **Mobile:** Quantity controls and buttons fit without wrapping

### Forms
- [ ] **All sizes:** Inputs don't overlap labels
- [ ] **Mobile:** Keyboard doesn't hide input fields
- [ ] **iOS:** No auto-zoom on focus (font-size ≥ 16px)

### Footer
- [ ] **Desktop:** Multi-column layout
- [ ] **Tablet:** 2-3 columns
- [ ] **Mobile:** Single column, stacks vertically

---

## 🌗 Dark Mode Tests

- [ ] **Homepage:** Toggle dark mode, all sections readable
- [ ] **Product cards:** Text contrast OK in dark mode
- [ ] **Modals:** Background and text OK
- [ ] **Cart:** All elements visible
- [ ] **Forms:** Input fields readable

---

## 🔄 Orientation Changes (Mobile/Tablet)

### Portrait → Landscape
1. Start in portrait mode
2. Rotate to landscape
3. **Expected:** Layout adjusts without overlap
4. **Expected:** No horizontal scrollbar
5. **Expected:** Navigation adapts properly

### Landscape → Portrait
1. Start in landscape
2. Rotate to portrait
3. **Expected:** Content reflows correctly
4. **Expected:** No clipped elements

---

## 📊 Performance Tests

### Page Load (Mobile)
- [ ] Homepage loads in < 3 seconds
- [ ] No layout shift (CLS < 0.1)
- [ ] Images don't flash unstyled

### Interactions
- [ ] Mobile menu opens/closes smoothly (< 350ms)
- [ ] Dropdowns respond instantly to tap
- [ ] Modals animate smoothly
- [ ] Scroll performance is smooth (no jank)

---

## 🐛 Edge Cases

### Very Long Content
- [ ] **Product title:** Long names don't overflow cards
- [ ] **Description:** Text wraps properly
- [ ] **Prices:** Large numbers don't break layout

### Empty States
- [ ] **Empty cart:** Displays nicely on all sizes
- [ ] **No products:** Message centered and visible
- [ ] **No orders:** Page looks good on mobile

### Extreme Sizes
- [ ] **Browser at 200% zoom:** Still usable
- [ ] **Split screen (mobile):** Works in narrow viewport
- [ ] **Foldable devices:** Adapts to different aspect ratios

---

## 📝 Notes Template

Use this to record any issues found:

```
Device: _______________
Screen Size: ___________
Browser: ______________

Issue Found:
[ ] Yes  [ ] No

Description:
_________________________________
_________________________________

Screenshot: [Attach if needed]
```

---

## ✅ Sign-Off

Once all tests pass:

- [ ] Mobile (320px-480px): PASS
- [ ] Tablet (768px-1024px): PASS
- [ ] Desktop (1024px+): PASS
- [ ] Dark Mode: PASS
- [ ] Orientation Changes: PASS
- [ ] All Dropdowns: PASS
- [ ] Modals: PASS
- [ ] Cart: PASS

**Tested By:** _________________  
**Date:** _________________  
**Status:** READY FOR PRODUCTION ✅

---

## 🚨 Quick Smoke Test (5 minutes)

If you're short on time, at least test these:

1. **Mobile (375px):**
   - Open homepage → ✅ Layout OK
   - Tap hamburger → ✅ Menu opens
   - Tap a product → ✅ No overlap
   - Add to cart → ✅ Toast visible
   
2. **Tablet (768px):**
   - Tap "Categories" → ✅ Dropdown opens
   - Tap user menu → ✅ Works
   - Check product grid → ✅ 3 columns

3. **Desktop (1440px):**
   - Full navigation → ✅ All visible
   - Hover dropdowns → ✅ Work
   - Product grid → ✅ 4-5 columns

If these 3 pass, you're 95% good to go!

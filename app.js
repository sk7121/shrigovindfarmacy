// ================== IMPORTS ==================
const express = require("express");
const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
require("dotenv").config();

const User = require("./models/user");
const Product = require("./models/product");
const Cart = require("./models/cart");
const Wishlist = require("./models/wishlist");
const Order = require("./models/order");
const Review = require("./models/review");
const Coupon = require("./models/coupon");
const Payment = require("./models/payment");
const Analytics = require("./models/analytics");
const Category = require("./models/category");
const Doctor = require("./models/doctor");
const Appointment = require("./models/appointment");
const Delivery = require("./models/delivery");
const DeliveryAgent = require("./models/deliveryAgent");
const ShippingPartner = require("./models/shippingPartner");
const OTP = require("./models/otp");
const LoyaltyPoint = require("./models/loyaltyPoint");
const {
  sendOrderConfirmation,
  sendOrderStatusUpdate,
  sendWelcomeEmail,
  sendOTPEmail,
} = require("./services/emailService");
const {
  sendOrderConfirmationSMS,
  sendOrderStatusSMS,
} = require("./services/smsService");
const DeliveryService = require("./services/deliveryService");
const QRCodeService = require("./services/qrCodeService");
const { upload, uploadProfile, uploadDoctor, uploadProduct, handleUploadError } = require("./config/multer");
const deliveryController = require("./controllers/deliveryController");

const passport = require("./config/passport");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const {
  authenticateVerified,
  authenticateVerifiedAPI,
  authenticateAgent,
  isAdmin,
  isDeliveryAgent,
} = require("./middleware/auth");

const app = express();

// ================== MIDDLEWARE ==================

const methodOverride = require("method-override");

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

app.use(express.static("public"));
app.use(express.json());

// Serve favicon.ico
app.get("/favicon.ico", (req, res) => {
  res.redirect(
    "https://res.cloudinary.com/drufdfmfr/image/upload/v1772726044/favicon_uuzvml.svg",
  );
});

// Serve pharmacy.png if it doesn't exist
app.get("/pharmacy.png", (req, res) => {
  res.status(404).send("Image not found");
});

app.use(cookieParser());

// Session and flash middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "shri-govind-pharmacy-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
    },
  }),
);

app.use(flash());

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Make flash messages available to all views
app.use((req, res, next) => {
  try {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.info = req.flash("info");
  } catch (err) {
    // Ignore flash errors
    res.locals.success = "";
    res.locals.error = "";
    res.locals.info = "";
  }
  next();
});

const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ================== VIEW ENGINE ==================
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// ================== DATABASE ==================
const MONGO_URL =
  process.env.MONGO_URL || "mongodb://localhost:27017/shri_govind_pharmacy";

mongoose
  .connect(process.env.MONGO_URL, {
    serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
    socketTimeoutMS: 45000,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:");
    console.error("   " + err.message);
    console.error("\n📋 Troubleshooting:");
    console.error(
      "   1. Make sure MongoDB is running: mongod --dbpath /data/db",
    );
    console.error(
      "   2. Or install MongoDB: https://www.mongodb.com/try/download/community",
    );
    console.error("   3. Check your MONGO_URL in .env file");
    console.error("   4. For Docker: docker-compose up -d mongodb\n");
  });

// MongoDB connection event listeners
mongoose.connection.on("disconnected", () => {
  console.log("⚠️  MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});

// ================== AUTH MIDDLEWARE ==================

const optionalAuth = async (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return next(); // no redirect
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (user) {
      req.user = user;
    }

    next();
  } catch (err) {
    next(); // invalid token → ignore
  }
};

const authenticate = async (req, res, next) => {
  const token = req.cookies.accessToken;
  console.log("\n[authenticate] Token present:", !!token);

  if (!token) {
    console.log("[authenticate] No token, redirecting to /login");
    // Save the intended URL for redirect after login
    return res.redirect(
      `/login?redirect=${encodeURIComponent(req.originalUrl)}`,
    );
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);
    console.log("[authenticate] Token decoded, userId:", decoded.userId);

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      console.log("[authenticate] User not found, redirecting to /login");
      return res.redirect(
        `/login?redirect=${encodeURIComponent(req.originalUrl)}`,
      );
    }

    req.user = user; // full user object from DB
    console.log(
      "[authenticate] User authenticated:",
      user.email,
      "Role:",
      user.role,
    );

    // Check if token is marked as unverified or email is not verified (skip for admin users)
    if (
      user.role !== "admin" &&
      (decoded.unverified || !user.isEmailVerified)
    ) {
      console.log(
        "[authenticate] Email not verified, redirecting to OTP verification",
      );
      // Clear cookies to prevent access
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
      // Store user info in session for OTP verification
      req.session.pendingUserId = user._id.toString();
      return res.redirect(
        `/verify-otp?email=${encodeURIComponent(user.email)}`,
      );
    }

    next();
  } catch (err) {
    console.log("[authenticate] Token verification failed:", err.message);
    return res.redirect(
      `/login?redirect=${encodeURIComponent(req.originalUrl)}`,
    );
  }
};

// Make user available to all templates
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const isUser = (req, res, next) => {
  if (req.user.role === "user") {
    next();
  } else {
    res.redirect("/home");
  }
};

const isDistributor = (req, res, next) => {
  if (req.user.role === "distributor") {
    next();
  } else {
    res.redirect("/home");
  }
};

// ================== ROUTES ==================

// Home
app.get("/", (req, res) => res.redirect("/home"));

app.get("/home", authenticateVerified, async (req, res) => {
  try {
    // Build search and filter query
    let query = {};

    // Search by product name or description
    if (req.query.search) {
      const searchTerm = req.query.search.trim();
      query.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } },
        { category: { $regex: searchTerm, $options: "i" } },
      ];
    }

    // Filter by category
    if (req.query.category && req.query.category !== "all") {
      query.category = req.query.category;
    }

    // Filter by price range
    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice) query.price.$gte = Number(req.query.minPrice);
      if (req.query.maxPrice) query.price.$lte = Number(req.query.maxPrice);
    }

    // Filter by availability
    if (req.query.inStock === "on") {
      query.stock = { $gt: 0 };
    }

    // Sorting
    let sortOption = {};
    const sortBy = req.query.sortBy || "default";

    switch (sortBy) {
      case "price-low":
        sortOption = { price: 1 };
        break;
      case "price-high":
        sortOption = { price: -1 };
        break;
      case "name-asc":
        sortOption = { name: 1 };
        break;
      case "name-desc":
        sortOption = { name: -1 };
        break;
      case "newest":
        sortOption = { createdAt: -1 };
        break;
      case "rating":
        sortOption = { rating: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    // Execute query with sorting
    const products = await Product.find(query).sort(sortOption);

    // Get unique categories for filter dropdown
    const categories = await Product.distinct("category");

    let count = 0;
    let cartCount = 0;
    let wishCount = 0;

    // Only check cart and wishlist if user is logged in
    if (req.user) {
      try {
        const cart = await Cart.findOne({ user: req.user._id });
        if (cart) {
          count = cart.items.reduce((total, item) => total + item.quantity, 0);
          cartCount = cart.items.length;
        }
      } catch (cartErr) {
        console.log("Cart count error:", cartErr.message);
      }

      try {
        const wishlist = await Wishlist.findOne({ user: req.user._id });
        if (wishlist) {
          wishCount = wishlist.items.length;
        }
      } catch (wishErr) {
        console.log("Wishlist count error:", wishErr.message);
      }
    }

    // Get filter values for UI
    const filters = {
      search: req.query.search || "",
      category: req.query.category || "all",
      minPrice: req.query.minPrice || "",
      maxPrice: req.query.maxPrice || "",
      inStock: req.query.inStock || "",
      sortBy: sortBy,
    };

    console.log(
      "Home page - Products found:",
      products.length,
      "Filters:",
      filters,
    );
    res.render("pages/index.ejs", {
      products,
      count,
      wishCount,
      cartCount,
      categories,
      filters,
    });
  } catch (err) {
    console.log("Home page error:", err);
    res.status(500).send("Error loading home");
  }
});

// Login Page
app.get("/signIn", (req, res) => {
  res.render("auth/account.ejs");
});

// Login Page
app.get("/login", (req, res) => {
  res.render("auth/account.ejs");
});

// Admin Login Page
app.get("/admin/login", (req, res) => {
  res.render("admin/login.ejs");
});

// OTP Verification Page
app.get("/verify-otp", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "verify-otp.html"));
});

// OTP Login Page (Passwordless Login)
app.get("/otp-login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "otp-login.html"));
});

// Loyalty Rewards Page
app.get("/loyalty-rewards", authenticateVerified, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "loyalty-rewards.html"));
});

// Forgot Password Page
app.get("/forgot-password", (req, res) => {
  res.redirect("/forgot-password.html");
});

// ================== GOOGLE OAUTH ROUTES ==================
// Initiate Google OAuth
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

// Google OAuth callback
app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    failureMessage: true,
  }),
  async (req, res) => {
    try {
      // User successfully authenticated
      const user = req.user;

      // Generate tokens
      const accessToken = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.ACCESS_SECRET,
        { expiresIn: "7d" },
      );

      const refreshToken = jwt.sign(
        { userId: user._id },
        process.env.REFRESH_SECRET,
        { expiresIn: "7d" },
      );

      user.refreshToken = refreshToken;
      await user.save();

      // Check if email is verified (skip for admin and Google OAuth users)
      if (user.role !== "admin" && !user.isEmailVerified) {
        console.log("⚠️ Email not verified (Google OAuth), redirecting to OTP verification");
        req.session.pendingUserId = user._id.toString();
        req.flash("info", "Please verify your email to continue.");
        return res.redirect(`/verify-otp?email=${encodeURIComponent(user.email)}`);
      }

      // Set cookies
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      req.flash("success", `Welcome to Shri Govind Pharmacy, ${user.name}!`);
      res.redirect("/home");
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      req.flash("error", "Error completing authentication");
      res.redirect("/login");
    }
  },
);

// Google OAuth failure
app.get("/auth/google/failure", (req, res) => {
  req.flash("error", "Google authentication failed. Please try again.");
  res.redirect("/login");
});

// Google OAuth logout (revoke access)
app.get("/auth/google/logout", (req, res) => {
  // This would revoke the OAuth token if needed
  res.redirect("/logout");
});

app.get("/admin/home", authenticate, isAdmin, async (req, res) => {
  try {
    // Get analytics data
    const analyticsData = await Analytics.getDashboardData(30);

    // Get recent orders
    const recentOrders = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("user", "name email");

    // Get low stock products
    const lowStockProducts = await Product.find({ stock: { $lte: 10, $gt: 0 } })
      .sort({ stock: 1 })
      .limit(5);

    // Get all products for table
    const products = await Product.find({}).sort({ createdAt: -1 });

    // Get doctor counts for admin dashboard quick access
    const totalDoctors = await Doctor.countDocuments();
    const activeDoctors = await Doctor.countDocuments({ isActive: true });

    // Get pending delivery agent count
    const pendingAgentsCount = await DeliveryAgent.countDocuments({
      isActive: false,
    });

    res.render("admin/dashboard.ejs", {
      products,
      analytics: analyticsData.summary,
      dailyRevenue: analyticsData.dailyRevenue,
      topProducts: analyticsData.topProducts,
      recentOrders,
      lowStockProducts,
      pendingAgentsCount,
      totalDoctors,
      activeDoctors,
    });
  } catch (err) {
    console.log("Dashboard error:", err);
    const products = await Product.find({});
    res.render("admin/dashboard.ejs", { products });
  }
});

// API: Get analytics data
app.get("/api/admin/analytics", authenticate, isAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const analyticsData = await Analytics.getDashboardData(days);
    res.json({ success: true, ...analyticsData });
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ success: false, message: "Error fetching analytics" });
  }
});

app.get(
  "/admin/products/edit/:productId",
  authenticate,
  isAdmin,
  async (req, res) => {
    const product = await Product.findById(req.params.productId);
    res.render("admin/edit-product.ejs", { product });
  },
);

app.post(
  "/admin/products/edit/:productId",
  authenticate,
  isAdmin,
  uploadProduct.single("image"),
  handleUploadError,
  async (req, res) => {
    try {
      const productData = req.body;

      // Handle image upload to Cloudinary - only update if new file uploaded
      if (req.file) {
        productData.image = req.file.secure_url || req.file.path;
        console.log("✅ Product image updated in Cloudinary:", productData.image);
      } else {
        // Remove image from update data if no new file uploaded (keep existing)
        delete productData.image;
        console.log("ℹ️ No new image uploaded, keeping existing image");
      }

      await Product.findByIdAndUpdate(req.params.productId, productData, {
        new: true,
        runValidators: true,
      });
      console.log("✅ Product updated successfully");
      req.flash("success", "Product updated successfully!");
      res.redirect("/admin/home");
    } catch (err) {
      console.log("❌ Error updating product:", err);
      req.flash("error", "Error updating product: " + err.message);
      res.render("admin/edit-product.ejs", { product: await Product.findById(req.params.productId) });
    }
  },
);

// ================== LOGIN ==================
app.post("/login", async (req, res) => {
  try {
    const { email, password, redirect } = req.body;
    console.log("Login attempt:", email);

    const user = await User.findOne({ email });

    // User not found
    if (!user) {
      console.log("❌ User not found");
      req.flash("error", "User not found. Please create an account first.");
      return res.redirect("/login");
    }

    // If admin tries user login
    if (user.role === "admin") {
      console.log("🔄 Admin tried user login");
      req.flash(
        "info",
        "Please use the admin login page for administrator access.",
      );
      return res.redirect("/admin/login");
    }

    // Password check
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log("❌ Incorrect password");
      req.flash("error", "Invalid email or password.");
      return res.redirect("/login");
    }

    console.log("✅ User login successful");

    // Check if email is verified (skip for admin)
    if (user.role !== "admin" && !user.isEmailVerified) {
      console.log("⚠️ Email not verified, redirecting to OTP verification");
      req.session.pendingUserId = user._id.toString();
      req.flash("info", "Please verify your email to continue.");
      return res.redirect(`/verify-otp?email=${encodeURIComponent(user.email)}`);
    }

    // Create Access Token - 7 days
    const accessToken = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        email: user.email,
      },
      process.env.ACCESS_SECRET,
      { expiresIn: "7d" },
    );

    // Create Refresh Token - 7 days
    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    // Save refresh token in DB
    user.refreshToken = refreshToken;
    await user.save();

    // Access token cookie - 7 days
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    // Refresh token cookie - 7 days
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    // Set user in res.locals for immediate availability
    res.locals.user = user;

    // Redirect if user tried to access protected page
    if (redirect && redirect.startsWith("/")) {
      console.log("🎯 Redirecting to:", redirect);
      return res.redirect(redirect);
    }

    // Default redirect
    return res.redirect("/home");
  } catch (error) {
    console.error("🔥 LOGIN ERROR:", error);
    req.flash("error", "Server error. Please try again.");
    return res.redirect("/login");
  }
});

// ================== ADMIN LOGIN ==================
app.post("/admin/login", async (req, res) => {
  try {
    const { email, password, redirect } = req.body;
    console.log("[Admin Login] Attempt:", email);

    const user = await User.findOne({ email });

    // User not found
    if (!user) {
      console.log("❌ Admin user not found");
      req.flash("error", "Invalid admin credentials.");
      return res.redirect("/admin/login");
    }

    // Check if user is admin
    if (user.role !== "admin") {
      console.log("🚫 Non-admin tried admin login:", user.email);
      req.flash(
        "error",
        "Access denied. Admin credentials required.",
      );
      return res.redirect("/admin/login");
    }

    // Password check
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log("❌ Admin password incorrect");
      req.flash("error", "Invalid admin credentials.");
      return res.redirect("/admin/login");
    }

    console.log("✅ Admin login successful");

    // Create Access Token - 7 days
    const accessToken = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        email: user.email,
      },
      process.env.ACCESS_SECRET,
      { expiresIn: "7d" },
    );

    // Create Refresh Token - 7 days
    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    // Save refresh token in DB
    user.refreshToken = refreshToken;
    await user.save();

    // Access token cookie - 7 days
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    // Refresh token cookie - 7 days
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    // Set user in res.locals for immediate availability
    res.locals.user = user;

    // Redirect if user tried to access protected page
    if (redirect && redirect.startsWith("/")) {
      console.log("🎯 Admin redirecting to:", redirect);
      return res.redirect(redirect);
    }

    // Default redirect to admin dashboard
    return res.redirect("/admin/home");
  } catch (error) {
    console.error("🔥 ADMIN LOGIN ERROR:", error);
    req.flash("error", "Server error. Please try again.");
    return res.redirect("/admin/login");
  }
});

// ================== PASSWORD RESET ==================

// Send OTP for password reset
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.json({
        success: false,
        message: "Please provide email address",
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });

    if (!user) {
      return res.json({
        success: false,
        message: "No account found with this email",
      });
    }

    // Generate OTP
    const { otp, expiresAt } = await OTP.createOTP(email, "password_reset", 10);

    // Send OTP via email
    const emailResult = await sendOTPEmail(email, otp, "password_reset");

    if (!emailResult.success) {
      return res.json({
        success: false,
        message: "Failed to send OTP. Please try again.",
      });
    }

    return res.json({
      success: true,
      message: "OTP sent to your email successfully.",
      expiresAt,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.json({
      success: false,
      message: "Server error. Please try again.",
    });
  }
});

// ================== VERIFY OTP ==================
app.post("/api/verify-reset-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    // Verify OTP
    const isValid = await OTP.verifyOTP(email, otp, "password_reset");

    if (!isValid) {
      return res.json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    return res.json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.json({
      success: false,
      message: "Server error. Please try again.",
    });
  }
});

// ================== RESET PASSWORD ==================
app.post("/api/reset-password", async (req, res) => {
  try {
    const { email, password, confirm_password } = req.body;

    if (!email || !password || !confirm_password) {
      return res.json({
        success: false,
        message: "Email, password and confirm password are required",
      });
    }

    // Check password match
    if (password !== confirm_password) {
      return res.json({
        success: false,
        message: "Passwords do not match",
      });
    }

    // Password length check
    if (password.length < 8) {
      return res.json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password
    const user = await User.findOneAndUpdate(
      { email },
      {
        password: hashedPassword,
        refreshToken: null,
      },
    );

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    // Delete all used OTPs for this email after successful password reset
    await OTP.deleteMany({ email, purpose: "password_reset" });

    return res.json({
      success: true,
      message:
        "Password reset successful! Please login with your new password.",
      redirect: "/login",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return res.json({
      success: false,
      message: "Server error. Please try again.",
    });
  }
});

// ================== REGISTRATION (Send OTP) ==================
app.post("/signIn", async (req, res) => {
  try {
    const {
      fname,
      lname,
      email,
      city,
      state,
      password,
      confirm_password,
      phone,
    } = req.body;

    console.log("[Registration] Received data:", {
      fname,
      lname,
      email,
      city,
      state,
      phone,
    });

    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      console.log("[Registration] User already exists:", email);
      req.flash("error", "Email already registered. Please login instead.");
      return res.redirect("/login");
    }

    // Check password match
    if (password !== confirm_password) {
      console.log("[Registration] Passwords do not match");
      req.flash("error", "Passwords do not match. Please try again.");
      return res.redirect("/login");
    }

    // Check password length
    if (password.length < 8) {
      console.log("[Registration] Password too short");
      req.flash("error", "Password must be at least 8 characters long.");
      return res.redirect("/login");
    }

    const name = `${fname} ${lname}`;
    const address = `${city}, ${state}`;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log("[Registration] Password hashed successfully", hashedPassword);

    // Store registration data in session (don't create user yet)
    req.session.pendingRegistration = {
      name,
      email: normalizedEmail,

      password: hashedPassword,
      address,
      phone,
    };

    console.log("[Registration] Stored in session. Session ID:", req.sessionID);
    console.log(
      "[Registration] Pending registration:",
      req.session.pendingRegistration,
    );

    // Generate and send OTP
    const { otp, expiresAt } = await OTP.createOTP(
      normalizedEmail,
      "email_verification",
      10,
    );
    console.log("[Registration] Generated OTP:", otp);
    // Send OTP via email
    const emailResult = await sendOTPEmail(
      normalizedEmail,
      otp,
      "email_verification",
    );
    console.log("[Registration] Email result:", emailResult);

    if (!emailResult.success) {
      console.log("[Registration] Failed to send email:", emailResult.message);
      req.flash("error", "Failed to send OTP email. Please try again.");
      return res.redirect("/login");
    }

    console.log(
      "[Registration] OTP sent successfully, redirecting to verify page",
    );
    req.flash(
      "success",
      "OTP sent to your email! Please verify to complete registration.",
    );
    const redirectUrl = `/verify-otp?email=${encodeURIComponent(normalizedEmail)}`;

    console.log("[Registration] Redirect URL:", redirectUrl);
    return res.redirect(redirectUrl);
  } catch (error) {
    console.log("Signup error:", error);
    req.flash("error", "Server error. Please try again.");
    return res.redirect("/login");
  }
});

// ================== TOKEN REFRESH ==================

app.post("/refresh-token", async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.redirect("/login");

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || user.refreshToken !== token) {
      return res.redirect("/login");
    }

    const newAccessToken = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        email: user.email,
      },
      process.env.ACCESS_SECRET,
      { expiresIn: "7d" },
    );

    const newRefreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    user.refreshToken = newRefreshToken;
    await user.save();

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    // Check email verification (skip for admin)
    if (user.role !== "admin" && !user.isEmailVerified) {
      console.log("⚠️ Email not verified on token refresh, redirecting to OTP verification");
      return res.redirect(`/verify-otp?email=${encodeURIComponent(user.email)}`);
    }

    res.redirect("/home");
  } catch (err) {
    return res.redirect("/login");
  }
});
// ================== PROTECTED ROUTES ==================

// ================== WISHLIST ROUTES ==================
app.get("/wishlist", authenticateVerified, async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user._id }).populate(
      "items.product",
    );

    if (!wishlist) {
      wishlist = { items: [] };
    }

    res.render("user/wishlist", { wishlist });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error loading wishlist");
  }
});

app.post(
  "/wishlist/add/:productId",
  authenticateVerifiedAPI,
  async (req, res) => {
    try {
      let wishlist = await Wishlist.findOne({ user: req.user._id });

      if (!wishlist) {
        wishlist = new Wishlist({ user: req.user._id, items: [] });
      }

      await wishlist.addProduct(req.params.productId);

      // Get cart count
      let cartCount = 0;
      let cartItemCount = 0;
      const cart = await Cart.findOne({ user: req.user._id });
      if (cart) {
        cartItemCount = cart.items.length;
        cartCount = cart.items.reduce(
          (total, item) => total + item.quantity,
          0,
        );
      }

      // Return updated counts
      res.json({
        success: true,
        message: "Added to wishlist",
        wishlistCount: wishlist.items.length,
        cartCount,
        cartItemCount,
      });
    } catch (err) {
      console.log(err);
      res
        .status(500)
        .json({ success: false, message: "Error adding to wishlist" });
    }
  },
);

app.post(
  "/wishlist/remove/:productId",
  authenticateVerifiedAPI,
  async (req, res) => {
    try {
      let wishlist = await Wishlist.findOne({ user: req.user._id });

      if (!wishlist) {
        return res.json({ success: false, message: "Wishlist not found" });
      }

      await wishlist.removeProduct(req.params.productId);

      // Get cart count
      let cartCount = 0;
      let cartItemCount = 0;
      const cart = await Cart.findOne({ user: req.user._id });
      if (cart) {
        cartItemCount = cart.items.length;
        cartCount = cart.items.reduce(
          (total, item) => total + item.quantity,
          0,
        );
      }

      // Return updated counts
      res.json({
        success: true,
        message: "Removed from wishlist",
        wishlistCount: wishlist.items.length,
        cartCount,
        cartItemCount,
      });
    } catch (err) {
      console.log(err);
      res
        .status(500)
        .json({ success: false, message: "Error removing from wishlist" });
    }
  },
);

app.get(
  "/wishlist/check/:productId",
  authenticateVerifiedAPI,
  async (req, res) => {
    try {
      const wishlist = await Wishlist.findOne({ user: req.user._id });

      if (!wishlist) {
        return res.json({ inWishlist: false });
      }

      const inWishlist = wishlist.isProductInWishlist(req.params.productId);
      res.json({ inWishlist });
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: "Error checking wishlist" });
    }
  },
);

// ================== COUNT APIs ==================
app.get("/api/user/counts", authenticate, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get cart count
    let cartCount = 0;
    let cartItemCount = 0;
    const cart = await Cart.findOne({ user: userId });
    if (cart) {
      cartItemCount = cart.items.length;
      cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);
    }

    // Get wishlist count
    let wishlistCount = 0;
    const wishlist = await Wishlist.findOne({ user: userId });
    if (wishlist) {
      wishlistCount = wishlist.items.length;
    }

    res.json({
      success: true,
      cartCount,
      cartItemCount,
      wishlistCount,
    });
  } catch (err) {
    console.log("Error fetching counts:", err);
    res.status(500).json({ success: false, message: "Error fetching counts" });
  }
});

// ================== OTP ROUTES ==================

// Send OTP for email verification
app.post("/api/otp/send", async (req, res) => {
  try {
    let { email, purpose = "email_verification", name = "" } = req.body;
    email = String(email || "")
      .trim()
      .toLowerCase();

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Generate OTP
    const { otp, expiresAt } = await OTP.createOTP(email, purpose, 10);

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otp, purpose, name);

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again.",
      });
    }

    res.json({
      success: true,
      message: "OTP sent successfully to your email",
      expiresAt,
      expiresIn: "10 minutes",
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Error sending OTP. Please try again.",
    });
  }
});

// Verify OTP
app.post("/api/otp/verify", async (req, res) => {
  try {
    let { email, otp, purpose = "email_verification" } = req.body;
    email = String(email || "")
      .trim()
      .toLowerCase();

    console.log("[OTP Verify] Email:", email, "Purpose:", purpose, "OTP:", otp);
    console.log(
      "[OTP Verify] Session pendingRegistration:",
      req.session.pendingRegistration,
    );

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and OTP",
      });
    }

    // Verify OTP
    const result = await OTP.verifyOTP(email, otp, purpose);

    if (!result.success) {
      console.log("[OTP Verify] OTP verification failed:", result.message);
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    console.log("[OTP Verify] OTP verified successfully");

    // For email verification during registration
    if (purpose === "email_verification") {
      // Check if there's a pending registration in session
      const pendingRegistration = req.session.pendingRegistration;

      if (pendingRegistration && pendingRegistration.email === email) {
        console.log(
          "[OTP Verify] Creating user account from pending registration...",
        );
        // Create the user account now that OTP is verified
        const newUser = await User.create({
          name: pendingRegistration.name,
          email: pendingRegistration.email,
          password: pendingRegistration.password,
          address: pendingRegistration.address,
          phone: pendingRegistration.phone,
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
        });

        console.log("[OTP Verify] User created:", newUser._id);

        // Clear pending registration from session
        req.session.pendingRegistration = null;

        // Generate tokens
        const accessToken = jwt.sign(
          { userId: newUser._id, email: newUser.email },
          process.env.ACCESS_SECRET,
          { expiresIn: "15m" },
        );

        const refreshToken = jwt.sign(
          { userId: newUser._id },
          process.env.REFRESH_SECRET,
          { expiresIn: "7d" },
        );

        newUser.refreshToken = refreshToken;
        await newUser.save();

        // Set cookies
        res.cookie("accessToken", accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "Lax",
          maxAge: 15 * 60 * 1000,
        });

        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "Lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        console.log("[OTP Verify] Registration complete, redirecting to /home");
        return res.json({
          success: true,
          message: "Email verified successfully! Account created.",
          redirect: "/home",
        });
      }

      // For existing users verifying email
      const user = await User.findOne({ email });
      if (user) {
        user.isEmailVerified = true;
        user.emailVerifiedAt = new Date();
        await user.save();

        console.log(`✅ Email verified for user: ${user.email}`);

        // Generate new tokens for verified user
        const accessToken = jwt.sign(
          {
            userId: user._id,
            role: user.role,
            email: user.email,
          },
          process.env.ACCESS_SECRET,
          { expiresIn: "15m" },
        );

        const refreshToken = jwt.sign(
          { userId: user._id },
          process.env.REFRESH_SECRET,
          { expiresIn: "7d" },
        );

        user.refreshToken = refreshToken;
        await user.save();

        // Set cookies
        res.cookie("accessToken", accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "Lax",
          maxAge: 15 * 60 * 1000,
        });

        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "Lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.json({
          success: true,
          message: "Email verified successfully!",
          redirect: "/home",
        });
      }

      // No pending registration and no existing user
      return res.status(400).json({
        success: false,
        message: "No pending registration found. Please register again.",
      });
    }

    res.json({
      success: true,
      message: "Email verified successfully!",
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying OTP. Please try again.",
    });
  }
});

// Resend OTP
app.post("/api/otp/resend", async (req, res) => {
  try {
    let { email, purpose = "email_verification", name = "" } = req.body;
    email = String(email || "")
      .trim()
      .toLowerCase();

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Rate limiting: max 3 resends per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentOTPs = await OTP.countDocuments({
      email,
      purpose,
      createdAt: { $gte: oneHourAgo },
    });

    if (recentOTPs >= 3) {
      return res.status(429).json({
        success: false,
        message: "Too many OTP requests. Please wait 1 hour.",
      });
    }

    // Generate new OTP
    const { otp, expiresAt } = await OTP.createOTP(email, purpose, 10);

    // Send OTP email
    await sendOTPEmail(email, otp, purpose, name);

    res.json({
      success: true,
      message: "OTP resent successfully",
      expiresAt,
      expiresIn: "10 minutes",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Error resending OTP. Please try again.",
    });
  }
});

// ================== LOYALTY POINTS ROUTES ==================

// Get user's loyalty points
app.get("/api/loyalty/points", authenticateVerifiedAPI, async (req, res) => {
  try {
    let loyaltyPoint = await LoyaltyPoint.findOne({
      user: req.user._id,
    }).populate("user", "name email");

    if (!loyaltyPoint) {
      // Create initial loyalty point account for user
      loyaltyPoint = await LoyaltyPoint.create({
        user: req.user._id,
        points: 0,
        lifetimePoints: 0,
        tier: "bronze",
      });
    }

    const benefits = LoyaltyPoint.getTierBenefits(loyaltyPoint.tier);

    res.json({
      success: true,
      loyaltyPoint: {
        points: loyaltyPoint.points,
        lifetimePoints: loyaltyPoint.lifetimePoints,
        tier: loyaltyPoint.tier,
        tierBenefits: benefits,
        history: loyaltyPoint.history.slice(-10), // Last 10 transactions
      },
    });
  } catch (error) {
    console.error("Get loyalty points error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching loyalty points",
    });
  }
});

// Get loyalty points history
app.get("/api/loyalty/history", authenticateVerifiedAPI, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const loyaltyPoint = await LoyaltyPoint.findOne({ user: req.user._id });

    if (!loyaltyPoint) {
      return res.json({
        success: true,
        history: [],
        total: 0,
      });
    }

    const history = loyaltyPoint.history
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      history,
      total: loyaltyPoint.history.length,
    });
  } catch (error) {
    console.error("Get loyalty history error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching loyalty history",
    });
  }
});

// Redeem loyalty points
app.post("/api/loyalty/redeem", authenticateVerifiedAPI, async (req, res) => {
  try {
    const { points, orderId } = req.body;

    if (!points || points <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid points amount",
      });
    }

    let loyaltyPoint = await LoyaltyPoint.findOne({ user: req.user._id });

    if (!loyaltyPoint) {
      return res.status(404).json({
        success: false,
        message: "Loyalty account not found",
      });
    }

    if (loyaltyPoint.points < points) {
      return res.status(400).json({
        success: false,
        message: "Insufficient points",
      });
    }

    const benefits = LoyaltyPoint.getTierBenefits(loyaltyPoint.tier);
    const discountValue = (points * benefits.cashback) / 100;

    await loyaltyPoint.redeemPoints(
      points,
      `Redeemed for order ${orderId || "N/A"}`,
    );

    res.json({
      success: true,
      message: "Points redeemed successfully",
      discount: discountValue,
      remainingPoints: loyaltyPoint.points,
    });
  } catch (error) {
    console.error("Redeem points error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error redeeming points",
    });
  }
});

// Calculate points for order (preview)
app.post(
  "/api/loyalty/calculate",
  authenticateVerifiedAPI,
  async (req, res) => {
    try {
      const { orderAmount } = req.body;

      if (!orderAmount || orderAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid order amount",
        });
      }

      let loyaltyPoint = await LoyaltyPoint.findOne({ user: req.user._id });

      if (!loyaltyPoint) {
        // Return default calculation for new user
        const pointsToEarn = Math.floor(orderAmount / 100);
        return res.json({
          success: true,
          pointsToEarn,
          currentTier: "bronze",
          cashbackPercent: 1,
        });
      }

      const benefits = LoyaltyPoint.getTierBenefits(loyaltyPoint.tier);
      const pointsToEarn =
        Math.floor(orderAmount / 100) * (1 + benefits.cashback / 100);

      res.json({
        success: true,
        pointsToEarn: Math.floor(pointsToEarn),
        currentTier: loyaltyPoint.tier,
        cashbackPercent: benefits.cashback,
        discountPercent: benefits.discount,
      });
    } catch (error) {
      console.error("Calculate points error:", error);
      res.status(500).json({
        success: false,
        message: "Error calculating points",
      });
    }
  },
);

// Admin: Get all loyalty point accounts
app.get("/admin/loyalty", authenticate, isAdmin, async (req, res) => {
  try {
    const { tier = "all", page = 1, limit = 20 } = req.query;

    const query = {};
    if (tier !== "all") {
      query.tier = tier;
    }

    const loyaltyPoints = await LoyaltyPoint.find(query)
      .sort({ lifetimePoints: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate("user", "name email phone");

    const total = await LoyaltyPoint.countDocuments(query);

    res.render("admin/loyalty.ejs", {
      loyaltyPoints,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      total,
      currentTier: tier,
    });
  } catch (error) {
    console.error("Admin loyalty error:", error);
    res.status(500).send("Error loading loyalty points");
  }
});

// Admin: Add/Adjust points for a user
app.post(
  "/admin/loyalty/:userId/adjust",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const { points, description, type = "adjusted" } = req.body;

      if (!points) {
        return res.status(400).json({
          success: false,
          message: "Points amount required",
        });
      }

      let loyaltyPoint = await LoyaltyPoint.findOne({
        user: req.params.userId,
      });

      if (!loyaltyPoint) {
        loyaltyPoint = await LoyaltyPoint.create({
          user: req.params.userId,
          points: 0,
          lifetimePoints: 0,
          tier: "bronze",
        });
      }

      if (type === "earned" || points > 0) {
        await loyaltyPoint.addPoints(
          Math.abs(points),
          description || "Admin adjustment",
        );
      } else if (type === "redeemed" || points < 0) {
        await loyaltyPoint.redeemPoints(
          Math.abs(points),
          description || "Admin adjustment",
        );
      }

      res.json({
        success: true,
        message: "Points adjusted successfully",
        loyaltyPoint,
      });
    } catch (error) {
      console.error("Admin adjust points error:", error);
      res.status(500).json({
        success: false,
        message: "Error adjusting points",
      });
    }
  },
);

// Cart route - redirect to /user/cart for authenticated users
app.get("/cart", authenticateVerified, (req, res) => {
  return res.redirect("/user/cart");
});

app.get("/product", authenticate, (req, res) => {
  res.render("user/product.ejs");
});

app.get("/user/item/purchase/payment/:itemId", authenticate, (req, res) => {
  res.render("user/payment.ejs", {
    itemId: req.params.itemId,
    price: 100,
    title: "Item Name",
    description: "Item Description",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
    quantity: 10,
    rating: 5,
    reviews: 10,
    seller: "Seller Name",
    sellerId: "Seller Id",
  });
});

app.get("/user/item/purchase/:itemId", authenticate, (req, res) => {
  res.render("user/purchase.ejs", {
    itemId: req.params.itemId,
    price: 100,
    title: "Item Name",
    description: "Item Description",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
    quantity: 10,
    rating: 5,
    reviews: 10,
    seller: "Seller Name",
    sellerId: "Seller Id",
  });
});

app.get("/item/:itemId", authenticate, (req, res) => {
  res.render("user/item.ejs", {
    itemId: req.params.itemId,
    price: 100,
    title: "Item Name",
    description: "Item Description",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
    quantity: 10,
    rating: 5,
    reviews: 10,
    seller: "Seller Name",
    sellerId: "Seller Id",
  });
});

// ================== LOGOUT ==================
app.post("/logout", async (req, res) => {
  const token = req.cookies.refreshToken;

  if (token) {
    const user = await User.findOne({ refreshToken: token });
    if (user) {
      user.refreshToken = null;
      await user.save();
    }
  }

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  res.redirect("/login");
});

app.get("/aboutUs", (req, res) => {
  res.render("pages/aboutUs.ejs");
});

// ================== COMPLIANCE PAGES (For Razorpay) ==================
app.get("/privacy-policy", (req, res) => {
  res.render("pages/privacy-policy.ejs");
});

app.get("/terms-conditions", (req, res) => {
  res.render("pages/terms-conditions.ejs");
});

app.get("/refund-policy", (req, res) => {
  res.render("pages/refund-policy.ejs");
});

app.get("/account", authenticateVerified, async (req, res) => {
  try {
    const Appointment = require("./models/appointment");
    const Order = require("./models/order");

    // Get user's appointments
    const appointments = await Appointment.find({ patient: req.user._id })
      .sort({ appointmentDate: -1, appointmentTime: -1 })
      .limit(10)
      .populate("doctor");

    // Get user's recent orders
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5);

    res.render("auth/account.ejs", {
      appointments,
      orders,
    });
  } catch (err) {
    console.log("Account page error:", err);
    res.render("auth/account.ejs", {
      appointments: [],
      orders: [],
    });
  }
});

// View appointment details
app.get("/appointment/:id", authenticate, async (req, res) => {
  try {
    const Appointment = require("./models/appointment");

    const appointment = await Appointment.findById(req.params.id).populate(
      "doctor",
    );

    if (!appointment) {
      req.flash("error", "Appointment not found");
      return res.redirect("/account");
    }

    // Check if user owns this appointment
    if (appointment.patient.toString() !== req.user._id.toString()) {
      req.flash("error", "Unauthorized access");
      return res.redirect("/account");
    }

    res.render("user/appointment-detail.ejs", {
      appointment,
    });
  } catch (err) {
    console.log("Appointment details error:", err);
    res.status(500).send("Error loading appointment details");
  }
});

app.get("/contact", (req, res) => {
  res.render("pages/contact.ejs");
});

app.get("/categories", optionalAuth, async (req, res) => {
  try {
    // Fetch all active categories with product counts
    const categories = await Category.getCategoriesWithCounts();

    // Fetch products grouped by category
    const productsByCategory = {};
    for (const cat of categories) {
      const products = await Product.find({ category: cat.slug })
        .sort({ createdAt: -1 })
        .limit(20); // Limit initial load

      productsByCategory[cat.slug] = products.map((p) => ({
        _id: p._id,
        name: p.name,
        image: p.image,
        price: p.price,
        oldPrice: p.oldPrice,
        stock: p.stock,
        description: p.description,
        averageRating: p.averageRating,
        numReviews: p.numReviews,
        category: p.category,
      }));
    }

    // Calculate total products and other stats
    const totalProducts = categories.reduce(
      (sum, cat) => sum + cat.productCount,
      0,
    );

    res.render("pages/categories.ejs", {
      categories,
      productsByCategory,
      totalProducts,
    });
  } catch (err) {
    console.log("Categories page error:", err);
    // Fallback: render with empty data
    res.render("pages/categories.ejs", {
      categories: [],
      productsByCategory: {},
      totalProducts: 0,
    });
  }
});

// ================== DOCTOR ROUTES ==================

// Doctor Consultation Page (Public)
app.get("/doctor", optionalAuth, async (req, res) => {
  try {
    // Get all active doctors sorted by featured first
    let doctors = await Doctor.find({ isActive: true }).sort({
      featured: -1,
      createdAt: -1,
    });

    // If no doctor exists, create default doctor
    if (!doctors || doctors.length === 0) {
      const defaultDoctor = await Doctor.create({
        name: "Himanshu Chaturvedi",
        title: "Senior Ayurvedic Physician & Herbal Specialist",
        qualifications: [
          {
            degree: "BAMS",
            specialization: "Ayurvedic Medicine",
            institution: "Rajasthan Ayurveda University",
            year: 2003,
          },
          {
            degree: "MD",
            specialization: "Ayurveda",
            institution: "National Institute of Ayurveda",
            year: 2006,
          },
        ],
        registrationNumber: "A-00452",
        experience: {
          years: 20,
          description:
            "Over 20 years of dedicated practice in classical Ayurveda and herbal therapeutics",
        },
        specializations: [
          "Digestive Disorders",
          "Skin Conditions",
          "Joint & Arthritis",
          "Immunity Boosting",
          "Stress & Anxiety",
          "Weight Management",
          "Sleep Disorders",
          "Diabetes Management",
          "Respiratory Health",
          "Panchakarma",
        ],
        languages: ["Hindi", "English", "Rajasthani"],
        about:
          "Dr. Himanshu Chaturvedi is a highly respected Ayurvedic physician with over two decades of dedicated practice in classical Ayurveda and herbal therapeutics. A gold medalist from Rajasthan Ayurveda University, he has treated thousands of patients across India for chronic lifestyle disorders, digestive ailments, skin conditions, joint disorders, and immunity-related concerns — all through holistic, natural, and evidence-based Ayurvedic treatments. He firmly believes in personalised care rooted in Prakriti analysis and Tridosha balance.",
        contact: {
          phone: "9413010731",
          whatsapp: "9413010731",
          email: "shrigovindpharmacy212@gmail.com",
          clinicAddress:
            "Ward No.6, Govind Marg, Neemkathana, Dist. Sikar, Rajasthan 332713, India",
        },
        availability: [
          {
            day: "Monday",
            startTime: "9:00 AM",
            endTime: "1:00 PM",
            isAvailable: true,
          },
          {
            day: "Tuesday",
            startTime: "9:00 AM",
            endTime: "1:00 PM",
            isAvailable: true,
          },
          {
            day: "Wednesday",
            startTime: "3:00 PM",
            endTime: "7:00 PM",
            isAvailable: true,
          },
          {
            day: "Thursday",
            startTime: "9:00 AM",
            endTime: "1:00 PM",
            isAvailable: true,
          },
          {
            day: "Friday",
            startTime: "9:00 AM",
            endTime: "1:00 PM",
            isAvailable: true,
          },
          {
            day: "Saturday",
            startTime: "9:00 AM",
            endTime: "3:00 PM",
            isAvailable: true,
          },
          { day: "Sunday", startTime: "", endTime: "", isAvailable: false },
        ],
        consultationFee: {
          firstVisit: 0,
          followUp: 500,
          currency: "INR",
          isFreeFirstVisit: true,
        },
        consultationModes: ["In-Clinic", "Online", "WhatsApp"],
        stats: {
          patientsTreated: 8500,
          totalConsultations: 12000,
          averageRating: 4.9,
          totalReviews: 3,
        },
        reviews: [
          {
            patientName: "Priya Meena, Jaipur",
            rating: 5,
            comment:
              "Consulted for chronic digestive issues. Within 3 weeks of Dr. Sharma's herbal prescription, I felt completely transformed. Highly recommend!",
            isVerified: true,
          },
          {
            patientName: "Arun Gupta, Delhi",
            rating: 5,
            comment:
              "Very thorough consultation on WhatsApp. Dr. Rajesh explained everything clearly and the medicines from Shri Govind Pharmacy worked beautifully.",
            isVerified: true,
          },
          {
            patientName: "Sunita Devi, Ajmer",
            rating: 4,
            comment:
              "Great experience, very knowledgeable doctor. My knee pain reduced significantly after the Panchakarma therapy he recommended.",
            isVerified: true,
          },
        ],
        isActive: true,
        isAvailableNow: true,
        featured: true,
      });
      doctors = [defaultDoctor];
    }

    // Determine selected doctor index from query param
    let selectedIndex = parseInt(req.query.selected, 10);
    if (
      isNaN(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= doctors.length
    ) {
      selectedIndex = 0;
    }

    const doctor = doctors[selectedIndex];

    // Update availability status for current doctor
    if (doctor && typeof doctor.updateAvailabilityStatus === "function") {
      doctor.updateAvailabilityStatus();
      await doctor.save();
    }

    // Check if user has an active appointment (pending or confirmed)
    let activeAppointment = null;
    if (req.user) {
      const Appointment = require("./models/appointment");
      activeAppointment = await Appointment.findOne({
        patient: req.user._id,
        status: { $in: ["Pending", "Confirmed"] },
      }).sort({ appointmentDate: -1 });
    }

    // Get cart and wishlist counts if user is logged in
    let cartCount = 0;
    let cartItemCount = 0;
    let wishCount = 0;

    if (req.user) {
      const cart = await Cart.findOne({ user: req.user._id });
      if (cart) {
        cartItemCount = cart.items.length;
        cartCount = cart.items.reduce(
          (total, item) => total + item.quantity,
          0,
        );
      }

      const wishlist = await Wishlist.findOne({ user: req.user._id });
      if (wishlist) {
        wishCount = wishlist.items.length;
      }
    }

    res.render("pages/doctor.ejs", {
      doctor,
      doctors,
      selectedIndex,
      totalDoctors: doctors.length,
      user: req.user || null,
      activeAppointment,
      cartCount,
      cartItemCount,
      wishCount,
    });
  } catch (err) {
    console.log("Doctor page error:", err);
    res.status(500).send("Error loading doctor page");
  }
});

// API: Get doctor details (default/featured)
app.get("/api/doctor", optionalAuth, async (req, res) => {
  try {
    let doctor = await Doctor.findOne({ isActive: true, featured: true });
    if (!doctor) {
      doctor = await Doctor.findOne({ isActive: true });
    }

    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    doctor.updateAvailabilityStatus();
    await doctor.save();

    res.json({ success: true, doctor });
  } catch (err) {
    console.log("Get doctor error:", err);
    res
      .status(500)
      .json({ success: false, message: "Error fetching doctor details" });
  }
});

// API: Get doctor details by slug
app.get("/api/doctor/:slug", optionalAuth, async (req, res) => {
  try {
    const doctor = await Doctor.findOne({
      slug: req.params.slug,
      isActive: true,
    });

    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    doctor.updateAvailabilityStatus();
    await doctor.save();

    res.json({ success: true, doctor });
  } catch (err) {
    console.log("Get doctor error:", err);
    res
      .status(500)
      .json({ success: false, message: "Error fetching doctor details" });
  }
});

// API: Book appointment
app.post(
  "/api/doctor/appointment",
  authenticateVerifiedAPI,
  async (req, res) => {
    try {
      const {
        doctorId,
        appointmentType,
        appointmentDate,
        appointmentTime,
        reason,
        symptoms,
        medicalHistory,
        currentMedications,
        patientDetails,
      } = req.body;

      // Validate required fields
      if (
        !doctorId ||
        !appointmentType ||
        !appointmentDate ||
        !appointmentTime ||
        !reason
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Missing required fields" });
      }

      // Check if doctor exists
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return res
          .status(404)
          .json({ success: false, message: "Doctor not found" });
      }

      // Check if slot is available
      const existingAppointments = await Appointment.find({
        doctor: doctorId,
        appointmentDate: new Date(appointmentDate),
        appointmentTime: appointmentTime,
        status: { $nin: ["Cancelled"] },
      });

      if (existingAppointments.length >= 1) {
        return res.status(400).json({
          success: false,
          message: "This time slot is no longer available",
        });
      }

      // Create appointment
      const appointment = await Appointment.create({
        doctor: doctorId,
        patient: req.user._id,
        patientDetails: patientDetails || {
          name: req.user.name,
          email: req.user.email,
          phone: req.user.phone,
        },
        appointmentType,
        appointmentDate: new Date(appointmentDate),
        appointmentTime,
        reason,
        symptoms: symptoms || [],
        medicalHistory: medicalHistory || "",
        currentMedications: currentMedications || "",
        consultationFee: doctor.consultationFee.firstVisit,
      });

      // Update doctor stats
      doctor.stats.totalConsultations += 1;
      await doctor.save();

      res.json({
        success: true,
        message:
          "Appointment booked successfully! We will confirm your appointment soon.",
        appointment,
      });
    } catch (err) {
      console.log("Book appointment error:", err);
      res
        .status(500)
        .json({ success: false, message: "Error booking appointment" });
    }
  },
);

// API: Submit doctor review
app.post("/api/doctor/:doctorId/review", authenticate, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || !comment) {
      return res
        .status(400)
        .json({ success: false, message: "Rating and comment are required" });
    }

    const doctor = await Doctor.findById(req.params.doctorId);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    // Check if patient has had consultation with doctor
    const hasAppointment = await Appointment.findOne({
      doctor: req.params.doctorId,
      patient: req.user._id,
      status: "Completed",
    });

    await doctor.addReview(
      req.user.name,
      parseInt(rating),
      comment,
      !!hasAppointment,
    );

    res.json({
      success: true,
      message: "Review submitted successfully!",
      doctor,
    });
  } catch (err) {
    console.log("Submit review error:", err);
    res
      .status(500)
      .json({ success: false, message: "Error submitting review" });
  }
});

// API: Get user's appointments
app.get("/api/user/appointments", authenticateVerifiedAPI, async (req, res) => {
  try {
    const appointments = await Appointment.findUpcomingForPatient(req.user._id);
    res.json({ success: true, appointments });
  } catch (err) {
    console.log("Get appointments error:", err);
    res
      .status(500)
      .json({ success: false, message: "Error fetching appointments" });
  }
});

// API: Cancel appointment
app.post(
  "/api/appointment/:appointmentId/cancel",
  authenticateVerified,
  async (req, res) => {
    try {
      const { reason } = req.body;

      const appointment = await Appointment.findOne({
        _id: req.params.appointmentId,
        patient: req.user._id,
      });

      if (!appointment) {
        return res
          .status(404)
          .json({ success: false, message: "Appointment not found" });
      }

      if (["Completed", "Cancelled"].includes(appointment.status)) {
        return res
          .status(400)
          .json({ success: false, message: "Cannot cancel this appointment" });
      }

      await appointment.cancel(req.user._id, reason);

      // Support both JSON and redirect
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        req.flash("success", "Appointment cancelled successfully");
        return res.redirect("/account");
      }

      res.json({
        success: true,
        message: "Appointment cancelled successfully",
      });
    } catch (err) {
      console.log("Cancel appointment error:", err);
      // Support both JSON and redirect
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        req.flash("error", "Error cancelling appointment");
        return res.redirect("/account");
      }
      res
        .status(500)
        .json({ success: false, message: "Error cancelling appointment" });
    }
  },
);

// ================== ADMIN DOCTOR ROUTES ==================

// Admin: View all doctors
app.get("/admin/doctors", authenticate, isAdmin, async (req, res) => {
  try {
    const doctors = await Doctor.find({}).sort({ createdAt: -1 });
    res.render("admin/doctors.ejs", { doctors });
  } catch (err) {
    console.log("Admin doctors error:", err);
    res.status(500).send("Error loading doctors");
  }
});

// Admin: Add new doctor
app.get("/admin/doctors/new", authenticate, isAdmin, (req, res) => {
  res.render("admin/doctor-form.ejs", { doctor: null, action: "create" });
});

app.post(
  "/admin/doctors/new",
  authenticate,
  isAdmin,
  uploadDoctor.single("image"),
  handleUploadError,
  async (req, res) => {
    // Handle upload errors
    if (req.fileValidationError) {
      req.flash("error", req.fileValidationError);
      return res.render("admin/doctor-form.ejs", { doctor: null, action: "create" });
    }

    try {
      const doctorData = req.body;

      // Handle image upload to Cloudinary
      if (req.file) {
        doctorData.image = req.file.secure_url || req.file.path;
        console.log("✅ Doctor image uploaded to Cloudinary:", doctorData.image);
      } else {
        console.log("⚠️ No image file uploaded");
      }

      // Parse arrays from form data
      if (typeof doctorData.specializations === "string") {
        doctorData.specializations = [doctorData.specializations].filter((s) =>
          s.trim(),
        );
      }
      if (typeof doctorData.languages === "string") {
        doctorData.languages = [doctorData.languages].filter((l) => l.trim());
      }
      if (typeof doctorData.consultationModes === "string") {
        doctorData.consultationModes = [doctorData.consultationModes].filter(
          (m) => m.trim(),
        );
      }

      // Normalize boolean fields
      doctorData.isActive =
        doctorData.isActive === "on" ||
        doctorData.isActive === "true" ||
        doctorData.isActive === true;
      doctorData.featured =
        doctorData.featured === "on" ||
        doctorData.featured === "true" ||
        doctorData.featured === true;

      // Normalize consultation fee values
      if (doctorData.consultationFee) {
        doctorData.consultationFee.firstVisit = Number(
          doctorData.consultationFee.firstVisit || 0,
        );
        doctorData.consultationFee.followUp = Number(
          doctorData.consultationFee.followUp || 0,
        );
        doctorData.consultationFee.isFreeFirstVisit =
          doctorData.consultationFee.isFreeFirstVisit === "on" ||
          doctorData.consultationFee.isFreeFirstVisit === "true";
        doctorData.consultationFee.currency =
          doctorData.consultationFee.currency || "INR";
      }

      const doctor = await Doctor.create(doctorData);
      console.log("✅ Doctor added successfully:", doctor.name);
      res.redirect("/admin/doctors");
    } catch (err) {
      console.log("❌ Add doctor error:", err);
      res.status(500).send("Error adding doctor: " + err.message);
    }
  },
);

// Admin: Edit doctor
app.get("/admin/doctors/edit/:id", authenticate, isAdmin, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).send("Doctor not found");
    }
    res.render("admin/doctor-form.ejs", { doctor, action: "edit" });
  } catch (err) {
    console.log("Edit doctor error:", err);
    res.status(500).send("Error loading doctor");
  }
});

app.post(
  "/admin/doctors/edit/:id",
  authenticate,
  isAdmin,
  uploadDoctor.single("image"),
  handleUploadError,
  async (req, res) => {
    // Handle upload errors
    if (req.fileValidationError) {
      req.flash("error", req.fileValidationError);
      const doctor = await Doctor.findById(req.params.id);
      return res.render("admin/doctor-form.ejs", { doctor, action: "edit" });
    }

    try {
      const doctorData = req.body;

      // Handle image upload to Cloudinary - only update if new file uploaded
      if (req.file) {
        doctorData.image = req.file.secure_url || req.file.path;
        console.log("✅ Doctor image updated in Cloudinary:", doctorData.image);
      } else {
        // Remove image from update data if no new file uploaded (keep existing)
        delete doctorData.image;
        console.log("ℹ️ No new image uploaded, keeping existing image");
      }

      // Parse arrays from form data
      if (typeof doctorData.specializations === "string") {
        doctorData.specializations = [doctorData.specializations].filter((s) =>
          s.trim(),
        );
      }
      if (typeof doctorData.languages === "string") {
        doctorData.languages = [doctorData.languages].filter((l) => l.trim());
      }
      if (typeof doctorData.consultationModes === "string") {
        doctorData.consultationModes = [doctorData.consultationModes].filter(
          (m) => m.trim(),
        );
      }

      // Normalize boolean fields
      doctorData.isActive =
        doctorData.isActive === "on" ||
        doctorData.isActive === "true" ||
        doctorData.isActive === true;
      doctorData.featured =
        doctorData.featured === "on" ||
        doctorData.featured === "true" ||
        doctorData.featured === true;

      // Normalize consultation fee values
      if (doctorData.consultationFee) {
        doctorData.consultationFee.firstVisit = Number(
          doctorData.consultationFee.firstVisit || 0,
        );
        doctorData.consultationFee.followUp = Number(
          doctorData.consultationFee.followUp || 0,
        );
        doctorData.consultationFee.isFreeFirstVisit =
          doctorData.consultationFee.isFreeFirstVisit === "on" ||
          doctorData.consultationFee.isFreeFirstVisit === "true";
        doctorData.consultationFee.currency =
          doctorData.consultationFee.currency || "INR";
      }

      await Doctor.findByIdAndUpdate(req.params.id, doctorData, {
        new: true,
        runValidators: true,
      });
      console.log("✅ Doctor updated successfully");
      res.redirect("/admin/doctors");
    } catch (err) {
      console.log("❌ Update doctor error:", err);
      res.status(500).send("Error updating doctor: " + err.message);
    }
  },
);

// Admin: Delete doctor
app.post(
  "/admin/doctors/delete/:id",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      await Doctor.findByIdAndDelete(req.params.id);
      res.redirect("/admin/doctors");
    } catch (err) {
      console.log("Delete doctor error:", err);
      res.status(500).send("Error deleting doctor");
    }
  },
);

// Admin: View all appointments
app.get("/admin/appointments", authenticate, isAdmin, async (req, res) => {
  try {
    const appointments = await Appointment.find({})
      .sort({ appointmentDate: -1, appointmentTime: -1 })
      .populate("doctor", "name title")
      .populate("patient", "name email phone");
    res.render("admin/appointments.ejs", { appointments });
  } catch (err) {
    console.log("Admin appointments error:", err);
    res.status(500).send("Error loading appointments");
  }
});

// Admin: Update appointment status
app.post(
  "/admin/appointment/:id/status",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const { status, notes } = req.body;
      const appointment = await Appointment.findById(req.params.id);

      if (!appointment) {
        return res.status(404).send("Appointment not found");
      }

      if (status === "Confirmed") {
        await appointment.confirm();
      } else if (status === "Completed") {
        await appointment.complete(notes || "", "");
      }

      res.redirect("/admin/appointments");
    } catch (err) {
      console.log("Update appointment status error:", err);
      res.status(500).send("Error updating appointment");
    }
  },
);

app.get("/admin/products/new", authenticate, isAdmin, (req, res) => {
  res.render("forms/product.ejs");
});

app.post("/admin/products/new", authenticate, isAdmin, uploadProduct.single("image"), handleUploadError, async (req, res) => {
  console.log("\n=== ADD PRODUCT ROUTE HIT ===");
  console.log("Request body:", req.body);
  console.log("Request file:", req.file);
  console.log("User:", req.user?.email, "Role:", req.user?.role);
  console.log("=============================\n");

  // Handle upload errors
  if (req.fileValidationError) {
    req.flash("error", req.fileValidationError);
    return res.render("forms/product.ejs");
  }

  try {
    const productData = req.body;

    // Handle image upload to Cloudinary
    if (req.file) {
      productData.image = req.file.secure_url || req.file.path;
      console.log("✅ Product image uploaded to Cloudinary:", productData.image);
    } else {
      console.log("⚠️ No image file uploaded");
      req.flash("error", "Product image is required");
      return res.render("forms/product.ejs");
    }

    const newProduct = new Product(productData);
    await newProduct.save();
    console.log("✅ Product added:", newProduct.name);
    req.flash("success", "Product added successfully!");
    res.redirect("/admin/home");
  } catch (err) {
    console.log("❌ Error adding product:", err);
    req.flash("error", "Error adding product: " + err.message);
    res.render("forms/product.ejs");
  }
});

app.post(
  "/admin/products/delete/:id",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const product = await Product.findByIdAndDelete(req.params.id);
      if (!product) {
        req.flash("error", "Product not found");
      } else {
        req.flash("success", "Product deleted successfully!");
      }
      res.redirect("/admin/home");
    } catch (err) {
      console.log(err);
      req.flash("error", "Error deleting product: " + err.message);
      res.redirect("/admin/home");
    }
  },
);

app.post(
  "/user/add-to-cart/:productId",
  authenticateVerifiedAPI,
  isUser,
  async (req, res) => {
    try {
      const quantity = parseInt(req.body.quantity) || 1;
      const userId = req.user._id;
      const productId = req.params.productId;

      // 🔎 Find product
      const product = await Product.findById(productId);

      if (!product) {
        return res.status(404).send("Product not found");
      }

      // 🚫 Stock validation
      if (quantity > product.stock) {
        return res.status(400).send("Not enough stock available");
      }

      // 🔎 Find cart
      let cart = await Cart.findOne({ user: userId });

      // 🆕 If no cart exists, create one
      if (!cart) {
        cart = new Cart({
          user: userId,
        });
      }

      // 🧠 Check existing item for stock overflow
      const existingItem = cart.items.find(
        (item) => item.product.toString() === productId,
      );

      if (existingItem && existingItem.quantity + quantity > product.stock) {
        return res.status(400).send("Stock limit exceeded");
      }

      // 🔥 Use schema method
      cart.addItem(product._id, quantity, product.price);

      // 🔥 totalAmount auto-calculated in pre("save")
      await cart.save();

      // Calculate counts
      const cartCount = cart.items.reduce(
        (total, item) => total + item.quantity,
        0,
      );
      const cartItemCount = cart.items.length;

      // Get wishlist count
      let wishlistCount = 0;
      const wishlist = await Wishlist.findOne({ user: userId });
      if (wishlist) {
        wishlistCount = wishlist.items.length;
      }

      res.json({
        success: true,
        message: "Added to cart",
        cartCount,
        cartItemCount,
        wishlistCount,
      });
    } catch (err) {
      console.log(err);
      res.status(500).send("Error adding to cart");
    }
  },
);

app.get("/user/cart", authenticateVerified, isUser, async (req, res) => {
  console.log("\n=== CART ROUTE HIT ===");
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
    );

    // Calculate totals
    let totalItems = 0;
    let mrpTotal = 0; // Total at MRP (old price)
    let sellingPrice = 0; // Total at selling price (current price)
    let productDiscount = 0; // Discount from MRP
    let gst = 0;
    let delivery = 0;

    if (cart && cart.items.length > 0) {
      cart.items.forEach((item) => {
        totalItems += item.quantity;

        // Get prices - ensure they are numbers
        const currentPrice = parseFloat(item.product.price) || 0;
        const oldPrice = parseFloat(item.product.oldPrice) || currentPrice;

        // MRP total (use oldPrice if it exists and is different from current price)
        const mrp =
          item.product.oldPrice && item.product.oldPrice > currentPrice
            ? oldPrice
            : currentPrice;
        mrpTotal += mrp * item.quantity;

        // Selling price total
        sellingPrice += currentPrice * item.quantity;

        // Product discount (difference between MRP and selling price)
        productDiscount += (mrp - currentPrice) * item.quantity;
      });

      // GST is 5% on selling price (after product discount)
      gst = sellingPrice * 0.05;

      // Ensure minimum GST of ₹1 if selling price > 0
      if (sellingPrice > 0 && gst < 1) {
        gst = Math.max(1, Math.round(gst));
      }
    }

    console.log("Cart:", cart);
    console.log("Total items:", totalItems);
    console.log("MRP Total:", mrpTotal);
    console.log("Selling Price:", sellingPrice);
    console.log("Product Discount:", productDiscount);
    console.log("GST:", gst);
    console.log("Delivery:", delivery);

    // CRITICAL: Ensure discount never exceeds selling price (prevent negative total)
    if (productDiscount > sellingPrice) {
      console.log(
        "⚠️ WARNING: Discount exceeded selling price, capping discount",
      );
      productDiscount = sellingPrice;
    }

    // Ensure values are not negative
    mrpTotal = Math.max(0, mrpTotal);
    sellingPrice = Math.max(0, sellingPrice);
    productDiscount = Math.max(0, productDiscount);
    gst = Math.max(0, gst);

    // Total payable = selling price + GST + delivery
    const totalPayable = sellingPrice + gst + delivery;

    console.log("Total Payable:", totalPayable);

    res.render("pages/cart", {
      cart,
      totalItems,
      mrpTotal,
      sellingPrice,
      productDiscount,
      gst,
      delivery,
      total: totalPayable,
    });
  } catch (err) {
    console.log("Cart error:", err);
    res.status(500).send("Error loading cart");
  }
});

// Cart edit quantity - redirect to cart page (quantity editing handled via AJAX on cart page)
app.get(
  "/cart/edit-quantity/:productId",
  authenticateVerified,
  isUser,
  (req, res) => {
    res.redirect("/user/cart");
  },
);

app.post(
  "/cart/remove/:productId",
  authenticateVerified,
  isUser,
  async (req, res) => {
    try {
      const cart = await Cart.findOne({ user: req.user._id });

      if (!cart) {
        return res.json({ success: false });
      }

      console.log("Product to remove:", req.params.productId);
      console.log(
        "Cart before:",
        cart.items.map((i) => i.product.toString()),
      );

      cart.items = cart.items.filter(
        (item) => item.product.toString() !== req.params.productId,
      );

      console.log(
        "Cart after:",
        cart.items.map((i) => i.product.toString()),
      );

      await cart.save();

      // Calculate counts
      const cartCount = cart.items.reduce(
        (total, item) => total + item.quantity,
        0,
      );
      const cartItemCount = cart.items.length;

      // Get wishlist count
      let wishlistCount = 0;
      const wishlist = await Wishlist.findOne({ user: req.user._id });
      if (wishlist) {
        wishlistCount = wishlist.items.length;
      }

      return res.json({
        success: true,
        cartCount,
        cartItemCount,
        wishlistCount,
      });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ success: false });
    }
  },
);

app.post(
  "/user/edit-quantity/:productId",
  authenticate,
  isUser,
  async (req, res) => {
    try {
      const { quantity } = req.body;

      if (!quantity || quantity < 1) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid quantity" });
      }

      const cart = await Cart.findOne({ user: req.user._id }).populate(
        "items.product",
      );

      if (!cart) {
        return res
          .status(404)
          .json({ success: false, message: "Cart not found" });
      }

      const item = cart.items.find(
        (item) =>
          item.product && item.product._id.toString() === req.params.productId,
      );

      if (!item) {
        return res
          .status(404)
          .json({ success: false, message: "Item not found in cart" });
      }

      // Check stock availability
      if (quantity > item.product.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${item.product.stock} items available in stock`,
        });
      }

      item.quantity = parseInt(quantity);
      await cart.save();

      // Recalculate cart totals with populated data
      let totalItems = 0;
      let mrpTotal = 0; // Total at MRP (old price)
      let sellingPrice = 0; // Total at selling price (current price)
      let productDiscount = 0; // Discount from MRP

      cart.items.forEach((cartItem) => {
        if (cartItem.product) {
          totalItems += cartItem.quantity;

          // Get prices - ensure they are numbers
          const currentPrice = parseFloat(cartItem.product.price) || 0;
          const oldPrice =
            parseFloat(cartItem.product.oldPrice) || currentPrice;

          // MRP total
          const mrp =
            cartItem.product.oldPrice &&
            cartItem.product.oldPrice > currentPrice
              ? oldPrice
              : currentPrice;
          mrpTotal += mrp * cartItem.quantity;

          // Selling price total
          sellingPrice += currentPrice * cartItem.quantity;

          // Product discount
          productDiscount += (mrp - currentPrice) * cartItem.quantity;
        }
      });

      // GST is 5% on selling price
      let gst = sellingPrice * 0.05;

      // Ensure minimum GST of ₹1 if selling price > 0
      if (sellingPrice > 0 && gst < 1) {
        gst = Math.max(1, Math.round(gst));
      }

      // CRITICAL: Ensure discount never exceeds selling price (prevent negative total)
      if (productDiscount > sellingPrice) {
        console.log(
          "⚠️ WARNING: Discount exceeded selling price in quantity update, capping discount",
        );
        productDiscount = sellingPrice;
      }

      // Ensure values are not negative
      mrpTotal = Math.max(0, mrpTotal);
      sellingPrice = Math.max(0, sellingPrice);
      productDiscount = Math.max(0, productDiscount);
      gst = Math.max(0, gst);

      // Total payable = selling price + GST
      const total = sellingPrice + gst;

      // Get wishlist count
      let wishlistCount = 0;
      const wishlist = await Wishlist.findOne({ user: req.user._id });
      if (wishlist) {
        wishlistCount = wishlist.items.length;
      }

      console.log("Quantity updated - totals:", {
        totalItems,
        mrpTotal,
        sellingPrice,
        productDiscount,
        gst,
        total,
      });

      res.json({
        success: true,
        message: "Quantity updated",
        cartCount: totalItems,
        cartItemCount: cart.items.length,
        wishlistCount,
        mrpTotal,
        sellingPrice,
        productDiscount,
        gst,
        total,
        itemQuantity: item.quantity,
      });
    } catch (err) {
      console.log("Edit quantity error:", err);
      res
        .status(500)
        .json({ success: false, message: "Error updating quantity" });
    }
  },
);

app.get("/checkout", authenticateVerified, isUser, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
    );

    if (!cart || cart.items.length === 0) {
      return res.redirect("/user/cart");
    }

    let total = 0;

    cart.items.forEach((item) => {
      total += item.product.price * item.quantity;
    });

    res.render("checkout/checkout", { cart, total });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error loading checkout");
  }
});

app.post("/checkout", authenticateVerified, isUser, async (req, res) => {
  console.log("📦 Checkout request received");
  console.log("👤 User:", req.user._id, req.user.email);
  console.log("📝 Body:", JSON.stringify(req.body, null, 2));

  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      state,
      pincode,
      landmark,
      payment,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = req.body;

    console.log("🛒 Fetching cart...");
    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
    );

    if (!cart || cart.items.length === 0) {
      console.log("⚠️ Cart is empty");
      return res.redirect("/user/cart");
    }

    console.log("✅ Cart found with", cart.items.length, "items");

    // Build order items
    const orderItems = cart.items.map((item) => ({
      product: item.product._id,
      name: item.product.name,
      image: item.product.image,
      price: item.product.price,
      quantity: item.quantity,
      subtotal: item.product.price * item.quantity,
    }));

    // Calculate totals
    const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const gst = subtotal * 0.05; // 5% GST

    // CRITICAL: Ensure total is never negative
    const total = Math.max(0, subtotal + gst);

    // Determine payment method and status
    let paymentMethod = payment || "cod";
    let paymentStatus = "pending";

    // If Razorpay payment details are present, use them
    if (razorpay_payment_id) {
      paymentMethod = "razorpay";
      paymentStatus = "paid";
    } else if (payment === "cod") {
      paymentMethod = "cod";
      paymentStatus = "pending";
    } else if (["phonepe", "googlepay", "razorpay"].includes(payment)) {
      // These are processed through Razorpay but form submits later
      paymentMethod = "razorpay";
      paymentStatus = "pending"; // Will be updated after payment
    }

    // Create order
    const order = new Order({
      user: req.user._id,
      items: orderItems,
      address: {
        fullName: `${firstName} ${lastName}`,
        email,
        phone,
        address,
        city,
        state,
        pincode,
        landmark,
      },
      payment: {
        method: paymentMethod,
        status: paymentStatus,
        transactionId: razorpay_payment_id || null,
        razorpayOrderId: razorpay_order_id || null,
        razorpaySignature: razorpay_signature || null,
      },
      pricing: {
        subtotal,
        gst,
        total,
      },
      status: "confirmed",
    });

    // Reduce stock
    for (let item of cart.items) {
      if (item.product.stock < item.quantity) {
        // Restore any already reduced stock
        for (let checkedItem of cart.items) {
          if (checkedItem.product._id !== item.product._id) {
            await Product.findByIdAndUpdate(checkedItem.product._id, {
              $inc: { stock: checkedItem.quantity },
            });
          }
        }
        return res
          .status(400)
          .send(
            `Not enough stock for ${item.product.name}. Only ${item.product.stock} items available.`,
          );
      }

      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: -item.quantity },
      });
    }

    // Save order and clear cart
    await order.save();
    cart.items = [];
    await cart.save();

    console.log("✅ Order created:", order.tracking.orderId);

    // Award loyalty points (non-blocking)
    Promise.resolve().then(async () => {
      try {
        let loyaltyPoint = await LoyaltyPoint.findOne({ user: req.user._id });

        if (!loyaltyPoint) {
          loyaltyPoint = await LoyaltyPoint.create({
            user: req.user._id,
            points: 0,
            lifetimePoints: 0,
            tier: "bronze",
          });
        }

        const benefits = LoyaltyPoint.getTierBenefits(loyaltyPoint.tier);
        const basePoints = Math.floor(total / 100); // 1 point per ₹100
        const bonusPoints = Math.floor((basePoints * benefits.cashback) / 100);
        const totalPoints = basePoints + bonusPoints;

        if (totalPoints > 0) {
          await loyaltyPoint.addPoints(
            totalPoints,
            `Order #${order.tracking.orderId} - ₹${total.toFixed(2)}`,
            order._id,
          );
          console.log(
            `✅ Awarded ${totalPoints} loyalty points (${basePoints} base + ${bonusPoints} bonus)`,
          );
        }
      } catch (loyaltyErr) {
        console.log("⚠️ Loyalty points award failed:", loyaltyErr.message);
      }
    });

    // Send order confirmation notifications (non-blocking to prevent timeout)
    Promise.allSettled([
      sendOrderConfirmation(order, req.user).catch(emailErr => {
        console.log("⚠️ Email notification failed:", emailErr.message);
      }),
      sendOrderConfirmationSMS(order, order.address.phone).catch(smsErr => {
        console.log("⚠️ SMS notification failed:", smsErr.message);
      })
    ]).then(results => {
      console.log("📧 Order confirmation notifications sent");
    });

    // Auto-assign delivery agent based on distance and availability (non-blocking)
    Promise.resolve().then(async () => {
      try {
        console.log("🚀 Starting auto-assignment for order:", order.tracking.orderId);
        
        // Find available agents
        const availableAgents = await DeliveryAgent.find({
          isActive: true,
          isAvailable: true,
          currentStatus: { $in: ["idle", "on_delivery"] }
        }).sort({ name: 1 });

        if (availableAgents.length === 0) {
          console.log("⚠️ No available agents found for auto-assignment");
          return;
        }

        // Score agents based on distance and workload
        const STORE_LOCATION = {
          latitude: parseFloat(process.env.STORE_LATITUDE || 26.9124),
          longitude: parseFloat(process.env.STORE_LONGITUDE || 75.7873)
        };

        const calculateDistance = (lat1, lon1, lat2, lon2) => {
          const R = 6371;
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          return R * c;
        };

        const scoredAgents = availableAgents.map(agent => {
          let score = 100;
          
          // Distance score (closer is better) - Max 40 points
          const agentLat = agent.currentLocation?.latitude || STORE_LOCATION.latitude;
          const agentLon = agent.currentLocation?.longitude || STORE_LOCATION.longitude;
          const distance = calculateDistance(STORE_LOCATION.latitude, STORE_LOCATION.longitude, agentLat, agentLon);
          score += Math.max(0, 40 - (distance * 2));

          // Workload score (lower is better) - Max 30 points
          const workloadFactor = 1 - (agent.currentDeliveries / agent.maxConcurrentDeliveries);
          score += workloadFactor * 30;

          // Rating score - Max 20 points
          score += agent.stats.averageRating * 4;

          // On-time delivery rate - Max 10 points
          score += agent.stats.onTimeDeliveryRate * 0.1;

          // Idle status bonus - 15 points
          if (agent.currentStatus === "idle") {
            score += 15;
          }

          return { agent, score };
        });

        // Sort by score and pick best
        scoredAgents.sort((a, b) => b.score - a.score);
        const bestAgent = scoredAgents[0].agent;

        console.log(`✅ Best agent for auto-assignment: ${bestAgent.name} (score: ${scoredAgents[0].score.toFixed(1)})`);

        // Generate OTP for delivery
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date();
        otpExpiry.setHours(otpExpiry.getHours() + 24);

        // Update order with delivery agent and OTP
        order.deliveryAgent = bestAgent._id;
        order.status = "assigned";
        order.deliveryOTP = {
          code: otp,
          expiresAt: otpExpiry,
          generatedAt: new Date()
        };
        await order.save();

        // Update agent's assigned orders
        await DeliveryAgent.findByIdAndUpdate(bestAgent._id, {
          $push: { assignedOrders: order._id },
          $inc: { currentDeliveries: 1 },
          currentStatus: "on_delivery"
        });

        console.log(`✅ Order ${order.tracking.orderId} auto-assigned to ${bestAgent.name}`);
      } catch (assignErr) {
        console.log("⚠️ Auto-assignment failed:", assignErr.message);
      }
    });

    console.log("🎉 Redirecting to success page...");
    res.redirect("/user/order-success/" + order._id);
    console.log("✅ Redirect successful");
  } catch (err) {
    console.log("❌ Order error:", err);
    console.log("❌ Error stack:", err.stack);
    console.log("❌ Error name:", err.name);
    console.log("❌ Error message:", err.message);

    // Check if it's a stock error
    if (err.message && err.message.includes("Not enough stock")) {
      // Redirect back to cart with error
      try {
        req.flash("error", err.message);
      } catch (flashErr) {
        console.log("Flash error:", flashErr);
      }
      return res.redirect("/user/cart");
    }

    // For other errors, render an error page or redirect
    console.log("⚠️ Unexpected error, redirecting to cart");
    return res.redirect("/user/cart");
  }
});

// ================== ORDER SUCCESS PAGE ==================
app.get(
  "/user/order-success/:orderId",
  authenticate,
  isUser,
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.orderId).populate(
        "items.product",
      );

      if (!order || order.user.toString() !== req.user._id.toString()) {
        return res.redirect("/user/orders");
      }

      // Get cart count
      let cartCount = 0;
      const cart = await Cart.findOne({ user: req.user._id });
      if (cart) {
        cartCount = cart.items.reduce(
          (total, item) => total + item.quantity,
          0,
        );
      }

      // Get wishlist count
      let wishCount = 0;
      const wishlist = await Wishlist.findOne({ user: req.user._id });
      if (wishlist) {
        wishCount = wishlist.items.length;
      }

      res.render("user/order-success", {
        order,
        user: req.user,
        cartCount,
        wishCount,
      });
    } catch (err) {
      console.log(err);
      res.redirect("/user/orders");
    }
  },
);

// ================== ORDER ROUTES ==================
app.get("/user/orders", authenticateVerified, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate("items.product");

    res.render("user/orders", { orders });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error loading orders");
  }
});

app.get("/user/orders/:orderId", authenticateVerified, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user._id,
    })
      .populate("items.product")
      .populate(
        "deliveryAgent",
        "name phone vehicleType vehicleNumber profileImage",
      );

    if (!order) {
      return res.status(404).send("Order not found");
    }

    // Get cart count
    let cartCount = 0;
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      cartCount = cart.items.reduce((total, item) => total + item.quantity, 0);
    }

    // Get wishlist count
    let wishCount = 0;
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    if (wishlist) {
      wishCount = wishlist.items.length;
    }

    res.render("user/order-detail", {
      order,
      user: req.user,
      cartCount,
      wishCount,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error loading order");
  }
});

// Download Invoice
app.get(
  "/user/orders/:orderId/invoice",
  authenticateVerified,
  async (req, res) => {
    try {
      const InvoiceGenerator = require("./services/invoiceService");

      const order = await Order.findOne({
        _id: req.params.orderId,
        user: req.user._id,
      }).populate("items.product");

      if (!order) {
        return res.status(404).send("Order not found");
      }

      // Generate invoice
      const invoiceResult = await InvoiceGenerator.generateInvoice(
        order,
        req.user,
        [],
      );

      if (invoiceResult.success) {
        // Download the invoice
        await InvoiceGenerator.downloadInvoice(
          res,
          invoiceResult.filePath,
          invoiceResult.fileName,
        );
      } else {
        res.status(500).send("Failed to generate invoice");
      }
    } catch (err) {
      console.log("Invoice error:", err);
      res.status(500).send("Error generating invoice");
    }
  },
);

app.post(
  "/user/orders/:orderId/cancel",
  authenticateVerified,
  async (req, res) => {
    try {
      const order = await Order.findOne({
        _id: req.params.orderId,
        user: req.user._id,
      });

      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }

      if (order.status === "delivered" || order.status === "cancelled") {
        return res
          .status(400)
          .json({ success: false, message: "Cannot cancel this order" });
      }

      await order.updateStatus(
        "cancelled",
        req.body.reason || "Customer requested",
      );
      res.json({ success: true, message: "Order cancelled successfully" });
    } catch (err) {
      console.log(err);
      res
        .status(500)
        .json({ success: false, message: "Error cancelling order" });
    }
  },
);

// ================== PRODUCT REVIEWS ==================
// Submit product review
app.post(
  "/api/products/:productId/review",
  authenticateVerified,
  async (req, res) => {
    try {
      const { rating, title, comment, images } = req.body;
      const productId = req.params.productId;
      const userId = req.user._id;

      // Validate input
      if (!rating || rating < 1 || rating > 5) {
        return res
          .status(400)
          .json({ success: false, message: "Rating must be between 1 and 5" });
      }

      if (!title || title.trim().length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Review title is required" });
      }

      if (!comment || comment.trim().length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "Review comment is required" });
      }

      // Check if user already reviewed this product
      const existingReview = await Review.findOne({
        product: productId,
        user: userId,
      });
      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: "You have already reviewed this product",
        });
      }

      // Check if user purchased this product (optional - for verified reviews)
      const order = await Order.findOne({
        user: userId,
        "items.product": productId,
        status: "delivered",
      });

      // Create review
      const review = await Review.create({
        product: productId,
        user: userId,
        rating: parseInt(rating),
        title: title.trim(),
        comment: comment.trim(),
        images: images || [],
        verified: !!order, // Verified purchase if order exists
      });

      // Update product average rating
      const Product = require("./models/product");
      const reviews = await Review.find({ product: productId });
      const averageRating =
        reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      const numReviews = reviews.length;

      await Product.findByIdAndUpdate(productId, {
        averageRating: Math.round(averageRating * 10) / 10,
        numReviews: numReviews,
      });

      res.json({
        success: true,
        message: "Review submitted successfully!",
        review: {
          ...review.toObject(),
          user: { name: req.user.name },
        },
      });
    } catch (err) {
      console.log("Review submission error:", err);
      res
        .status(500)
        .json({ success: false, message: "Error submitting review" });
    }
  },
);

// Get product reviews
app.get("/api/products/:productId/reviews", async (req, res) => {
  try {
    const productId = req.params.productId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ product: productId })
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments({ product: productId });

    res.json({
      success: true,
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.log("Get reviews error:", err);
    res.status(500).json({ success: false, message: "Error fetching reviews" });
  }
});

// Mark review as helpful
app.post(
  "/api/reviews/:reviewId/helpful",
  authenticateVerified,
  async (req, res) => {
    try {
      const review = await Review.findById(req.params.reviewId);

      if (!review) {
        return res
          .status(404)
          .json({ success: false, message: "Review not found" });
      }

      // Check if user already marked as helpful
      if (review.helpful.includes(req.user._id)) {
        return res
          .status(400)
          .json({ success: false, message: "Already marked as helpful" });
      }

      review.helpful.push(req.user._id);
      await review.save();

      res.json({
        success: true,
        message: "Review marked as helpful",
        helpfulCount: review.helpful.length,
      });
    } catch (err) {
      console.log("Mark helpful error:", err);
      res
        .status(500)
        .json({ success: false, message: "Error marking review as helpful" });
    }
  },
);

// ================== RETURNS & REFUNDS ==================
// Request return/refund
app.post(
  "/api/orders/:orderId/return",
  authenticateVerified,
  async (req, res) => {
    try {
      const { productId, quantity, reason, description, refundMethod } =
        req.body;
      const orderId = req.params.orderId;
      const userId = req.user._id;

      // Find order
      const order = await Order.findOne({ _id: orderId, user: userId });
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }

      // Check if order is delivered
      if (order.status !== "delivered") {
        return res.status(400).json({
          success: false,
          message: "Can only return delivered orders",
        });
      }

      // Check if within return window (7 days)
      const returnWindow = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
      if (Date.now() - order.createdAt.getTime() > returnWindow) {
        return res.status(400).json({
          success: false,
          message: "Return window expired (7 days from delivery)",
        });
      }

      // Find product in order
      const orderItem = order.items.find(
        (item) => item.product._id.toString() === productId,
      );
      if (!orderItem) {
        return res
          .status(404)
          .json({ success: false, message: "Product not found in order" });
      }

      // Check if already returned
      const existingReturn = await Return.findOne({
        order: orderId,
        product: productId,
        user: userId,
      });
      if (existingReturn) {
        return res.status(400).json({
          success: false,
          message: "Return already requested for this product",
        });
      }

      // Create return request
      const returnRequest = await Return.create({
        order: orderId,
        user: userId,
        product: productId,
        quantity: quantity || 1,
        reason,
        description,
        refundMethod: refundMethod || "original_payment",
        refundAmount: orderItem.price * (quantity || 1),
        pickupAddress: order.address,
      });

      // Update order status
      order.items.find(
        (item) => item.product._id.toString() === productId,
      ).returnStatus = "return_requested";
      await order.save();

      res.json({
        success: true,
        message: "Return request submitted successfully",
        returnRequest,
      });
    } catch (err) {
      console.log("Return request error:", err);
      res
        .status(500)
        .json({ success: false, message: "Error submitting return request" });
    }
  },
);

// Get user's return requests
app.get("/api/returns", authenticateVerified, async (req, res) => {
  try {
    const returns = await Return.find({ user: req.user._id })
      .populate("order", "tracking.orderId createdAt")
      .populate("product", "name image price")
      .sort({ createdAt: -1 });

    res.json({ success: true, returns });
  } catch (err) {
    console.log("Get returns error:", err);
    res.status(500).json({ success: false, message: "Error fetching returns" });
  }
});

// Cancel return request
app.patch(
  "/api/returns/:returnId/cancel",
  authenticateVerified,
  async (req, res) => {
    try {
      const returnRequest = await Return.findOne({
        _id: req.params.returnId,
        user: req.user._id,
      });

      if (!returnRequest) {
        return res
          .status(404)
          .json({ success: false, message: "Return request not found" });
      }

      if (returnRequest.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "Cannot cancel return after approval",
        });
      }

      returnRequest.status = "cancelled";
      await returnRequest.save();

      res.json({ success: true, message: "Return request cancelled" });
    } catch (err) {
      console.log("Cancel return error:", err);
      res
        .status(500)
        .json({ success: false, message: "Error cancelling return" });
    }
  },
);

// ================== ADDRESS MANAGEMENT ==================
// Get all addresses
app.get("/api/addresses", authenticateVerified, async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.user._id }).sort({
      isDefault: -1,
      createdAt: -1,
    });
    res.json({ success: true, addresses });
  } catch (err) {
    console.log("Get addresses error:", err);
    res
      .status(500)
      .json({ success: false, message: "Error fetching addresses" });
  }
});

// Add new address
app.post("/api/addresses", authenticateVerified, async (req, res) => {
  try {
    const {
      type,
      label,
      name,
      phone,
      fullAddress,
      landmark,
      city,
      state,
      pincode,
      isDefault,
    } = req.body;

    const address = await Address.create({
      user: req.user._id,
      type: type || "home",
      label: label || "Home",
      name,
      phone,
      fullAddress,
      landmark,
      city,
      state,
      pincode,
      isDefault: isDefault || false,
    });

    res.json({ success: true, message: "Address added successfully", address });
  } catch (err) {
    console.log("Add address error:", err);
    res.status(500).json({ success: false, message: "Error adding address" });
  }
});

// Update address
app.put("/api/addresses/:addressId", authenticateVerified, async (req, res) => {
  try {
    const address = await Address.findOneAndUpdate(
      { _id: req.params.addressId, user: req.user._id },
      req.body,
      { new: true, runValidators: true },
    );

    if (!address) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found" });
    }

    res.json({
      success: true,
      message: "Address updated successfully",
      address,
    });
  } catch (err) {
    console.log("Update address error:", err);
    res.status(500).json({ success: false, message: "Error updating address" });
  }
});

// Delete address
app.delete(
  "/api/addresses/:addressId",
  authenticateVerified,
  async (req, res) => {
    try {
      const address = await Address.findOneAndDelete({
        _id: req.params.addressId,
        user: req.user._id,
      });

      if (!address) {
        return res
          .status(404)
          .json({ success: false, message: "Address not found" });
      }

      res.json({ success: true, message: "Address deleted successfully" });
    } catch (err) {
      console.log("Delete address error:", err);
      res
        .status(500)
        .json({ success: false, message: "Error deleting address" });
    }
  },
);

// Set default address
app.patch(
  "/api/addresses/:addressId/default",
  authenticateVerified,
  async (req, res) => {
    try {
      const address = await Address.findOneAndUpdate(
        { _id: req.params.addressId, user: req.user._id },
        { isDefault: true },
        { new: true },
      );

      if (!address) {
        return res
          .status(404)
          .json({ success: false, message: "Address not found" });
      }

      res.json({ success: true, message: "Default address updated", address });
    } catch (err) {
      console.log("Set default error:", err);
      res
        .status(500)
        .json({ success: false, message: "Error setting default address" });
    }
  },
);

// ================== ABANDONED CART RECOVERY ==================
// Trigger abandoned cart email (for testing)
app.post(
  "/api/cart/send-recovery-email",
  authenticateVerified,
  async (req, res) => {
    try {
      const AbandonedCartService = require("./services/abandonedCartService");
      const cart = await Cart.findOne({ user: req.user._id }).populate(
        "user items.product",
      );

      if (!cart || cart.items.length === 0) {
        return res.json({ success: false, message: "No abandoned cart found" });
      }

      const result = await AbandonedCartService.sendRecoveryEmail(cart);
      res.json(result);
    } catch (err) {
      console.log("Send recovery email error:", err);
      res
        .status(500)
        .json({ success: false, message: "Error sending recovery email" });
    }
  },
);

// ================== PAYMENT WEBHOOKS ==================
// Razorpay Webhook
app.post("/api/webhooks/razorpay", async (req, res) => {
  try {
    const crypto = require("crypto");
    const signature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (expectedSignature !== signature) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }

    const event = req.body;
    console.log("Razorpay webhook received:", event.event);

    // Handle payment captured event
    if (event.event === "payment.captured") {
      const paymentId = event.payload.payment.entity.id;
      const orderId = event.payload.payment.entity.order_id;
      const amount = event.payload.payment.entity.amount / 100; // Convert paise to rupees

      // Update order payment status
      const order = await Order.findOne({ "razorpay.orderId": orderId });
      if (order) {
        order.paymentStatus = "paid";
        order.razorpay.paymentId = paymentId;
        await order.save();
        console.log(`✅ Payment captured for order: ${order.tracking.orderId}`);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.log("Razorpay webhook error:", err);
    res.status(500).json({ success: false, message: "Webhook error" });
  }
});

// Admin Order Routes
app.get("/admin/orders", authenticate, isAdmin, async (req, res) => {
  try {
    const orders = await Order.find({})
      .sort({ createdAt: -1 })
      .populate("user", "name email phone")
      .populate("items.product");

    res.render("admin/orders", { orders });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error loading orders");
  }
});

app.get("/admin/orders/:orderId", authenticate, isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate("user", "name email phone address")
      .populate("items.product")
      .populate(
        "deliveryAgent",
        "name phone vehicleType vehicleNumber profileImage",
      );

    if (!order) {
      return res.status(404).send("Order not found");
    }

    res.render("admin/order-detail", { order });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error loading order");
  }
});

app.post(
  "/admin/orders/:orderId/status",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.orderId);

      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }

      const oldStatus = order.status;
      await order.updateStatus(req.body.status, req.body.reason);

      // Send email notification if status changed
      if (
        oldStatus !== req.body.status &&
        [
          "confirmed",
          "processing",
          "shipped",
          "out_for_delivery",
          "delivered",
          "cancelled",
        ].includes(req.body.status)
      ) {
        const User = require("./models/user");
        const user = await User.findById(order.user);
        if (user) {
          sendOrderStatusUpdate(order, user, req.body.status);
        }
      }

      res.json({ success: true, message: "Order status updated" });
    } catch (err) {
      console.log(err);
      res
        .status(500)
        .json({ success: false, message: "Error updating order status" });
    }
  },
);

// ================== CANCELLATION REQUEST ROUTES ==================

// Create cancellation request
app.post("/api/cancellations", authenticateVerified, async (req, res) => {
  try {
    const { orderId, items, reason, description, pickupAddress } = req.body;

    // Validate order exists and belongs to user
    const order = await Order.findById(orderId).populate("items.product");
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this order",
      });
    }

    // Check if order can be cancelled
    if (["delivered", "cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled at this stage",
      });
    }

    // Check if cancellation request already exists
    const CancellationRequest = require("./models/cancellationRequest");
    const existingRequest = await CancellationRequest.findOne({
      order: orderId,
      status: {
        $in: [
          "pending",
          "approved",
          "assigned",
          "otp_generated",
          "pickup_scheduled",
          "picked_up",
          "verified",
        ],
      },
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "Cancellation request already exists for this order",
      });
    }

    // Calculate refund amount
    let refundAmount = 0;
    const selectedItems = [];

    for (const item of items) {
      const orderItem = order.items.find(
        (oi) => oi.product.toString() === item.productId,
      );
      if (orderItem && item.quantity <= orderItem.quantity) {
        const itemTotal = orderItem.price * item.quantity;
        refundAmount += itemTotal;
        selectedItems.push({
          product: item.productId,
          name: orderItem.name,
          image: orderItem.image,
          price: orderItem.price,
          quantity: item.quantity,
          subtotal: itemTotal,
        });
      }
    }

    // Create cancellation request
    const cancellationRequest = new CancellationRequest({
      order: orderId,
      user: req.user._id,
      items: selectedItems,
      reason,
      description,
      pickupAddress: {
        ...pickupAddress,
        fullName: order.address.fullName,
        phone: order.address.phone,
      },
      refundAmount,
    });

    await cancellationRequest.save();

    res.status(201).json({
      success: true,
      data: cancellationRequest,
      message: "Cancellation request submitted successfully",
    });
  } catch (error) {
    console.error("Create cancellation request error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating cancellation request",
    });
  }
});

// Get user cancellation requests
app.get("/api/cancellations", authenticateVerified, async (req, res) => {
  try {
    const CancellationRequest = require("./models/cancellationRequest");
    const requests = await CancellationRequest.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate("order", "tracking.orderId status")
      .populate("assignedAgent", "name phone")
      .populate("items.product");

    res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error("Get user cancellation requests error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cancellation requests",
    });
  }
});

// Get single cancellation request
app.get("/api/cancellations/:id", authenticateVerified, async (req, res) => {
  try {
    const CancellationRequest = require("./models/cancellationRequest");
    const request = await CancellationRequest.findById(req.params.id)
      .populate("order")
      .populate("user", "name email phone")
      .populate("assignedAgent", "name phone vehicleType vehicleNumber")
      .populate("items.product");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Cancellation request not found",
      });
    }

    // Check if user owns this request or is admin
    if (
      request.user._id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this request",
      });
    }

    res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("Get cancellation request error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cancellation request",
    });
  }
});

// Get all cancellation requests (Admin)
app.get(
  "/api/cancellations/admin/all",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      const CancellationRequest = require("./models/cancellationRequest");

      const filter = {};
      if (status) {
        filter.status = status;
      }

      const requests = await CancellationRequest.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate("order", "tracking.orderId status pricing.total")
        .populate("user", "name email phone")
        .populate("assignedAgent", "name phone")
        .populate("items.product");

      const total = await CancellationRequest.countDocuments(filter);

      res.json({
        success: true,
        data: requests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get all cancellation requests error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching cancellation requests",
      });
    }
  },
);

// Update cancellation request status (Admin)
app.put(
  "/api/cancellations/:id/status",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const { status, adminNotes, rejectionReason, assignedAgent } = req.body;
      const CancellationRequest = require("./models/cancellationRequest");

      const request = await CancellationRequest.findById(req.params.id)
        .populate("user", "name email phone")
        .populate("order");

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Cancellation request not found",
        });
      }

      const oldStatus = request.status;
      request.status = status;

      if (adminNotes) request.adminNotes = adminNotes;
      if (rejectionReason) request.rejectionReason = rejectionReason;
      if (assignedAgent) request.assignedAgent = assignedAgent;

      // If assigning agent, generate OTP
      if (status === "assigned" && assignedAgent) {
        const crypto = require("crypto");
        const otp = crypto.randomInt(100000, 999999).toString();
        request.cancellationOTP = {
          code: otp,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          generatedAt: new Date(),
        };
        request.status = "otp_generated";

        // If assigning agent, generate OTP
        if (status === "assigned" && assignedAgent) {
          const crypto = require("crypto");
          const otp = crypto.randomInt(100000, 999999).toString();
          request.cancellationOTP = {
            code: otp,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            generatedAt: new Date(),
          };
          request.status = "otp_generated";

          // Send OTP to assigned agent
          const { sendCancellationOTP } = require("./services/smsService");
          await sendCancellationOTP(
            request.assignedAgent,
            otp,
            request.trackingId,
          );
        }
      }

      await request.save();

      res.json({
        success: true,
        data: request,
        message: "Cancellation request updated successfully",
      });
    } catch (error) {
      console.error("Update cancellation status error:", error);
      res.status(500).json({
        success: false,
        message: "Error updating cancellation request",
      });
    }
  },
);

// Verify cancellation OTP and upload proof (Agent)
app.post(
  "/api/cancellations/:id/verify",
  authenticate,
  isDeliveryAgent,
  async (req, res) => {
    try {
      const { otp, pickupProof } = req.body;
      const CancellationRequest = require("./models/cancellationRequest");

      const request = await CancellationRequest.findById(
        req.params.id,
      ).populate("assignedAgent");

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Cancellation request not found",
        });
      }

      // Check if agent is assigned to this request
      if (request.assignedAgent._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Not authorized for this request",
        });
      }

      // Verify OTP
      if (
        !request.cancellationOTP.code ||
        request.cancellationOTP.code !== otp
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid OTP",
        });
      }

      // Check OTP expiry
      if (request.cancellationOTP.expiresAt < new Date()) {
        return res.status(400).json({
          success: false,
          message: "OTP has expired",
        });
      }

      // Update request
      request.cancellationOTP.verifiedAt = new Date();
      request.pickupProof = {
        image: pickupProof,
        uploadedAt: new Date(),
      };
      request.status = "picked_up";
      request.pickedUpAt = new Date();

      await request.save();

      res.json({
        success: true,
        data: request,
        message: "Pickup verified successfully",
      });
    } catch (error) {
      console.error("Verify cancellation pickup error:", error);
      res.status(500).json({
        success: false,
        message: "Error verifying pickup",
      });
    }
  },
);

// Process refund (Admin)
app.post(
  "/api/cancellations/:id/refund",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const CancellationRequest = require("./models/cancellationRequest");
      const request = await CancellationRequest.findById(req.params.id)
        .populate("order")
        .populate("user", "name email phone");

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Cancellation request not found",
        });
      }

      if (request.status !== "picked_up") {
        return res.status(400).json({
          success: false,
          message: "Request must be picked up before processing refund",
        });
      }

      // Process refund logic here (integrate with payment gateway)
      request.status = "refunded";
      request.refundedAt = new Date();

      // Update order status
      await Order.findByIdAndUpdate(request.order._id, {
        status: "cancelled",
        "tracking.cancelledAt": new Date(),
        "tracking.cancellationReason": request.reason,
      });

      await request.save();

      res.json({
        success: true,
        data: request,
        message: "Refund processed successfully",
      });
    } catch (error) {
      console.error("Process refund error:", error);
      res.status(500).json({
        success: false,
        message: "Error processing refund",
      });
    }
  },
);

// ================== ADMIN CANCELLATIONS ROUTES ==================
app.get("/admin/cancellations", authenticate, isAdmin, async (req, res) => {
  try {
    res.render("admin/cancellations");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error loading cancellations");
  }
});

app.get(
  "/admin/cancellations/:requestId",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const CancellationRequest = require("./models/cancellationRequest");
      const request = await CancellationRequest.findById(req.params.requestId)
        .populate("order")
        .populate("user", "name email phone")
        .populate("assignedAgent", "name phone vehicleType vehicleNumber")
        .populate("items.product");

      if (!request) {
        return res.status(404).send("Cancellation request not found");
      }

      res.render("admin/cancellation-detail", { request });
    } catch (err) {
      console.log(err);
      res.status(500).send("Error loading cancellation request");
    }
  },
);

// ================== REVIEW ROUTES ==================
app.get("/api/products/:productId/reviews", async (req, res) => {
  try {
    const reviews = await Review.getReviewsByProduct(req.params.productId, 20);
    res.json({ success: true, reviews });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Error loading reviews" });
  }
});

app.post("/api/products/:productId/review", authenticate, async (req, res) => {
  try {
    const { rating, title, comment, orderId } = req.body;

    // Check if user already reviewed
    const existing = await Review.findOne({
      product: req.params.productId,
      user: req.user._id,
    });

    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "You already reviewed this product" });
    }

    // Verify order
    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) {
      return res
        .status(400)
        .json({ success: false, message: "Order not found" });
    }

    const review = new Review({
      product: req.params.productId,
      user: req.user._id,
      order: orderId,
      rating,
      title,
      comment,
    });

    await review.save();

    // Update product rating
    const product = await Product.findById(req.params.productId);
    if (product) {
      await product.updateRatingStats();
    }

    res.json({ success: true, message: "Review submitted successfully" });
  } catch (err) {
    console.log(err);
    if (err.code === 11000) {
      res
        .status(400)
        .json({ success: false, message: "You already reviewed this product" });
    } else {
      res
        .status(500)
        .json({ success: false, message: "Error submitting review" });
    }
  }
});

app.post("/api/reviews/:reviewId/helpful", authenticate, async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    }

    await review.markHelpful(req.user._id);
    res.json({ success: true, helpful: review.helpful.length });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Error" });
  }
});

// Admin review routes
app.get("/admin/reviews", authenticate, isAdmin, async (req, res) => {
  try {
    const reviews = await Review.find({})
      .sort({ createdAt: -1 })
      .populate("product", "name")
      .populate("user", "name email");
    res.render("admin/reviews", { reviews });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error loading reviews");
  }
});

app.post(
  "/admin/reviews/:reviewId/reply",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const review = await Review.findById(req.params.reviewId);
      if (!review) {
        return res
          .status(404)
          .json({ success: false, message: "Review not found" });
      }

      await review.addAdminReply(req.body.comment, req.user._id);
      res.json({ success: true, message: "Reply added successfully" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ success: false, message: "Error adding reply" });
    }
  },
);

app.delete(
  "/admin/reviews/:reviewId",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      await Review.findByIdAndDelete(req.params.reviewId);
      res.json({ success: true, message: "Review deleted successfully" });
    } catch (err) {
      console.log(err);
      res
        .status(500)
        .json({ success: false, message: "Error deleting review" });
    }
  },
);

// ================== COUPON ROUTES ==================
// User: Validate coupon
app.post("/api/coupons/validate", authenticate, async (req, res) => {
  try {
    const { code, orderValue, categories, products } = req.body;

    const coupon = await Coupon.findByCode(code);

    if (!coupon) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid coupon code" });
    }

    if (!coupon.isValid()) {
      return res
        .status(400)
        .json({ success: false, message: "This coupon is no longer valid" });
    }

    if (!coupon.canUserUse(req.user._id)) {
      return res
        .status(400)
        .json({ success: false, message: "You have already used this coupon" });
    }

    const discount = coupon.calculateDiscount(
      orderValue,
      categories || [],
      products || [],
    );

    if (discount === 0) {
      return res.status(400).json({
        success: false,
        message: "Coupon not applicable for this order",
        minOrderValue: coupon.minOrderValue,
      });
    }

    res.json({
      success: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discount,
      },
    });
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ success: false, message: "Error validating coupon" });
  }
});

// Admin: Get all coupons
app.get("/admin/coupons", authenticate, isAdmin, async (req, res) => {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    res.render("admin/coupons", { coupons });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error loading coupons");
  }
});

// API: Get single coupon
app.get(
  "/api/admin/coupons/:couponId",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const coupon = await Coupon.findById(req.params.couponId);
      if (!coupon) {
        return res
          .status(404)
          .json({ success: false, message: "Coupon not found" });
      }
      res.json(coupon);
    } catch (err) {
      console.log(err);
      res
        .status(500)
        .json({ success: false, message: "Error fetching coupon" });
    }
  },
);

// ================== PRODUCT SEARCH & FILTER API ==================
app.get("/api/products/search", async (req, res) => {
  try {
    const {
      q, // search query
      category,
      minPrice,
      maxPrice,
      inStock,
      sortBy,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    // Search query
    if (q) {
      query.name = { $regex: q, $options: "i" };
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // In stock filter
    if (inStock === "true") {
      query.stock = { $gt: 0 };
    }

    // Sorting
    let sort = {};
    if (sortBy) {
      switch (sortBy) {
        case "price_asc":
          sort.price = 1;
          break;
        case "price_desc":
          sort.price = -1;
          break;
        case "name_asc":
          sort.name = 1;
          break;
        case "name_desc":
          sort.name = -1;
          break;
        case "rating":
          sort.averageRating = -1;
          break;
        case "newest":
          sort.createdAt = -1;
          break;
        default:
          sort.createdAt = -1;
      }
    } else {
      sort.createdAt = -1;
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
      filters: {
        categories: ["ayurvedic", "sashtri", "herbal-cosmetics", "fmcg"],
        priceRange: {
          min: minPrice || 0,
          max: maxPrice || 10000,
        },
      },
    });
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ success: false, message: "Error searching products" });
  }
});

// Get product by ID with reviews
app.get("/api/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const reviews = await Review.find({ product: product._id })
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      product,
      reviews,
      reviewCount: reviews.length,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Error fetching product" });
  }
});

// ================== RAZORPAY PAYMENT ROUTES ==================
// Create Razorpay order
app.post("/api/payment/create-order", authenticate, async (req, res) => {
  try {
    const { amount, orderId } = req.body;

    if (!amount || amount < 1) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid amount" });
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert to paise
      currency: "INR",
      receipt: `order_${orderId || Date.now()}`,
      notes: {
        userId: req.user._id.toString(),
      },
    });

    // Create payment record
    const payment = new Payment({
      user: req.user._id,
      order: orderId,
      razorpay: {
        orderId: razorpayOrder.id,
        status: "created",
      },
      amount,
    });

    await payment.save();

    res.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
      key: process.env.RAZORPAY_KEY_ID,
      paymentId: payment._id,
    });
  } catch (err) {
    console.log("Razorpay order creation error:", err);
    res.status(500).json({
      success: false,
      message: "Error creating payment order",
      error: err.message,
    });
  }
});

// Verify Razorpay payment
app.post("/api/payment/verify", authenticate, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentId,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment details",
      });
    }

    // Verify signature
    const crypto = require("crypto");
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    // Fetch payment details
    const payment = await Payment.findById(paymentId).populate("order");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    // Update payment status
    payment.razorpay.paymentId = razorpay_payment_id;
    payment.razorpay.signature = razorpay_signature;
    payment.razorpay.status = "paid";

    // Fetch payment details from Razorpay
    const razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id);
    payment.paymentMethod = razorpayPayment.method;
    payment.razorpayResponse = {
      entity: razorpayPayment.entity,
      amount: razorpayPayment.amount,
      currency: razorpayPayment.currency,
      status: razorpayPayment.status,
      method: razorpayPayment.method,
    };

    await payment.save();

    res.json({
      success: true,
      message: "Payment verified successfully",
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    });
  } catch (err) {
    console.log("Payment verification error:", err);
    res.status(500).json({
      success: false,
      message: "Error verifying payment",
      error: err.message,
    });
  }
});

// Payment failed route
app.post("/api/payment/failed", authenticate, async (req, res) => {
  try {
    const { paymentId, error } = req.body;

    if (paymentId) {
      await Payment.findByIdAndUpdate(paymentId, {
        "razorpay.status": "failed",
        failureReason: error?.description || "Payment failed",
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.log("Payment failure recording error:", err);
    res
      .status(500)
      .json({ success: false, message: "Error recording failure" });
  }
});

// Get payment status
app.get("/api/payment/status/:orderId", authenticate, async (req, res) => {
  try {
    const payment = await Payment.findOne({ order: req.params.orderId }).sort({
      createdAt: -1,
    });

    if (!payment) {
      return res.json({ success: true, hasPayment: false });
    }

    res.json({
      success: true,
      hasPayment: true,
      status: payment.razorpay.status,
      amount: payment.amount,
      paymentId: payment.razorpay.paymentId,
    });
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ success: false, message: "Error fetching payment status" });
  }
});

// Admin: View all payments
app.get("/admin/payments", authenticate, isAdmin, async (req, res) => {
  try {
    const payments = await Payment.find({})
      .sort({ createdAt: -1 })
      .populate("user", "name email")
      .populate("order");
    res.render("admin/payments", { payments });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error loading payments");
  }
});

// Admin: Create coupon
app.post("/admin/coupons", authenticate, isAdmin, async (req, res) => {
  try {
    const coupon = new Coupon(req.body);
    await coupon.save();
    res.redirect("/admin/coupons");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error creating coupon");
  }
});

// Admin: Update coupon
app.post(
  "/admin/coupons/:couponId",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      await Coupon.findByIdAndUpdate(req.params.couponId, req.body);
      res.redirect("/admin/coupons");
    } catch (err) {
      console.log(err);
      res.status(500).send("Error updating coupon");
    }
  },
);

// Admin: Delete coupon
app.delete(
  "/admin/coupons/:couponId",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      await Coupon.findByIdAndDelete(req.params.couponId);
      res.json({ success: true, message: "Coupon deleted successfully" });
    } catch (err) {
      console.log(err);
      res
        .status(500)
        .json({ success: false, message: "Error deleting coupon" });
    }
  },
);

// Admin: Toggle coupon status
app.post(
  "/admin/coupons/:couponId/toggle",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const coupon = await Coupon.findById(req.params.couponId);
      if (!coupon) {
        return res
          .status(404)
          .json({ success: false, message: "Coupon not found" });
      }

      coupon.isActive = !coupon.isActive;
      await coupon.save();

      res.json({ success: true, isActive: coupon.isActive });
    } catch (err) {
      console.log(err);
      res
        .status(500)
        .json({ success: false, message: "Error toggling coupon status" });
    }
  },
);

// ==================== DELIVERY MANAGEMENT ROUTES ====================

// ----- ADMIN DELIVERY MANAGEMENT -----

// Admin: Delivery Dashboard
app.get("/admin/delivery", authenticate, isAdmin, async (req, res) => {
  try {
    const stats = await DeliveryService.getDashboardStats();
    const deliveries = await Delivery.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("order", "tracking.orderId user")
      .populate("assignedTo", "name employeeId phone")
      .populate("shippingPartner");

    const agents = await DeliveryAgent.find({}).sort({
      "stats.totalDeliveries": -1,
    });
    const partners = await ShippingPartner.find({ isActive: true });

    res.render("admin/delivery/dashboard.ejs", {
      stats,
      deliveries,
      agents,
      partners,
    });
  } catch (err) {
    console.log("Delivery dashboard error:", err);
    res.status(500).send("Error loading delivery dashboard");
  }
});

// Admin: View all deliveries
app.get("/admin/deliveries", authenticate, isAdmin, async (req, res) => {
  try {
    const { status, agent, partner, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (agent) query.assignedTo = agent;
    if (partner) query.shippingPartner = partner;

    const deliveries = await Delivery.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("order", "tracking.orderId user")
      .populate("assignedTo", "name employeeId")
      .populate("shippingPartner");

    const count = await Delivery.countDocuments(query);

    res.render("admin/delivery/list.ejs", {
      deliveries,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      totalDeliveries: count,
      filters: { status, agent, partner },
    });
  } catch (err) {
    console.log("Deliveries list error:", err);
    res.status(500).send("Error loading deliveries");
  }
});

// Admin: View single delivery
app.get("/admin/delivery/:id", authenticate, isAdmin, async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate("order")
      .populate("assignedTo")
      .populate("shippingPartner");

    if (!delivery) {
      req.flash("error", "Delivery not found");
      return res.redirect("/admin/deliveries");
    }

    const qrLabel = QRCodeService.generateDeliveryLabel(
      delivery,
      delivery.order,
    );
    const agents = await DeliveryAgent.find({
      isActive: true,
      isAvailable: true,
    });
    const partners = await ShippingPartner.find({ isActive: true });

    res.render("admin/delivery/detail.ejs", {
      delivery,
      qrLabel,
      agents,
      partners,
    });
  } catch (err) {
    console.log("Delivery detail error:", err);
    res.status(500).send("Error loading delivery details");
  }
});

// Admin: Assign delivery to agent
app.post(
  "/admin/delivery/:id/assign",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const { agentId, notes } = req.body;
      const delivery = await Delivery.findById(req.params.id);

      if (!delivery) {
        return res
          .status(404)
          .json({ success: false, message: "Delivery not found" });
      }

      const agent = await DeliveryAgent.findById(agentId);
      if (!agent) {
        return res
          .status(404)
          .json({ success: false, message: "Agent not found" });
      }

      const result = await DeliveryService.assignDeliveryToAgent(
        delivery,
        agent,
        { notes },
      );

      if (result.success) {
        req.flash("success", "Delivery assigned successfully");
        res.redirect(`/admin/delivery/${req.params.id}`);
      } else {
        req.flash("error", result.message);
        res.redirect(`/admin/delivery/${req.params.id}`);
      }
    } catch (err) {
      console.log("Assign delivery error:", err);
      req.flash("error", "Failed to assign delivery");
      res.redirect("/admin/deliveries");
    }
  },
);

// Admin: Auto-assign delivery
app.post(
  "/admin/delivery/:id/auto-assign",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const delivery = await Delivery.findById(req.params.id);

      if (!delivery) {
        return res
          .status(404)
          .json({ success: false, message: "Delivery not found" });
      }

      const result = await DeliveryService.autoAssignDelivery(delivery);

      if (result.success) {
        req.flash("success", `Delivery assigned to ${result.agent.name}`);
      } else {
        req.flash("error", result.message);
      }
      res.redirect(`/admin/delivery/${req.params.id}`);
    } catch (err) {
      console.log("Auto-assign error:", err);
      req.flash("error", "Failed to auto-assign delivery");
      res.redirect("/admin/deliveries");
    }
  },
);

// Admin: Update delivery status
app.post(
  "/admin/delivery/:id/status",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const { status, notes } = req.body;
      const result = await DeliveryService.updateDeliveryStatus(
        req.params.id,
        status,
        { notes },
      );

      if (result.success) {
        req.flash("success", "Delivery status updated");
      } else {
        req.flash("error", result.message);
      }
      res.redirect(`/admin/delivery/${req.params.id}`);
    } catch (err) {
      console.log("Update status error:", err);
      req.flash("error", "Failed to update status");
      res.redirect("/admin/deliveries");
    }
  },
);

// Admin: Reassign delivery
app.post(
  "/admin/delivery/:id/reassign",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const { agentId, reason } = req.body;
      const result = await DeliveryService.reassignDelivery(
        req.params.id,
        agentId,
        reason,
      );

      if (result.success) {
        req.flash("success", "Delivery reassigned successfully");
      } else {
        req.flash("error", result.message);
      }
      res.redirect(`/admin/delivery/${req.params.id}`);
    } catch (err) {
      console.log("Reassign error:", err);
      req.flash("error", "Failed to reassign delivery");
      res.redirect("/admin/deliveries");
    }
  },
);

// Admin: Cancel delivery
app.post(
  "/admin/delivery/:id/cancel",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const { reason } = req.body;
      const result = await DeliveryService.cancelDelivery(
        req.params.id,
        reason,
        req.user,
      );

      if (result.success) {
        req.flash("success", "Delivery cancelled");
      } else {
        req.flash("error", result.message);
      }
      res.redirect(`/admin/delivery/${req.params.id}`);
    } catch (err) {
      console.log("Cancel error:", err);
      req.flash("error", "Failed to cancel delivery");
      res.redirect("/admin/deliveries");
    }
  },
);

// Admin: Generate delivery label
app.get(
  "/admin/delivery/:id/label",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const delivery = await Delivery.findById(req.params.id).populate("order");

      if (!delivery) {
        return res.status(404).send("Delivery not found");
      }

      const qrLabel = QRCodeService.generateDeliveryLabel(
        delivery,
        delivery.order,
      );
      res.render("admin/delivery/label.ejs", { delivery, qrLabel });
    } catch (err) {
      console.log("Generate label error:", err);
      res.status(500).send("Error generating label");
    }
  },
);

// Admin: Download QR code
app.get(
  "/admin/delivery/qr/:qrCode",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const delivery = await Delivery.findOne({ qrCode: req.params.qrCode });

      if (!delivery) {
        return res.status(404).send("Delivery not found");
      }

      const qrBuffer = await QRCodeService.generateQRCodeImage(
        `${Buffer.from(
          JSON.stringify({
            deliveryId: delivery._id.toString(),
            qrCode: delivery.qrCode,
            secret: delivery.qrCodeSecret,
            timestamp: Date.now(),
          }),
        ).toString("base64")}.${require("crypto")
          .createHmac("sha256", process.env.ACCESS_SECRET)
          .update(
            Buffer.from(
              JSON.stringify({
                deliveryId: delivery._id.toString(),
                qrCode: delivery.qrCode,
                secret: delivery.qrCodeSecret,
                timestamp: Date.now(),
              }),
            ).toString("base64"),
          )
          .digest("hex")}`,
      );

      res.setHeader("Content-Type", "image/png");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="qr_${delivery.qrCode}.png"`,
      );
      res.send(qrBuffer);
    } catch (err) {
      console.log("Download QR error:", err);
      res.status(500).send("Error generating QR code");
    }
  },
);

// ----- DELIVERY AGENT MANAGEMENT -----

// Admin: View all agents
app.get("/admin/delivery-agents", authenticate, isAdmin, async (req, res) => {
  try {
    const agents = await DeliveryAgent.find({})
      .sort({ createdAt: -1 })
      .populate("verifiedBy", "name");

    // Separate pending and approved agents
    const pendingAgents = agents.filter((a) => !a.isActive);
    const activeAgents = agents.filter((a) => a.isActive);

    res.render("admin/delivery/agents.ejs", {
      agents,
      pendingAgents,
      activeAgents,
    });
  } catch (err) {
    console.log("Agents list error:", err);
    res.status(500).send("Error loading agents");
  }
});

// Admin: Approve agent
app.post(
  "/admin/delivery-agents/:id/approve",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const agent = await DeliveryAgent.findById(req.params.id);

      if (!agent) {
        return res
          .status(404)
          .json({ success: false, message: "Agent not found" });
      }

      agent.isActive = true;
      agent.isAvailable = true;
      agent.verifiedBy = req.user._id;
      agent.verifiedAt = new Date();
      agent.policeVerification.status = "verified";
      agent.policeVerification.verifiedAt = new Date();
      agent.policeVerification.verifiedBy = req.user.name;

      await agent.save();

      req.flash("success", `Agent ${agent.name} approved successfully!`);
      res.redirect("/admin/delivery-agents");
    } catch (err) {
      console.log("Approve agent error:", err);
      req.flash("error", "Failed to approve agent");
      res.redirect("/admin/delivery-agents");
    }
  },
);

// Admin: Verify agent profile updates
app.post(
  "/admin/delivery-agents/:id/verify-profile",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const agent = await DeliveryAgent.findById(req.params.id);

      if (!agent) {
        req.flash("error", "Agent not found");
        return res.redirect("/admin/delivery-agents");
      }

      // Mark profile as verified
      agent.policeVerification.status = "verified";
      agent.policeVerification.verifiedAt = new Date();
      agent.policeVerification.verifiedBy = req.user.name;

      // Make agent available if not already
      if (agent.isActive) {
        agent.isAvailable = true;
      }

      await agent.save();

      req.flash(
        "success",
        `Agent ${agent.name}'s profile verified successfully!`,
      );
      res.redirect("/admin/delivery-agent/" + req.params.id);
    } catch (err) {
      console.log("Verify profile error:", err);
      req.flash("error", "Failed to verify profile");
      res.redirect("/admin/delivery-agents");
    }
  },
);

// Admin: Reject agent
app.post(
  "/admin/delivery-agents/:id/reject",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const agent = await DeliveryAgent.findById(req.params.id);

      if (!agent) {
        return res
          .status(404)
          .json({ success: false, message: "Agent not found" });
      }

      // Soft delete - mark as inactive with note
      agent.isActive = false;
      agent.notes = `Rejected by admin on ${new Date().toLocaleDateString()}. Reason: ${req.body.reason || "Not approved"}`;
      await agent.save();

      req.flash("success", "Agent registration rejected");
      res.redirect("/admin/delivery-agents");
    } catch (err) {
      console.log("Reject agent error:", err);
      req.flash("error", "Failed to reject agent");
      res.redirect("/admin/delivery-agents");
    }
  },
);

// Admin: View agent details
app.get(
  "/admin/delivery-agent/:id",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const agent = await DeliveryAgent.findById(req.params.id).populate(
        "verifiedBy",
        "name",
      );

      if (!agent) {
        req.flash("error", "Agent not found");
        return res.redirect("/admin/delivery-agents");
      }

      const deliveries = await Delivery.find({ assignedTo: agent._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("order");

      res.render("admin/delivery/agent-detail.ejs", { agent, deliveries });
    } catch (err) {
      console.log("Agent detail error:", err);
      res.status(500).send("Error loading agent details");
    }
  },
);

// Admin: Create delivery agent
app.post(
  "/admin/delivery-agents",
  authenticate,
  isAdmin,
  upload.fields([
    { name: "aadharImage", maxCount: 1 },
    { name: "panImage", maxCount: 1 },
    { name: "drivingLicense", maxCount: 1 },
    { name: "vehicleRC", maxCount: 1 },
    { name: "vehicleInsurance", maxCount: 1 },
  ]),
  handleUploadError,
  async (req, res) => {
    try {
      const agentData = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        password: req.body.password || "defaultpass123",
        vehicleType: req.body.vehicleType,
        vehicleNumber: req.body.vehicleNumber,
        address: {
          street: req.body["address.street"] || req.body.address?.street,
          city: req.body["address.city"] || req.body.address?.city,
          state: req.body["address.state"] || req.body.address?.state,
          pincode: req.body["address.pincode"] || req.body.address?.pincode,
        },
        aadharNumber: req.body.aadharNumber,
        panNumber: req.body.panNumber,
        drivingLicense: req.body.drivingLicense,
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        "policeVerification.status": "verified",
        "policeVerification.verifiedAt": new Date(),
        "policeVerification.verifiedBy": req.user.name,
        isActive: true,
        isAvailable: true,
      };

      // Add uploaded document URLs (Cloudinary)
      if (req.files.aadharImage) {
        agentData.aadharImage = req.files.aadharImage[0].path;
      }
      if (req.files.panImage) {
        agentData.panImage = req.files.panImage[0].path;
      }
      if (req.files.drivingLicense) {
        agentData.drivingLicense = req.files.drivingLicense[0].path;
      }
      if (req.files.vehicleRC) {
        agentData.vehicleRC = req.files.vehicleRC[0].path;
      }
      if (req.files.vehicleInsurance) {
        agentData.vehicleInsurance = req.files.vehicleInsurance[0].path;
      }

      const agent = new DeliveryAgent(agentData);
      await agent.save();

      req.flash("success", "Delivery agent created successfully");
      res.redirect("/admin/delivery-agents");
    } catch (err) {
      console.log("Create agent error:", err);
      req.flash("error", "Failed to create agent");
      res.redirect("/admin/delivery-agents");
    }
  },
);

// Admin: Update agent
app.post(
  "/admin/delivery-agents/:id",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      await DeliveryAgent.findByIdAndUpdate(req.params.id, req.body);
      req.flash("success", "Agent updated successfully");
      res.redirect(`/admin/delivery-agent/${req.params.id}`);
    } catch (err) {
      console.log("Update agent error:", err);
      req.flash("error", "Failed to update agent");
      res.redirect("/admin/delivery-agents");
    }
  },
);

// Admin: Toggle agent availability
app.post(
  "/admin/delivery-agents/:id/toggle",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const agent = await DeliveryAgent.findById(req.params.id);
      if (!agent) {
        return res
          .status(404)
          .json({ success: false, message: "Agent not found" });
      }

      agent.isAvailable = !agent.isAvailable;
      if (!agent.isAvailable) {
        agent.currentStatus = "offline";
      }
      await agent.save();

      res.json({ success: true, isAvailable: agent.isAvailable });
    } catch (err) {
      console.log("Toggle agent error:", err);
      res
        .status(500)
        .json({ success: false, message: "Error toggling agent status" });
    }
  },
);

// ----- SHIPPING PARTNER MANAGEMENT -----

// Admin: View all shipping partners
app.get("/admin/shipping-partners", authenticate, isAdmin, async (req, res) => {
  try {
    const partners = await ShippingPartner.find({}).sort({ priority: -1 });
    res.render("admin/delivery/partners.ejs", { partners });
  } catch (err) {
    console.log("Partners list error:", err);
    res.status(500).send("Error loading partners");
  }
});

// Admin: Create shipping partner
app.post(
  "/admin/shipping-partners",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      const partner = new ShippingPartner(req.body);
      await partner.save();
      req.flash("success", "Shipping partner created successfully");
      res.redirect("/admin/shipping-partners");
    } catch (err) {
      console.log("Create partner error:", err);
      req.flash("error", "Failed to create partner");
      res.redirect("/admin/shipping-partners");
    }
  },
);

// Admin: Update shipping partner
app.post(
  "/admin/shipping-partners/:id",
  authenticate,
  isAdmin,
  async (req, res) => {
    try {
      await ShippingPartner.findByIdAndUpdate(req.params.id, req.body);
      req.flash("success", "Partner updated successfully");
      res.redirect("/admin/shipping-partners");
    } catch (err) {
      console.log("Update partner error:", err);
      req.flash("error", "Failed to update partner");
      res.redirect("/admin/shipping-partners");
    }
  },
);

// ----- DELIVERY AGENT PORTAL -----

// Agent: Registration Page
app.get("/agent/register", (req, res) => {
  if (req.user) {
    return res.redirect("/agent/dashboard");
  }
  res.render("agent/register.ejs");
});

// Agent: Register Account
app.post(
  "/agent/register",
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "aadharImage", maxCount: 1 },
    { name: "panImage", maxCount: 1 },
    { name: "drivingLicense", maxCount: 1 },
    { name: "vehicleRC", maxCount: 1 },
    { name: "vehicleInsurance", maxCount: 1 },
  ]),
  handleUploadError,
  async (req, res) => {
    try {
      const {
        name,
        email,
        phone,
        password,
        confirmPassword,
        vehicleType,
        vehicleNumber,
        address,
        city,
        state,
        pincode,
        aadharNumber,
        panNumber,
        bankDetails,
      } = req.body;

      console.log("\n📝 Agent Registration Request:");
      console.log("  - Name:", name);
      console.log("  - Email:", email);
      console.log("  - Phone:", phone);

      // Check if agent already exists
      const existingAgent = await DeliveryAgent.findOne({
        $or: [{ email }, { phone }],
      });
      if (existingAgent) {
        req.flash(
          "error",
          "Email or phone already registered. Please login instead.",
        );
        return res.redirect("/agent/login");
      }

      // Check password match
      if (password !== confirmPassword) {
        req.flash("error", "Passwords do not match");
        return res.redirect("/agent/register");
      }

      // Check password length
      if (password.length < 6) {
        req.flash("error", "Password must be at least 6 characters");
        return res.redirect("/agent/register");
      }

      // Create agent data
      const agentData = {
        name,
        email,
        phone,
        password, // Will be hashed by pre-save hook
        vehicleType,
        vehicleNumber,
        address: {
          street: address,
          city,
          state,
          pincode,
        },
        aadharNumber,
        panNumber,
        coverageAreas: [
          {
            city,
            pincode,
            zones: ["all"],
          },
        ],
        isActive: false, // Needs admin approval
        isAvailable: false, // Will be activated after approval
        employmentType: "freelance",
      };

      // Add bank details if provided
      if (bankDetails) {
        agentData.bankDetails = {
          accountHolderName: bankDetails.accountHolderName || "",
          accountNumber: bankDetails.accountNumber || "",
          ifscCode: bankDetails.ifscCode || "",
          bankName: bankDetails.bankName || "",
          branchName: bankDetails.branchName || "",
          upiId: bankDetails.upiId || "",
        };
      }

      agentData.coverageAreas = [
        {
          city,
          pincode,
          zones: ["all"],
        },
      ];

      // Log uploaded files for debugging
      console.log(
        "📁 Uploaded files:",
        req.files ? Object.keys(req.files) : "No files",
      );
      if (req.files) {
        Object.keys(req.files).forEach((field) => {
          console.log(`  - ${field}: ${req.files[field][0].path}`);
        });
      }

      // Add uploaded document URLs (Cloudinary)
      if (req.files.profileImage) {
        agentData.profileImage = req.files.profileImage[0].path;
        console.log("✅ Profile image uploaded:", agentData.profileImage);
      }
      if (req.files.aadharImage) {
        agentData.aadharImage = req.files.aadharImage[0].path;
        console.log("✅ Aadhar image uploaded:", agentData.aadharImage);
      }
      if (req.files.panImage) {
        agentData.panImage = req.files.panImage[0].path;
        console.log("✅ PAN image uploaded:", agentData.panImage);
      }
      if (req.files.drivingLicense) {
        agentData.drivingLicense = req.files.drivingLicense[0].path;
        console.log("✅ Driving License uploaded:", agentData.drivingLicense);
      }
      if (req.files.vehicleRC) {
        agentData.vehicleRC = req.files.vehicleRC[0].path;
        console.log("✅ Vehicle RC uploaded:", agentData.vehicleRC);
      }
      if (req.files.vehicleInsurance) {
        agentData.vehicleInsurance = req.files.vehicleInsurance[0].path;
        console.log(
          "✅ Vehicle Insurance uploaded:",
          agentData.vehicleInsurance,
        );
      }

      console.log("💾 Creating agent with documents...");
      const agent = new DeliveryAgent(agentData);
      await agent.save();

      console.log(
        "✅ Agent registered successfully:",
        agent.email,
        "ID:",
        agent._id,
      );
      console.log("📄 Saved documents:");
      console.log("  - profileImage:", agent.profileImage ? "✅" : "❌");
      console.log("  - aadharImage:", agent.aadharImage ? "✅" : "❌");
      console.log("  - panImage:", agent.panImage ? "✅" : "❌");
      console.log("  - drivingLicense:", agent.drivingLicense ? "✅" : "❌");
      console.log("  - vehicleRC:", agent.vehicleRC ? "✅" : "❌");
      console.log(
        "  - vehicleInsurance:",
        agent.vehicleInsurance ? "✅" : "❌",
      );

      req.flash(
        "success",
        "Registration successful! Your account is pending admin approval. You will be notified once approved.",
      );
      res.redirect("/agent/login");
    } catch (err) {
      console.error("❌ Agent registration error:", err);
      req.flash("error", "Registration failed. Please try again.");
      res.redirect("/agent/register");
    }
  },
);

// Agent: Login Page
app.get("/agent/login", (req, res) => {
  if (req.user) {
    return res.redirect("/agent/dashboard");
  }
  res.render("agent/login.ejs");
});

// Agent: Login
app.post("/agent/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find agent by email or phone
    const agent = await DeliveryAgent.findOne({
      $or: [{ email }, { phone: email }],
    }).select("+password");

    if (!agent) {
      req.flash("error", "Invalid credentials");
      return res.redirect("/agent/login");
    }

    // Check if account is approved
    if (!agent.isActive) {
      req.flash(
        "error",
        "Your account is pending admin approval. Please wait for approval.",
      );
      return res.redirect("/agent/login");
    }

    // Verify password
    const isMatch = await agent.comparePassword(password);
    if (!isMatch) {
      req.flash("error", "Invalid credentials");
      return res.redirect("/agent/login");
    }

    // Generate JWT token
    const accessToken = jwt.sign(
      { userId: agent._id, role: "delivery_agent", email: agent.email },
      process.env.ACCESS_SECRET,
      { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign(
      { userId: agent._id },
      process.env.REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    // Store refresh token (optional, for token rotation)
    agent.refreshToken = refreshToken;
    await agent.save();

    // Set cookies
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
    });

    req.flash("success", `Welcome back, ${agent.name}!`);
    res.redirect("/agent/dashboard");
  } catch (err) {
    console.log("Agent login error:", err);
    req.flash("error", "Login failed. Please try again.");
    res.redirect("/agent/login");
  }
});

// Agent: Dashboard
app.get("/agent/dashboard", authenticateAgent, async (req, res) => {
  try {
    // Check if user is a delivery agent
    const agent = await DeliveryAgent.findOne({
      $or: [{ email: req.user.email }, { phone: req.user.phone }],
    }).populate("verifiedBy", "name email");

    if (!agent) {
      req.flash("error", "Access denied. Not a registered agent.");
      return res.redirect("/home");
    }

    // Check if account is still active
    if (!agent.isActive) {
      req.flash(
        "error",
        "Your account has been deactivated. Please contact admin.",
      );
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
      return res.redirect("/agent/login");
    }

    // Get agent's assigned orders
    const assignedOrders = await Order.find({
      deliveryAgent: agent._id,
      status: { $in: ["assigned", "out_for_delivery", "processing"] },
    })
      .populate("items.product")
      .sort({ createdAt: -1 });

    // Get completed deliveries (delivered orders)
    const completedOrders = await Order.find({
      deliveryAgent: agent._id,
      status: "delivered",
    })
      .populate("items.product")
      .sort({ updatedAt: -1 })
      .limit(20);

    // Calculate today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayDeliveries = completedOrders.filter(
      (o) => o.updatedAt >= today && o.updatedAt < tomorrow,
    );
    const todayEarnings = todayDeliveries.length * 50; // Assuming ₹50 per delivery

    // Calculate weekly stats (last 7 days)
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekDeliveries = completedOrders.filter(
      (o) => o.updatedAt >= weekAgo,
    );
    const weekEarnings = weekDeliveries.length * 50;

    // Calculate monthly stats (last 30 days)
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthDeliveries = completedOrders.filter(
      (o) => o.updatedAt >= monthAgo,
    );
    const monthEarnings = monthDeliveries.length * 50;

    // Performance metrics
    const onTimeDeliveries = completedOrders.filter((o) => {
      if (!o.tracking.deliveredAt || !o.tracking.estimatedDelivery)
        return false;
      return (
        new Date(o.tracking.deliveredAt) <=
        new Date(o.tracking.estimatedDelivery)
      );
    }).length;
    const onTimeRate =
      completedOrders.length > 0
        ? Math.round((onTimeDeliveries / completedOrders.length) * 100)
        : 100;

    // Get recent ratings (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRatings = agent.ratings.filter(
      (rating) => new Date(rating.submittedAt) >= thirtyDaysAgo,
    );

    // Get pending notifications
    const notifications = [];
    if (!agent.isAvailable) {
      notifications.push({
        type: "info",
        message:
          "You are currently offline. Go online to receive new deliveries.",
        icon: "fa-info-circle",
      });
    }
    if (assignedOrders.length >= agent.maxConcurrentDeliveries) {
      notifications.push({
        type: "warning",
        message:
          "You have reached maximum concurrent deliveries. Complete some deliveries to accept more.",
        icon: "fa-exclamation-triangle",
      });
    }

    res.render("agent/dashboard.ejs", {
      agent,
      assignedOrders,
      completedOrders,
      todayStats: {
        deliveries: todayDeliveries.length,
        earnings: todayEarnings,
      },
      weekStats: {
        deliveries: weekDeliveries.length,
        earnings: weekEarnings,
      },
      monthStats: {
        deliveries: monthDeliveries.length,
        earnings: monthEarnings,
      },
      performanceMetrics: {
        onTimeRate,
        totalDeliveries: completedOrders.length,
        averageRating: agent.stats.averageRating || 0,
      },
      recentRatings,
      notifications,
    });
  } catch (err) {
    console.log("Agent dashboard error:", err);
    req.flash("error", "Error loading dashboard");
    res.redirect("/agent/login");
  }
});

// Agent: Upload Documents (POST)
app.post(
  "/agent/upload-document",
  authenticateAgent,
  upload.fields([
    { name: "aadharImage", maxCount: 1 },
    { name: "panImage", maxCount: 1 },
    { name: "drivingLicense", maxCount: 1 },
    { name: "vehicleRC", maxCount: 1 },
    { name: "vehicleInsurance", maxCount: 1 },
  ]),
  handleUploadError,
  async (req, res) => {
    try {
      const agent = await DeliveryAgent.findOne({
        $or: [{ email: req.user.email }, { phone: req.user.phone }],
      });

      if (!agent) {
        req.flash("error", "Agent profile not found");
        return res.redirect("/agent/profile");
      }

      // Update document URLs (Cloudinary URLs)
      if (req.files.aadharImage) {
        agent.aadharImage = req.files.aadharImage[0].path; // Cloudinary URL
      }
      if (req.files.panImage) {
        agent.panImage = req.files.panImage[0].path; // Cloudinary URL
      }
      if (req.files.drivingLicense) {
        agent.drivingLicense = req.files.drivingLicense[0].path; // Cloudinary URL
      }
      if (req.files.vehicleRC) {
        agent.vehicleRC = req.files.vehicleRC[0].path; // Cloudinary URL
      }
      if (req.files.vehicleInsurance) {
        agent.vehicleInsurance = req.files.vehicleInsurance[0].path; // Cloudinary URL
      }

      await agent.save();

      req.flash("success", "Documents uploaded successfully!");
      res.redirect("/agent/profile");
    } catch (err) {
      console.log("Document upload error:", err);
      req.flash("error", "Failed to upload documents");
      res.redirect("/agent/profile");
    }
  },
);

// Agent: Upload Profile Image (POST)
app.post(
  "/agent/upload-profile-image",
  authenticateAgent,
  uploadProfile.single("profileImage"),
  handleUploadError,
  async (req, res) => {
    try {
      const agent = await DeliveryAgent.findOne({
        $or: [{ email: req.user.email }, { phone: req.user.phone }],
      });

      if (!agent) {
        req.flash("error", "Agent profile not found");
        return res.redirect("/agent/profile");
      }

      // Update profile image URL (Cloudinary URL)
      if (req.file) {
        agent.profileImage = req.file.path; // Cloudinary URL
      }

      await agent.save();

      req.flash("success", "Profile image uploaded successfully!");
      res.redirect("/agent/profile");
    } catch (err) {
      console.log("Profile image upload error:", err);
      req.flash("error", "Failed to upload profile image");
      res.redirect("/agent/profile");
    }
  },
);

// Agent: Toggle Availability (POST)
app.post("/agent/toggle-availability", authenticateAgent, async (req, res) => {
  try {
    const agent = await DeliveryAgent.findOne({
      $or: [{ email: req.user.email }, { phone: req.user.phone }],
    });

    if (!agent) {
      return res.json({ success: false, message: "Agent not found" });
    }

    // Toggle availability
    agent.isAvailable = !agent.isAvailable;

    // Update status based on availability
    if (!agent.isAvailable) {
      agent.currentStatus = "offline";
    } else {
      agent.currentStatus = "idle";
    }

    await agent.save();

    res.json({
      success: true,
      isAvailable: agent.isAvailable,
      currentStatus: agent.currentStatus,
    });
  } catch (err) {
    console.log("Toggle availability error:", err);
    res.json({ success: false, message: "Failed to update availability" });
  }
});

// Agent: Update Location (POST)
app.post("/agent/update-location", authenticateAgent, async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;

    const agent = await DeliveryAgent.findOne({
      $or: [{ email: req.user.email }, { phone: req.user.phone }],
    });

    if (!agent) {
      return res.json({ success: false, message: "Agent not found" });
    }

    // Update location
    await agent.updateLocation(
      parseFloat(latitude),
      parseFloat(longitude),
      address || "",
    );

    res.json({
      success: true,
      message: "Location updated successfully",
      location: agent.currentLocation,
    });
  } catch (err) {
    console.log("Update location error:", err);
    res.json({ success: false, message: "Failed to update location" });
  }
});

// Agent: Profile Page
app.get("/agent/profile", authenticateAgent, async (req, res) => {
  try {
    const agent = await DeliveryAgent.findOne({
      $or: [{ email: req.user.email }, { phone: req.user.phone }],
    });

    if (!agent) {
      req.flash("error", "Profile not found");
      return res.redirect("/agent/login");
    }

    // Debug: Log document status
    console.log("📄 Agent Documents for", agent.email);
    console.log("  - profileImage:", agent.profileImage ? "✅" : "❌");
    console.log("  - aadharImage:", agent.aadharImage ? "✅" : "❌");
    console.log("  - panImage:", agent.panImage ? "✅" : "❌");
    console.log("  - drivingLicense:", agent.drivingLicense ? "✅" : "❌");
    console.log("  - vehicleRC:", agent.vehicleRC ? "✅" : "❌");
    console.log("  - vehicleInsurance:", agent.vehicleInsurance ? "✅" : "❌");

    res.render("agent/profile.ejs", { agent });
  } catch (err) {
    console.log("Agent profile error:", err);
    res.status(500).send("Error loading profile");
  }
});

// Agent: Edit Profile Page (GET)
app.get("/agent/profile/edit", authenticateAgent, async (req, res) => {
  try {
    const agent = await DeliveryAgent.findOne({
      $or: [{ email: req.user.email }, { phone: req.user.phone }],
    });

    if (!agent) {
      req.flash("error", "Profile not found");
      return res.redirect("/agent/login");
    }

    res.render("agent/edit-profile.ejs", { agent });
  } catch (err) {
    console.log("Agent edit profile page error:", err);
    res.status(500).send("Error loading edit profile page");
  }
});

// Agent: Update Profile (POST)
app.post(
  "/agent/profile/edit",
  authenticateAgent,
  upload.fields([
    { name: "aadharImage", maxCount: 1 },
    { name: "panImage", maxCount: 1 },
    { name: "drivingLicense", maxCount: 1 },
    { name: "vehicleRC", maxCount: 1 },
    { name: "vehicleInsurance", maxCount: 1 },
  ]),
  handleUploadError,
  async (req, res) => {
    try {
      const agent = await DeliveryAgent.findOne({
        $or: [{ email: req.user.email }, { phone: req.user.phone }],
      });

      if (!agent) {
        req.flash("error", "Profile not found");
        return res.redirect("/agent/login");
      }

      const {
        name,
        phone,
        vehicleType,
        vehicleNumber,
        address,
        aadharNumber,
        panNumber,
        bankDetails,
      } = req.body;

      console.log("\n📝 Agent Profile Update Request:");
      console.log("  - Agent ID:", agent._id);
      console.log("  - Name:", name);
      console.log("  - Phone:", phone);

      // Update basic information
      agent.name = name;
      agent.phone = phone;
      agent.vehicleType = vehicleType;
      agent.vehicleNumber = vehicleNumber;

      // Update address
      if (address) {
        agent.address = {
          street: address.street || agent.address.street,
          city: address.city || agent.address.city,
          state: address.state || agent.address.state,
          pincode: address.pincode || agent.address.pincode,
        };
      }

      // Update ID information
      agent.aadharNumber = aadharNumber;
      agent.panNumber = panNumber;

      // Update bank details
      if (bankDetails) {
        agent.bankDetails = {
          accountHolderName: bankDetails.accountHolderName || "",
          accountNumber: bankDetails.accountNumber || "",
          ifscCode: bankDetails.ifscCode || "",
          bankName: bankDetails.bankName || "",
          branchName: bankDetails.branchName || "",
          upiId: bankDetails.upiId || "",
        };
      }

      // Log uploaded files for debugging
      console.log(
        "📁 Uploaded files:",
        req.files ? Object.keys(req.files) : "No files",
      );
      if (req.files) {
        Object.keys(req.files).forEach((field) => {
          console.log(`  - ${field}: ${req.files[field][0].path}`);
        });
      }

      // Update uploaded document URLs (Cloudinary)
      if (req.files.aadharImage) {
        agent.aadharImage = req.files.aadharImage[0].path;
        console.log("✅ Aadhar image updated:", agent.aadharImage);
      }
      if (req.files.panImage) {
        agent.panImage = req.files.panImage[0].path;
        console.log("✅ PAN image updated:", agent.panImage);
      }
      if (req.files.drivingLicense) {
        agent.drivingLicense = req.files.drivingLicense[0].path;
        console.log("✅ Driving License updated:", agent.drivingLicense);
      }
      if (req.files.vehicleRC) {
        agent.vehicleRC = req.files.vehicleRC[0].path;
        console.log("✅ Vehicle RC updated:", agent.vehicleRC);
      }
      if (req.files.vehicleInsurance) {
        agent.vehicleInsurance = req.files.vehicleInsurance[0].path;
        console.log("✅ Vehicle Insurance updated:", agent.vehicleInsurance);
      }

      // Mark profile as needing verification if important fields changed
      agent.policeVerification.status = "pending";

      await agent.save();

      console.log("✅ Agent profile updated successfully:", agent.email);
      console.log("📄 Updated documents:");
      console.log("  - profileImage:", agent.profileImage ? "✅" : "❌");
      console.log("  - aadharImage:", agent.aadharImage ? "✅" : "❌");
      console.log("  - panImage:", agent.panImage ? "✅" : "❌");
      console.log("  - drivingLicense:", agent.drivingLicense ? "✅" : "❌");
      console.log("  - vehicleRC:", agent.vehicleRC ? "✅" : "❌");
      console.log(
        "  - vehicleInsurance:",
        agent.vehicleInsurance ? "✅" : "❌",
      );

      req.flash(
        "success",
        "Profile updated successfully! Your changes are pending admin verification.",
      );
      res.redirect("/agent/profile");
    } catch (err) {
      console.error("❌ Agent profile update error:", err);
      req.flash("error", "Failed to update profile. Please try again.");
      res.redirect("/agent/profile/edit");
    }
  },
);

// Agent: My deliveries
app.get("/agent/deliveries", authenticateAgent, async (req, res) => {
  try {
    const agent = await DeliveryAgent.findOne({
      $or: [{ email: req.user.email }, { phone: req.user.phone }],
    });

    if (!agent) {
      return res.status(403).send("Access denied");
    }

    const {
      status,
      page = 1,
      limit = 10,
      search,
      sort = "newest",
      type,
    } = req.query;

    let deliveries = [];
    let cancellationRequests = [];
    let totalDeliveries = 0;
    let totalPages = 0;

    if (type === "cancellations") {
      // Load cancellation requests
      const CancellationRequest = require("./models/cancellationRequest");
      const query = { assignedAgent: agent._id };

      if (status) {
        const statuses = status.split(",");
        query.status = { $in: statuses };
      } else {
        // Default to active cancellation requests
        query.status = { $in: ["otp_generated", "assigned"] };
      }

      const currentPage = parseInt(page);
      const pageSize = parseInt(limit);
      const skip = (currentPage - 1) * pageSize;

      cancellationRequests = await CancellationRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate("order", "tracking.orderId")
        .populate("user", "name phone")
        .populate("items.product");

      totalDeliveries = await CancellationRequest.countDocuments(query);
      totalPages = Math.ceil(totalDeliveries / pageSize);
    } else {
      // Load regular deliveries
      const query = { assignedTo: agent._id };
      if (status) {
        const statuses = status.split(",");
        query.status = { $in: statuses };
      }

      const currentPage = parseInt(page);
      const pageSize = parseInt(limit);
      const skip = (currentPage - 1) * pageSize;

      let sortOptions = { createdAt: -1 };
      if (sort === "oldest") {
        sortOptions = { createdAt: 1 };
      } else if (sort === "status") {
        sortOptions = { status: 1 };
      }

      deliveries = await Delivery.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(pageSize)
        .populate("order");

      totalDeliveries = await Delivery.countDocuments(query);
      totalPages = Math.ceil(totalDeliveries / pageSize);
    }

    res.render("agent/deliveries.ejs", {
      agent,
      deliveries,
      cancellationRequests,
      currentStatus: status,
      currentType: type,
      currentPage: parseInt(page),
      totalPages,
      totalDeliveries,
    });
  } catch (err) {
    console.log("Agent deliveries error:", err);
    res.status(500).send("Error loading deliveries");
  }
});

// Agent: View delivery details
app.get("/agent/delivery/:id", authenticateAgent, async (req, res) => {
  try {
    const agent = await DeliveryAgent.findOne({
      $or: [{ email: req.user.email }, { phone: req.user.phone }],
    });

    if (!agent) {
      return res.status(403).send("Access denied");
    }

    const delivery = await Delivery.findById(req.params.id)
      .populate("order")
      .populate("assignedTo");

    if (
      !delivery ||
      delivery.assignedTo._id.toString() !== agent._id.toString()
    ) {
      req.flash("error", "Delivery not found or not assigned to you");
      return res.redirect("/agent/deliveries");
    }

    const qrLabel = QRCodeService.generateDeliveryLabel(
      delivery,
      delivery.order,
    );

    // Check if delivery is ready for completion (out for delivery)
    if (delivery.status === 'out_for_delivery') {
      // Render the new delivery complete page
      return res.render("agent/delivery-complete.ejs", {
        agent,
        delivery,
      });
    }

    // Otherwise render the old detail page
    res.render("agent/delivery-detail.ejs", {
      agent,
      delivery,
      qrLabel,
      OTP: QRCodeService.generateOTP(),
    });
  } catch (err) {
    console.log("Agent delivery detail error:", err);
    res.status(500).send("Error loading delivery details");
  }
});

// Agent: Update delivery status
app.post(
  "/agent/delivery/:id/status",
  authenticate,
  isDeliveryAgent,
  async (req, res) => {
    try {
      const { status, notes, otp } = req.body;
      const agent = await DeliveryAgent.findById(req.user._id);

      if (!agent) {
        return res.status(404).json({ success: false, message: "Agent not found" });
      }

      // For delivered status, verify OTP
      if (status === 'delivered') {
        const delivery = await Delivery.findById(req.params.id);
        
        if (!delivery) {
          return res.status(404).json({ success: false, message: "Delivery not found" });
        }

        // Verify OTP
        if (!otp) {
          return res.status(400).json({ 
            success: false, 
            message: "OTP is required to complete delivery" 
          });
        }

        // Check if OTP matches
        if (delivery.deliveryOTP !== otp) {
          return res.status(400).json({ 
            success: false, 
            message: "Invalid OTP. Please enter the correct OTP provided by customer." 
          });
        }

        // Mark OTP as verified
        delivery.otpVerified = true;
        await delivery.save();
      }

      const result = await DeliveryService.updateDeliveryStatus(
        req.params.id,
        status,
        { notes, agent }
      );

      if (result.success) {
        req.flash("success", "Delivery status updated");
        res.redirect(`/agent/delivery/${req.params.id}`);
      } else {
        req.flash("error", result.message);
        res.redirect(`/agent/delivery/${req.params.id}`);
      }
    } catch (err) {
      console.log("Update status error:", err);
      req.flash("error", "Failed to update status");
      res.redirect("/agent/deliveries");
    }
  },
);

// API: Verify delivery OTP
app.post(
  "/api/delivery/:id/verify-otp",
  authenticate,
  isDeliveryAgent,
  async (req, res) => {
    try {
      const { otp } = req.body;
      const agent = await DeliveryAgent.findById(req.user._id);

      if (!agent) {
        return res.json({ success: false, message: "Agent not found" });
      }

      const delivery = await Delivery.findById(req.params.id);

      if (!delivery || delivery.assignedTo.toString() !== agent._id.toString()) {
        return res.json({ 
          success: false, 
          message: "Delivery not found or not assigned to you" 
        });
      }

      // Verify OTP
      if (!otp) {
        return res.json({ success: false, message: "OTP is required" });
      }

      if (delivery.deliveryOTP !== otp) {
        return res.json({ 
          success: false, 
          message: "Invalid OTP. Please enter the correct OTP." 
        });
      }

      // Mark OTP as verified
      delivery.otpVerified = true;
      await delivery.save();

      res.json({ 
        success: true, 
        message: "OTP verified successfully. You can now mark the delivery as delivered." 
      });
    } catch (err) {
      console.log("OTP verification error:", err);
      res.json({ success: false, message: "OTP verification failed" });
    }
  },
);
app.post("/agent/delivery/:id/status", authenticateAgent, async (req, res) => {
  try {
    const agent = await DeliveryAgent.findOne({
      $or: [{ email: req.user.email }, { phone: req.user.phone }],
    });

    if (!agent) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { status, notes, latitude, longitude, proof } = req.body;
    const location = latitude && longitude ? { latitude, longitude } : null;

    const result = await DeliveryService.updateDeliveryStatus(
      req.params.id,
      status,
      { agent, location, notes, proof },
    );

    if (result.success) {
      req.flash("success", "Status updated successfully");
    } else {
      req.flash("error", result.message);
    }
    res.redirect(`/agent/delivery/${req.params.id}`);
  } catch (err) {
    console.log("Agent update status error:", err);
    req.flash("error", "Failed to update status");
    res.redirect("/agent/deliveries");
  }
});

// Agent: Mark delivery as delivered
app.post("/agent/delivery/:id/deliver", authenticateAgent, async (req, res) => {
  try {
    const agent = await DeliveryAgent.findOne({
      $or: [{ email: req.user.email }, { phone: req.user.phone }],
    });

    if (!agent) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { qrCodeVerified, photo, signature, otp } = req.body;
    const proof = { photo, signature, otp };

    const result = await DeliveryService.markAsDelivered(
      req.params.id,
      proof,
      agent,
    );

    if (result.success) {
      req.flash("success", "Delivery completed successfully!");
    } else {
      req.flash("error", result.message);
    }
    res.redirect("/agent/deliveries");
  } catch (err) {
    console.log("Agent mark delivered error:", err);
    req.flash("error", "Failed to mark as delivered");
    res.redirect("/agent/deliveries");
  }
});

// Agent: Update location
app.post("/agent/location", authenticateAgent, async (req, res) => {
  try {
    const agent = await DeliveryAgent.findOne({
      $or: [{ email: req.user.email }, { phone: req.user.phone }],
    });

    if (!agent) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { latitude, longitude, address } = req.body;
    await agent.updateLocation(latitude, longitude, address);

    res.json({ success: true, message: "Location updated" });
  } catch (err) {
    console.log("Update location error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to update location" });
  }
});

// ================== DELIVERY AGENT ORDER MANAGEMENT ==================

// Agent: Update order status
app.post(
  "/agent/order/:orderId/status",
  authenticateAgent,
  async (req, res) => {
    try {
      const agent = await DeliveryAgent.findOne({
        $or: [{ email: req.user.email }, { phone: req.user.phone }],
      });

      if (!agent) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }

      const { status, notes } = req.body;
      const orderId = req.params.orderId;

      // Verify the order is assigned to this agent
      const order = await Order.findOne({
        _id: orderId,
        deliveryAgent: agent._id,
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found or not assigned to you",
        });
      }

      // Update order status
      const updateData = { status };
      if (status === "out_for_delivery") {
        updateData.tracking = { ...order.tracking, shippedAt: new Date() };
      } else if (status === "delivered") {
        updateData.tracking = { ...order.tracking, deliveredAt: new Date() };
      }

      await Order.findByIdAndUpdate(orderId, updateData);

      // Send SMS notification to customer
      try {
        await sendOrderStatusSMS(order, order.address.phone, status);
      } catch (smsError) {
        console.log("SMS sending failed:", smsError);
        // Don't fail the status update if SMS fails
      }

      // Update agent's stats if delivered
      if (status === "delivered") {
        await DeliveryAgent.findByIdAndUpdate(agent._id, {
          $inc: { "stats.totalDeliveries": 1, "stats.successfulDeliveries": 1 },
          $pull: { assignedOrders: orderId },
        });
      }

      res.json({ success: true, message: "Status updated successfully" });
    } catch (err) {
      console.log("Agent update order status error:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to update status" });
    }
  },
);

// Agent: Upload delivery proof (image)
app.post(
  "/agent/order/:orderId/proof",
  authenticateAgent,
  upload.single("proofImage"),
  handleUploadError,
  async (req, res) => {
    try {
      const agent = await DeliveryAgent.findOne({
        $or: [{ email: req.user.email }, { phone: req.user.phone }],
      });

      if (!agent) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }

      const orderId = req.params.orderId;

      // Verify the order is assigned to this agent
      const order = await Order.findOne({
        _id: orderId,
        deliveryAgent: agent._id,
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found or not assigned to you",
        });
      }

      // Update order with proof image
      await Order.findByIdAndUpdate(orderId, {
        "deliveryProof.image": req.file.path,
        "deliveryProof.uploadedAt": new Date(),
      });

      res.json({
        success: true,
        message: "Proof uploaded successfully",
        imageUrl: req.file.path,
      });
    } catch (err) {
      console.log("Agent upload proof error:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to upload proof" });
    }
  },
);

// Agent: Verify delivery OTP
app.post(
  "/agent/order/:orderId/verify-otp",
  authenticateAgent,
  async (req, res) => {
    try {
      const agent = await DeliveryAgent.findOne({
        $or: [{ email: req.user.email }, { phone: req.user.phone }],
      });

      if (!agent) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }

      const { otp } = req.body;
      const orderId = req.params.orderId;

      // Verify the order is assigned to this agent
      const order = await Order.findOne({
        _id: orderId,
        deliveryAgent: agent._id,
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found or not assigned to you",
        });
      }

      // Check if OTP is valid
      if (!order.deliveryOTP || order.deliveryOTP.code !== otp) {
        return res.status(400).json({ success: false, message: "Invalid OTP" });
      }

      // Check if OTP is expired
      if (new Date() > new Date(order.deliveryOTP.expiresAt)) {
        return res
          .status(400)
          .json({ success: false, message: "OTP has expired" });
      }

      // Mark OTP as verified
      await Order.findByIdAndUpdate(orderId, {
        "deliveryOTP.verifiedAt": new Date(),
      });

      res.json({ success: true, message: "OTP verified successfully" });
    } catch (err) {
      console.log("Agent verify OTP error:", err);
      res.status(500).json({ success: false, message: "Failed to verify OTP" });
    }
  },
);

// ----- CUSTOMER TRACKING -----

// Public: Track order by QR code or order ID
app.get("/track-order", async (req, res) => {
  try {
    const { qr, orderId } = req.query;
    let trackingResult = null;

    if (qr) {
      trackingResult = await DeliveryService.getTrackingInfo(qr);
    } else if (orderId) {
      const delivery = await Delivery.findOne({ "tracking.orderId": orderId })
        .populate("order")
        .populate("assignedTo");

      if (delivery) {
        trackingResult = await DeliveryService.getTrackingInfo(delivery._id);
      }
    }

    if (!trackingResult || !trackingResult.success) {
      return res.render("user/track-order.ejs", {
        error: "Order not found. Please check your Order ID or QR code.",
        trackingInfo: null,
      });
    }

    res.render("user/track-order.ejs", {
      error: null,
      trackingInfo: trackingResult.trackingInfo,
    });
  } catch (err) {
    console.log("Track order error:", err);
    res.render("user/track-order.ejs", {
      error: "Error tracking order",
      trackingInfo: null,
    });
  }
});

// Public: Verify delivery QR code
app.post("/api/verify-qr", async (req, res) => {
  try {
    const { qrCode } = req.body;

    if (!qrCode) {
      return res.json({ valid: false, message: "QR code required" });
    }

    const result = await QRCodeService.validateDeliveryQRCode(qrCode, Delivery);

    if (result.valid) {
      res.json({
        valid: true,
        message: "QR code verified successfully",
        delivery: {
          id: result.delivery._id,
          orderId: result.delivery.order,
          status: result.delivery.status,
          customerName: result.delivery.deliveryAddress?.fullName,
          address: result.delivery.deliveryAddress?.address,
          codAmount: result.delivery.codAmount,
        },
      });
    } else {
      res.json({
        valid: false,
        message: result.error || "Invalid QR code",
        alreadyDelivered: result.alreadyDelivered,
      });
    }
  } catch (err) {
    console.log("Verify QR error:", err);
    res.status(500).json({ valid: false, message: "Verification failed" });
  }
});

// User: View order delivery status
app.get("/user/order/:orderId/delivery", authenticate, async (req, res) => {
  try {
    const delivery = await Delivery.findOne({ order: req.params.orderId })
      .populate("order")
      .populate("assignedTo");

    if (!delivery) {
      req.flash("error", "Delivery information not found");
      return res.redirect("/user/orders");
    }

    // Verify user owns this order
    if (delivery.order.user.toString() !== req.user._id.toString()) {
      req.flash("error", "Unauthorized access");
      return res.redirect("/user/orders");
    }

    const qrLabel = QRCodeService.generateDeliveryLabel(
      delivery,
      delivery.order,
    );

    res.render("user/delivery-status.ejs", {
      delivery,
      qrLabel,
    });
  } catch (err) {
    console.log("User delivery status error:", err);
    res.status(500).send("Error loading delivery status");
  }
});

// ================== DELIVERY API ROUTES ==================
// Complete delivery with image upload and OTP verification
app.post(
  "/api/delivery/:orderId/complete",
  authenticate,
  isDeliveryAgent,
  uploadProfile.single("deliveryProof"),
  deliveryController.completeDelivery
);

// Generate delivery OTP
app.post(
  "/api/delivery/:orderId/generate-otp",
  authenticate,
  isDeliveryAgent,
  deliveryController.generateDeliveryOTP
);

// Verify delivery OTP
app.post(
  "/api/delivery/:orderId/verify-otp",
  authenticate,
  isDeliveryAgent,
  deliveryController.verifyDeliveryOTP
);

// Get delivery OTP
app.get(
  "/api/delivery/:orderId/otp",
  authenticate,
  isDeliveryAgent,
  deliveryController.getDeliveryOTP
);

// Get delivery details
app.get(
  "/api/delivery/:id",
  authenticate,
  isDeliveryAgent,
  deliveryController.getDeliveryDetails
);

// ================== ERROR HANDLING ==================

// 404 Not Found Handler - MUST be after all routes
app.use(notFound);

// Global Error Handler - MUST be last
app.use(errorHandler);

// ================== SERVER ==================
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`✅ Error handlers registered`);
  console.log(`✅ 404 page: /views/error/404.ejs`);
  console.log(`✅ 500 page: /views/error/500.ejs`);
});

const jwt = require("jsonwebtoken");
const User = require("../models/user");
const DeliveryAgent = require("../models/deliveryAgent");

// Optional authentication - doesn't redirect if no token
const optionalAuth = async (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (user) {
      req.user = user;
    }

    next();
  } catch (err) {
    next();
  }
};

// Required authentication - redirects to login if no token
const authenticate = async (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return res.redirect(
      `/login?redirect=${encodeURIComponent(req.originalUrl)}`,
    );
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.redirect(
        `/login?redirect=${encodeURIComponent(req.originalUrl)}`,
      );
    }

    req.user = user;
    res.locals.user = user; // Make user available to views
    next();
  } catch (err) {
    return res.redirect(
      `/login?redirect=${encodeURIComponent(req.originalUrl)}`,
    );
  }
};

// Authentication with email verification check
const authenticateVerified = async (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return res.redirect(
      `/login?redirect=${encodeURIComponent(req.originalUrl)}`,
    );
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.redirect(
        `/login?redirect=${encodeURIComponent(req.originalUrl)}`,
      );
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      // Don't clear cookies - just redirect to verification page
      req.flash("error", "Please verify your email to continue.");
      return res.redirect(
        `/verify-otp?email=${encodeURIComponent(user.email)}&redirect=${encodeURIComponent(req.originalUrl)}`,
      );
    }

    req.user = user;
    res.locals.user = user; // Make user available to views
    next();
  } catch (err) {
    return res.redirect(
      `/login?redirect=${encodeURIComponent(req.originalUrl)}`,
    );
  }
};

// API Authentication - returns JSON error instead of redirect
const authenticateVerifiedAPI = async (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please login again.",
      redirect: "/login",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found. Please login again.",
        redirect: "/login",
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      // Don't clear cookies - just return error with redirect
      return res.status(403).json({
        success: false,
        message: "Please verify your email to continue.",
        redirect: `/verify-otp?email=${encodeURIComponent(user.email)}&redirect=${encodeURIComponent(req.originalUrl)}`,
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("API Authentication error:", err.message);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session. Please login again.",
      redirect: "/login",
    });
  }
};

// Delivery agent authentication
const authenticateAgent = async (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return res.redirect("/agent/login");
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);

    const agent = await DeliveryAgent.findById(decoded.userId).select(
      "-password",
    );

    if (!agent) {
      return res.redirect("/agent/login");
    }

    req.user = agent;
    req.userRole = "delivery_agent";
    next();
  } catch (err) {
    console.log("Agent authentication error:", err.message);
    return res.redirect("/agent/login");
  }
};

// Role-based authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.redirect("/login");
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    next();
  };
};

// Specific role checks
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.redirect("/login");
  }

  if (req.user.role === "admin") {
    next();
  } else {
    res.redirect("/home");
  }
};

const isUser = (req, res, next) => {
  if (!req.user) {
    return res.redirect("/login");
  }

  if (req.user.role === "user") {
    next();
  } else {
    res.redirect("/home");
  }
};

const isDistributor = (req, res, next) => {
  if (!req.user) {
    return res.redirect("/login");
  }

  if (req.user.role === "distributor") {
    next();
  } else {
    res.redirect("/home");
  }
};

const isDeliveryAgent = (req, res, next) => {
  if (!req.user) {
    return res.redirect("/agent/login");
  }

  if (req.userRole === "delivery_agent") {
    next();
  } else {
    res.redirect("/agent/login");
  }
};

module.exports = {
  optionalAuth,
  authenticate,
  authenticateVerified,
  authenticateVerifiedAPI,
  authenticateAgent,
  authorize,
  isAdmin,
  isUser,
  isDistributor,
  isDeliveryAgent,
};

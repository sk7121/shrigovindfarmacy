const User = require('../models/user');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendOTPEmail } = require('../services/emailService');
const OTP = require('../models/otp');

// @desc    Send OTP and store pending registration
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
    try {
        const { fname, lname, email, city, state, password, confirm_password, phone } = req.body;

        // Check if user already exists (verified or unverified)
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            req.flash('error', 'Email already registered. Please login instead.');
            return res.redirect('/login');
        }

        // Check password match
        if (password !== confirm_password) {
            req.flash('error', 'Passwords do not match. Please try again.');
            return res.redirect('/login');
        }

        // Check password length
        if (password.length < 8) {
            req.flash('error', 'Password must be at least 8 characters long.');
            return res.redirect('/login');
        }

        const name = `${fname} ${lname}`;
        const address = `${city}, ${state}`;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Store registration data in session (don't create user yet)
        req.session.pendingRegistration = {
            name,
            email,
            password: hashedPassword,
            address,
            phone
        };

        // Generate and send OTP
        const { otp, expiresAt } = await OTP.createOTP(email, 'email_verification', 10);

        // Send OTP via email
        const emailResult = await sendOTPEmail(email, otp, 'email_verification');

        if (!emailResult.success) {
            req.flash('error', 'Failed to send OTP email. Please try again.');
            return res.redirect('/login');
        }

        req.flash('success', 'OTP sent to your email! Please verify to complete registration.');
        return res.redirect(`/verify-otp?email=${encodeURIComponent(email)}`);

    } catch (error) {
        console.log("Signup error:", error);
        req.flash('error', 'Server error. Please try again.');
        return res.redirect('/login');
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
    try {
        const { email, password, redirect } = req.body;
        console.log("Login attempt:", email);

        const user = await User.findOne({ email });

        if (!user) {
            console.log("❌ User not found");
            req.flash('error', 'User not found. Please create an account first.');
            return res.redirect('/login');
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            console.log("❌ Password incorrect");
            req.flash('error', 'Invalid email or password. Please try again.');
            return res.redirect('/login');
        }

        console.log("✅ Login successful");

        const accessToken = jwt.sign(
            {
                userId: user._id,
                role: user.role,
                email: user.email
            },
            process.env.ACCESS_SECRET,
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        user.refreshToken = refreshToken;
        await user.save();

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
            maxAge: 15 * 60 * 1000
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'Lax'
        });

        // Redirect to intended URL or default based on role
        if (redirect && redirect.startsWith('/')) {
            console.log('🎯 Redirecting to intended URL:', redirect);
            return res.redirect(redirect);
        }

        if (user.role === 'admin')
            res.redirect('/admin/home');
        else
            res.redirect('/home');

    } catch (error) {
        console.log("🔥 ERROR:", error);
        req.flash('error', 'Server error. Please try again.');
        return res.redirect('/login');
    }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
    try {
        const token = req.cookies.refreshToken;

        if (token) {
            const user = await User.findOne({ refreshToken: token });
            if (user) {
                user.refreshToken = null;
                await user.save();
            }
        }

        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        res.redirect('/login');
    } catch (error) {
        console.error('Logout error:', error);
        res.redirect('/login');
    }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh-token
// @access  Private
const refreshToken = async (req, res) => {
    try {
        const token = req.cookies.refreshToken;
        if (!token) return res.redirect('/login');

        const decoded = jwt.verify(token, process.env.REFRESH_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user || user.refreshToken !== token) {
            return res.redirect('/login');
        }

        // New access token
        const newAccessToken = jwt.sign(
            { userId: user._id },
            process.env.ACCESS_SECRET,
            { expiresIn: '15m' }
        );

        // Rotate refresh token
        const newRefreshToken = jwt.sign(
            { userId: user._id },
            process.env.REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        user.refreshToken = newRefreshToken;
        await user.save();

        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 15 * 60 * 1000
        });

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict'
        });

        res.redirect('/home');
    } catch (err) {
        return res.redirect('/login');
    }
};

// @desc    Send OTP for passwordless login
// @route   POST /api/auth/otp-login/send
// @access  Public
const sendOTPLogin = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.json({ success: false, message: 'Email is required' });
        }

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ success: false, message: 'No account found with this email. Please register first.' });
        }

        // Generate and send OTP for login
        const { otp, expiresAt } = await OTP.createOTP(email, 'email_verification', 10);
        const emailResult = await sendOTPEmail(email, otp, 'email_verification', user.name);

        if (!emailResult.success) {
            return res.json({ success: false, message: 'Failed to send OTP. Please try again.' });
        }

        // Store email in session for verification
        req.session.otpLoginEmail = email;

        console.log(`✅ Login OTP sent to: ${email}`);
        return res.json({
            success: true,
            message: 'OTP sent to your email! Please check your inbox.',
            expiresAt
        });

    } catch (error) {
        console.error('OTP Login send error:', error);
        return res.json({ success: false, message: 'Server error. Please try again.' });
    }
};

// @desc    Verify OTP and complete passwordless login
// @route   POST /api/auth/otp-login/verify
// @access  Public
const verifyOTPLogin = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.json({ success: false, message: 'Email and OTP are required' });
        }

        // Verify OTP
        const otpResult = await OTP.verifyOTP(email, otp, 'email_verification');

        if (!otpResult.success) {
            return res.json({ success: false, message: otpResult.message });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        // Generate tokens
        const accessToken = jwt.sign(
            {
                userId: user._id,
                role: user.role,
                email: user.email
            },
            process.env.ACCESS_SECRET,
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        user.refreshToken = refreshToken;
        await user.save();

        // Set cookies
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
            maxAge: 15 * 60 * 1000
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Clear session
        delete req.session.otpLoginEmail;

        console.log(`✅ OTP Login successful for: ${email}`);
        
        // Determine redirect based on role and email verification
        let redirectUrl;
        if (user.role === 'admin') {
            redirectUrl = '/admin/home';
        } else if (!user.isEmailVerified) {
            // If email not verified, redirect to OTP verification page
            redirectUrl = `/verify-otp?email=${encodeURIComponent(email)}`;
        } else {
            redirectUrl = '/home';
        }
        
        return res.json({
            success: true,
            message: 'Login successful!',
            redirect: redirectUrl
        });

    } catch (error) {
        console.error('OTP Login verify error:', error);
        return res.json({ success: false, message: 'Server error. Please try again.' });
    }
};

module.exports = {
    register,
    login,
    logout,
    refreshToken,
    sendOTPLogin,
    verifyOTPLogin
};

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user');

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
    scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user already exists
        let user = await User.findOne({ 
            $or: [
                { email: profile.emails[0].value },
                { 'google.googleId': profile.id }
            ]
        });

        if (user) {
            // Update Google ID if not already set
            if (!user.google?.googleId) {
                user.google = user.google || {};
                user.google.googleId = profile.id;
                user.google.avatar = profile.photos[0]?.value;
                await user.save();
            }
            return done(null, user);
        }

        // Create new user
        const newUser = await User.create({
            name: profile.displayName,
            email: profile.emails[0].value,
            password: '', // No password for OAuth users
            phone: profile.phoneNumbers?.[0]?.value || '',
            address: '',
            google: {
                googleId: profile.id,
                avatar: profile.photos[0]?.value
            },
            isEmailVerified: true, // Google emails are verified
            emailVerifiedAt: new Date()
        });

        done(null, newUser);
    } catch (error) {
        done(error, null);
    }
}));

module.exports = passport;

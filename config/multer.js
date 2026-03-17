const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cloudinary storage configuration
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'shri-govind-pharmacy/agents',
        allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        public_id: (req, file) => {
            // For registration: use email + timestamp (agent doesn't have ID yet)
            // For profile updates: use agent ID
            const agentId = req.params.id || req.body.agentId;
            const email = req.body.email || 'unknown';
            const docType = file.fieldname;
            const timestamp = Date.now();

            // Clean email for use in filename (replace @ and . with underscores)
            const emailSafe = email.replace(/[@.]/g, '_').substring(0, 30);

            if (agentId) {
                return `agent_${agentId}_${docType}_${timestamp}`;
            } else {
                // For new registrations, use email instead of agentId
                // Special handling for profileImage
                if (docType === 'profileImage') {
                    return `agent_profile_${emailSafe}_${timestamp}`;
                }
                return `agent_register_${emailSafe}_${docType}_${timestamp}`;
            }
        }
    }
});

// Profile image storage configuration (images only, with transformation)
const profileStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'shri-govind-pharmacy/agent-profiles',
        allowed_formats: ['jpg', 'jpeg', 'png'],
        transformation: [
            { quality: 'auto', fetch_format: 'auto' },
            { width: 400, height: 400, gravity: 'face', crop: 'fill' }
        ],
        public_id: (req, file) => {
            const agentId = req.params.id || req.body.agentId;
            const email = req.body.email || 'unknown';
            const timestamp = Date.now();
            
            // Clean email for use in filename
            const emailSafe = email.replace(/[@.]/g, '_').substring(0, 30);
            
            if (agentId) {
                return `agent_profile_${agentId}_${timestamp}`;
            } else {
                return `agent_profile_${emailSafe}_${timestamp}`;
            }
        }
    }
});

// File filter - only allow images and PDFs
const fileFilter = (req, file, cb) => {
    // For profile images, only allow image formats
    if (file.fieldname === 'profileImage') {
        const allowedTypes = /jpeg|jpg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, PNG) are allowed for profile picture'));
        }
    } else {
        // For other documents, allow images and PDFs
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images (JPEG, PNG) and PDF files are allowed'));
        }
    }
};

// Upload middleware
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: fileFilter
});

// Profile image upload middleware
const uploadProfile = multer({
    storage: profileStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only allow image files for profile
        const allowedTypes = /jpeg|jpg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, PNG) are allowed for profile pictures'));
        }
    }
});

// Error handling middleware for multer
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size too large. Maximum size is 5MB'
            });
        }
        return res.status(400).json({
            success: false,
            message: `Upload error: ${err.message}`
        });
    } else if (err) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    next();
};

// Prescription upload storage configuration
const prescriptionStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'shri-govind-pharmacy/prescriptions',
        allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        public_id: (req, file) => {
            const userId = req.user?._id || 'unknown';
            const timestamp = Date.now();
            return `prescription_${userId}_${timestamp}`;
        }
    }
});

// Prescription upload middleware
const uploadPrescription = multer({
    storage: prescriptionStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images (JPEG, PNG) and PDF files are allowed for prescriptions'));
        }
    }
});

module.exports = {
    upload,
    uploadProfile,
    uploadPrescription,
    handleUploadError,
    cloudinary
};

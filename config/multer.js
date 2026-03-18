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

// Doctor profile image storage configuration (images only, with transformation)
const doctorStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'shri-govind-pharmacy/doctors',
        allowed_formats: ['jpg', 'jpeg', 'png'],
        transformation: [
            { quality: 'auto', fetch_format: 'auto' },
            { width: 400, height: 400, gravity: 'face', crop: 'fill' }
        ],
        public_id: (req, file) => {
            const doctorId = req.params.id || req.body.doctorId;
            const doctorName = req.body.name || 'unknown';
            const timestamp = Date.now();

            // Clean name for use in filename
            const nameSafe = doctorName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);

            if (doctorId) {
                return `doctor_profile_${doctorId}_${timestamp}`;
            } else {
                return `doctor_profile_${nameSafe}_${timestamp}`;
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

// Product image upload storage configuration (images only, with transformation)
const productStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'shri-govind-pharmacy/products',
        allowed_formats: ['jpg', 'jpeg', 'png'],
        transformation: [
            { quality: 'auto', fetch_format: 'auto' },
            { width: 600, height: 600, gravity: 'center', crop: 'fill' }
        ],
        public_id: (req, file) => {
            const productName = req.body.name || 'unknown';
            const timestamp = Date.now();

            // Clean name for use in filename
            const nameSafe = productName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);

            return `product_${nameSafe}_${timestamp}`;
        }
    }
});

// Product image upload middleware
const uploadProduct = multer({
    storage: productStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only allow image files for product
        const allowedTypes = /jpeg|jpg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        console.log('Product image upload - File:', {
            fieldname: file.fieldname,
            originalname: file.originalname,
            mimetype: file.mimetype,
            extname: path.extname(file.originalname).toLowerCase()
        });

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, JPG, PNG) are allowed for product image. Received: ' + file.mimetype));
        }
    }
});

// Doctor profile image upload middleware
const uploadDoctor = multer({
    storage: doctorStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only allow image files for doctor profile
        const allowedTypes = /jpeg|jpg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        console.log('Doctor image upload - File:', {
            fieldname: file.fieldname,
            originalname: file.originalname,
            mimetype: file.mimetype,
            extname: path.extname(file.originalname).toLowerCase()
        });

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, JPG, PNG) are allowed for doctor profile picture. Received: ' + file.mimetype));
        }
    }
});

// Delivery proof image upload storage configuration (images only)
const deliveryProofStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'shri-govind-pharmacy/delivery-proof',
        allowed_formats: ['jpg', 'jpeg', 'png'],
        transformation: [
            { quality: 'auto', fetch_format: 'auto' }
        ],
        public_id: (req, file) => {
            const orderId = req.params.orderId || req.body.orderId || 'unknown';
            const timestamp = Date.now();
            return `delivery_proof_${orderId}_${timestamp}`;
        }
    }
});

// Delivery proof image upload middleware
const uploadDeliveryProof = multer({
    storage: deliveryProofStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only allow image files for delivery proof
        const allowedTypes = /jpeg|jpg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        console.log('Delivery proof upload - File:', {
            fieldname: file.fieldname,
            originalname: file.originalname,
            mimetype: file.mimetype,
            extname: path.extname(file.originalname).toLowerCase()
        });

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, JPG, PNG) are allowed for delivery proof. Received: ' + file.mimetype));
        }
    }
});

// Error handling middleware for multer
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            req.fileValidationError = 'File size too large. Maximum size is 5MB';
            return next();
        }
        req.fileValidationError = `Upload error: ${err.message}`;
        return next();
    } else if (err) {
        req.fileValidationError = err.message;
        return next();
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
    uploadDoctor,
    uploadProduct,
    uploadPrescription,
    uploadDeliveryProof,
    handleUploadError,
    cloudinary
};

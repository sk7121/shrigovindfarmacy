const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { v2: cloudinary } = require("cloudinary");
const path = require("path");

// Configure Cloudinary with validation
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

// Validate Cloudinary configuration
if (
  !cloudinaryConfig.cloud_name ||
  !cloudinaryConfig.api_key ||
  !cloudinaryConfig.api_secret
) {
  console.error(
    "❌ Cloudinary configuration missing. Check environment variables:",
  );
  console.error(
    "   CLOUDINARY_CLOUD_NAME:",
    cloudinaryConfig.cloud_name ? "✅" : "❌ Missing",
  );
  console.error(
    "   CLOUDINARY_API_KEY:",
    cloudinaryConfig.api_key ? "✅" : "❌ Missing",
  );
  console.error(
    "   CLOUDINARY_API_SECRET:",
    cloudinaryConfig.api_secret ? "✅" : "❌ Missing",
  );
  throw new Error(
    "Cloudinary configuration is incomplete. Please check your .env file.",
  );
}

cloudinary.config(cloudinaryConfig);
console.log("✅ Cloudinary configured successfully");

// Cloudinary storage configuration
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "shri-govind-pharmacy/agents",
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
    transformation: [{ quality: "auto", fetch_format: "auto" }],
    public_id: (req, file) => {
      const timestamp = Date.now();

      let agentId = req.params.id || req.body.agentId;
      let email = (req.body.email || "unknown").toString().trim();
      let docType = (file.fieldname || "file").toString().trim();

      // 🔹 Clean function
      const clean = (value, fallback) => {
        let safe = value
          .toString()
          .trim()
          .replace(/[^a-zA-Z0-9\s]/g, "") // remove special chars
          .replace(/\s+/g, "_") // spaces → _
          .replace(/_+/g, "_") // ___ → _
          .substring(0, 30)
          .replace(/^_+|_+$/g, ""); // trim _

        return safe || fallback;
      };

      const safeEmail = clean(email, "agent");
      const safeDocType = clean(docType, "file");

      // 🔹 If agentId exists → use it
      if (agentId) {
        const safeAgentId = clean(agentId, "agent");
        return `agent_${safeAgentId}_${safeDocType}_${timestamp}`.trim();
      }

      // 🔹 New registration
      if (docType === "profileImage") {
        return `agent_profile_${safeEmail}_${timestamp}`.trim();
      }

      return `agent_register_${safeEmail}_${safeDocType}_${timestamp}`.trim();
    },
  },
});

// Profile image storage configuration (images only, with transformation)
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "shri-govind-pharmacy/agent-profiles",
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [
      { quality: "auto", fetch_format: "auto" },
      { width: 400, height: 400, gravity: "face", crop: "fill" },
    ],
    public_id: (req, file) => {
      const timestamp = Date.now();

      let agentId = req.params.id || req.body.agentId;
      let email = (req.body.email || "unknown").trim();

      // 🔹 Clean email
      let emailSafe = email
        .replace(/[^a-zA-Z0-9\s]/g, "") // remove special chars
        .replace(/\s+/g, "_") // spaces → _
        .replace(/_+/g, "_") // ___ → _
        .substring(0, 30)
        .replace(/^_+|_+$/g, ""); // trim _

      if (!emailSafe) emailSafe = "agent";

      // 🔹 Clean agentId
      if (agentId) {
        agentId = agentId
          .toString()
          .trim()
          .replace(/[^a-zA-Z0-9]/g, "");
        return `agent_profile_${agentId}_${timestamp}`.trim();
      }

      return `agent_profile_${emailSafe}_${timestamp}`.trim();
    },
  },
});

// Doctor profile image storage configuration (images only, with transformation)
const doctorStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "shri-govind-pharmacy/doctors",
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [
      { quality: "auto", fetch_format: "auto" },
      { width: 400, height: 400, gravity: "face", crop: "fill" },
    ],
    public_id: (req, file) => {
      const timestamp = Date.now();

      let doctorId = req.params.id || req.body.doctorId;
      let doctorName = (req.body.name || "unknown").trim();

      // 🔹 Clean doctor name
      let nameSafe = doctorName
        .replace(/[^a-zA-Z0-9\s]/g, "") // remove special chars
        .replace(/\s+/g, "_") // spaces → _
        .replace(/_+/g, "_") // ___ → _
        .substring(0, 30)
        .replace(/^_+|_+$/g, ""); // trim _

      if (!nameSafe) nameSafe = "doctor";

      // 🔹 Clean doctorId (if exists)
      if (doctorId) {
        doctorId = doctorId
          .toString()
          .trim()
          .replace(/[^a-zA-Z0-9]/g, "");
        return `doctor_profile_${doctorId}_${timestamp}`.trim();
      }

      return `doctor_profile_${nameSafe}_${timestamp}`.trim();
    },
  },
});

// File filter - only allow images and PDFs
const fileFilter = (req, file, cb) => {
  // For profile images, only allow image formats
  if (file.fieldname === "profileImage") {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Only image files (JPEG, PNG) are allowed for profile picture",
        ),
      );
    }
  } else {
    // For other documents, allow images and PDFs
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only images (JPEG, PNG) and PDF files are allowed"));
    }
  }
};

// Upload middleware
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

// Profile image upload middleware
const uploadProfile = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files for profile
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Only image files (JPEG, PNG) are allowed for profile pictures",
        ),
      );
    }
  },
});

// Product image upload storage configuration (images only, with transformation)
const productStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "shri-govind-pharmacy/products",
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [
      { quality: "auto", fetch_format: "auto" },
      { width: 600, height: 600, gravity: "center", crop: "fill" },
    ],
    public_id: (req, file) => {
      // Use original filename without extension as fallback, or product name if available
      let baseName = "";

      // Try to get product name from body (might not be available yet)
      if (req.body && req.body.name) {
        baseName = req.body.name.toString().trim();
      } else {
        // Fallback: use original filename without extension
        baseName = path.parse(file.originalname).name.trim();
      }

      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);

      // Aggressive sanitization: remove ALL non-alphanumeric chars
      const nameSafe = baseName
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, "")    // Remove everything except letters and numbers
        .substring(0, 25);                // Leave room for timestamp

      // Build public_id without folder prefix (folder is already set above)
      const publicId = `${nameSafe || 'product'}_${timestamp}_${randomString}`;

      console.log("Cloudinary public_id:", publicId);
      return publicId;
    },
  },
});

// Product image upload middleware
const uploadProduct = multer({
  storage: productStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files for product
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    console.log("Product image upload - File:", {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      extname: path.extname(file.originalname).toLowerCase(),
    });

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Only image files (JPEG, JPG, PNG) are allowed for product image. Received: " +
            file.mimetype,
        ),
      );
    }
  },
});

// Doctor profile image upload middleware
const uploadDoctor = multer({
  storage: doctorStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files for doctor profile
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    console.log("Doctor image upload - File:", {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      extname: path.extname(file.originalname).toLowerCase(),
    });

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Only image files (JPEG, JPG, PNG) are allowed for doctor profile picture. Received: " +
            file.mimetype,
        ),
      );
    }
  },
});

// Delivery proof image upload storage configuration (images only)
const deliveryProofStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "shri-govind-pharmacy/delivery-proof",
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [{ quality: "auto", fetch_format: "auto" }],
    public_id: (req, file) => {
      const timestamp = Date.now();

      let orderId = (req.params.orderId || req.body.orderId || "unknown")
        .toString()
        .trim();

      let safeOrderId = orderId
        .replace(/[^a-zA-Z0-9\s]/g, "") // remove special chars
        .replace(/\s+/g, "_") // space → _
        .replace(/_+/g, "_") // ___ → _
        .replace(/^_+|_+$/g, ""); // trim _

      if (!safeOrderId) {
        safeOrderId = "order";
      }

      return `delivery_proof_${safeOrderId}_${timestamp}`.trim();
    },
  },
});

// Delivery proof image upload middleware
const uploadDeliveryProof = multer({
  storage: deliveryProofStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files for delivery proof
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    console.log("Delivery proof upload - File:", {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      extname: path.extname(file.originalname).toLowerCase(),
    });

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Only image files (JPEG, JPG, PNG) are allowed for delivery proof. Received: " +
            file.mimetype,
        ),
      );
    }
  },
});

// Error handling middleware for multer
const handleUploadError = (err, req, res, next) => {
  console.error("❌ Upload error:", err);
  console.error("   Error type:", err.constructor.name);
  console.error("   Error message:", err.message);

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      req.fileValidationError = "File size too large. Maximum size is 5MB";
      return next();
    }
    req.fileValidationError = `Upload error: ${err.message}`;
    return next();
  } else if (err) {
    // Handle Cloudinary and other errors
    req.fileValidationError = err.message || "Failed to upload file";
    return next();
  }
  next();
};

// Prescription upload storage configuration
const prescriptionStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "shri-govind-pharmacy/prescriptions",
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
    transformation: [{ quality: "auto", fetch_format: "auto" }],
    public_id: (req, file) => {
      const timestamp = Date.now();

      let userId = (req.user?._id || "unknown").toString().trim();

      let safeUserId = userId
        .replace(/[^a-zA-Z0-9]/g, "") // remove special chars
        .substring(0, 30);

      if (!safeUserId) {
        safeUserId = "user";
      }

      return `prescription_${safeUserId}_${timestamp}`.trim();
    },
  },
});

// Prescription upload middleware
const uploadPrescription = multer({
  storage: prescriptionStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Only images (JPEG, PNG) and PDF files are allowed for prescriptions",
        ),
      );
    }
  },
});

module.exports = {
  upload,
  uploadProfile,
  uploadDoctor,
  uploadProduct,
  uploadPrescription,
  uploadDeliveryProof,
  handleUploadError,
  cloudinary,
};

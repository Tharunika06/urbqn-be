const multer = require('multer');
const path = require('path');

// --- Memory storage for base64 conversion ---
const memoryStorage = multer.memoryStorage();

// --- File filter for images only ---
const imageFilter = (req, file, cb) => {
  console.log(`🔍 Checking file: ${file.originalname}, mimetype: ${file.mimetype}`);
  
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    console.log(`✅ File accepted: ${file.originalname}`);
    return cb(null, true);
  } else {
    console.log(`❌ File rejected: ${file.originalname} - Invalid type`);
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'));
  }
};

// --- Base64 conversion middleware ---
const convertToBase64 = (req, res, next) => {
  try {
    // Handle .fields() approach for property photo
    if (req.files && req.files.photo && req.files.photo[0] && req.files.photo[0].buffer) {
      const file = req.files.photo[0];
      const base64Data = file.buffer.toString('base64');
      const mimeType = file.mimetype;
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      
      // Add base64 data to request object
      req.photoBase64 = dataUrl;
      req.photoInfo = {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadDate: new Date()
      };
      
      console.log(`📸 Converted property photo to base64: ${file.originalname} (${file.size} bytes)`);
      console.log(`💾 Base64 length: ${dataUrl.length} characters`);
    }

    // Handle single file approach (if needed for other routes)
    if (req.file && req.file.buffer) {
      const base64Data = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      
      req.photoBase64 = dataUrl;
      req.photoInfo = {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadDate: new Date()
      };
      
      console.log(`📸 Converted single property photo to base64: ${req.file.originalname}`);
    }

    next();
  } catch (error) {
    console.error('❌ Error converting to base64:', error);
    res.status(500).json({
      success: false,
      error: 'Base64 conversion failed',
      message: error.message
    });
  }
};

// --- Multer configuration ---
const uploadPropertyPhotoMulter = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (base64 is larger than binary)
  },
  fileFilter: imageFilter
}).fields([{ name: 'photo', maxCount: 1 }]);

// --- Error handling wrapper ---
const handleUploadError = (uploadFunction) => {
  return (req, res, next) => {
    uploadFunction(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        console.error('❌ Multer Error:', err);
        
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'File too large - File size should not exceed 10MB'
          });
        }
        
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            error: 'Too many files - Maximum 1 photo allowed'
          });
        }
        
        return res.status(400).json({
          error: 'Upload error: ' + err.message
        });
      } else if (err) {
        console.error('❌ Upload Error:', err);
        return res.status(400).json({
          error: 'Upload failed: ' + err.message
        });
      }
      
      // Log successful upload
      if (req.files && req.files.photo && req.files.photo[0]) {
        console.log('✅ Property photo uploaded to memory:', {
          filename: req.files.photo[0].originalname,
          size: req.files.photo[0].size,
          mimetype: req.files.photo[0].mimetype
        });
      }
      
      next();
    });
  };
};

// --- Combined middleware chain ---
const uploadPropertyPhoto = [
  handleUploadError(uploadPropertyPhotoMulter),
  convertToBase64
];

module.exports = {
  uploadPropertyPhoto
};
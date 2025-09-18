// server/src/middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Ensure upload directories exist ---
const baseUploadDir = path.join(__dirname, '../uploads');
const ownerUploadDir = path.join(baseUploadDir, 'owners');
const propertyUploadDir = path.join(baseUploadDir, 'properties');

[baseUploadDir, ownerUploadDir, propertyUploadDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// --- Storage Config ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (req.uploadType === 'owner') {
      cb(null, ownerUploadDir);
    } else if (req.uploadType === 'property') {
      cb(null, propertyUploadDir);
    } else {
      cb(new Error('Invalid upload type'));
    }
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// --- Multer Instance ---
const upload = multer({ storage });

module.exports = upload;

const multer = require('multer');

// store file in memory, not in disk
const storage = multer.memoryStorage();

// "profilePhoto" should match the field name from frontend FormData
const uploadAdminPhoto = multer({ storage }).single('profilePhoto');

module.exports = { uploadAdminPhoto };

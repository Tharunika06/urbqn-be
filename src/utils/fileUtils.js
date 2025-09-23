const fs = require('fs');
const path = require('path');

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const setupUploadDirectories = () => {
  const parentUploadDir = path.join(__dirname, '../uploads');
  const ownersUploadDir = path.join(__dirname, '../uploads/owners');
  
  ensureDirectoryExists(parentUploadDir);
  ensureDirectoryExists(ownersUploadDir);
};

module.exports = {
  ensureDirectoryExists,
  setupUploadDirectories
};
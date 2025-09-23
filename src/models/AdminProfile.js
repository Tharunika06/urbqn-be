const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  name: { type: String, default: "" },
  phone: { type: String, default: "" },
  photo: { type: String, default: "" } // stores base64 DataURL
});

module.exports = mongoose.model('Admin', adminSchema);

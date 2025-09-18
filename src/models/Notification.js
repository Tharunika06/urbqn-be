// server/src/models/Notification.js

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
type: { 
  type: String, 
  required: true, 
  enum: ["login", "signup", "transaction", "propertySale", "system", "review","property","owner"] 
},
 // what kind of event
  message: { type: String, required: true }, // notification text
  relatedId: { type: mongoose.Schema.Types.ObjectId, required: false }, // transaction/property ID
  time: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false }
});

module.exports = mongoose.model("Notification", notificationSchema);

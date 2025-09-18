// models/counter.js
const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 100 } // Start counting from 100
});

// ✅ Check if the model already exists
module.exports = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

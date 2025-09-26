const Counter = require("../models/Counter");

async function getNextSequenceValue(sequenceName) {
  try {
    const sequenceDocument = await Counter.findOneAndUpdate(
      { _id: sequenceName },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    return sequenceDocument.seq;
  } catch (error) {
    console.error("Error generating sequence:", error);
    throw error;
  }
}

module.exports = { getNextSequenceValue };

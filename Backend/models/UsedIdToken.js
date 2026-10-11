const mongoose = require("mongoose");

// Remembers which ID-card QR tokens have already been accepted so one can't be replayed.
// Rows delete themselves shortly after the token would have expired anyway.
const usedSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  expireAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

module.exports = mongoose.model("UsedIdToken", usedSchema);

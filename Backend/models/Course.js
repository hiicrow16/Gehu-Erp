const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "BCA"
    code: { type: String, required: true, unique: true, trim: true },
    department: { type: String, trim: true },
    durationYears: { type: Number, default: 3 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", courseSchema);

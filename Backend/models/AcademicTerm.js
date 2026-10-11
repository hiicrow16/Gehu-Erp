const mongoose = require("mongoose");

// A semester window, e.g. "2026-27 Odd Semester". Exactly one can be current.
const termSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    academicYear: { type: String, required: true, trim: true }, // "2026-27"
    type: { type: String, enum: ["Odd", "Even", "Summer"], default: "Odd" },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AcademicTerm", termSchema);

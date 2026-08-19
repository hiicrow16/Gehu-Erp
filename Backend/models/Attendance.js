const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["Present", "Absent"], required: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty" },
  },
  { timestamps: true }
);

// Prevent the same student being marked twice for the same subject on the same day
attendanceSchema.index({ student: 1, subject: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);

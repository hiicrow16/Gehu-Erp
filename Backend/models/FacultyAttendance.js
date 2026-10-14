const mongoose = require("mongoose");

// Daily check-in for faculty (first face scan of the day wins).
const facultyAttendanceSchema = new mongoose.Schema(
  {
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty", required: true },
    date: { type: Date, required: true }, // midnight UTC of the day
    checkIn: { type: Date, required: true },
    method: { type: String, enum: ["face", "manual"], default: "face" },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

facultyAttendanceSchema.index({ faculty: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("FacultyAttendance", facultyAttendanceSchema);

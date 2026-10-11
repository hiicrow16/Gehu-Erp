const mongoose = require("mongoose");

const timetableSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    semester: { type: Number, required: true, min: 1, max: 12 },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 }, // 0 = Sunday ... 6 = Saturday
    startTime: { type: String, required: true, match: /^\d{2}:\d{2}$/ }, // 24h "HH:MM"
    endTime: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    room: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Timetable", timetableSchema);

const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    semester: { type: Number, required: true, min: 1, max: 12 },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    title: { type: String, required: true, trim: true }, // e.g. "Mid-Term", "End-Term"
    date: { type: Date, required: true },
    startTime: { type: String, trim: true },
    venue: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Exam", examSchema);

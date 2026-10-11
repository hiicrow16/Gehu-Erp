const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    examTitle: { type: String, required: true, trim: true },
    marksObtained: { type: Number, required: true, min: 0 },
    maxMarks: { type: Number, required: true, min: 1 },
    // Students only ever see results once this is true
    published: { type: Boolean, default: false },
  },
  { timestamps: true }
);

resultSchema.index({ student: 1, subject: 1, examTitle: 1 }, { unique: true });

module.exports = mongoose.model("Result", resultSchema);

const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    semester: { type: Number, required: true, min: 1, max: 12 },
  },
  { timestamps: true }
);

// A subject code should be unique within a course
subjectSchema.index({ course: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("Subject", subjectSchema);

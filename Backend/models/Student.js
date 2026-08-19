const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    studentId: { type: String, required: true, unique: true, trim: true }, // college roll/ID number
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    semester: { type: Number, min: 1, max: 12 },
    department: { type: String, trim: true },
    admissionYear: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", studentSchema);
